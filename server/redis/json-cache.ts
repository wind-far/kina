import { REDIS_CONFIG, isRedisEnabled } from './config'
import { getRedisClient } from './client'
import { recordCacheHitMetric, recordCacheMissMetric, recordCacheWriteMetric } from './metrics'

interface JsonCacheOptions<T> {
  key: string
  ttlSeconds?: number
  factory: () => Promise<T>
}

export const readJsonCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisEnabled()) {
    return null
  }

  const client = await getRedisClient()
  if (!client) {
    return null
  }

  const cachedValue = await client.get(key)
  if (!cachedValue) {
    return null
  }

  return JSON.parse(cachedValue) as T
}

export const writeJsonCache = async (key: string, value: unknown, ttlSeconds = REDIS_CONFIG.defaultTtlSeconds) => {
  if (!isRedisEnabled()) {
    return
  }

  const serializedValue = JSON.stringify(value)
  const client = await getRedisClient()
  if (!client) {
    return
  }

  await client.set(key, serializedValue, 'EX', ttlSeconds)
  await recordCacheWriteMetric(key, Buffer.byteLength(serializedValue))
}

export const deleteJsonCache = async (key: string) => {
  if (!isRedisEnabled()) {
    return
  }

  const client = await getRedisClient()
  if (!client) {
    return
  }

  await client.del(key)
}

// 统一封装“先读缓存，没有再回源”的通用读法。
export const getOrSetJsonCache = async <T>(options: JsonCacheOptions<T>): Promise<T> => {
  const cachedValue = await readJsonCache<T>(options.key)
  if (cachedValue !== null) {
    await recordCacheHitMetric(options.key)
    return cachedValue
  }

  await recordCacheMissMetric(options.key)
  const freshValue = await options.factory()
  await writeJsonCache(options.key, freshValue, options.ttlSeconds)
  return freshValue
}
