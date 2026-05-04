import { getAdminRedisRuntimeSettings } from '../system-config/service'

let cachedSettings: Record<string, number> | null = null
let cachedAt = 0
let inflightPromise: Promise<Record<string, number>> | null = null

const CACHE_TTL_MS = 15_000

// 统一读取后台配置的 Redis 运行参数，并做一个很短的进程内缓存，避免每次请求都打数据库。
export const getRedisRuntimeSettings = async () => {
  const now = Date.now()
  if (cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings
  }

  if (inflightPromise) {
    return inflightPromise
  }

  inflightPromise = getAdminRedisRuntimeSettings()
    .then((settings) => {
      cachedSettings = settings as Record<string, number>
      cachedAt = Date.now()
      return cachedSettings
    })
    .finally(() => {
      inflightPromise = null
    })

  return inflightPromise
}

export const clearRedisRuntimeSettingsCache = () => {
  cachedSettings = null
  cachedAt = 0
}
