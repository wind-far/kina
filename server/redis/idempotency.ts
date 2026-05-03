import { createHash, randomUUID } from 'node:crypto'
import { REDIS_CONFIG, isRedisEnabled } from './config'
import { getRedisClient } from './client'
import { redisKeys } from './keys'

interface PendingIdempotencyValue {
  status: 'pending'
  token: string
  createdAt: string
}

interface CompletedIdempotencyValue<T = Record<string, unknown>> {
  status: 'completed'
  token: string
  createdAt: string
  completedAt: string
  data: T
}

type RedisIdempotencyValue<T = Record<string, unknown>> = PendingIdempotencyValue | CompletedIdempotencyValue<T>

export interface IdempotencyClaimResult<T = Record<string, unknown>> {
  state: 'acquired' | 'in_progress' | 'completed'
  key: string
  token?: string
  data?: T
}

const parseIdempotencyValue = <T>(rawValue: string | null) => {
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as RedisIdempotencyValue<T>
  } catch {
    return null
  }
}

// 统一生成任务提交幂等 key，避免同一用户重复点击后重复创建记录。
export const buildTaskSubmissionIdempotencyKey = (input: {
  userId: string
  strategyKey: string
  providerId: string
  modelKey: string
  skill: string
  prompt: string
  requestMode: string
  referenceImages: string[]
  requestBody?: Record<string, unknown> | null
}) => {
  const normalizedPayload = JSON.stringify({
    userId: String(input.userId || '').trim(),
    strategyKey: String(input.strategyKey || '').trim(),
    providerId: String(input.providerId || '').trim(),
    modelKey: String(input.modelKey || '').trim(),
    skill: String(input.skill || '').trim(),
    prompt: String(input.prompt || '').trim(),
    requestMode: String(input.requestMode || '').trim(),
    referenceImages: Array.isArray(input.referenceImages) ? input.referenceImages : [],
    requestBody: input.requestBody || null,
  })

  const hash = createHash('sha1').update(normalizedPayload).digest('hex')
  return redisKeys.taskIdempotency(hash)
}

export const claimIdempotencyKey = async <T = Record<string, unknown>>(
  key: string,
  ttlSeconds = REDIS_CONFIG.taskIdempotencyTtlSeconds,
): Promise<IdempotencyClaimResult<T>> => {
  if (!isRedisEnabled()) {
    return {
      state: 'acquired',
      key,
      token: `redis-disabled-${randomUUID()}`,
    }
  }

  const client = await getRedisClient()
  if (!client) {
    return {
      state: 'acquired',
      key,
      token: `redis-unavailable-${randomUUID()}`,
    }
  }

  const token = randomUUID()
  const payload: PendingIdempotencyValue = {
    status: 'pending',
    token,
    createdAt: new Date().toISOString(),
  }

  const reserved = await client.set(key, JSON.stringify(payload), 'EX', ttlSeconds, 'NX')
  if (reserved === 'OK') {
    return {
      state: 'acquired',
      key,
      token,
    }
  }

  const currentValue = parseIdempotencyValue<T>(await client.get(key))
  if (currentValue?.status === 'completed') {
    return {
      state: 'completed',
      key,
      data: currentValue.data,
    }
  }

  return {
    state: 'in_progress',
    key,
  }
}

// 仅允许当前占有 token 的提交把 pending 状态升级为 completed。
export const completeIdempotencyKey = async (
  key: string,
  token: string | null | undefined,
  data: Record<string, unknown>,
  ttlSeconds = REDIS_CONFIG.taskIdempotencyTtlSeconds,
) => {
  if (!token || !isRedisEnabled()) {
    return
  }

  const client = await getRedisClient()
  if (!client) {
    return
  }

  const nextValue: CompletedIdempotencyValue = {
    status: 'completed',
    token,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    data,
  }

  await client.eval(
    `
      local current = redis.call("get", KEYS[1])
      if not current then
        return 0
      end
      local decoded = cjson.decode(current)
      if decoded["token"] ~= ARGV[1] then
        return 0
      end
      redis.call("set", KEYS[1], ARGV[2], "EX", ARGV[3])
      return 1
    `,
    1,
    key,
    token,
    JSON.stringify(nextValue),
    String(ttlSeconds),
  )
}

// 当提交在创建记录前失败时，释放 pending 状态，避免错误地长时间阻塞重复提交。
export const clearPendingIdempotencyKey = async (key: string, token: string | null | undefined) => {
  if (!token || !isRedisEnabled()) {
    return
  }

  const client = await getRedisClient()
  if (!client) {
    return
  }

  await client.eval(
    `
      local current = redis.call("get", KEYS[1])
      if not current then
        return 0
      end
      local decoded = cjson.decode(current)
      if decoded["status"] ~= "pending" or decoded["token"] ~= ARGV[1] then
        return 0
      end
      return redis.call("del", KEYS[1])
    `,
    1,
    key,
    token,
  )
}
