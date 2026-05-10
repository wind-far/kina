import type { AgentWorkspaceEvent } from '../../src/shared/agent-workspace'
import type { GenerationTaskStreamEvent, GenerationTaskFailureCode } from './shared'
import { appendSharedTaskRecentEvent, setSharedTaskSnapshot } from './runtime-store'
import { emitDistributedTaskStreamEvent } from './event-bus'
import { allocateEventId, recordReplayEvent } from './task-event-replay'

type TaskEventLogger = (stage: string, error: unknown, detail: Record<string, unknown>) => void

interface TaskEventEmitterContext {
  logGenerationTaskError: TaskEventLogger
}

// 统一下发任务事件，并顺手写入 Redis 快照与最近事件摘要，避免各处重复处理。
export const emitTaskStreamEvent = (
  recordId: string,
  event: GenerationTaskStreamEvent,
  context: TaskEventEmitterContext,
) => {
  // 同步分配单调 id（用于客户端断线重连时定位重放起点）
  if (event.id === undefined) {
    event.id = allocateEventId(recordId)
    recordReplayEvent(recordId, { id: event.id, event })
  }

  if (event.record) {
    void setSharedTaskSnapshot(recordId, event.record).catch((error) => {
      context.logGenerationTaskError('task_snapshot_cache_failed', error, {
        recordId,
        eventType: event.type,
      })
    })
  }

  void appendSharedTaskRecentEvent(recordId, event).catch((error) => {
    context.logGenerationTaskError('task_recent_event_cache_failed', error, {
      recordId,
      eventType: event.type,
      stage: event.stage || null,
    })
  })

  emitDistributedTaskStreamEvent(recordId, event)
}

export const emitTaskProgressEvent = (
  recordId: string,
  input: {
    stage: string
    message: string
    done?: boolean
    stopped?: boolean
    record?: Record<string, unknown> | null
  },
  context: TaskEventEmitterContext,
) => {
  emitTaskStreamEvent(recordId, {
    type: 'progress',
    recordId,
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    stage: input.stage,
    message: input.message,
    record: input.record,
  }, context)
}

export const emitTaskContentDeltaEvent = (
  recordId: string,
  input: {
    stage: string
    delta: string
    content: string
  },
  context: TaskEventEmitterContext,
) => {
  emitTaskStreamEvent(recordId, {
    type: 'content_delta',
    recordId,
    done: false,
    stopped: false,
    stage: input.stage,
    delta: input.delta,
    content: input.content,
    message: '对话内容持续生成中',
  }, context)
}

export const emitTaskThinkingDeltaEvent = (
  recordId: string,
  input: {
    stage: string
    thinkingDelta: string
    thinkingContent: string
  },
  context: TaskEventEmitterContext,
) => {
  emitTaskStreamEvent(recordId, {
    type: 'thinking_delta',
    recordId,
    done: false,
    stopped: false,
    stage: input.stage,
    thinkingDelta: input.thinkingDelta,
    thinkingContent: input.thinkingContent,
    message: '模型正在深度思考',
  }, context)
}

export const emitTaskAgentEvent = (
  recordId: string,
  input: {
    agentEvent: AgentWorkspaceEvent
    record?: Record<string, unknown> | null
    done?: boolean
    stopped?: boolean
    stage?: string
    message?: string
  },
  context: TaskEventEmitterContext,
) => {
  emitTaskStreamEvent(recordId, {
    type: 'agent_event',
    recordId,
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    record: input.record,
    stage: input.stage,
    message: input.message,
    agentEvent: input.agentEvent,
  }, context)
}

// 标准化的失败事件发送：带 errorCode + errorReason，便于前端区分错误类型
export const emitTaskFailedEvent = (
  recordId: string,
  input: {
    errorCode: GenerationTaskFailureCode
    errorReason: string
    message?: string
    stage?: string
    record?: Record<string, unknown> | null
  },
  context: TaskEventEmitterContext,
) => {
  emitTaskStreamEvent(recordId, {
    type: 'failed',
    recordId,
    done: true,
    stopped: false,
    record: input.record,
    stage: input.stage || 'failed',
    message: input.message || input.errorReason,
    errorCode: input.errorCode,
    errorReason: input.errorReason,
  }, context)
}
