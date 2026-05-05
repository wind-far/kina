import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import type { GenerationRecordPayload } from '../generation-records/shared'
import type { GenerationTaskStrategyKey } from './strategy'
import type { AgentRunState } from '../../src/types/agent'

export type TaskAbortReason = 'user_stop' | 'shared_stop' | 'execution_lock_lost'

type SettlementTask = {
  recordId: string
  userId: string
  strategyKey: string
}

type SettlementRecord = Record<string, unknown> & {
  content?: string
  agentRun?: AgentRunState | null
}

type EmitTaskProgressEvent = (recordId: string, event: {
  stage: string
  stopped?: boolean
  message?: string
}) => void

type EmitTaskStreamEvent = (recordId: string, event: GenerationTaskStreamEvent) => void

export interface GenerationTaskExecutionStrategyContext {
  executeImageGenerationTask: (task: SettlementTask, payload: GenerationTaskStartPayload) => Promise<void>
  executeAgentChatTask: (task: SettlementTask, payload: GenerationTaskStartPayload) => Promise<void>
  executeAgentWorkspaceTask: (task: SettlementTask, payload: GenerationTaskStartPayload) => Promise<void>
  refundTaskPointsIfNeeded: (task: SettlementTask, reason: string) => Promise<void>
  markTaskExecutionState: (task: SettlementTask, input: {
    lastErrorAt?: string
    lastErrorMessage?: string
  }) => Promise<void>
  emitTaskProgressEvent: EmitTaskProgressEvent
  emitTaskStreamEvent: EmitTaskStreamEvent
  buildInitialRecordPayload: (payload: GenerationTaskStartPayload) => GenerationRecordPayload
  updateGenerationRecord: (recordId: string, payload: GenerationRecordPayload, currentUserId: string) => Promise<void>
  getGenerationRecordById: (recordId: string, currentUserId: string) => Promise<SettlementRecord>
  syncSharedTaskRuntime: (task: SettlementTask, status: 'stopped' | 'failed') => Promise<void>
  buildAgentStoppedRun: (agentRun: AgentRunState, message: string) => AgentRunState
  buildAgentErrorRun: (agentRun: AgentRunState, message: string) => AgentRunState
  normalizeGenerationErrorMessage: (error: unknown, fallbackMessage: string) => string
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
  logGenerationTaskError: (stage: string, error: unknown, detail: Record<string, unknown>) => void
}

export interface GenerationTaskExecutionStrategy {
  key: GenerationTaskStrategyKey
  execute: (
    task: SettlementTask,
    payload: GenerationTaskStartPayload,
    context: GenerationTaskExecutionStrategyContext,
  ) => Promise<void>
  handleStopped: (
    task: SettlementTask,
    payload: GenerationTaskStartPayload,
    context: GenerationTaskExecutionStrategyContext,
  ) => Promise<void>
  handleFailed: (
    task: SettlementTask,
    payload: GenerationTaskStartPayload,
    error: unknown,
    errorMessage: string,
    context: GenerationTaskExecutionStrategyContext,
  ) => Promise<void>
  resolveFailureMessage: (
    error: unknown,
    abortReason: TaskAbortReason | '',
    context: GenerationTaskExecutionStrategyContext,
  ) => string
}

// 图片生成任务的收口逻辑相对固定，集中在这里，避免 service.ts 持续堆分支。
const imageTaskExecutionStrategy: GenerationTaskExecutionStrategy = {
  key: 'image',
  execute(task, payload, context) {
    return context.executeImageGenerationTask(task, payload)
  },
  async handleStopped(task, payload, context) {
    await context.refundTaskPointsIfNeeded(task, 'task_aborted')
    await context.markTaskExecutionState(task, {
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: '任务已收到停止指令',
    })
    context.emitTaskProgressEvent(task.recordId, {
      stage: 'stopping',
      stopped: true,
      message: '任务已收到停止指令，正在收口状态',
    })
    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      done: true,
      stopped: true,
      error: '',
      images: [],
    }, task.userId)
    const stoppedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.syncSharedTaskRuntime(task, 'stopped')
    context.emitTaskStreamEvent(task.recordId, {
      type: 'stopped',
      recordId: task.recordId,
      done: true,
      stopped: true,
      record: stoppedRecord,
      stage: 'stopped',
      message: '任务已停止',
    })
    context.logGenerationTask('image_task:stopped', {
      recordId: task.recordId,
      userId: task.userId,
    })
  },
  async handleFailed(task, payload, error, errorMessage, context) {
    await context.refundTaskPointsIfNeeded(task, 'task_failed')
    await context.markTaskExecutionState(task, {
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: errorMessage,
    })
    context.emitTaskProgressEvent(task.recordId, {
      stage: 'failing',
      message: '任务执行异常，正在写入失败状态',
    })
    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      done: true,
      stopped: false,
      error: errorMessage,
      images: [],
    }, task.userId)
    const failedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.syncSharedTaskRuntime(task, 'failed')
    context.emitTaskStreamEvent(task.recordId, {
      type: 'failed',
      recordId: task.recordId,
      done: true,
      stopped: false,
      record: failedRecord,
      stage: 'failed',
      message: errorMessage,
    })
    context.logGenerationTaskError('image_task:failed', error, {
      recordId: task.recordId,
      userId: task.userId,
    })
  },
  resolveFailureMessage(error, abortReason, context) {
    if (abortReason === 'execution_lock_lost') {
      return '任务执行锁已失效，系统已中断本次生成'
    }

    return context.normalizeGenerationErrorMessage(error, '图片生成失败')
  },
}

// Agent 对话任务需要保留已有内容，因此与图片任务分开策略化处理。
const agentChatTaskExecutionStrategy: GenerationTaskExecutionStrategy = {
  key: 'agent-chat',
  execute(task, payload, context) {
    return context.executeAgentChatTask(task, payload)
  },
  async handleStopped(task, payload, context) {
    await context.refundTaskPointsIfNeeded(task, 'task_aborted')
    await context.markTaskExecutionState(task, {
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: '任务已收到停止指令',
    })
    context.emitTaskProgressEvent(task.recordId, {
      stage: 'stopping',
      stopped: true,
      message: '任务已收到停止指令，正在收口状态',
    })
    const currentRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      content: String(currentRecord.content || ''),
      done: true,
      stopped: true,
      error: '',
    }, task.userId)
    const stoppedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.syncSharedTaskRuntime(task, 'stopped')
    context.emitTaskStreamEvent(task.recordId, {
      type: 'stopped',
      recordId: task.recordId,
      done: true,
      stopped: true,
      record: stoppedRecord,
      stage: 'stopped',
      message: '任务已停止',
    })
  },
  async handleFailed(task, payload, error, errorMessage, context) {
    await context.refundTaskPointsIfNeeded(task, 'task_failed')
    await context.markTaskExecutionState(task, {
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: errorMessage,
    })
    context.emitTaskProgressEvent(task.recordId, {
      stage: 'failing',
      message: '任务执行异常，正在写入失败状态',
    })
    const currentRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      content: String(currentRecord.content || ''),
      done: true,
      stopped: false,
      error: errorMessage,
    }, task.userId)
    const failedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.syncSharedTaskRuntime(task, 'failed')
    context.emitTaskStreamEvent(task.recordId, {
      type: 'failed',
      recordId: task.recordId,
      done: true,
      stopped: false,
      record: failedRecord,
      stage: 'failed',
      message: errorMessage,
    })
    context.logGenerationTaskError('agent_task:failed', error, {
      recordId: task.recordId,
      userId: task.userId,
    })
  },
  resolveFailureMessage(error, abortReason, context) {
    if (abortReason === 'execution_lock_lost') {
      return '任务执行锁已失效，系统已中断本次任务'
    }

    return context.normalizeGenerationErrorMessage(error, '对话生成失败')
  },
}

// Agent 工作台任务需要同步 agentRun 的停止态与失败态，因此单独策略化。
const agentWorkspaceTaskExecutionStrategy: GenerationTaskExecutionStrategy = {
  key: 'agent-workspace',
  execute(task, payload, context) {
    return context.executeAgentWorkspaceTask(task, payload)
  },
  async handleStopped(task, payload, context) {
    await context.refundTaskPointsIfNeeded(task, 'task_aborted')
    await context.markTaskExecutionState(task, {
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: '任务已收到停止指令',
    })
    const currentRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    const stoppedRun = currentRecord.agentRun
      ? context.buildAgentStoppedRun(currentRecord.agentRun, '任务已停止')
      : null
    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      content: '',
      agentRun: stoppedRun,
      done: true,
      stopped: true,
      error: '',
    }, task.userId)
    const stoppedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.syncSharedTaskRuntime(task, 'stopped')
    context.emitTaskStreamEvent(task.recordId, {
      type: 'stopped',
      recordId: task.recordId,
      done: true,
      stopped: true,
      record: stoppedRecord,
      stage: 'stopped',
      message: '任务已停止',
    })
  },
  async handleFailed(task, payload, error, errorMessage, context) {
    await context.refundTaskPointsIfNeeded(task, 'task_failed')
    await context.markTaskExecutionState(task, {
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: errorMessage,
    })
    const currentRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    const errorRun = currentRecord.agentRun
      ? context.buildAgentErrorRun(currentRecord.agentRun, errorMessage)
      : null
    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      content: '',
      agentRun: errorRun,
      done: true,
      stopped: false,
      error: errorMessage,
    }, task.userId)
    const failedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.syncSharedTaskRuntime(task, 'failed')
    context.emitTaskStreamEvent(task.recordId, {
      type: 'failed',
      recordId: task.recordId,
      done: true,
      stopped: false,
      record: failedRecord,
      stage: 'failed',
      message: errorMessage,
    })
    context.logGenerationTaskError('agent_workspace_task:failed', error, {
      recordId: task.recordId,
      userId: task.userId,
    })
  },
  resolveFailureMessage(error, abortReason, context) {
    if (abortReason === 'execution_lock_lost') {
      return '任务执行锁已失效，系统已中断本次任务'
    }

    return context.normalizeGenerationErrorMessage(error, '对话生成失败')
  },
}

const EXECUTION_STRATEGY_REGISTRY: Record<GenerationTaskStrategyKey, GenerationTaskExecutionStrategy> = {
  image: imageTaskExecutionStrategy,
  'agent-chat': agentChatTaskExecutionStrategy,
  'agent-workspace': agentWorkspaceTaskExecutionStrategy,
}

// 按策略键获取执行策略；当前优先承接停止/失败收口逻辑。
export const getGenerationTaskExecutionStrategy = (strategyKey: GenerationTaskStrategyKey) => {
  const strategy = EXECUTION_STRATEGY_REGISTRY[strategyKey]
  if (!strategy) {
    throw new Error('未找到对应的生成任务执行策略')
  }

  return strategy
}
