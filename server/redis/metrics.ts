import { REDIS_CONFIG, isRedisEnabled } from './config'
import { getRedisClient } from './client'
import { redisKeys } from './keys'

const METRIC_MAX_RANK_SIZE = 50
const LARGE_VALUE_WARNING_BYTES = 256 * 1024

const parseCacheScopeFromKey = (key: string) => {
  const prefix = `${REDIS_CONFIG.prefix}:${REDIS_CONFIG.env}:cache:`
  if (!String(key || '').startsWith(prefix)) {
    return ''
  }

  const suffix = key.slice(prefix.length)
  return String(suffix.split(':')[0] || '').trim()
}

const recordModuleSeen = async (scope: string) => {
  const client = await getRedisClient()
  if (!client || !scope) {
    return
  }

  await client.sadd(redisKeys.cacheMetricsModules(), scope)
}

const incrementModuleSummary = async (scope: string, fields: Record<string, number | string>) => {
  const client = await getRedisClient()
  if (!client || !scope) {
    return
  }

  const summaryKey = redisKeys.cacheMetricsModuleSummary(scope)
  const pipeline = client.pipeline()

  for (const [field, value] of Object.entries(fields)) {
    if (typeof value === 'number') {
      pipeline.hincrby(summaryKey, field, value)
    } else {
      pipeline.hset(summaryKey, field, value)
    }
  }

  pipeline.expire(summaryKey, 7 * 24 * 60 * 60)
  await pipeline.exec()
}

export const recordCacheHitMetric = async (key: string) => {
  if (!isRedisEnabled()) {
    return
  }

  const scope = parseCacheScopeFromKey(key)
  if (!scope) {
    return
  }

  const client = await getRedisClient()
  if (!client) {
    return
  }

  const now = new Date().toISOString()
  await recordModuleSeen(scope)
  await incrementModuleSummary(scope, {
    hitCount: 1,
    readCount: 1,
    lastHitAt: now,
  })

  const hotKeyMetricKey = redisKeys.cacheMetricsModuleHotKeys(scope)
  await client.zincrby(hotKeyMetricKey, 1, key)
  await client.zremrangebyrank(hotKeyMetricKey, 0, -1 - METRIC_MAX_RANK_SIZE)
  await client.expire(hotKeyMetricKey, 7 * 24 * 60 * 60)
}

export const recordCacheMissMetric = async (key: string) => {
  if (!isRedisEnabled()) {
    return
  }

  const scope = parseCacheScopeFromKey(key)
  if (!scope) {
    return
  }

  await recordModuleSeen(scope)
  await incrementModuleSummary(scope, {
    missCount: 1,
    readCount: 1,
    lastMissAt: new Date().toISOString(),
  })
}

export const recordCacheWriteMetric = async (key: string, valueBytes: number) => {
  if (!isRedisEnabled()) {
    return
  }

  const scope = parseCacheScopeFromKey(key)
  if (!scope) {
    return
  }

  const client = await getRedisClient()
  if (!client) {
    return
  }

  const now = new Date().toISOString()
  await recordModuleSeen(scope)
  await incrementModuleSummary(scope, {
    writeCount: 1,
    totalValueBytes: valueBytes,
    lastValueBytes: String(valueBytes),
    lastWriteAt: now,
  })

  const summaryKey = redisKeys.cacheMetricsModuleSummary(scope)
  const currentMaxValueBytes = Number(await client.hget(summaryKey, 'maxValueBytes') || 0)
  if (valueBytes > currentMaxValueBytes) {
    await client.hset(summaryKey, 'maxValueBytes', String(valueBytes))
  }

  const largeValueMetricKey = redisKeys.cacheMetricsModuleLargeValues(scope)
  await client.zadd(largeValueMetricKey, valueBytes, key)
  await client.zremrangebyrank(largeValueMetricKey, 0, -1 - METRIC_MAX_RANK_SIZE)
  await client.expire(largeValueMetricKey, 7 * 24 * 60 * 60)
}

export const recordCacheInvalidateMetrics = async (keys: string[]) => {
  if (!isRedisEnabled() || !keys.length) {
    return
  }

  const grouped = keys.reduce<Map<string, number>>((map, key) => {
    const scope = parseCacheScopeFromKey(key)
    if (!scope) {
      return map
    }
    map.set(scope, (map.get(scope) || 0) + 1)
    return map
  }, new Map())

  const now = new Date().toISOString()
  for (const [scope, count] of grouped.entries()) {
    await recordModuleSeen(scope)
    await incrementModuleSummary(scope, {
      invalidateCount: count,
      lastInvalidateAt: now,
    })
  }
}

const scanRedisKeys = async (pattern: string) => {
  const client = await getRedisClient()
  if (!client) {
    return [] as string[]
  }

  let cursor = '0'
  const keys: string[] = []
  do {
    const [nextCursor, matchedKeys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    cursor = nextCursor
    keys.push(...matchedKeys)
  } while (cursor !== '0')

  return keys
}

const readModuleCurrentKeyCount = async (scope: string) => {
  const keys = await scanRedisKeys(redisKeys.cache(scope, '*'))
  return {
    count: keys.length,
    sampleKeys: keys.slice(0, 5),
  }
}

const readModuleHotKeys = async (scope: string) => {
  const client = await getRedisClient()
  if (!client) {
    return [] as Array<{ key: string; score: number }>
  }

  const rows = await client.zrevrange(redisKeys.cacheMetricsModuleHotKeys(scope), 0, 4, 'WITHSCORES')
  const items: Array<{ key: string; score: number }> = []
  for (let index = 0; index < rows.length; index += 2) {
    items.push({
      key: rows[index],
      score: Number(rows[index + 1] || 0),
    })
  }
  return items
}

const readModuleLargeValues = async (scope: string) => {
  const client = await getRedisClient()
  if (!client) {
    return [] as Array<{ key: string; bytes: number }>
  }

  const rows = await client.zrevrange(redisKeys.cacheMetricsModuleLargeValues(scope), 0, 4, 'WITHSCORES')
  const items: Array<{ key: string; bytes: number }> = []
  for (let index = 0; index < rows.length; index += 2) {
    items.push({
      key: rows[index],
      bytes: Number(rows[index + 1] || 0),
    })
  }
  return items
}

export const getBusinessCacheMetricsOverview = async () => {
  const client = await getRedisClient()
  if (!client) {
    return {
      modules: [],
      diagnostics: {
        hotKeys: [],
        largeValues: [],
        warnings: [] as Array<{ level: 'info' | 'warning'; message: string }>,
      },
    }
  }

  const scopes = await client.smembers(redisKeys.cacheMetricsModules())
  const modules = await Promise.all(scopes.map(async (scope) => {
    const [summary, currentKeys, hotKeys, largeValues] = await Promise.all([
      client.hgetall(redisKeys.cacheMetricsModuleSummary(scope)),
      readModuleCurrentKeyCount(scope),
      readModuleHotKeys(scope),
      readModuleLargeValues(scope),
    ])

    const hitCount = Number(summary.hitCount || 0)
    const missCount = Number(summary.missCount || 0)
    const readCount = Number(summary.readCount || 0)
    const writeCount = Number(summary.writeCount || 0)
    const invalidateCount = Number(summary.invalidateCount || 0)
    const totalValueBytes = Number(summary.totalValueBytes || 0)
    const maxValueBytes = Number(summary.maxValueBytes || 0)
    const hitRate = readCount > 0 ? Number(((hitCount / readCount) * 100).toFixed(2)) : 0
    const averageValueBytes = writeCount > 0 ? Math.round(totalValueBytes / writeCount) : 0

    return {
      scope,
      currentKeyCount: currentKeys.count,
      sampleKeys: currentKeys.sampleKeys,
      hitCount,
      missCount,
      readCount,
      writeCount,
      invalidateCount,
      hitRate,
      lastHitAt: summary.lastHitAt || '',
      lastMissAt: summary.lastMissAt || '',
      lastWriteAt: summary.lastWriteAt || '',
      lastInvalidateAt: summary.lastInvalidateAt || '',
      lastValueBytes: Number(summary.lastValueBytes || 0),
      maxValueBytes,
      averageValueBytes,
      hotKeys,
      largeValues,
    }
  }))

  const hotKeys = modules
    .flatMap(module => module.hotKeys.map(item => ({ scope: module.scope, ...item })))
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)

  const largeValues = modules
    .flatMap(module => module.largeValues.map(item => ({ scope: module.scope, ...item })))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 10)

  const warnings: Array<{ level: 'info' | 'warning'; message: string }> = []
  if (!modules.length) {
    warnings.push({
      level: 'info',
      message: '当前尚未采集到业务缓存指标，请先触发相关业务接口后再查看。',
    })
  }
  if (largeValues.some(item => item.bytes >= LARGE_VALUE_WARNING_BYTES)) {
    warnings.push({
      level: 'warning',
      message: '存在超过 256KB 的缓存 value，建议检查是否有列表或详情对象缓存过大。',
    })
  }
  if (modules.some(item => item.readCount >= 20 && item.hitRate < 40)) {
    warnings.push({
      level: 'warning',
      message: '存在命中率低于 40% 的业务缓存模块，建议复核 TTL 或失效策略是否过于激进。',
    })
  }
  if (!warnings.length) {
    warnings.push({
      level: 'info',
      message: '当前业务缓存指标未发现明显异常。',
    })
  }

  return {
    modules: modules.sort((left, right) => right.readCount - left.readCount || right.currentKeyCount - left.currentKeyCount),
    diagnostics: {
      hotKeys,
      largeValues,
      warnings,
    },
  }
}
