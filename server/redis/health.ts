import { getRedisClient } from './client'
import { isRedisEnabled } from './config'

export const pingRedis = async () => {
  if (!isRedisEnabled()) {
    return {
      enabled: false,
      ok: false,
      message: 'Redis 未启用',
    }
  }

  const client = await getRedisClient()
  if (!client) {
    return {
      enabled: true,
      ok: false,
      message: 'Redis 客户端初始化失败',
    }
  }

  const pong = await client.ping()
  return {
    enabled: true,
    ok: pong === 'PONG',
    message: pong,
  }
}
