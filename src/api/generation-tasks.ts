import { buildApiUrl } from './http'
import { readApiData } from './response'
import type { PersistedGenerationRecord } from './generation-records'
import { consumeSseStream, type SseMessage } from '@/utils/sse'
import type { AgentWorkspaceEvent } from '@/shared/agent-workspace'

export interface GenerationTaskStartPayload {
  sessionId?: string
  type: 'image' | 'agent'
  prompt: string
  model?: string
  modelKey?: string
  ratio?: string
  resolution?: string
  duration?: string
  feature?: string
  skill?: string
  referenceImages?: string[]
  requestBody?: Record<string, unknown>
}

interface RequestOptions {
  signal?: AbortSignal
}

export interface GenerationTaskStreamEvent {
  type: 'connected' | 'snapshot' | 'progress' | 'content_delta' | 'agent_event' | 'completed' | 'failed' | 'stopped'
  recordId: string
  done: boolean
  stopped?: boolean
  record?: PersistedGenerationRecord | null
  stage?: string
  message?: string
  delta?: string
  content?: string
  agentEvent?: AgentWorkspaceEvent
}

const GENERATION_TASKS_API_PATH = '/api/generation-tasks'

// 创建服务端生成任务，由后端继续运行并持续写回生成记录。
export const createGenerationTask = async (payload: GenerationTaskStartPayload, options: RequestOptions = {}) => {
  const response = await fetch(buildApiUrl(GENERATION_TASKS_API_PATH), {
    method: 'POST',
    credentials: 'include',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<PersistedGenerationRecord>(response, {
    showErrorMessage: true,
  })
}

// 获取单个服务端任务对应的最新生成记录。
export const getGenerationTask = async (taskId: string, options: RequestOptions = {}) => {
  const response = await fetch(buildApiUrl(`${GENERATION_TASKS_API_PATH}/${encodeURIComponent(taskId)}`), {
    method: 'GET',
    credentials: 'include',
    signal: options.signal,
  })

  return readApiData<PersistedGenerationRecord>(response)
}

// 停止服务端仍在运行的生成任务。
export const stopGenerationTask = async (taskId: string, options: RequestOptions = {}) => {
  const response = await fetch(buildApiUrl(`${GENERATION_TASKS_API_PATH}/${encodeURIComponent(taskId)}/stop`), {
    method: 'POST',
    credentials: 'include',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return readApiData<PersistedGenerationRecord>(response, {
    showErrorMessage: true,
  })
}

// 订阅任务的实时状态事件流，页面切换回来后可直接重连。
export const subscribeGenerationTaskEvents = async (
  taskId: string,
  options: RequestOptions & {
    onEvent: (event: GenerationTaskStreamEvent) => void
  },
) => {
  const response = await fetch(buildApiUrl(`${GENERATION_TASKS_API_PATH}/${encodeURIComponent(taskId)}/events`), {
    method: 'GET',
    credentials: 'include',
    signal: options.signal,
    headers: {
      Accept: 'text/event-stream',
    },
  })

  if (!response.ok) {
    throw new Error(`订阅任务状态失败 (${response.status})`)
  }

  await consumeSseStream(response, (message: SseMessage) => {
    if (!['connected', 'snapshot', 'progress', 'content_delta', 'agent_event', 'completed', 'failed', 'stopped'].includes(message.event)) {
      return
    }

    try {
      const parsed = JSON.parse(message.data) as GenerationTaskStreamEvent
      options.onEvent(parsed)
    } catch {
      // 忽略解析失败的事件消息。
    }
  })
}
