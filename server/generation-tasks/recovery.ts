import { prisma, isPrismaConfigured } from '../db/prisma'
import { getRedisClient, isRedisEnabled, redisKeys } from '../redis'
import { invalidateGenerationRecordsCache } from '../generation-records/service'
import { markSkillExecutionRun } from '../skill-config/execution-service'
import { patchSharedTaskRuntime } from './runtime-store'
import { writeScopedLog } from '../shared/logging'

type ExecutionLockState = 'active' | 'inactive' | 'unknown'

const GENERATION_TASK_RECOVERY_LIMIT = Number.parseInt(process.env.GENERATION_TASK_RECOVERY_LIMIT || '500', 10)
const RECOVERY_ERROR_MESSAGE = '服务重启导致任务中断，可重试'

/** 仅在没有仍被其他实例持有的执行锁时，才允许启动恢复器结束任务。 */
export const shouldFinalizeInterruptedGenerationTask = (lockState: ExecutionLockState) => lockState === 'inactive'

// 服务重启只能收口没有结果的遗留任务；已写入任意输出的任务必须保留结果并视为完成。
export const resolveInterruptedTaskTerminalStatus = (hasOutput: boolean) => hasOutput ? 'COMPLETED' : 'FAILED'

const getExecutionLockState = async (recordId: string): Promise<ExecutionLockState> => {
  if (!isRedisEnabled()) return 'inactive'
  try {
    const client = await getRedisClient()
    if (!client) return 'unknown'
    return await client.get(redisKeys.taskLock(recordId)) ? 'active' : 'inactive'
  } catch {
    // Redis 连接异常时无法安全判断是否有其他实例继续执行，保留记录等待下一次恢复。
    return 'unknown'
  }
}

/**
 * 服务启动时收口上一进程遗留的任务。任务请求的原始 payload 不会落库，
 * 因此这里不盲目重放，统一标记为失败并沿用现有“重试”能力。
 */
export const recoverInterruptedGenerationTasks = async () => {
  if (!isPrismaConfigured()) return { recovered: 0, activeElsewhere: 0, deferred: 0 }

  // 只处理恢复器启动前已存在的记录，避免服务开始接收请求后把新建任务误判为遗留任务。
  const recoveryStartedAt = new Date()

  const records = await prisma.generationRecord.findMany({
    where: {
      status: { in: ['PENDING', 'RUNNING'] },
      createdAt: { lt: recoveryStartedAt },
    },
    select: {
      id: true,
      userId: true,
      outputs: {
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: Number.isFinite(GENERATION_TASK_RECOVERY_LIMIT) && GENERATION_TASK_RECOVERY_LIMIT > 0
      ? GENERATION_TASK_RECOVERY_LIMIT
      : 500,
  })

  const affectedUsers = new Set<string>()
  let recovered = 0
  let activeElsewhere = 0
  let deferred = 0

  for (const record of records) {
    const lockState = await getExecutionLockState(record.id)
    if (!shouldFinalizeInterruptedGenerationTask(lockState)) {
      if (lockState === 'active') activeElsewhere += 1
      else deferred += 1
      continue
    }

    const hasOutput = record.outputs.length > 0
    const terminalStatus = resolveInterruptedTaskTerminalStatus(hasOutput)
    const errorMessage = hasOutput ? null : RECOVERY_ERROR_MESSAGE

    // 条件更新保证多实例同时启动时，只有一个实例能完成收口。
    const result = await prisma.generationRecord.updateMany({
      where: { id: record.id, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: terminalStatus, errorMessage, finishedAt: new Date() },
    })
    if (!result.count) continue

    recovered += 1
    affectedUsers.add(record.userId)
    await markSkillExecutionRun(record.id, hasOutput ? 'COMPLETED' : 'FAILED', {
      recovery: 'server_restart',
      message: hasOutput ? '服务重启后已保留已写入的生成结果' : RECOVERY_ERROR_MESSAGE,
    })
    await patchSharedTaskRuntime(record.id, current => current
      ? {
          ...current,
          status: hasOutput ? 'completed' : 'failed',
          updatedAt: new Date().toISOString(),
          execution: {
            ...current.execution,
            completedAt: new Date().toISOString(),
            lastErrorAt: hasOutput ? current.execution?.lastErrorAt || '' : new Date().toISOString(),
            lastErrorMessage: hasOutput ? current.execution?.lastErrorMessage || '' : RECOVERY_ERROR_MESSAGE,
          },
        }
      : current)
  }

  await Promise.all([...affectedUsers].map(userId => invalidateGenerationRecordsCache(userId)))
  const summary = { recovered, activeElsewhere, deferred }
  writeScopedLog('info', '生成任务恢复器', '启动恢复完成', summary)
  return summary
}
