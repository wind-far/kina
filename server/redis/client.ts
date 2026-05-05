import Redis from 'ioredis'
import { REDIS_CONFIG, isRedisEnabled } from './config'
import { writeScopedLog } from '../shared/logging'

let commandClient: Redis | null = null
let publisherClient: Redis | null = null
let subscriberClient: Redis | null = null

const buildRedisClient = (connectionName: string) => new Redis(REDIS_CONFIG.url, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  connectionName,
})

const ensureClientConnected = async (client: Redis) => {
  if (client.status === 'ready' || client.status === 'connecting' || client.status === 'connect') {
    return client
  }

  await client.connect()
  return client
}

const getOrCreateClient = async (factory: () => Redis, current: Redis | null) => {
  const client = current || factory()
  await ensureClientConnected(client)
  return client
}

// 返回执行普通 KV 操作的 Redis 客户端。
export const getRedisClient = async () => {
  if (!isRedisEnabled()) {
    return null
  }

  try {
    commandClient = await getOrCreateClient(
      () => buildRedisClient('canana:command'),
      commandClient,
    )
    return commandClient
  } catch (error) {
    writeScopedLog('error', 'Redis', '命令客户端连接失败', error)
    return null
  }
}

// Pub/Sub 建议独立连接，避免订阅模式影响常规命令。
export const getRedisPublisher = async () => {
  if (!isRedisEnabled()) {
    return null
  }

  try {
    publisherClient = await getOrCreateClient(
      () => buildRedisClient('canana:publisher'),
      publisherClient,
    )
    return publisherClient
  } catch (error) {
    writeScopedLog('error', 'Redis', '发布客户端连接失败', error)
    return null
  }
}

// Pub/Sub 建议独立连接，避免订阅模式影响常规命令。
export const getRedisSubscriber = async () => {
  if (!isRedisEnabled()) {
    return null
  }

  try {
    subscriberClient = await getOrCreateClient(
      () => buildRedisClient('canana:subscriber'),
      subscriberClient,
    )
    return subscriberClient
  } catch (error) {
    writeScopedLog('error', 'Redis', '订阅客户端连接失败', error)
    return null
  }
}
