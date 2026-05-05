import { getRedisPublisher, getRedisSubscriber } from './client'
import { isRedisEnabled } from './config'
import { writeScopedLog } from '../shared/logging'

const channelHandlers = new Map<string, Set<(payload: string) => void>>()
let subscriberBound = false

const bindSubscriberMessageListener = async () => {
  if (subscriberBound || !isRedisEnabled()) {
    return
  }

  const subscriber = await getRedisSubscriber()
  if (!subscriber) {
    return
  }

  subscriber.on('message', (channel, payload) => {
    const handlers = channelHandlers.get(channel)
    if (!handlers?.size) {
      return
    }

    for (const handler of handlers) {
      try {
        handler(payload)
      } catch (error) {
        writeScopedLog('error', 'Redis 订阅', `消息处理器执行失败 ${channel}`, error)
      }
    }
  })

  subscriberBound = true
}

export const publishJsonMessage = async (channel: string, payload: unknown) => {
  if (!isRedisEnabled()) {
    return
  }

  const publisher = await getRedisPublisher()
  if (!publisher) {
    return
  }

  await publisher.publish(channel, JSON.stringify(payload))
}

export const subscribeJsonMessage = async <T>(channel: string, handler: (payload: T) => void) => {
  if (!isRedisEnabled()) {
    return () => {}
  }

  await bindSubscriberMessageListener()
  const subscriber = await getRedisSubscriber()
  if (!subscriber) {
    return () => {}
  }

  let handlers = channelHandlers.get(channel)
  if (!handlers) {
    handlers = new Set()
    channelHandlers.set(channel, handlers)
    await subscriber.subscribe(channel)
  }

  const wrappedHandler = (rawPayload: string) => {
    handler(JSON.parse(rawPayload) as T)
  }
  handlers.add(wrappedHandler)

  return async () => {
    const currentHandlers = channelHandlers.get(channel)
    if (!currentHandlers) {
      return
    }

    currentHandlers.delete(wrappedHandler)
    if (currentHandlers.size > 0) {
      return
    }

    channelHandlers.delete(channel)
    await subscriber.unsubscribe(channel)
  }
}
