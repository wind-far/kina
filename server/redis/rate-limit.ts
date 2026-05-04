import { REDIS_CONFIG, isRedisEnabled } from './config'
import { getRedisClient } from './client'
import { redisKeys } from './keys'

export interface RedisRateLimitResult {
  allowed: boolean
  key: string
  limit: number
  currentCount: number
  remaining: number
  retryAfterSeconds: number
  windowSeconds: number
}

// 先提供固定窗口限流，覆盖登录、提交任务、敏感后台接口等高频场景。
export const consumeFixedWindowRateLimit = async (input: {
  scope: string
  identifier: string
  limit?: number
  windowSeconds?: number
}): Promise<RedisRateLimitResult> => {
  const limit = input.limit || REDIS_CONFIG.taskSubmitRateLimit
  const windowSeconds = input.windowSeconds || REDIS_CONFIG.rateLimitWindowSeconds
  const key = redisKeys.rateLimit(input.scope, input.identifier)

  if (!isRedisEnabled()) {
    return {
      allowed: true,
      key,
      limit,
      currentCount: 1,
      remaining: Math.max(limit - 1, 0),
      retryAfterSeconds: 0,
      windowSeconds,
    }
  }

  const client = await getRedisClient()
  if (!client) {
    return {
      allowed: true,
      key,
      limit,
      currentCount: 1,
      remaining: Math.max(limit - 1, 0),
      retryAfterSeconds: 0,
      windowSeconds,
    }
  }

  const result = await client.eval(
    `
      local current = redis.call("incr", KEYS[1])
      if current == 1 then
        redis.call("expire", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("ttl", KEYS[1])
      return {current, ttl}
    `,
    1,
    key,
    String(windowSeconds),
  ) as [number, number]

  const currentCount = Number(result?.[0] || 0)
  const retryAfterSeconds = Math.max(Number(result?.[1] || 0), 0)

  return {
    allowed: currentCount <= limit,
    key,
    limit,
    currentCount,
    remaining: Math.max(limit - currentCount, 0),
    retryAfterSeconds,
    windowSeconds,
  }
}
