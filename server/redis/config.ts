const DEFAULT_REDIS_PREFIX = 'canana'
const DEFAULT_REDIS_ENV = process.env.NODE_ENV || 'development'
const DEFAULT_REDIS_HOST = '127.0.0.1'
const DEFAULT_REDIS_PORT = 6379
const DEFAULT_REDIS_DATABASE = 0
const DEFAULT_CACHE_TTL_SECONDS = 60
const DEFAULT_TASK_RUNTIME_TTL_SECONDS = 30 * 60
const DEFAULT_TASK_SNAPSHOT_TTL_SECONDS = 30 * 60
const DEFAULT_TASK_ABORT_TTL_SECONDS = 5 * 60
const DEFAULT_TASK_LOCK_TTL_MS = 30_000
const DEFAULT_TASK_IDEMPOTENCY_TTL_SECONDS = 10 * 60
const DEFAULT_TASK_CONCURRENCY_TTL_SECONDS = 30 * 60
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60
const DEFAULT_TASK_SUBMIT_RATE_LIMIT = 6
const DEFAULT_TASK_USER_CONCURRENCY_LIMIT = 3
const DEFAULT_TASK_PROVIDER_CONCURRENCY_LIMIT = 8
const DEFAULT_TASK_SKILL_CONCURRENCY_LIMIT = 4
const DEFAULT_AUTH_VERIFICATION_RATE_LIMIT = 5
const DEFAULT_AUTH_LOGIN_RATE_LIMIT = 10

const normalizeBoolean = (value: string, defaultValue: boolean) => {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (!normalizedValue) {
    return defaultValue
  }

  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false
  }

  return defaultValue
}

const normalizeInteger = (value: string, defaultValue: number, minValue = 1) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return defaultValue
  }

  return Math.max(minValue, Math.floor(parsed))
}

const normalizeOptionalInteger = (value: string, defaultValue: number, minValue = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return defaultValue
  }

  return Math.max(minValue, Math.floor(parsed))
}

const buildRedisUrlFromFields = (input: {
  host: string
  port: number
  password: string
  database: number
}) => {
  const encodedPassword = input.password ? `:${encodeURIComponent(input.password)}@` : ''
  return `redis://${encodedPassword}${input.host}:${input.port}/${input.database}`
}

const rawRedisUrl = String(process.env.REDIS_URL || '').trim()
const redisHost = String(process.env.REDIS_HOST || DEFAULT_REDIS_HOST).trim() || DEFAULT_REDIS_HOST
const redisPort = normalizeOptionalInteger(process.env.REDIS_PORT || '', DEFAULT_REDIS_PORT, 1)
const redisPassword = String(process.env.REDIS_PASSWORD || '').trim()
const redisDatabase = normalizeOptionalInteger(process.env.REDIS_DATABASE || '', DEFAULT_REDIS_DATABASE, 0)
const resolvedRedisUrl = rawRedisUrl || buildRedisUrlFromFields({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  database: redisDatabase,
})

// Redis 统一运行时配置，避免各模块重复读取环境变量。
export const REDIS_CONFIG = {
  enabled: normalizeBoolean(process.env.REDIS_ENABLED || '', Boolean(rawRedisUrl || redisHost)),
  url: resolvedRedisUrl,
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  database: redisDatabase,
  prefix: String(process.env.REDIS_PREFIX || DEFAULT_REDIS_PREFIX).trim() || DEFAULT_REDIS_PREFIX,
  env: String(process.env.REDIS_ENV || DEFAULT_REDIS_ENV).trim() || DEFAULT_REDIS_ENV,
  defaultTtlSeconds: normalizeInteger(process.env.REDIS_DEFAULT_TTL_SECONDS || '', DEFAULT_CACHE_TTL_SECONDS),
  taskRuntimeTtlSeconds: normalizeInteger(process.env.REDIS_TASK_RUNTIME_TTL_SECONDS || '', DEFAULT_TASK_RUNTIME_TTL_SECONDS),
  taskSnapshotTtlSeconds: normalizeInteger(process.env.REDIS_TASK_SNAPSHOT_TTL_SECONDS || '', DEFAULT_TASK_SNAPSHOT_TTL_SECONDS),
  taskAbortTtlSeconds: normalizeInteger(process.env.REDIS_TASK_ABORT_TTL_SECONDS || '', DEFAULT_TASK_ABORT_TTL_SECONDS),
  taskLockTtlMs: normalizeInteger(process.env.REDIS_TASK_LOCK_TTL_MS || '', DEFAULT_TASK_LOCK_TTL_MS),
  taskIdempotencyTtlSeconds: normalizeInteger(process.env.REDIS_TASK_IDEMPOTENCY_TTL_SECONDS || '', DEFAULT_TASK_IDEMPOTENCY_TTL_SECONDS),
  taskConcurrencyTtlSeconds: normalizeInteger(process.env.REDIS_TASK_CONCURRENCY_TTL_SECONDS || '', DEFAULT_TASK_CONCURRENCY_TTL_SECONDS),
  rateLimitWindowSeconds: normalizeInteger(process.env.REDIS_RATE_LIMIT_WINDOW_SECONDS || '', DEFAULT_RATE_LIMIT_WINDOW_SECONDS),
  taskSubmitRateLimit: normalizeInteger(process.env.REDIS_TASK_SUBMIT_RATE_LIMIT || '', DEFAULT_TASK_SUBMIT_RATE_LIMIT),
  taskUserConcurrencyLimit: normalizeInteger(process.env.REDIS_TASK_USER_CONCURRENCY_LIMIT || '', DEFAULT_TASK_USER_CONCURRENCY_LIMIT),
  taskProviderConcurrencyLimit: normalizeInteger(process.env.REDIS_TASK_PROVIDER_CONCURRENCY_LIMIT || '', DEFAULT_TASK_PROVIDER_CONCURRENCY_LIMIT),
  taskSkillConcurrencyLimit: normalizeInteger(process.env.REDIS_TASK_SKILL_CONCURRENCY_LIMIT || '', DEFAULT_TASK_SKILL_CONCURRENCY_LIMIT),
  authVerificationRateLimit: normalizeInteger(process.env.REDIS_AUTH_VERIFICATION_RATE_LIMIT || '', DEFAULT_AUTH_VERIFICATION_RATE_LIMIT),
  authLoginRateLimit: normalizeInteger(process.env.REDIS_AUTH_LOGIN_RATE_LIMIT || '', DEFAULT_AUTH_LOGIN_RATE_LIMIT),
  instanceId: `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
}

export const isRedisEnabled = () => Boolean(REDIS_CONFIG.enabled && REDIS_CONFIG.url)
