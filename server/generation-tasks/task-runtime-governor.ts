import { getSharedTaskRuntime, hasSharedTaskAbortRequested, patchSharedTaskRuntime } from './runtime-store'
import {
  acquireRedisLock,
  REDIS_CONFIG,
  redisKeys,
  releaseRedisLock,
  renewRedisLock,
} from '../redis'

export interface RuntimeManagedTask {
  recordId: string
  userId: string
  type: string
  strategyKey: string
  billedProviderId?: string
  billedModelKey?: string
  abortController: AbortController
}

type SharedRuntimeSnapshot = Awaited<ReturnType<typeof getSharedTaskRuntime>>

type RetryState = {
  attempt: number
  waitDurationMs: number
  status: number
  errorPreview: string
  stage: string
}

type ExecutionStateInput = {
  lockAcquiredAt?: string
  lockLost?: boolean
  lastErrorAt?: string
  lastErrorMessage?: string
}

type SyncStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped'

interface RuntimeGovernorContext {
  abortTaskWithReason: (task: RuntimeManagedTask, reason: 'shared_stop' | 'execution_lock_lost') => void
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
  logGenerationTaskError: (stage: string, error: unknown, detail: Record<string, unknown>) => void
}

export const syncSharedTaskRuntime = async (
  task: RuntimeManagedTask,
  status: SyncStatus,
  extra?: Partial<SharedRuntimeSnapshot>,
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

export const markTaskRetryState = async (task: RuntimeManagedTask, input: RetryState) => {
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

export const markTaskExecutionState = async (task: RuntimeManagedTask, input: ExecutionStateInput) => {
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

export const runTaskWithExecutionLock = async (
  task: RuntimeManagedTask,
  runner: () => Promise<void>,
  context: RuntimeGovernorContext,
) => {
  const lockKey = redisKeys.taskLock(task.recordId)
  const executionLock = await acquireRedisLock(lockKey)
  if (!executionLock) {
    context.logGenerationTask('task_execution_skipped_by_lock', {
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
        context.logGenerationTaskError('task_execution_lock_renew_failed', new Error(renewResult.reason), {
          recordId: task.recordId,
          userId: task.userId,
          strategyKey: task.strategyKey,
          renewReason: renewResult.reason,
          renewIntervalMs,
          taskLockTtlMs: REDIS_CONFIG.taskLockTtlMs,
          lastSuccessfulRenewAt: new Date(lastSuccessfulRenewAt).toISOString(),
        })
        context.abortTaskWithReason(task, 'execution_lock_lost')
        return
      }

      context.logGenerationTask('task_execution_lock_renew_retrying', {
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

export const ensureTaskNotAborted = async (
  task: RuntimeManagedTask,
  context: Pick<RuntimeGovernorContext, 'abortTaskWithReason'>,
) => {
  if (task.abortController.signal.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const remoteAbortRequested = await hasSharedTaskAbortRequested(task.recordId)
  if (!remoteAbortRequested) {
    return
  }

  context.abortTaskWithReason(task, 'shared_stop')
  throw new DOMException('Aborted', 'AbortError')
}
