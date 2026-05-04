import { REDIS_CONFIG, isRedisEnabled } from './config'
import { getBusinessCacheMetricsOverview } from './metrics'
import { getRedisClient } from './client'
import { redisKeys } from './keys'
import { pingRedis } from './health'
import { getSharedTaskRecentEvents, getSharedTaskRuntime, getSharedTaskSnapshot } from '../generation-tasks/runtime-store'
import { prisma } from '../db/prisma'

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

const countRedisKeys = async (pattern: string) => {
  const keys = await scanRedisKeys(pattern)
  return {
    count: keys.length,
    sampleKeys: keys.slice(0, 5),
  }
}

const getRedisKeyTtlSeconds = async (key: string) => {
  const client = await getRedisClient()
  if (!client) {
    return -2
  }

  return client.ttl(key)
}

const deleteRedisKeysByPattern = async (pattern: string) => {
  const client = await getRedisClient()
  if (!client) {
    return 0
  }

  const keys = await scanRedisKeys(pattern)
  if (!keys.length) {
    return 0
  }

  return client.del(...keys)
}

export const getRedisAdminOverview = async () => {
  const health = await pingRedis()
  const publicModelCatalogKey = redisKeys.cache('provider-config', 'public-model-catalog')
  const providerDiscoverCachePattern = redisKeys.cache('provider-model-discover', '*')
  const publicEnabledSkillsKey = redisKeys.cache('skill-config', 'public-enabled-skills')
  const runtimeSkillPattern = redisKeys.cache('runtime-skill', '*')
  const workspaceRuntimeSkillPattern = redisKeys.cache('workspace-runtime-skill', '*')
  const taskIdempotencyPattern = redisKeys.taskIdempotency('*')
  const taskUserConcurrencyPattern = redisKeys.taskUserConcurrency('*')
  const taskSkillConcurrencyPattern = redisKeys.taskSkillConcurrency('*')
  const taskProviderConcurrencyPattern = redisKeys.taskProviderConcurrency('*')
  const taskSubmitRatePattern = redisKeys.rateLimit('task-submit', '*')
  const providerModelDiscoverRatePattern = redisKeys.rateLimit('provider-model-discover', '*')
  const authVerificationRatePattern = redisKeys.rateLimit('auth-verification', '*')
  const authLoginRatePattern = redisKeys.rateLimit('auth-login', '*')

  const [
    providerCacheStats,
    providerDiscoverCacheStats,
    publicSkillsCacheStats,
    runtimeSkillCacheStats,
    workspaceRuntimeSkillCacheStats,
    taskRuntimeStats,
    taskSnapshotStats,
    taskAbortStats,
    taskLockStats,
    taskIdempotencyStats,
    taskUserConcurrencyStats,
    taskSkillConcurrencyStats,
    taskProviderConcurrencyStats,
    taskSubmitRateStats,
    providerModelDiscoverRateStats,
    authVerificationRateStats,
    authLoginRateStats,
    publicModelCatalogTtl,
    publicEnabledSkillsTtl,
    businessCaches,
  ] = await Promise.all([
    countRedisKeys(publicModelCatalogKey),
    countRedisKeys(providerDiscoverCachePattern),
    countRedisKeys(publicEnabledSkillsKey),
    countRedisKeys(runtimeSkillPattern),
    countRedisKeys(workspaceRuntimeSkillPattern),
    countRedisKeys(redisKeys.taskRuntime('*')),
    countRedisKeys(redisKeys.taskSnapshot('*')),
    countRedisKeys(redisKeys.taskAbort('*')),
    countRedisKeys(redisKeys.taskLock('*')),
    countRedisKeys(taskIdempotencyPattern),
    countRedisKeys(taskUserConcurrencyPattern),
    countRedisKeys(taskSkillConcurrencyPattern),
    countRedisKeys(taskProviderConcurrencyPattern),
    countRedisKeys(taskSubmitRatePattern),
    countRedisKeys(providerModelDiscoverRatePattern),
    countRedisKeys(authVerificationRatePattern),
    countRedisKeys(authLoginRatePattern),
    getRedisKeyTtlSeconds(publicModelCatalogKey),
    getRedisKeyTtlSeconds(publicEnabledSkillsKey),
    getBusinessCacheMetricsOverview(),
  ])

  const riskHints: Array<{ level: 'info' | 'warning' | 'danger'; message: string }> = []
  if (!health.ok && isRedisEnabled()) {
    riskHints.push({
      level: 'danger',
      message: 'Redis 已启用但健康检查失败，当前缓存、锁和广播链路可能已降级。',
    })
  }
  if (taskLockStats.count > taskRuntimeStats.count && taskLockStats.count > 0) {
    riskHints.push({
      level: 'warning',
      message: '任务锁数量高于 runtime 数量，可能存在未释放锁或异常退出后的残留锁。',
    })
  }
  if (taskAbortStats.count > 0) {
    riskHints.push({
      level: 'warning',
      message: '存在停止标记残留，建议检查是否有停止后的任务未完成清理。',
    })
  }
  if (taskSnapshotStats.count >= 10 && taskSnapshotStats.count > Math.max(taskRuntimeStats.count * 3, 10)) {
    riskHints.push({
      level: 'warning',
      message: '任务快照数量明显高于 runtime 数量，可能存在完成任务的快照未及时淘汰。',
    })
  }
  if (!riskHints.length) {
    riskHints.push({
      level: 'info',
      message: '当前未发现明显的 Redis 残留 key 风险。',
    })
  }

  return {
    enabled: isRedisEnabled(),
    prefix: REDIS_CONFIG.prefix,
    env: REDIS_CONFIG.env,
    instanceId: REDIS_CONFIG.instanceId,
    health,
    riskHints,
    caches: {
      providerCatalog: {
        key: publicModelCatalogKey,
        count: providerCacheStats.count,
        ttlSeconds: publicModelCatalogTtl,
        sampleKeys: providerCacheStats.sampleKeys,
      },
      providerDiscover: {
        pattern: providerDiscoverCachePattern,
        count: providerDiscoverCacheStats.count,
        sampleKeys: providerDiscoverCacheStats.sampleKeys,
      },
      publicEnabledSkills: {
        key: publicEnabledSkillsKey,
        count: publicSkillsCacheStats.count,
        ttlSeconds: publicEnabledSkillsTtl,
        sampleKeys: publicSkillsCacheStats.sampleKeys,
      },
      runtimeSkills: {
        pattern: runtimeSkillPattern,
        count: runtimeSkillCacheStats.count,
        sampleKeys: runtimeSkillCacheStats.sampleKeys,
      },
      workspaceRuntimeSkills: {
        pattern: workspaceRuntimeSkillPattern,
        count: workspaceRuntimeSkillCacheStats.count,
        sampleKeys: workspaceRuntimeSkillCacheStats.sampleKeys,
      },
    },
    tasks: {
      runtime: {
        pattern: redisKeys.taskRuntime('*'),
        count: taskRuntimeStats.count,
        sampleKeys: taskRuntimeStats.sampleKeys,
      },
      snapshot: {
        pattern: redisKeys.taskSnapshot('*'),
        count: taskSnapshotStats.count,
        sampleKeys: taskSnapshotStats.sampleKeys,
      },
      abort: {
        pattern: redisKeys.taskAbort('*'),
        count: taskAbortStats.count,
        sampleKeys: taskAbortStats.sampleKeys,
      },
      lock: {
        pattern: redisKeys.taskLock('*'),
        count: taskLockStats.count,
        sampleKeys: taskLockStats.sampleKeys,
      },
      idempotency: {
        pattern: taskIdempotencyPattern,
        count: taskIdempotencyStats.count,
        sampleKeys: taskIdempotencyStats.sampleKeys,
      },
      userConcurrency: {
        pattern: taskUserConcurrencyPattern,
        count: taskUserConcurrencyStats.count,
        sampleKeys: taskUserConcurrencyStats.sampleKeys,
      },
      skillConcurrency: {
        pattern: taskSkillConcurrencyPattern,
        count: taskSkillConcurrencyStats.count,
        sampleKeys: taskSkillConcurrencyStats.sampleKeys,
      },
      providerConcurrency: {
        pattern: taskProviderConcurrencyPattern,
        count: taskProviderConcurrencyStats.count,
        sampleKeys: taskProviderConcurrencyStats.sampleKeys,
      },
      submitRateLimit: {
        pattern: taskSubmitRatePattern,
        count: taskSubmitRateStats.count,
        sampleKeys: taskSubmitRateStats.sampleKeys,
      },
      providerDiscoverRateLimit: {
        pattern: providerModelDiscoverRatePattern,
        count: providerModelDiscoverRateStats.count,
        sampleKeys: providerModelDiscoverRateStats.sampleKeys,
      },
      authVerificationRateLimit: {
        pattern: authVerificationRatePattern,
        count: authVerificationRateStats.count,
        sampleKeys: authVerificationRateStats.sampleKeys,
      },
      authLoginRateLimit: {
        pattern: authLoginRatePattern,
        count: authLoginRateStats.count,
        sampleKeys: authLoginRateStats.sampleKeys,
      },
    },
    businessCaches,
  }
}

export const clearRedisCachesByScope = async (scope: 'provider-model-catalog' | 'skill-runtime' | 'task-runtime') => {
  if (scope === 'provider-model-catalog') {
    return {
      scope,
      deletedCount: await Promise.all([
        deleteRedisKeysByPattern(redisKeys.cache('provider-config', 'public-model-catalog')),
        deleteRedisKeysByPattern(redisKeys.cache('provider-model-discover', '*')),
        deleteRedisKeysByPattern(redisKeys.rateLimit('provider-model-discover', '*')),
      ]).then(results => results.reduce((sum, count) => sum + count, 0)),
    }
  }

  if (scope === 'skill-runtime') {
    const [publicEnabledSkillsDeleted, runtimeSkillsDeleted, workspaceRuntimeSkillsDeleted] = await Promise.all([
      deleteRedisKeysByPattern(redisKeys.cache('skill-config', 'public-enabled-skills')),
      deleteRedisKeysByPattern(redisKeys.cache('runtime-skill', '*')),
      deleteRedisKeysByPattern(redisKeys.cache('workspace-runtime-skill', '*')),
    ])

    return {
      scope,
      deletedCount: publicEnabledSkillsDeleted + runtimeSkillsDeleted + workspaceRuntimeSkillsDeleted,
    }
  }

  return {
    scope,
    deletedCount: await Promise.all([
      deleteRedisKeysByPattern(redisKeys.taskRuntime('*')),
      deleteRedisKeysByPattern(redisKeys.taskSnapshot('*')),
      deleteRedisKeysByPattern(redisKeys.taskRecentEvents('*')),
      deleteRedisKeysByPattern(redisKeys.taskAbort('*')),
      deleteRedisKeysByPattern(redisKeys.taskLock('*')),
      deleteRedisKeysByPattern(redisKeys.taskIdempotency('*')),
      deleteRedisKeysByPattern(redisKeys.taskUserConcurrency('*')),
      deleteRedisKeysByPattern(redisKeys.taskSkillConcurrency('*')),
      deleteRedisKeysByPattern(redisKeys.taskProviderConcurrency('*')),
      deleteRedisKeysByPattern(redisKeys.rateLimit('task-submit', '*')),
      deleteRedisKeysByPattern(redisKeys.rateLimit('auth-verification', '*')),
      deleteRedisKeysByPattern(redisKeys.rateLimit('auth-login', '*')),
    ]).then(results => results.reduce((sum, count) => sum + count, 0)),
  }
}

export const getRedisTaskDetail = async (recordId: string) => {
  const normalizedRecordId = String(recordId || '').trim()
  if (!normalizedRecordId) {
    throw new Error('缺少 recordId')
  }

  const client = await getRedisClient()
  const [runtime, snapshot, recentEvents, abortTtlSeconds, lockTtlMs, dbRecord] = await Promise.all([
    getSharedTaskRuntime(normalizedRecordId),
    getSharedTaskSnapshot<Record<string, unknown>>(normalizedRecordId),
    getSharedTaskRecentEvents(normalizedRecordId),
    client ? client.ttl(redisKeys.taskAbort(normalizedRecordId)) : Promise.resolve(-2),
    client ? client.pttl(redisKeys.taskLock(normalizedRecordId)) : Promise.resolve(-2),
    prisma.generationRecord.findUnique({
      where: { id: normalizedRecordId },
      include: {
        outputs: {
          orderBy: { sortOrder: 'asc' },
        },
        agentRun: {
          include: {
            steps: {
              orderBy: { sortOrder: 'asc' },
            },
            processSections: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    }),
  ])

  const snapshotAgentRun = snapshot?.agentRun && typeof snapshot.agentRun === 'object'
    ? snapshot.agentRun as Record<string, unknown>
    : null
  const snapshotOutputs = Array.isArray(snapshot?.outputs) ? snapshot.outputs : []
  const snapshotImages = Array.isArray(snapshot?.images) ? snapshot.images : []

  return {
    recordId: normalizedRecordId,
    runtime: runtime || null,
    abort: {
      exists: abortTtlSeconds > -2,
      ttlSeconds: abortTtlSeconds,
    },
    lock: {
      exists: lockTtlMs > -2,
      ttlMs: lockTtlMs,
    },
    recentEvents: Array.isArray(recentEvents) ? recentEvents : [],
    database: dbRecord
      ? {
          id: dbRecord.id,
          userId: dbRecord.userId,
          type: String(dbRecord.type || ''),
          status: String(dbRecord.status || ''),
          prompt: String(dbRecord.prompt || ''),
          modelKey: String(dbRecord.modelKey || ''),
          skill: String(dbRecord.skill || ''),
          error: String(dbRecord.errorMessage || ''),
          outputCount: Array.isArray(dbRecord.outputs) ? dbRecord.outputs.length : 0,
          imageCount: Array.isArray(dbRecord.outputs)
            ? dbRecord.outputs.filter(output => output.outputType === 'IMAGE' && output.url).length
            : 0,
          hasAgentRun: Boolean(dbRecord.agentRun),
          agentRunStatus: String(dbRecord.agentRun?.status || ''),
          createdAt: dbRecord.createdAt.toISOString(),
          updatedAt: dbRecord.updatedAt.toISOString(),
          finishedAt: dbRecord.finishedAt ? dbRecord.finishedAt.toISOString() : '',
        }
      : null,
    snapshot: snapshot
      ? {
          id: String(snapshot.id || ''),
          type: String(snapshot.type || ''),
          prompt: String(snapshot.prompt || ''),
          modelKey: String(snapshot.modelKey || ''),
          skill: String(snapshot.skill || ''),
          done: Boolean(snapshot.done),
          stopped: Boolean(snapshot.stopped),
          error: String(snapshot.error || ''),
          imageCount: snapshotImages.length,
          outputCount: snapshotOutputs.length,
          hasAgentRun: Boolean(snapshotAgentRun),
          agentRunStatus: String(snapshotAgentRun?.status || ''),
          updatedAt: String(snapshot.updatedAt || ''),
        }
      : null,
    governance: {
      queue: runtime?.queue
        ? {
            enteredAt: String(runtime.queue.enteredAt || ''),
            startedAt: String(runtime.queue.startedAt || ''),
            waitDurationMs: Number(runtime.queue.waitDurationMs || 0),
            reason: String(runtime.queue.reason || ''),
          }
        : null,
      retry: runtime?.retry
        ? {
            totalRetryCount: Number(runtime.retry.totalRetryCount || 0),
            burstRateRetryCount: Number(runtime.retry.burstRateRetryCount || 0),
            lastRetryAt: String(runtime.retry.lastRetryAt || ''),
            lastRetryStage: String(runtime.retry.lastRetryStage || ''),
            lastWaitDurationMs: Number(runtime.retry.lastWaitDurationMs || 0),
            lastStatusCode: Number(runtime.retry.lastStatusCode || 0),
            lastErrorPreview: String(runtime.retry.lastErrorPreview || ''),
          }
        : null,
      execution: runtime?.execution
        ? {
            lockAcquiredAt: String(runtime.execution.lockAcquiredAt || ''),
            lockLost: Boolean(runtime.execution.lockLost),
            completedAt: String(runtime.execution.completedAt || ''),
            lastErrorAt: String(runtime.execution.lastErrorAt || ''),
            lastErrorMessage: String(runtime.execution.lastErrorMessage || ''),
          }
        : null,
    },
  }
}
