import { randomUUID } from 'node:crypto'
import { REDIS_CONFIG, isRedisEnabled } from './config'
import { getRedisClient } from './client'

export interface RedisLockHandle {
  key: string
  token: string
}

export const acquireRedisLock = async (key: string, ttlMs = REDIS_CONFIG.taskLockTtlMs): Promise<RedisLockHandle | null> => {
  if (!isRedisEnabled()) {
    return null
  }

  const client = await getRedisClient()
  if (!client) {
    return null
  }

  const token = randomUUID()
  const result = await client.set(key, token, 'PX', ttlMs, 'NX')
  if (result !== 'OK') {
    return null
  }

  return {
    key,
    token,
  }
}

// 仅释放自己持有的锁，避免误删其他实例刚续上的锁。
export const releaseRedisLock = async (lock: RedisLockHandle | null | undefined) => {
  if (!lock || !isRedisEnabled()) {
    return
  }

  const client = await getRedisClient()
  if (!client) {
    return
  }

  await client.eval(
    `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `,
    1,
    lock.key,
    lock.token,
  )
}

// 长任务执行期间按 token 续租，避免锁在任务未结束前过期。
export const renewRedisLock = async (lock: RedisLockHandle | null | undefined, ttlMs = REDIS_CONFIG.taskLockTtlMs) => {
  if (!lock || !isRedisEnabled()) {
    return false
  }

  const client = await getRedisClient()
  if (!client) {
    return false
  }

  const result = await client.eval(
    `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      end
      return 0
    `,
    1,
    lock.key,
    lock.token,
    String(ttlMs),
  )

  return Number(result) === 1
}
