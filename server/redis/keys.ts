import { REDIS_CONFIG } from './config'

const buildNamespaceKey = (...parts: Array<string | number>) => {
  const normalizedParts = parts
    .map(part => String(part || '').trim())
    .filter(Boolean)

  return [REDIS_CONFIG.prefix, REDIS_CONFIG.env, ...normalizedParts].join(':')
}

export const redisKeys = {
  cache: (scope: string, identifier: string) => buildNamespaceKey('cache', scope, identifier),
  cacheMetricsModules: () => buildNamespaceKey('metrics', 'cache', 'modules'),
  cacheMetricsModuleSummary: (scope: string) => buildNamespaceKey('metrics', 'cache', 'summary', scope),
  cacheMetricsModuleHotKeys: (scope: string) => buildNamespaceKey('metrics', 'cache', 'hot-keys', scope),
  cacheMetricsModuleLargeValues: (scope: string) => buildNamespaceKey('metrics', 'cache', 'large-values', scope),
  taskRuntime: (recordId: string) => buildNamespaceKey('task', 'runtime', recordId),
  taskSnapshot: (recordId: string) => buildNamespaceKey('task', 'snapshot', recordId),
  taskRecentEvents: (recordId: string) => buildNamespaceKey('task', 'recent-events', recordId),
  taskAbort: (recordId: string) => buildNamespaceKey('task', 'abort', recordId),
  taskLock: (recordId: string) => buildNamespaceKey('task', 'lock', recordId),
  taskIdempotency: (hash: string) => buildNamespaceKey('task', 'idempotency', hash),
  taskUserConcurrency: (userId: string) => buildNamespaceKey('task', 'user-concurrency', userId),
  taskSkillConcurrency: (skillKey: string) => buildNamespaceKey('task', 'skill-concurrency', skillKey),
  taskProviderConcurrency: (providerKey: string) => buildNamespaceKey('task', 'provider-concurrency', providerKey),
  taskEventChannel: (recordId: string) => buildNamespaceKey('task', 'event', recordId),
  rateLimit: (scope: string, identifier: string) => buildNamespaceKey('rate', scope, identifier),
}
