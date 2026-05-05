import type { AgentWorkspaceEvent } from '../../src/shared/agent-workspace'
import type { GenerationTaskStreamEvent } from './shared'
import { appendSharedTaskRecentEvent, setSharedTaskSnapshot } from './runtime-store'
import { emitDistributedTaskStreamEvent } from './event-bus'

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
