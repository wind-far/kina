import { getGenerationRecordById, createGenerationRecord, updateGenerationRecord } from '../generation-records/service'
import type { GenerationRecordPayload } from '../generation-records/shared'
import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import { resolveGatewayProviderUpstream } from '../provider-config/service'
import {
  attachGenerationPointRecordId,
  consumeGenerationPoints,
  refundGenerationPoints,
  resolveGenerationPointCost,
} from '../marketing-center/service'
import { resolveGenerationTaskStrategy, type GenerationTaskStrategyKey } from './strategy'
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
import type { AgentImageResult, AgentRunState } from '../../src/types/agent'
import { normalizeGenerationErrorMessage } from '../../src/shared/generation-error'
import {
  deleteLocalRunningTask,
  getLocalRunningTask,
  setLocalRunningTask,
  type LocalRunningGenerationTask,
} from './local-runtime'
import {
  clearSharedTaskAbortRequested,
  getSharedTaskRuntime,
  markSharedTaskAbortRequested,
  setSharedTaskRuntime,
} from './runtime-store'
import {
  buildTaskSubmissionIdempotencyKey,
  claimIdempotencyKey,
  clearPendingIdempotencyKey,
  completeIdempotencyKey,
  getRedisRuntimeSettings,
  releaseTaskConcurrencySlots,
  tryAcquireProviderTaskSlot,
  tryAcquireSkillTaskSlot,
  tryAcquireUserTaskSlot,
  type RedisConcurrencySlot,
} from '../redis'
import { GenerationTaskRequestError } from './shared'
import { getGenerationTaskExecutionStrategy, type TaskAbortReason } from './execution-strategies'
import { executeImageTask } from './image-task-executor'
import { executeAgentChatTaskFlow } from './agent-chat-task-executor'
import { executeAgentWorkspaceTaskFlow } from './agent-workspace-task-executor'
import {
  emitTaskAgentEvent,
  emitTaskContentDeltaEvent,
  emitTaskProgressEvent,
  emitTaskStreamEvent,
} from './task-event-emitter'
import {
  resolveTaskRecordSnapshot,
  subscribeGenerationTaskStream,
} from './task-stream-subscription'
import {
  buildInitialRecordPayload,
  getGenerationTaskRecord as getGenerationTaskRecordLifecycle,
  startGenerationTask as startGenerationTaskLifecycle,
  stopGenerationTask as stopGenerationTaskLifecycle,
} from './task-lifecycle-service'
import {
  ensureTaskNotAborted,
  markTaskExecutionState,
  markTaskRetryState,
  runTaskWithExecutionLock,
  syncSharedTaskRuntime,
} from './task-runtime-governor'
import {
  fetchWithBurstRateRetry,
  extractChatTextFromNonStreamResponse,
  extractChatTextFromJsonPayload,
  parseChatChunkText,
  parseChatChunkError,
  requestImageGeneration,
  requestImageEdit,
  resolveWorkspaceImageModel,
  requestAgentWorkspaceModelPlan,
} from './upstream-helpers'

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

const taskEventEmitterContext = {
  logGenerationTaskError,
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

const buildGatewayAssociationNo = () => {
  return `GTK${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

// 统一构造任务执行策略上下文，先把停止/失败收口逻辑从中心 service 中迁出。
const buildTaskExecutionStrategyContext = () => ({
  executeImageGenerationTask,
  executeAgentChatTask,
  executeAgentWorkspaceTask,
  refundTaskPointsIfNeeded,
  markTaskExecutionState,
  emitTaskProgressEvent: (recordId: string, input: {
    stage: string
    stopped?: boolean
    message?: string
  }) => emitTaskProgressEvent(recordId, {
    stage: input.stage,
    stopped: input.stopped,
    message: input.message || '',
  }, taskEventEmitterContext),
  emitTaskStreamEvent: (recordId: string, event: GenerationTaskStreamEvent) => (
    emitTaskStreamEvent(recordId, event, taskEventEmitterContext)
  ),
  buildInitialRecordPayload,
  updateGenerationRecord,
  getGenerationRecordById,
  syncSharedTaskRuntime,
  buildAgentStoppedRun,
  buildAgentErrorRun,
  normalizeGenerationErrorMessage,
  logGenerationTask,
  logGenerationTaskError,
})


const executeImageGenerationTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  await executeImageTask(task, payload, {
    syncSharedTaskRuntime,
    ensureTaskNotAborted: (runningTask) => ensureTaskNotAborted(runningTask, { abortTaskWithReason }),
    emitTaskProgressEvent: (recordId, input) => emitTaskProgressEvent(recordId, input, taskEventEmitterContext),
    markTaskRetryState,
    requestImageGeneration: (input) => requestImageGeneration({
      ...input,
      fetchWithBurstRateRetry: (retryInput) => fetchWithBurstRateRetry({
        ...retryInput,
        logGenerationTask,
      }),
    }),
    requestImageEdit: (input) => requestImageEdit({
      ...input,
      fetchWithBurstRateRetry: (retryInput) => fetchWithBurstRateRetry({
        ...retryInput,
        logGenerationTask,
      }),
    }),
    buildInitialRecordPayload,
    updateGenerationRecord,
    getGenerationRecordById,
    emitTaskStreamEvent: (recordId, event) => emitTaskStreamEvent(recordId, event, taskEventEmitterContext),
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

const executeAgentChatTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  await executeAgentChatTaskFlow(task, payload, {
    syncSharedTaskRuntime,
    ensureTaskNotAborted: (runningTask) => ensureTaskNotAborted(runningTask, { abortTaskWithReason }),
    resolveGatewayProviderUpstream,
    emitTaskProgressEvent: (recordId, input) => emitTaskProgressEvent(recordId, input, taskEventEmitterContext),
    fetchWithBurstRateRetry: (input) => fetchWithBurstRateRetry({
      ...input,
      logGenerationTask,
    }),
    markTaskRetryState,
    extractChatTextFromNonStreamResponse,
    parseChatChunkError,
    parseChatChunkText,
    extractChatTextFromJsonPayload,
    emitTaskContentDeltaEvent: (recordId, input) => emitTaskContentDeltaEvent(recordId, input, taskEventEmitterContext),
    persistAgentTaskContentIfNeeded,
    buildInitialRecordPayload,
    updateGenerationRecord,
    getGenerationRecordById,
    emitTaskStreamEvent: (recordId, event) => emitTaskStreamEvent(recordId, event, taskEventEmitterContext),
    logGenerationTask,
  })
}

const persistAgentWorkspaceRecord = async (input: {
  task: RunningGenerationTask
  payload: GenerationTaskStartPayload
  agentRun: AgentRunState
  done?: boolean
  stopped?: boolean
  error?: string
}) => {
  const agentRunImages: AgentImageResult[] = Array.isArray(input.agentRun.result?.images)
    ? input.agentRun.result.images
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
    ensureTaskNotAborted: (runningTask) => ensureTaskNotAborted(runningTask, { abortTaskWithReason }),
    getAgentWorkspaceSkillMeta,
    buildAgentPendingRun,
    applyAgentWorkspaceEvent: (currentRun, agentEvent) => applyAgentWorkspaceEvent(currentRun as AgentRunState, agentEvent),
    persistAgentWorkspaceRecord,
    emitTaskProgressEvent: (recordId, input) => emitTaskProgressEvent(recordId, input, taskEventEmitterContext),
    emitTaskAgentEvent: (recordId, input) => emitTaskAgentEvent(recordId, input, taskEventEmitterContext),
    sleepWithWorkspaceAbort,
    getWorkspaceRandomDelay,
    workspaceTimingProfile,
    planAgentWorkspace,
    requestAgentWorkspaceModelPlan: (input) => requestAgentWorkspaceModelPlan({
      ...input,
      fetchWithBurstRateRetry: (retryInput) => fetchWithBurstRateRetry({
        ...retryInput,
        logGenerationTask,
      }),
    }),
    logGenerationTask,
    logGenerationTaskError,
    resolveWorkspaceImageModel,
    requestImageEdit: (input) => requestImageEdit({
      ...input,
      fetchWithBurstRateRetry: (retryInput) => fetchWithBurstRateRetry({
        ...retryInput,
        logGenerationTask,
      }),
    }),
    requestImageGeneration: (input) => requestImageGeneration({
      ...input,
      fetchWithBurstRateRetry: (retryInput) => fetchWithBurstRateRetry({
        ...retryInput,
        logGenerationTask,
      }),
    }),
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
      }, {
        abortTaskWithReason,
        logGenerationTask,
        logGenerationTaskError,
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

// 统一构造生命周期服务依赖，避免 start/get/stop 三个入口重复拼装同一批上下文。
const buildTaskLifecycleContext = () => ({
  resolveGenerationTaskStrategy,
  buildTaskSubmissionIdempotencyKey,
  claimIdempotencyKey,
  completeIdempotencyKey,
  clearPendingIdempotencyKey,
  getGenerationRecordById,
  createGenerationRecord: (recordPayload: GenerationRecordPayload, userId: string) => createGenerationRecord(recordPayload, userId),
  updateGenerationRecord: (recordId: string, recordPayload: GenerationRecordPayload, userId: string) => (
    updateGenerationRecord(recordId, recordPayload, userId)
  ),
  attachGenerationPointRecordId,
  resolveGenerationPointCost,
  consumeGenerationPoints,
  acquireTaskConcurrencySlots: async ({ userId, providerId, skillKey }: {
    userId: string
    providerId: string
    skillKey: string
  }) => {
    const acquiredSlots: RedisConcurrencySlot[] = []
    const runtimeSettings = await getRedisRuntimeSettings()
    const userResult = await tryAcquireUserTaskSlot(userId, runtimeSettings.taskUserConcurrencyLimit)
    if (!userResult.acquired || !userResult.slot) {
      throw new GenerationTaskRequestError(429, `当前账号正在执行的任务过多，请稍后再试（上限 ${userResult.limit}）`)
    }
    acquiredSlots.push(userResult.slot)

    try {
      const skillResult = await tryAcquireSkillTaskSlot(skillKey, runtimeSettings.taskSkillConcurrencyLimit)
      if (!skillResult.acquired || !skillResult.slot) {
        throw new GenerationTaskRequestError(429, `当前技能任务较多，请稍后再试（上限 ${skillResult.limit}）`)
      }
      acquiredSlots.push(skillResult.slot)

      if (providerId) {
        const providerResult = await tryAcquireProviderTaskSlot(providerId, runtimeSettings.taskProviderConcurrencyLimit)
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
  },
  releaseTaskConcurrencySlots,
  buildAgentPendingRun,
  buildGatewayAssociationNo,
  setLocalRunningTask,
  syncSharedTaskRuntime,
  emitTaskStreamEvent: (recordId: string, event: GenerationTaskStreamEvent) => (
    emitTaskStreamEvent(recordId, event, taskEventEmitterContext)
  ),
  logGenerationTask,
  runTaskInBackground,
  resolveTaskRecordSnapshot,
  getLocalRunningTask,
  getSharedTaskRuntime,
  markSharedTaskAbortRequested,
  abortTaskWithReason,
})

export const startGenerationTask = async (payload: GenerationTaskStartPayload, currentUserId: string) => {
  return startGenerationTaskLifecycle(payload, currentUserId, buildTaskLifecycleContext())
}

export const getGenerationTaskRecord = async (recordId: string, currentUserId: string) => {
  return getGenerationTaskRecordLifecycle(recordId, currentUserId, buildTaskLifecycleContext())
}

export const stopGenerationTask = async (recordId: string, currentUserId: string) => {
  return stopGenerationTaskLifecycle(recordId, currentUserId, buildTaskLifecycleContext())
}

export { subscribeGenerationTaskStream }
