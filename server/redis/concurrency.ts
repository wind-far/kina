import { REDIS_CONFIG, isRedisEnabled } from './config'
import { getRedisClient } from './client'
import { redisKeys } from './keys'

export interface RedisConcurrencySlot {
  scope: 'user' | 'skill' | 'provider'
  key: string
  limit: number
  currentCount: number
}

const acquireConcurrencySlot = async (key: string, limit: number, ttlSeconds = REDIS_CONFIG.taskConcurrencyTtlSeconds) => {
  if (!isRedisEnabled()) {
    return {
      acquired: true,
      currentCount: 1,
      limit,
      key,
    }
  }

  const client = await getRedisClient()
  if (!client) {
    return {
      acquired: true,
      currentCount: 1,
      limit,
      key,
    }
  }

  const result = await client.eval(
    `
      local current = tonumber(redis.call("get", KEYS[1]) or "0")
      local limit = tonumber(ARGV[1])
      if current >= limit then
        return {0, current}
      end
      local next = redis.call("incr", KEYS[1])
      redis.call("expire", KEYS[1], ARGV[2])
      return {1, next}
    `,
    1,
    key,
    String(limit),
    String(ttlSeconds),
  ) as [number, number]

  return {
    acquired: Number(result?.[0]) === 1,
    currentCount: Number(result?.[1] || 0),
    limit,
    key,
  }
}

const releaseConcurrencySlot = async (key: string) => {
  if (!isRedisEnabled()) {
    return 0
  }

  const client = await getRedisClient()
  if (!client) {
    return 0
  }

  const result = await client.eval(
    `
      local current = tonumber(redis.call("get", KEYS[1]) or "0")
      if current <= 1 then
        redis.call("del", KEYS[1])
        return 0
      end
      return redis.call("decr", KEYS[1])
    `,
    1,
    key,
  )

  return Number(result || 0)
}

export const tryAcquireUserTaskSlot = async (userId: string, limit = REDIS_CONFIG.taskUserConcurrencyLimit) => {
  const key = redisKeys.taskUserConcurrency(userId)
  const result = await acquireConcurrencySlot(key, limit)
  return {
    ...result,
    slot: result.acquired
      ? {
          scope: 'user' as const,
          key,
          limit,
          currentCount: result.currentCount,
        }
      : null,
  }
}

export const tryAcquireSkillTaskSlot = async (skillKey: string, limit = REDIS_CONFIG.taskSkillConcurrencyLimit) => {
  const key = redisKeys.taskSkillConcurrency(skillKey || 'general')
  const result = await acquireConcurrencySlot(key, limit)
  return {
    ...result,
    slot: result.acquired
      ? {
          scope: 'skill' as const,
          key,
          limit,
          currentCount: result.currentCount,
        }
      : null,
  }
}

export const tryAcquireProviderTaskSlot = async (providerKey: string, limit = REDIS_CONFIG.taskProviderConcurrencyLimit) => {
  const key = redisKeys.taskProviderConcurrency(providerKey)
  const result = await acquireConcurrencySlot(key, limit)
  return {
    ...result,
    slot: result.acquired
      ? {
          scope: 'provider' as const,
          key,
          limit,
          currentCount: result.currentCount,
        }
      : null,
  }
}

// 统一释放任务提交阶段占用的并发槽位，避免异常任务长期占坑。
export const releaseTaskConcurrencySlots = async (slots: RedisConcurrencySlot[] | null | undefined) => {
  if (!Array.isArray(slots) || !slots.length) {
    return
  }

  await Promise.all(slots.map(slot => releaseConcurrencySlot(slot.key)))
}
