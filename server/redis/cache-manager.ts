import { getRedisClient } from './client'
import { deleteJsonCache } from './json-cache'
import { recordCacheInvalidateMetrics } from './metrics'

// 统一批量失效缓存，后续各模块只需要给出 key 列表，不再重复手写 Promise.all。
export const invalidateRedisCaches = async (keys: Array<string | null | undefined>) => {
  const normalizedKeys = keys
    .map(key => String(key || '').trim())
    .filter(Boolean)

  if (!normalizedKeys.length) {
    return
  }

  await Promise.all(normalizedKeys.map(key => deleteJsonCache(key)))
  await recordCacheInvalidateMetrics(normalizedKeys)
}

const scanRedisKeysByPattern = async (pattern: string) => {
  const client = await getRedisClient()
  if (!client) {
    return [] as string[]
  }

  const matchedKeys: string[] = []
  let cursor = '0'

  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    cursor = nextCursor
    if (Array.isArray(keys) && keys.length) {
      matchedKeys.push(...keys)
    }
  } while (cursor !== '0')

  return matchedKeys
}

// 用于模块级缓存批量失效，适合无法提前枚举完整 key 的用户态和分页态缓存。
export const invalidateRedisCachePatterns = async (patterns: Array<string | null | undefined>) => {
  const normalizedPatterns = patterns
    .map(pattern => String(pattern || '').trim())
    .filter(Boolean)

  if (!normalizedPatterns.length) {
    return
  }

  const groupedKeys = await Promise.all(normalizedPatterns.map(pattern => scanRedisKeysByPattern(pattern)))
  const allKeys = Array.from(new Set(groupedKeys.flat()))

  if (!allKeys.length) {
    return
  }

  await invalidateRedisCaches(allKeys)
}
