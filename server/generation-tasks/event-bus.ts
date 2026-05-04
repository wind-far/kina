import type { GenerationTaskStreamEvent } from './shared'
import { REDIS_CONFIG, publishJsonMessage, redisKeys, subscribeJsonMessage } from '../redis'
import { emitLocalTaskStreamEvent, getTaskStreamSubscriberCount } from './local-runtime'

interface SharedTaskEventEnvelope {
  sourceInstanceId: string
  recordId: string
  event: GenerationTaskStreamEvent
}

const remoteUnsubscribeMap = new Map<string, (() => Promise<void> | void)>()

export const emitDistributedTaskStreamEvent = (recordId: string, event: GenerationTaskStreamEvent) => {
  emitLocalTaskStreamEvent(recordId, event)

  void publishJsonMessage(redisKeys.taskEventChannel(recordId), {
    sourceInstanceId: REDIS_CONFIG.instanceId,
    recordId,
    event,
  } satisfies SharedTaskEventEnvelope).catch((error) => {
    console.error('[generation-tasks][event-bus] publish_failed', recordId, error)
  })
}

// 当前实例一旦有 SSE 订阅者，就开始监听 Redis 广播，避免漏掉其他实例产生的进度事件。
export const ensureDistributedTaskSubscription = async (recordId: string) => {
  if (remoteUnsubscribeMap.has(recordId)) {
    return
  }

  const unsubscribe = await subscribeJsonMessage<SharedTaskEventEnvelope>(
    redisKeys.taskEventChannel(recordId),
    (payload) => {
      if (!payload || payload.sourceInstanceId === REDIS_CONFIG.instanceId) {
        return
      }

      emitLocalTaskStreamEvent(recordId, payload.event)
    },
  )

  remoteUnsubscribeMap.set(recordId, unsubscribe)
}

export const cleanupDistributedTaskSubscriptionIfIdle = async (recordId: string) => {
  if (getTaskStreamSubscriberCount(recordId) > 0) {
    return
  }

  const unsubscribe = remoteUnsubscribeMap.get(recordId)
  remoteUnsubscribeMap.delete(recordId)
  await unsubscribe?.()
}
