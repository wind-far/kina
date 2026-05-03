import { REDIS_CONFIG, deleteJsonCache, readJsonCache, redisKeys, writeJsonCache, getRedisClient } from '../redis'
import type { GenerationTaskStreamEvent } from './shared'

export interface SharedTaskRuntimeState {
  recordId: string
  userId: string
  type: 'image' | 'agent'
  strategyKey: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped'
  updatedAt: string
  providerId?: string
  modelKey?: string
  skillKey?: string
  queue?: {
    enteredAt: string
    startedAt: string
    waitDurationMs: number
    reason: string
  }
  retry?: {
    totalRetryCount: number
    burstRateRetryCount: number
    lastRetryAt: string
    lastRetryStage: string
    lastWaitDurationMs: number
    lastStatusCode: number
    lastErrorPreview: string
  }
  execution?: {
    lockAcquiredAt: string
    lockLost: boolean
    completedAt: string
    lastErrorAt: string
    lastErrorMessage: string
  }
}

export interface SharedTaskRecentEventItem {
  type: GenerationTaskStreamEvent['type']
  stage: string
  message: string
  done: boolean
  stopped: boolean
  createdAt: string
}

export const setSharedTaskRuntime = async (state: SharedTaskRuntimeState) => {
  await writeJsonCache(
    redisKeys.taskRuntime(state.recordId),
    state,
    REDIS_CONFIG.taskRuntimeTtlSeconds,
  )
}

export const getSharedTaskRuntime = async (recordId: string) => {
  return readJsonCache<SharedTaskRuntimeState>(redisKeys.taskRuntime(recordId))
}

// 统一做任务运行态局部更新，避免不同阶段分别维护整份对象时互相覆盖。
export const patchSharedTaskRuntime = async (
  recordId: string,
  updater: (current: SharedTaskRuntimeState | null) => SharedTaskRuntimeState | null,
) => {
  const current = await getSharedTaskRuntime(recordId)
  const next = updater(current)
  if (!next) {
    return null
  }

  await setSharedTaskRuntime(next)
  return next
}

export const clearSharedTaskRuntime = async (recordId: string) => {
  await deleteJsonCache(redisKeys.taskRuntime(recordId))
}

export const setSharedTaskSnapshot = async (recordId: string, snapshot: unknown) => {
  await writeJsonCache(
    redisKeys.taskSnapshot(recordId),
    snapshot,
    REDIS_CONFIG.taskSnapshotTtlSeconds,
  )
}

export const getSharedTaskSnapshot = async <T>(recordId: string) => {
  return readJsonCache<T>(redisKeys.taskSnapshot(recordId))
}

export const clearSharedTaskSnapshot = async (recordId: string) => {
  await deleteJsonCache(redisKeys.taskSnapshot(recordId))
}

// 保存最近事件摘要，方便后台按 recordId 回放任务的最近关键阶段。
export const appendSharedTaskRecentEvent = async (recordId: string, event: GenerationTaskStreamEvent) => {
  const eventStage = String(event.stage || event.type || '').trim()
  const eventMessage = String(event.message || '').trim()
  if (!eventStage && !eventMessage) {
    return
  }

  const currentItems = await readJsonCache<SharedTaskRecentEventItem[]>(redisKeys.taskRecentEvents(recordId))
  const nextItem: SharedTaskRecentEventItem = {
    type: event.type,
    stage: eventStage || event.type,
    message: eventMessage || '',
    done: Boolean(event.done),
    stopped: Boolean(event.stopped),
    createdAt: new Date().toISOString(),
  }

  const nextItems = [...(Array.isArray(currentItems) ? currentItems : []), nextItem].slice(-20)
  await writeJsonCache(
    redisKeys.taskRecentEvents(recordId),
    nextItems,
    REDIS_CONFIG.taskSnapshotTtlSeconds,
  )
}

export const getSharedTaskRecentEvents = async (recordId: string) => {
  return readJsonCache<SharedTaskRecentEventItem[]>(redisKeys.taskRecentEvents(recordId))
}

export const clearSharedTaskRecentEvents = async (recordId: string) => {
  await deleteJsonCache(redisKeys.taskRecentEvents(recordId))
}

export const markSharedTaskAbortRequested = async (recordId: string) => {
  const client = await getRedisClient()
  if (!client) {
    return
  }

  await client.set(
    redisKeys.taskAbort(recordId),
    '1',
    'EX',
    REDIS_CONFIG.taskAbortTtlSeconds,
  )
}

export const hasSharedTaskAbortRequested = async (recordId: string) => {
  const client = await getRedisClient()
  if (!client) {
    return false
  }

  const value = await client.get(redisKeys.taskAbort(recordId))
  return value === '1'
}

export const clearSharedTaskAbortRequested = async (recordId: string) => {
  const client = await getRedisClient()
  if (!client) {
    return
  }

  await client.del(redisKeys.taskAbort(recordId))
}
