import { getGenerationRecordById, createGenerationRecord, updateGenerationRecord } from '../generation-records/service'
import type { GenerationRecordPayload } from '../generation-records/shared'
import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import { getPublicModelCatalog, resolveGatewayProviderUpstream } from '../provider-config/service'
import {
  attachGenerationPointRecordId,
  consumeGenerationPoints,
  refundGenerationPoints,
  resolveGenerationPointCost,
} from '../marketing-center/service'
import { resolveGenerationTaskStrategy, type GenerationTaskStrategyKey } from './strategy'
import { buildAgentChatMessages } from '../../src/shared/agent-skills-core'
import {
  AgentWorkspaceStoppedError,
  getAgentWorkspaceSkillMeta,
  buildWorkspaceCompletionSummary,
  getWorkspaceRandomDelay,
  planAgentWorkspace,
  sleepWithWorkspaceAbort,
  workspaceTimingProfile,
} from './agent-workspace-runtime'
import {
  applyAgentWorkspaceEvent,
  buildAgentErrorRun,
  buildAgentPendingRun,
  buildAgentStoppedRun,
  type AgentWorkspaceEvent,
} from '../../src/shared/agent-workspace'
import { normalizeGenerationErrorMessage } from '../../src/shared/generation-error'
import {
  addTaskStreamSubscriber,
  deleteLocalRunningTask,
  getLocalRunningTask,
  hasLocalRunningTask,
  removeTaskStreamSubscriber,
  setLocalRunningTask,
  type LocalRunningGenerationTask,
} from './local-runtime'
import {
  clearSharedTaskAbortRequested,
  appendSharedTaskRecentEvent,
  getSharedTaskRuntime,
  hasSharedTaskAbortRequested,
  markSharedTaskAbortRequested,
  patchSharedTaskRuntime,
  setSharedTaskRuntime,
  setSharedTaskSnapshot,
} from './runtime-store'
import {
  cleanupDistributedTaskSubscriptionIfIdle,
  emitDistributedTaskStreamEvent,
  ensureDistributedTaskSubscription,
} from './event-bus'
import {
  acquireRedisLock,
  buildTaskSubmissionIdempotencyKey,
  claimIdempotencyKey,
  clearPendingIdempotencyKey,
  completeIdempotencyKey,
  REDIS_CONFIG,
  redisKeys,
  releaseRedisLock,
  releaseTaskConcurrencySlots,
  renewRedisLock,
  tryAcquireProviderTaskSlot,
  tryAcquireSkillTaskSlot,
  tryAcquireUserTaskSlot,
  type RedisConcurrencySlot,
  getRedisRuntimeSettings,
} from '../redis'
import { GenerationTaskRequestError } from './shared'
import { getGenerationTaskExecutionStrategy, type TaskAbortReason } from './execution-strategies'
import { executeImageTask } from './image-task-executor'
import { executeAgentChatTaskFlow } from './agent-chat-task-executor'
import { executeAgentWorkspaceTaskFlow } from './agent-workspace-task-executor'

type RunningGenerationTask = LocalRunningGenerationTask & {
  strategyKey: GenerationTaskStrategyKey
}

// 统一输出生成任务日志，方便排查离页后任务是否仍在服务端继续执行。
const logGenerationTask = (stage: string, detail: Record<string, unknown>) => {
  console.log('[generation-tasks]', stage, JSON.stringify(detail))
}

// 统一输出生成任务异常日志。
const logGenerationTaskError = (stage: string, error: unknown, detail: Record<string, unknown>) => {
  const err = error as { message?: string; stack?: string }
  console.error('[generation-tasks][service-error]', stage, JSON.stringify({
    ...detail,
    errorMessage: err?.message || '未知异常',
    errorStack: err?.stack || null,
  }))
}

// 统一给任务写入中断原因，避免把系统中断误判成用户主动停止。
const abortTaskWithReason = (task: RunningGenerationTask, reason: TaskAbortReason) => {
  task.abortController.abort(reason)
}

// 解析本次中断的真实原因，便于后续决定写成 stopped 还是 failed。
const resolveTaskAbortReason = (task: RunningGenerationTask): TaskAbortReason | '' => {
  const reason = task.abortController.signal.reason
  return typeof reason === 'string' ? reason as TaskAbortReason : ''
}

const BURST_RATE_RETRY_DELAYS = [1200, 2600, 5200]

const sleepWithAbortSignal = async (signal: AbortSignal, durationMs: number) => {
  if (durationMs <= 0) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, durationMs)

    const handleAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', handleAbort)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

const parseRetryAfterMs = (response: Response) => {
  const retryAfterValue = String(response.headers.get('retry-after') || '').trim()
  if (!retryAfterValue) {
    return 0
  }

  const seconds = Number(retryAfterValue)
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000
  }

  const retryAt = Date.parse(retryAfterValue)
  if (Number.isFinite(retryAt)) {
    return Math.max(retryAt - Date.now(), 0)
  }

  return 0
}

const isBurstRateLimitedResponse = (status: number, responseText: string) => {
  if (status === 429) {
    return true
  }

  const normalizedText = String(responseText || '').trim()
  if (!normalizedText) {
    return false
  }

  return /limit_burst_rate/i.test(normalizedText)
    || /Request rate increased too quickly/i.test(normalizedText)
}

const fetchWithBurstRateRetry = async (input: {
  url: string
  init: RequestInit
  signal: AbortSignal
  stage: string
  detail: Record<string, unknown>
  onRetry?: (retryState: {
    attempt: number
    waitDurationMs: number
    status: number
    errorPreview: string
    stage: string
  }) => Promise<void> | void
}) => {
  for (let attemptIndex = 0; attemptIndex <= BURST_RATE_RETRY_DELAYS.length; attemptIndex += 1) {
    const response = await fetch(input.url, {
      ...input.init,
      signal: input.signal,
    })

    if (response.ok) {
      return response
    }

    const responseText = await response.clone().text().catch(() => '')
    const isBurstRateLimited = isBurstRateLimitedResponse(response.status, responseText)
    if (!isBurstRateLimited || attemptIndex >= BURST_RATE_RETRY_DELAYS.length) {
      return response
    }

    const retryAfterMs = parseRetryAfterMs(response)
    const baseDelayMs = BURST_RATE_RETRY_DELAYS[attemptIndex]
    const jitterMs = Math.floor(Math.random() * 400)
    const waitDurationMs = Math.max(retryAfterMs, baseDelayMs + jitterMs)

    logGenerationTask(`${input.stage}:burst_rate_retry`, {
      ...input.detail,
      status: response.status,
      attempt: attemptIndex + 1,
      waitDurationMs,
      errorPreview: responseText.slice(0, 240),
    })

    await input.onRetry?.({
      attempt: attemptIndex + 1,
      waitDurationMs,
      status: response.status,
      errorPreview: responseText.slice(0, 240),
      stage: input.stage,
    })

    await sleepWithAbortSignal(input.signal, waitDurationMs)
  }

  throw new Error('上游请求重试流程异常结束')
}

const emitTaskStreamEvent = (recordId: string, event: GenerationTaskStreamEvent) => {
  if (event.record) {
    void setSharedTaskSnapshot(recordId, event.record).catch((error) => {
      logGenerationTaskError('task_snapshot_cache_failed', error, {
        recordId,
        eventType: event.type,
      })
    })
  }

  void appendSharedTaskRecentEvent(recordId, event).catch((error) => {
    logGenerationTaskError('task_recent_event_cache_failed', error, {
      recordId,
      eventType: event.type,
      stage: event.stage || null,
    })
  })

  emitDistributedTaskStreamEvent(recordId, event)
}

// 推送当前任务的业务阶段进度，让事件流更易理解。
const emitTaskProgressEvent = (recordId: string, input: {
  stage: string
  message: string
  done?: boolean
  stopped?: boolean
  record?: Record<string, unknown> | null
}) => {
  emitTaskStreamEvent(recordId, {
    type: 'progress',
    recordId,
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    stage: input.stage,
    message: input.message,
    record: input.record,
  })
}

// 向前端推送文本增量，供通用对话任务直接流式展示。
const emitTaskContentDeltaEvent = (recordId: string, input: {
  stage: string
  delta: string
  content: string
}) => {
  emitTaskStreamEvent(recordId, {
    type: 'content_delta',
    recordId,
    done: false,
    stopped: false,
    stage: input.stage,
    delta: input.delta,
    content: input.content,
    message: '对话内容持续生成中',
  })
}

// 向前端广播技能工作台事件，并同步附带最新记录快照。
const emitTaskAgentEvent = (recordId: string, input: {
  agentEvent: AgentWorkspaceEvent
  record?: Record<string, unknown> | null
  done?: boolean
  stopped?: boolean
  stage?: string
  message?: string
}) => {
  emitTaskStreamEvent(recordId, {
    type: 'agent_event',
    recordId,
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    record: input.record,
    stage: input.stage,
    message: input.message,
    agentEvent: input.agentEvent,
  })
}

const syncSharedTaskRuntime = async (
  task: RunningGenerationTask,
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped',
  extra?: Partial<Awaited<ReturnType<typeof getSharedTaskRuntime>>>,
) => {
  const now = new Date().toISOString()

  await patchSharedTaskRuntime(task.recordId, (current) => {
    const currentQueue = current?.queue
    const queueStartedAt = status === 'running'
      ? (currentQueue?.startedAt || now)
      : (currentQueue?.startedAt || '')
    const queueEnteredAt = currentQueue?.enteredAt || (status === 'queued' ? now : '')
    const queueWaitDurationMs = status === 'running' && queueEnteredAt
      ? Math.max(Date.parse(queueStartedAt) - Date.parse(queueEnteredAt), 0)
      : Number(currentQueue?.waitDurationMs || 0)

    return {
      recordId: task.recordId,
      userId: task.userId,
      type: task.type,
      strategyKey: task.strategyKey,
      status,
      updatedAt: now,
      providerId: task.billedProviderId,
      modelKey: task.billedModelKey,
      skillKey: current?.skillKey || '',
      queue: {
        enteredAt: queueEnteredAt,
        startedAt: queueStartedAt,
        waitDurationMs: queueWaitDurationMs,
        reason: currentQueue?.reason || '等待服务端执行',
      },
      retry: current?.retry || {
        totalRetryCount: 0,
        burstRateRetryCount: 0,
        lastRetryAt: '',
        lastRetryStage: '',
        lastWaitDurationMs: 0,
        lastStatusCode: 0,
        lastErrorPreview: '',
      },
      execution: {
        lockAcquiredAt: current?.execution?.lockAcquiredAt || '',
        lockLost: Boolean(current?.execution?.lockLost),
        completedAt: status === 'completed' || status === 'failed' || status === 'stopped'
          ? now
          : (current?.execution?.completedAt || ''),
        lastErrorAt: current?.execution?.lastErrorAt || '',
        lastErrorMessage: current?.execution?.lastErrorMessage || '',
      },
      ...(extra || {}),
    }
  })
}

// 记录任务排队、重试与执行阶段的治理信息，供后台 Redis 诊断页查看。
const markTaskRetryState = async (task: RunningGenerationTask, input: {
  attempt: number
  waitDurationMs: number
  status: number
  errorPreview: string
  stage: string
}) => {
  await patchSharedTaskRuntime(task.recordId, (current) => {
    if (!current) {
      return current
    }

    return {
      ...current,
      updatedAt: new Date().toISOString(),
      retry: {
        totalRetryCount: Math.max(Number(current.retry?.totalRetryCount || 0), input.attempt),
        burstRateRetryCount: Math.max(Number(current.retry?.burstRateRetryCount || 0), input.attempt),
        lastRetryAt: new Date().toISOString(),
        lastRetryStage: input.stage,
        lastWaitDurationMs: input.waitDurationMs,
        lastStatusCode: input.status,
        lastErrorPreview: input.errorPreview,
      },
    }
  })
}

const markTaskExecutionState = async (task: RunningGenerationTask, input: {
  lockAcquiredAt?: string
  lockLost?: boolean
  lastErrorAt?: string
  lastErrorMessage?: string
}) => {
  await patchSharedTaskRuntime(task.recordId, (current) => {
    if (!current) {
      return current
    }

    return {
      ...current,
      updatedAt: new Date().toISOString(),
      execution: {
        lockAcquiredAt: input.lockAcquiredAt ?? current.execution?.lockAcquiredAt ?? '',
        lockLost: typeof input.lockLost === 'boolean' ? input.lockLost : Boolean(current.execution?.lockLost),
        completedAt: current.execution?.completedAt || '',
        lastErrorAt: input.lastErrorAt ?? current.execution?.lastErrorAt ?? '',
        lastErrorMessage: input.lastErrorMessage ?? current.execution?.lastErrorMessage ?? '',
      },
    }
  })
}

// 同一个 recordId 在多实例下只能有一个真正执行者。
// 这里用 Redis 锁包住后台执行阶段，避免重复扣费、重复调上游、重复写结果。
const runTaskWithExecutionLock = async (
  task: RunningGenerationTask,
  runner: () => Promise<void>,
) => {
  const lockKey = redisKeys.taskLock(task.recordId)
  const executionLock = await acquireRedisLock(lockKey)
  if (!executionLock) {
    logGenerationTask('task_execution_skipped_by_lock', {
      recordId: task.recordId,
      userId: task.userId,
      strategyKey: task.strategyKey,
    })
    return false
  }

  await markTaskExecutionState(task, {
    lockAcquiredAt: new Date().toISOString(),
    lockLost: false,
  })

  const renewIntervalMs = Math.max(5_000, Math.floor(REDIS_CONFIG.taskLockTtlMs / 3))
  let renewTimer: ReturnType<typeof setInterval> | null = null
  let lockLost = false
  let lastSuccessfulRenewAt = Date.now()

  // 锁续租放在独立定时器里，避免长耗时任务执行期间锁自动过期。
  renewTimer = setInterval(() => {
    void renewRedisLock(executionLock).then((renewResult) => {
      if (renewResult.ok) {
        lastSuccessfulRenewAt = Date.now()
        return
      }

      const renewDeadlineExceeded = Date.now() - lastSuccessfulRenewAt >= REDIS_CONFIG.taskLockTtlMs
      const shouldAbortImmediately = renewResult.reason === 'ownership_lost'
      const shouldAbort = shouldAbortImmediately || renewDeadlineExceeded

      void markTaskExecutionState(task, {
        lockLost: shouldAbort,
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: shouldAbort
          ? '任务执行锁续租失败，任务已中断'
          : '任务执行锁续租异常，正在等待下一次恢复',
      })

      if (shouldAbort) {
        lockLost = true
        logGenerationTaskError('task_execution_lock_renew_failed', new Error(renewResult.reason), {
          recordId: task.recordId,
          userId: task.userId,
          strategyKey: task.strategyKey,
          renewReason: renewResult.reason,
          renewIntervalMs,
          taskLockTtlMs: REDIS_CONFIG.taskLockTtlMs,
          lastSuccessfulRenewAt: new Date(lastSuccessfulRenewAt).toISOString(),
        })
        abortTaskWithReason(task, 'execution_lock_lost')
        return
      }

      logGenerationTask('task_execution_lock_renew_retrying', {
        recordId: task.recordId,
        userId: task.userId,
        strategyKey: task.strategyKey,
        renewReason: renewResult.reason,
        renewIntervalMs,
        taskLockTtlMs: REDIS_CONFIG.taskLockTtlMs,
        lastSuccessfulRenewAt: new Date(lastSuccessfulRenewAt).toISOString(),
      })
    })
  }, renewIntervalMs)

  try {
    await runner()
    if (lockLost) {
      throw new Error('任务执行锁已失效，当前任务已中断')
    }
    return true
  } finally {
    if (renewTimer) {
      clearInterval(renewTimer)
    }
    await releaseRedisLock(executionLock)
  }
}

// 统一检查本地停止信号和 Redis 跨实例停止标记。
const ensureTaskNotAborted = async (task: RunningGenerationTask) => {
  if (task.abortController.signal.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const remoteAbortRequested = await hasSharedTaskAbortRequested(task.recordId)
  if (!remoteAbortRequested) {
    return
  }

  abortTaskWithReason(task, 'shared_stop')
  throw new DOMException('Aborted', 'AbortError')
}

// 当服务端内存里已经没有运行中的任务，但数据库里仍是未完成态时，
// 说明它多半是旧实例遗留或异常中断，需要主动回收，避免前端一直订阅。
const resolveTaskRecordSnapshot = async (recordId: string, currentUserId: string) => {
  let record = await getGenerationRecordById(recordId, currentUserId)
  const sharedRuntime = await getSharedTaskRuntime(recordId)

  if (
    !record.done
    && !record.stopped
    && !hasLocalRunningTask(recordId)
    && sharedRuntime?.status !== 'running'
    && sharedRuntime?.status !== 'queued'
  ) {
    await updateGenerationRecord(recordId, {
      type: record.type,
      prompt: record.prompt,
      content: record.content,
      error: record.error,
      model: record.model,
      modelKey: record.modelKey,
      ratio: record.ratio,
      resolution: record.resolution,
      duration: record.duration,
      feature: record.feature,
      skill: record.skill,
      done: true,
      stopped: true,
      images: record.images,
      agentRun: record.agentRun,
    }, currentUserId)

    record = await getGenerationRecordById(recordId, currentUserId)
  }

  return record
}

// 注册 SSE 订阅连接，并立即推送一次当前快照。
export const subscribeGenerationTaskStream = async (recordId: string, currentUserId: string, res: any) => {
  const record = await resolveTaskRecordSnapshot(recordId, currentUserId)

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  addTaskStreamSubscriber(recordId, res)
  await ensureDistributedTaskSubscription(recordId)

  res.write(`event: connected\ndata: ${JSON.stringify({
    type: 'connected',
    recordId,
    done: Boolean(record.done),
    stopped: Boolean(record.stopped),
    stage: record.done ? 'connected_completed' : 'connected_running',
    message: '任务事件流已连接',
  } satisfies GenerationTaskStreamEvent)}\n\n`)
  res.write(`event: snapshot\ndata: ${JSON.stringify({
    type: 'snapshot',
    recordId,
    done: Boolean(record.done),
    stopped: Boolean(record.stopped),
    record,
    stage: record.done ? 'snapshot_completed' : 'snapshot_running',
    message: record.done ? '已返回任务最终快照' : '已返回任务当前快照',
  } satisfies GenerationTaskStreamEvent)}\n\n`)

  // 已完成任务只需要返回一次快照，避免继续挂长连接和心跳。
  if (record.done) {
    res.end()
    return
  }

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      // 连接写入失败时，由 close 事件统一清理。
    }
  }, 15000)

  const cleanup = () => {
    clearInterval(heartbeatTimer)
    removeTaskStreamSubscriber(recordId, res)
    void cleanupDistributedTaskSubscriptionIfIdle(recordId)
  }

  res.on('close', cleanup)
  res.on('error', cleanup)
}

const buildGatewayAssociationNo = () => {
  return `GTK${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

const isChatCompletionsEndpoint = (endpoint: string) => {
  return /chat\/completions/i.test(String(endpoint || '').trim())
}

const buildInitialRecordPayload = (payload: GenerationTaskStartPayload): GenerationRecordPayload => ({
  sessionId: String(payload.sessionId || '').trim() || undefined,
  type: payload.type,
  prompt: String(payload.prompt || '').trim(),
  content: '',
  error: '',
  model: String(payload.model || '').trim(),
  modelKey: String(payload.modelKey || '').trim(),
  ratio: String(payload.ratio || '').trim(),
  resolution: String(payload.resolution || '').trim(),
  duration: String(payload.duration || '').trim(),
  feature: String(payload.feature || '').trim(),
  skill: String(payload.skill || '').trim() || 'general',
  referenceImages: Array.isArray(payload.referenceImages) ? [...payload.referenceImages] : [],
  done: false,
  stopped: false,
  images: [],
})

// 统一构造任务执行策略上下文，先把停止/失败收口逻辑从中心 service 中迁出。
const buildTaskExecutionStrategyContext = () => ({
  executeImageGenerationTask,
  executeAgentChatTask,
  executeAgentWorkspaceTask,
  refundTaskPointsIfNeeded,
  markTaskExecutionState,
  emitTaskProgressEvent,
  emitTaskStreamEvent,
  buildInitialRecordPayload,
  updateGenerationRecord,
  getGenerationRecordById,
  syncSharedTaskRuntime,
  buildAgentStoppedRun: (agentRun: Record<string, unknown>, message: string) => buildAgentStoppedRun(agentRun as any, message) as unknown as Record<string, unknown>,
  buildAgentErrorRun: (agentRun: Record<string, unknown>, message: string) => buildAgentErrorRun(agentRun as any, message) as unknown as Record<string, unknown>,
  normalizeGenerationErrorMessage,
  logGenerationTask,
  logGenerationTaskError,
})

const buildGenerationTaskIdempotencyKey = (input: {
  payload: GenerationTaskStartPayload
  userId: string
  strategyKey: string
  providerId: string
  modelKey: string
}) => {
  return buildTaskSubmissionIdempotencyKey({
    userId: input.userId,
    strategyKey: input.strategyKey,
    providerId: input.providerId,
    modelKey: input.modelKey,
    skill: String(input.payload.skill || '').trim(),
    prompt: String(input.payload.prompt || '').trim(),
    requestMode: String(input.payload.requestMode || '').trim(),
    referenceImages: Array.isArray(input.payload.referenceImages) ? input.payload.referenceImages : [],
    requestBody: input.payload.requestBody || null,
  })
}

const resolveTaskSkillKey = (payload: GenerationTaskStartPayload, strategyKey: GenerationTaskStrategyKey) => {
  return String(payload.skill || '').trim() || strategyKey || 'general'
}

// 统一申请生成任务占用的并发槽位，避免单个用户或单个厂商被瞬时流量打满。
const acquireTaskConcurrencySlots = async (input: {
  userId: string
  providerId: string
  skillKey: string
}) => {
  const acquiredSlots: RedisConcurrencySlot[] = []
  const runtimeSettings = await getRedisRuntimeSettings()

  const userResult = await tryAcquireUserTaskSlot(input.userId, runtimeSettings.taskUserConcurrencyLimit)
  if (!userResult.acquired || !userResult.slot) {
    throw new GenerationTaskRequestError(429, `当前账号正在执行的任务过多，请稍后再试（上限 ${userResult.limit}）`)
  }
  acquiredSlots.push(userResult.slot)

  try {
    const skillResult = await tryAcquireSkillTaskSlot(input.skillKey, runtimeSettings.taskSkillConcurrencyLimit)
    if (!skillResult.acquired || !skillResult.slot) {
      throw new GenerationTaskRequestError(429, `当前技能任务较多，请稍后再试（上限 ${skillResult.limit}）`)
    }
    acquiredSlots.push(skillResult.slot)

    if (input.providerId) {
      const providerResult = await tryAcquireProviderTaskSlot(input.providerId, runtimeSettings.taskProviderConcurrencyLimit)
      if (!providerResult.acquired || !providerResult.slot) {
        throw new GenerationTaskRequestError(429, `当前模型厂商任务较多，请稍后再试（上限 ${providerResult.limit}）`)
      }
      acquiredSlots.push(providerResult.slot)
    }

    return acquiredSlots
  } catch (error) {
    await releaseTaskConcurrencySlots(acquiredSlots)
    throw error
  }
}

const extractImageUrlsFromJsonResponse = (result: any) => {
  const urls: string[] = []

  if (!Array.isArray(result?.data)) {
    return urls
  }

  for (const item of result.data) {
    if (item?.url) {
      urls.push(item.url)
      continue
    }

    if (item?.b64_json) {
      urls.push(`data:image/png;base64,${item.b64_json}`)
    }
  }

  return urls
}

const extractImageUrlsFromStreamResponse = async (response: Response, signal: AbortSignal) => {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('图片流式响应缺少可读数据')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  const imageUrls: string[] = []

  while (!signal.aborted) {
    let readResult: ReadableStreamReadResult<Uint8Array>
    try {
      readResult = await reader.read()
    } catch {
      break
    }

    const { done, value } = readResult
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let boundaryIndex = -1
    while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
      const message = buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex + 2)

      for (const line of message.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const chunk = trimmed.slice(5).trim()
        if (chunk === '[DONE]') continue

        try {
          const parsed = JSON.parse(chunk)
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content) fullContent += delta.content
          if (Array.isArray(delta?.images)) {
            for (const img of delta.images) {
              const url = img?.image_url?.url
              if (url) imageUrls.push(url)
            }
          }
          if (delta?.inline_data?.data) {
            imageUrls.push(`data:${delta.inline_data.mime_type};base64,${delta.inline_data.data}`)
          }
        } catch {
          // 跳过无效 SSE 数据块，继续处理后续消息。
        }
      }
    }
  }

  const markdownImages = fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)
  if (markdownImages) {
    for (const item of markdownImages) {
      const matched = item.match(/\((https?:\/\/[^\s)]+)\)/)
      if (matched?.[1]) {
        imageUrls.push(matched[1])
      }
    }
  }

  const base64Image = fullContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
  if (base64Image?.[0]) {
    imageUrls.push(base64Image[0])
  }

  return imageUrls
}

const requestImageGeneration = async (input: {
  signal: AbortSignal
  providerId: string
  modelKey: string
  requestBody: Record<string, unknown>
  onRetry?: (retryState: {
    attempt: number
    waitDurationMs: number
    status: number
    errorPreview: string
    stage: string
  }) => Promise<void> | void
}) => {
  const upstream = await resolveGatewayProviderUpstream({
    providerId: input.providerId,
    endpointType: 'image',
    modelKey: input.modelKey,
  })

  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const requestBody = {
    ...input.requestBody,
    model: input.modelKey,
  }
  delete (requestBody as Record<string, unknown>).providerId

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  const response = await fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: 'image_generation',
    detail: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      endpointType: 'image',
    },
    onRetry: input.onRetry,
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(normalizeGenerationErrorMessage(
      responseText,
      `图片生成失败 (${response.status})`,
    ))
  }

  const imageUrls = isChatCompletionsEndpoint(upstream.endpoint)
    ? await extractImageUrlsFromStreamResponse(response, input.signal)
    : extractImageUrlsFromJsonResponse(await response.json())

  if (!imageUrls.length) {
    throw new Error('未能获取到生成的图片')
  }

  return {
    upstreamUrl,
    imageUrls,
  }
}

const inferReferenceImageMimeType = (value: string) => {
  const normalizedValue = String(value || '').trim()
  if (/^data:image\/png/i.test(normalizedValue)) return 'image/png'
  if (/^data:image\/webp/i.test(normalizedValue)) return 'image/webp'
  if (/^data:image\/gif/i.test(normalizedValue)) return 'image/gif'
  if (/^data:image\/bmp/i.test(normalizedValue)) return 'image/bmp'
  if (/^data:image\/svg\+xml/i.test(normalizedValue)) return 'image/svg+xml'
  if (/^data:image\/jpe?g/i.test(normalizedValue)) return 'image/jpeg'
  return 'image/png'
}

const sanitizeReferenceImageExtension = (mimeType: string) => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'image/bmp':
      return 'bmp'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'png'
  }
}

const decodeReferenceImageToBlob = async (value: string) => {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    throw new Error('参考图内容为空')
  }

  if (/^data:/i.test(normalizedValue)) {
    const response = await fetch(normalizedValue)
    const blob = await response.blob()
    return {
      blob,
      mimeType: blob.type || inferReferenceImageMimeType(normalizedValue),
    }
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    const response = await fetch(normalizedValue)
    if (!response.ok) {
      throw new Error(`参考图下载失败 (${response.status})`)
    }
    const blob = await response.blob()
    return {
      blob,
      mimeType: blob.type || inferReferenceImageMimeType(normalizedValue),
    }
  }

  throw new Error('暂不支持当前参考图格式，请重新上传图片后再试')
}

const requestImageEdit = async (input: {
  signal: AbortSignal
  providerId: string
  modelKey: string
  prompt: string
  size?: string
  referenceImages: string[]
  onRetry?: (retryState: {
    attempt: number
    waitDurationMs: number
    status: number
    errorPreview: string
    stage: string
  }) => Promise<void> | void
}) => {
  const upstream = await resolveGatewayProviderUpstream({
    providerId: input.providerId,
    endpointType: 'image-edit',
    modelKey: input.modelKey,
  })

  const formData = new FormData()
  formData.set('model', input.modelKey)
  formData.set('prompt', input.prompt)
  formData.set('n', '1')
  if (input.size) {
    formData.set('size', input.size)
  }

  for (let index = 0; index < input.referenceImages.length; index += 1) {
    const { blob, mimeType } = await decodeReferenceImageToBlob(input.referenceImages[index])
    formData.append(
      'image',
      blob,
      `reference-${index + 1}.${sanitizeReferenceImageExtension(mimeType)}`,
    )
  }

  const headers = new Headers()
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  const response = await fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: 'image_edit',
    detail: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      endpointType: 'image-edit',
      referenceImageCount: input.referenceImages.length,
    },
    onRetry: input.onRetry,
    init: {
      method: 'POST',
      headers,
      body: formData,
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(normalizeGenerationErrorMessage(
      responseText,
      `图片编辑失败 (${response.status})`,
    ))
  }

  const imageUrls = extractImageUrlsFromJsonResponse(await response.json())
  if (!imageUrls.length) {
    throw new Error('未能获取到编辑后的图片')
  }

  return {
    upstreamUrl,
    imageUrls,
  }
}

const resolveWorkspaceImageModel = async (binding?: {
  providerId: string
  modelKey: string
}) => {
  const catalog = await getPublicModelCatalog()
  if (binding?.providerId && binding?.modelKey) {
    const matchedImageModel = catalog.models.image.find(item => {
      return item.providerId === binding.providerId && item.modelKey === binding.modelKey
    })
    if (!matchedImageModel) {
      throw new Error('当前技能绑定的图片模型不可用，请在后台技能配置中重新选择')
    }
    return matchedImageModel
  }

  const imageModel = catalog.models.image[0]
  if (!imageModel) {
    throw new Error('未配置可用图片模型，请先在后台启用图片模型')
  }

  return imageModel
}

const executeImageGenerationTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  await executeImageTask(task, payload, {
    syncSharedTaskRuntime,
    ensureTaskNotAborted,
    emitTaskProgressEvent,
    markTaskRetryState,
    requestImageGeneration,
    requestImageEdit,
    buildInitialRecordPayload,
    updateGenerationRecord,
    getGenerationRecordById,
    emitTaskStreamEvent,
    logGenerationTask,
  })
}

const persistAgentTaskContentIfNeeded = async (input: {
  task: RunningGenerationTask
  payload: GenerationTaskStartPayload
  content: string
  force?: boolean
}, state: {
  lastPersistAt: number
  lastPersistContentLength: number
}) => {
  const now = Date.now()
  const shouldPersist = Boolean(input.force)
    || (input.content.length - state.lastPersistContentLength >= 24)
    || (now - state.lastPersistAt >= 400)

  if (!shouldPersist) {
    return
  }

  await updateGenerationRecord(input.task.recordId, {
    ...buildInitialRecordPayload(input.payload),
    content: input.content,
    done: false,
    stopped: false,
  }, input.task.userId)

  state.lastPersistAt = now
  state.lastPersistContentLength = input.content.length
}

const extractChatTextFromNonStreamResponse = async (response: Response) => {
  const result = await response.json().catch(() => null as any)
  const messageContent = result?.choices?.[0]?.message?.content
  if (typeof messageContent === 'string' && messageContent.trim()) {
    return messageContent
  }
  return ''
}

const extractChatTextFromJsonPayload = (result: any) => {
  const normalizeContentValue = (value: unknown): string => {
    if (typeof value === 'string' && value.trim()) {
      return value
    }

    if (Array.isArray(value)) {
      const joined = value
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>
            if (typeof record.text === 'string') {
              return record.text
            }
            if (typeof record.content === 'string') {
              return record.content
            }
          }
          return ''
        })
        .filter(Boolean)
        .join('')
      if (joined.trim()) {
        return joined
      }
    }

    return ''
  }

  const candidates = [
    result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.delta?.content,
    result?.choices?.[0]?.delta?.reasoning_content,
    result?.choices?.[0]?.text,
    result?.message?.content,
    result?.delta?.content,
    result?.content,
    result?.text,
    result?.response,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeContentValue(candidate)
    if (normalized) {
      return normalized
    }
  }

  return ''
}

const parseChatChunkText = (chunk: string) => {
  try {
    const parsed = JSON.parse(chunk)
    return extractChatTextFromJsonPayload(parsed)
  } catch {
    return ''
  }
}

const parseChatChunkError = (chunk: string) => {
  try {
    const parsed = JSON.parse(chunk)
    const errorMessage = parsed?.error?.message
    if (typeof errorMessage === 'string' && errorMessage.trim()) {
      return errorMessage.trim()
    }
    return ''
  } catch {
    return ''
  }
}

interface AgentWorkspaceModelPlanResult {
  analysisLines: string[]
  workflowLabel?: string
  workflowParams?: Record<string, unknown>
  planItems?: string[]
  imageTasks?: Array<{
    label: string
    promptText: string
  }>
  submitLines: string[]
  rawTextPreview?: string
}

const extractJsonObjectFromText = (text: string) => {
  const normalized = String(text || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    return normalized
  }

  const startIndex = normalized.indexOf('{')
  if (startIndex === -1) {
    return ''
  }

  let depth = 0
  for (let index = startIndex; index < normalized.length; index += 1) {
    const currentChar = normalized[index]
    if (currentChar === '{') {
      depth += 1
    } else if (currentChar === '}') {
      depth -= 1
      if (depth === 0) {
        return normalized.slice(startIndex, index + 1)
      }
    }
  }

  return ''
}

const readChatResponseText = async (response: Response, signal: AbortSignal) => {
  if (!response.body) {
    return await extractChatTextFromNonStreamResponse(response)
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('text/event-stream')) {
    const rawText = await response.text().catch(() => '')
    if (!rawText.trim()) {
      return ''
    }

    try {
      const parsed = JSON.parse(rawText)
      const extractedText = extractChatTextFromJsonPayload(parsed)
      return extractedText || rawText
    } catch {
      return rawText
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let streamErrorMessage = ''

  while (!signal.aborted) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) {
        continue
      }

      const chunk = trimmed.slice(5).trim()
      if (!chunk || chunk === '[DONE]') {
        continue
      }

      const chunkError = parseChatChunkError(chunk)
      if (chunkError) {
        streamErrorMessage = chunkError
        break
      }

      fullContent += parseChatChunkText(chunk)
    }

    if (streamErrorMessage) {
      break
    }
  }

  if (streamErrorMessage) {
    throw new Error(streamErrorMessage)
  }

  return fullContent
}

const requestAgentWorkspaceModelPlan = async (input: {
  signal: AbortSignal
  providerId: string
  modelKey: string
  skill: string
  skillLabel: string
  workspaceSkillKey: string
  dependencySkillKeys?: string[]
  prompt: string
  referenceImages?: string[]
}) => {
  const upstream = await resolveGatewayProviderUpstream({
    providerId: input.providerId,
    endpointType: 'chat',
    modelKey: input.modelKey,
  })

  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const messages = [
    ...buildAgentChatMessages(input.skill, input.prompt, input.referenceImages),
    {
      role: 'system',
      content: [
        '你是一个 AI 技能工作流规划器。',
        '你需要先理解用户需求，再输出适合图片生成的结构化执行计划。',
        '必须返回纯 JSON，不要输出 Markdown，不要输出解释。',
        'JSON 字段固定为：analysis_lines, workflow_label, workflow_params, plan_items, image_tasks, submit_lines。',
        'analysis_lines 至少 3 条，用中文简洁说明：需求理解、技能匹配、执行策略。',
        `当前技能展示名：${input.skillLabel}。当前技能键：${input.workspaceSkillKey}。`,
        input.dependencySkillKeys?.length ? `依赖技能键：${input.dependencySkillKeys.join('、')}。` : '当前无依赖技能。',
        input.referenceImages?.length ? `当前还提供了 ${input.referenceImages.length} 张参考图，你必须结合这些参考图理解主体、风格、构图或保留要求。` : '当前没有提供参考图。',
        'workflow_params.workflow_type 当前仅允许 text_to_image。',
        'plan_items 和 image_tasks 默认给 4 项，并保持一一对应。',
        '每个 image_tasks 元素必须包含 label 和 promptText；promptText 要适合直接用于图片生成，必须中文，且彼此有明确差异。',
        'submit_lines 给 1 到 2 条，用于描述将如何提交并回传结果。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `用户需求：${input.prompt}`,
        '请基于当前技能生成结构化工作流计划。',
      ].join('\n'),
    },
  ]

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  const response = await fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: 'agent_workspace_planner',
    detail: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      endpointType: 'chat',
      skill: input.skill,
    },
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: input.modelKey,
        stream: false,
        messages,
        temperature: 0.6,
      }),
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `规划模型调用失败 (${response.status})`)
  }

  const rawText = await readChatResponseText(response, input.signal)
  const jsonText = extractJsonObjectFromText(rawText)
  if (!jsonText) {
    throw new Error('规划模型未返回有效 JSON')
  }

  const parsed = JSON.parse(jsonText) as Record<string, unknown>
  const analysisLines = Array.isArray(parsed.analysis_lines)
    ? parsed.analysis_lines.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const submitLines = Array.isArray(parsed.submit_lines)
    ? parsed.submit_lines.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const planItems = Array.isArray(parsed.plan_items)
    ? parsed.plan_items.map((item) => {
        if (typeof item === 'string') {
          return item.trim()
        }

        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          return String(record.title || record.label || record.text || '').trim()
        }

        return ''
      }).filter(Boolean)
    : []
  const imageTasks = Array.isArray(parsed.image_tasks)
    ? parsed.image_tasks.map((item) => {
        const record = item as Record<string, unknown>
        return {
          label: String(record.label || '').trim(),
          promptText: String(record.promptText || record.prompt_text || '').trim(),
        }
      }).filter(item => item.label && item.promptText)
    : []

  const workflowParams = parsed.workflow_params && typeof parsed.workflow_params === 'object'
    ? parsed.workflow_params as Record<string, unknown>
    : undefined

  const hasUsablePlan = analysisLines.length >= 2
    || submitLines.length >= 1
    || planItems.length >= 2
    || imageTasks.length >= 2
    || Boolean(String(parsed.workflow_label || '').trim())

  if (!hasUsablePlan) {
    throw new Error(`规划模型返回内容不完整：${jsonText.slice(0, 240)}`)
  }

  if (workflowParams?.workflow_type && workflowParams.workflow_type !== 'text_to_image') {
    throw new Error(`规划模型返回了不支持的工作流类型：${String(workflowParams.workflow_type)}`)
  }

  return {
    analysisLines,
    workflowLabel: String(parsed.workflow_label || '').trim() || undefined,
    workflowParams,
    planItems,
    imageTasks,
    submitLines,
    rawTextPreview: rawText.slice(0, 400),
  } satisfies AgentWorkspaceModelPlanResult
}

const executeAgentChatTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  await executeAgentChatTaskFlow(task, payload, {
    syncSharedTaskRuntime,
    ensureTaskNotAborted,
    resolveGatewayProviderUpstream,
    emitTaskProgressEvent,
    fetchWithBurstRateRetry,
    markTaskRetryState,
    extractChatTextFromNonStreamResponse,
    parseChatChunkError,
    parseChatChunkText,
    extractChatTextFromJsonPayload,
    emitTaskContentDeltaEvent,
    persistAgentTaskContentIfNeeded,
    buildInitialRecordPayload,
    updateGenerationRecord,
    getGenerationRecordById,
    emitTaskStreamEvent,
    logGenerationTask,
  })
}

const persistAgentWorkspaceRecord = async (input: {
  task: RunningGenerationTask
  payload: GenerationTaskStartPayload
  agentRun: Record<string, unknown>
  done?: boolean
  stopped?: boolean
  error?: string
}) => {
  const agentRunImages = Array.isArray((input.agentRun as any)?.result?.images)
    ? ((input.agentRun as any).result.images as Array<Record<string, unknown>>)
    : []

  await updateGenerationRecord(input.task.recordId, {
    ...buildInitialRecordPayload(input.payload),
    content: '',
    agentRun: input.agentRun,
    referenceImages: undefined,
    outputs: agentRunImages
      .filter((image) => String(image?.imageSrc || '').trim())
      .map((image, index) => ({
        outputType: 'image' as const,
        url: String(image.imageSrc || '').trim(),
        sortOrder: index,
        metaJson: {
          promptText: String(image.promptText || '').trim(),
        },
      })),
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    error: input.error || '',
  }, input.task.userId)

  return getGenerationRecordById(input.task.recordId, input.task.userId)
}

const executeAgentWorkspaceTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  await executeAgentWorkspaceTaskFlow(task, payload, {
    syncSharedTaskRuntime,
    ensureTaskNotAborted,
    getAgentWorkspaceSkillMeta,
    buildAgentPendingRun: (recordId, query, skill, referenceImages) => (
      buildAgentPendingRun(recordId, query, skill, referenceImages) as unknown as Record<string, unknown>
    ),
    applyAgentWorkspaceEvent: (currentRun, agentEvent) => (
      applyAgentWorkspaceEvent(currentRun as any, agentEvent) as unknown as Record<string, unknown>
    ),
    persistAgentWorkspaceRecord,
    emitTaskProgressEvent,
    emitTaskAgentEvent,
    sleepWithWorkspaceAbort,
    getWorkspaceRandomDelay,
    workspaceTimingProfile,
    planAgentWorkspace,
    requestAgentWorkspaceModelPlan,
    logGenerationTask,
    logGenerationTaskError,
    resolveWorkspaceImageModel,
    requestImageEdit,
    requestImageGeneration,
    markTaskRetryState,
    refundTaskPointsIfNeeded,
    normalizeGenerationErrorMessage,
    buildWorkspaceCompletionSummary,
    AgentWorkspaceStoppedError,
  })
}

const refundTaskPointsIfNeeded = async (task: RunningGenerationTask, reason: string) => {
  if (!task.billedPointCost || task.refundCommitted) {
    return
  }

  task.refundCommitted = true
  await refundGenerationPoints({
    userId: task.userId,
    pointCost: task.billedPointCost,
    sourceId: task.associationNo,
    associationNo: task.associationNo,
    endpointType: task.billedEndpointType,
    providerId: task.billedProviderId,
    modelKey: task.billedModelKey,
    modelName: task.billedModelName,
    metaJson: {
      refundReason: reason,
      generationRecordId: task.recordId,
    },
  })
}

// 统一按策略键分派后台执行器，避免图片/Agent 两套后台壳逻辑重复演化。
const runTaskInBackground = (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  void (async () => {
    let ownsExecution = false
    const executionStrategy = getGenerationTaskExecutionStrategy(task.strategyKey)
    const executionStrategyContext = buildTaskExecutionStrategyContext()

    try {
      ownsExecution = await runTaskWithExecutionLock(task, async () => {
        await executionStrategy.execute(task, payload, executionStrategyContext)
      })
    } catch (error) {
      const isAbortError = error instanceof DOMException
        ? error.name === 'AbortError'
        : error instanceof Error && /abort/i.test(String(error.name || error.message || ''))
      const abortReason = resolveTaskAbortReason(task)

      if (isAbortError && (abortReason === 'user_stop' || abortReason === 'shared_stop')) {
        await executionStrategy.handleStopped(task, payload, executionStrategyContext)
      } else {
        const errorMessage = executionStrategy.resolveFailureMessage(error, abortReason, executionStrategyContext)
        await executionStrategy.handleFailed(task, payload, error, errorMessage, executionStrategyContext)
      }
    } finally {
      deleteLocalRunningTask(task.recordId)
      await releaseTaskConcurrencySlots(task.concurrencySlots)
      if (ownsExecution) {
        await clearSharedTaskAbortRequested(task.recordId)
      }
    }
  })()
}

// 创建新的生成任务，并立即把运行态记录持久化。
export const startGenerationTask = async (payload: GenerationTaskStartPayload, currentUserId: string) => {
  const strategy = resolveGenerationTaskStrategy(payload)
  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  const modelKey = String(payload.modelKey || '').trim()
  const skillKey = resolveTaskSkillKey(payload, strategy.key)
  const idempotencyKey = buildGenerationTaskIdempotencyKey({
    payload,
    userId: currentUserId,
    strategyKey: strategy.key,
    providerId,
    modelKey,
  })
  const idempotencyClaim = await claimIdempotencyKey<{ recordId?: string }>(idempotencyKey)

  if (idempotencyClaim.state === 'completed' && idempotencyClaim.data?.recordId) {
    return getGenerationRecordById(String(idempotencyClaim.data.recordId), currentUserId)
  }

  if (idempotencyClaim.state === 'in_progress') {
    throw new GenerationTaskRequestError(409, '检测到相同任务正在处理中，请稍候查看结果')
  }

  let concurrencySlots: RedisConcurrencySlot[] = []

  try {
    if (strategy.key === 'agent-chat') {
      if (!providerId) {
        throw new GenerationTaskRequestError(400, '未匹配到后台模型配置，请先在后台配置可用模型')
      }

      if (!modelKey) {
        throw new GenerationTaskRequestError(400, '缺少对话模型标识')
      }

      concurrencySlots = await acquireTaskConcurrencySlots({
        userId: currentUserId,
        providerId,
        skillKey,
      })

      const billingDetail = await resolveGenerationPointCost({
        providerId,
        modelKey,
        endpointType: 'chat',
      })

      const associationNo = buildGatewayAssociationNo()
      const pointLog = billingDetail.pointCost > 0
        ? await consumeGenerationPoints({
          userId: currentUserId,
          pointCost: billingDetail.pointCost,
          sourceId: associationNo,
          associationNo,
          endpointType: 'chat',
          providerId,
          modelKey,
          modelName: billingDetail.modelName,
          metaJson: {
            source: 'generation-task',
            taskType: 'agent-chat',
          },
        })
        : null

      const createdRecord = await createGenerationRecord(buildInitialRecordPayload(payload), currentUserId)
      await attachGenerationPointRecordId({
        associationNo,
        userId: currentUserId,
        generationRecordId: createdRecord.id,
      })
      await completeIdempotencyKey(idempotencyKey, idempotencyClaim.token, {
        recordId: createdRecord.id,
      })

      const task: RunningGenerationTask = {
        recordId: createdRecord.id,
        userId: currentUserId,
        type: 'agent',
        strategyKey: strategy.key,
        abortController: new AbortController(),
        associationNo,
        billedEndpointType: 'chat',
        billedPointCost: pointLog ? billingDetail.pointCost : 0,
        billedProviderId: providerId,
        billedModelKey: modelKey,
        billedModelName: billingDetail.modelName || String(payload.model || '').trim(),
        refundCommitted: false,
        concurrencySlots,
      }

      setLocalRunningTask(task)
      await syncSharedTaskRuntime(task, 'queued', {
        skillKey,
      })
      emitTaskStreamEvent(createdRecord.id, {
        type: 'progress',
        recordId: createdRecord.id,
        done: false,
        stopped: false,
        record: createdRecord as unknown as Record<string, unknown>,
        stage: 'queued',
        message: '任务已创建，等待服务端执行',
      })

      logGenerationTask('task_created', {
        recordId: createdRecord.id,
        userId: currentUserId,
        type: payload.type,
        strategyKey: strategy.key,
        providerId,
        modelKey,
      })

      runTaskInBackground(task, payload)
      return createdRecord
    }

    if (strategy.key === 'agent-workspace') {
      if (!providerId) {
        throw new GenerationTaskRequestError(400, '未匹配到后台模型配置，请先在后台配置可用模型')
      }

      if (!modelKey) {
        throw new GenerationTaskRequestError(400, '缺少对话模型标识')
      }

      concurrencySlots = await acquireTaskConcurrencySlots({
        userId: currentUserId,
        providerId,
        skillKey,
      })

      const billingDetail = await resolveGenerationPointCost({
        providerId,
        modelKey,
        endpointType: 'chat',
      })

      const associationNo = buildGatewayAssociationNo()
      const pointLog = billingDetail.pointCost > 0
        ? await consumeGenerationPoints({
          userId: currentUserId,
          pointCost: billingDetail.pointCost,
          sourceId: associationNo,
          associationNo,
          endpointType: 'chat',
          providerId,
          modelKey,
          modelName: billingDetail.modelName,
          metaJson: {
            source: 'generation-task',
            taskType: 'agent-workspace',
            skill: String(payload.skill || '').trim(),
          },
        })
        : null

      const initialPayload = {
        ...buildInitialRecordPayload(payload),
        agentRun: buildAgentPendingRun(
          `record-${Date.now()}`,
          String(payload.prompt || '').trim(),
          String(payload.skill || '').trim() || 'general',
          Array.isArray(payload.referenceImages) ? payload.referenceImages : [],
        ) as unknown as Record<string, unknown>,
      }
      const createdRecord = await createGenerationRecord(initialPayload, currentUserId)
      await attachGenerationPointRecordId({
        associationNo,
        userId: currentUserId,
        generationRecordId: createdRecord.id,
      })
      await completeIdempotencyKey(idempotencyKey, idempotencyClaim.token, {
        recordId: createdRecord.id,
      })

      const task: RunningGenerationTask = {
        recordId: createdRecord.id,
        userId: currentUserId,
        type: 'agent',
        strategyKey: strategy.key,
        abortController: new AbortController(),
        associationNo,
        billedEndpointType: 'chat',
        billedPointCost: pointLog ? billingDetail.pointCost : 0,
        billedProviderId: providerId,
        billedModelKey: modelKey,
        billedModelName: billingDetail.modelName || String(payload.model || '').trim(),
        refundCommitted: false,
        concurrencySlots,
      }

      setLocalRunningTask(task)
      await syncSharedTaskRuntime(task, 'queued', {
        skillKey,
      })
      emitTaskStreamEvent(createdRecord.id, {
        type: 'progress',
        recordId: createdRecord.id,
        done: false,
        stopped: false,
        record: createdRecord as unknown as Record<string, unknown>,
        stage: 'queued',
        message: '技能任务已创建，等待服务端执行',
      })

      logGenerationTask('task_created', {
        recordId: createdRecord.id,
        userId: currentUserId,
        type: payload.type,
        strategyKey: strategy.key,
        skill: payload.skill,
        modelKey: payload.modelKey,
      })

      runTaskInBackground(task, payload)
      return createdRecord
    }

    if (!providerId) {
      throw new GenerationTaskRequestError(400, '未匹配到后台模型配置，请先在后台配置可用模型')
    }

    if (!modelKey) {
      throw new GenerationTaskRequestError(400, '缺少图片模型标识')
    }

    concurrencySlots = await acquireTaskConcurrencySlots({
      userId: currentUserId,
      providerId,
      skillKey,
    })

    const billingDetail = await resolveGenerationPointCost({
      providerId,
      modelKey,
      endpointType: 'image',
    })

    const associationNo = buildGatewayAssociationNo()
    const pointLog = billingDetail.pointCost > 0
      ? await consumeGenerationPoints({
        userId: currentUserId,
        pointCost: billingDetail.pointCost,
        sourceId: associationNo,
        associationNo,
        endpointType: 'image',
        providerId,
        modelKey,
        modelName: billingDetail.modelName,
        metaJson: {
          source: 'generation-task',
        },
      })
      : null

    const createdRecord = await createGenerationRecord(buildInitialRecordPayload(payload), currentUserId)
    await attachGenerationPointRecordId({
      associationNo,
      userId: currentUserId,
      generationRecordId: createdRecord.id,
    })
    await completeIdempotencyKey(idempotencyKey, idempotencyClaim.token, {
      recordId: createdRecord.id,
    })

    const task: RunningGenerationTask = {
      recordId: createdRecord.id,
      userId: currentUserId,
      type: 'image',
      strategyKey: strategy.key,
      abortController: new AbortController(),
      associationNo,
      billedEndpointType: 'image',
      billedPointCost: pointLog ? billingDetail.pointCost : 0,
      billedProviderId: providerId,
      billedModelKey: modelKey,
      billedModelName: billingDetail.modelName,
      refundCommitted: false,
      concurrencySlots,
    }

    setLocalRunningTask(task)
    await syncSharedTaskRuntime(task, 'queued', {
      skillKey,
    })
    emitTaskStreamEvent(createdRecord.id, {
      type: 'progress',
      recordId: createdRecord.id,
      done: false,
      stopped: false,
      record: createdRecord as unknown as Record<string, unknown>,
      stage: 'queued',
      message: '任务已创建，等待服务端执行',
    })

    logGenerationTask('task_created', {
      recordId: createdRecord.id,
      userId: currentUserId,
      type: payload.type,
      strategyKey: strategy.key,
      providerId,
      modelKey,
    })

    runTaskInBackground(task, payload)
    return createdRecord
  } catch (error) {
    if (concurrencySlots.length) {
      await releaseTaskConcurrencySlots(concurrencySlots)
    }
    await clearPendingIdempotencyKey(idempotencyKey, idempotencyClaim.token)
    throw error
  }
}

// 查询任务对应的最新生成记录。
export const getGenerationTaskRecord = async (recordId: string, currentUserId: string) => {
  return resolveTaskRecordSnapshot(recordId, currentUserId)
}

// 停止正在运行的任务；若任务已不在内存中，则尝试直接把记录落成已停止。
export const stopGenerationTask = async (recordId: string, currentUserId: string) => {
  const task = getLocalRunningTask(recordId)

  if (task) {
    if (task.userId !== currentUserId) {
      throw new Error('无权停止当前生成任务')
    }
    abortTaskWithReason(task, 'user_stop')
  } else {
    const sharedRuntime = await getSharedTaskRuntime(recordId)
    if (sharedRuntime?.status === 'running') {
      await markSharedTaskAbortRequested(recordId)
      return getGenerationRecordById(recordId, currentUserId)
    }

    const currentRecord = await getGenerationRecordById(recordId, currentUserId)
    if (currentRecord.done) {
      return currentRecord
    }

    await updateGenerationRecord(recordId, {
      type: currentRecord.type,
      prompt: currentRecord.prompt,
      content: currentRecord.content,
      error: '',
      model: currentRecord.model,
      modelKey: currentRecord.modelKey,
      ratio: currentRecord.ratio,
      resolution: currentRecord.resolution,
      duration: currentRecord.duration,
      feature: currentRecord.feature,
      skill: currentRecord.skill,
      done: true,
      stopped: true,
      images: currentRecord.images,
      agentRun: currentRecord.agentRun,
    }, currentUserId)
    const stoppedRecord = await getGenerationRecordById(recordId, currentUserId)
    emitTaskStreamEvent(recordId, {
      type: 'stopped',
      recordId,
      done: true,
      stopped: true,
      record: stoppedRecord,
      stage: 'stopped',
      message: '任务已停止',
    })
  }

  return getGenerationRecordById(recordId, currentUserId)
}
