import { buildApiUrl } from './http'
import { readApiData } from './response'
import type { PersistedGenerationRecord } from './generation-records'
import { consumeSseStream, type SseMessage } from '@/utils/sse'
import type { GenerationTaskStreamEventBase } from '@/shared/generation-task-stream'
import { resolveRequestModelKey, resolveRequestProviderId } from '@/config/models'

// 重新导出失败码，便于业务代码 import { GenerationTaskFailureCode } from '@/api/generation-tasks'
export type { GenerationTaskFailureCode } from '@/shared/generation-task-stream'

export interface GenerationTaskStartPayload {
  sessionId?: string
  source?: string
  type: 'image' | 'agent'
  requestMode?: 'image-generation' | 'image-edit'
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

export interface ResolvedGenerationTaskModelInput {
  modelKey?: string
  fallbackModelKey?: string
  category: 'CHAT' | 'IMAGE'
  missingProviderMessage?: string
  missingModelMessage?: string
}

export interface ResolvedGenerationTaskModelResult {
  providerId: string
  modelKey: string
}

// 前端的 record 收紧为持久化记录类型
export type GenerationTaskStreamEvent = GenerationTaskStreamEventBase<PersistedGenerationRecord>

const GENERATION_TASKS_API_PATH = '/api/generation-tasks'

// 统一解析生成任务提交前要使用的厂商与模型。
export const resolveGenerationTaskModel = (
  input: ResolvedGenerationTaskModelInput,
): ResolvedGenerationTaskModelResult => {
  const sourceModelKey = String(input.modelKey || input.fallbackModelKey || '').trim()
  const resolvedModelKey = resolveRequestModelKey(sourceModelKey, input.category)
  const providerId = resolveRequestProviderId(sourceModelKey || resolvedModelKey, input.category)

  if (!providerId) {
    throw new Error(input.missingProviderMessage || '未匹配到后台模型配置，请先在后台配置可用模型')
  }

  if (!resolvedModelKey) {
    throw new Error(input.missingModelMessage || '缺少模型标识')
  }

  return {
    providerId,
    modelKey: resolvedModelKey,
  }
}

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
// 已内置自动重连（指数退避）+ watchdog（30s 无消息视为断流）。
const ALLOWED_STREAM_EVENT_TYPES = new Set([
  'connected', 'snapshot', 'progress', 'content_delta', 'thinking_delta',
  'agent_event', 'completed', 'failed', 'stopped',
])
const TERMINAL_EVENT_TYPES = new Set(['completed', 'failed', 'stopped'])
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000]
const WATCHDOG_TIMEOUT_MS = 30000
const WATCHDOG_CHECK_INTERVAL_MS = 5000

export const subscribeGenerationTaskEvents = async (
  taskId: string,
  options: RequestOptions & {
    onEvent: (event: GenerationTaskStreamEvent) => void
  },
) => {
  const externalSignal = options.signal
  let attempt = 0
  let terminated = false
  // 跟踪最后一个收到事件的 id，重连时传给服务端用于重放遗漏事件
  let lastEventId = 0

  while (!terminated) {
    if (externalSignal?.aborted) return

    const innerController = new AbortController()
    const onExternalAbort = () => innerController.abort()
    externalSignal?.addEventListener('abort', onExternalAbort)

    // watchdog：超过 30s 没收到任何事件（含心跳）就视为断流，主动 abort 触发重连
    let lastActivityAt = Date.now()
    const watchdogTimer = setInterval(() => {
      if (Date.now() - lastActivityAt > WATCHDOG_TIMEOUT_MS) {
        innerController.abort()
      }
    }, WATCHDOG_CHECK_INTERVAL_MS)

    let connected = false
    try {
      const url = lastEventId > 0
        ? `${GENERATION_TASKS_API_PATH}/${encodeURIComponent(taskId)}/events?lastEventId=${lastEventId}`
        : `${GENERATION_TASKS_API_PATH}/${encodeURIComponent(taskId)}/events`
      const response = await fetch(buildApiUrl(url), {
        method: 'GET',
        credentials: 'include',
        signal: innerController.signal,
        headers: {
          Accept: 'text/event-stream',
        },
      })

      if (!response.ok) {
        // HTTP 4xx/5xx 不重试（鉴权失败 / 任务不存在等永久错误）
        throw new Error(`订阅任务状态失败 (${response.status})`)
      }

      connected = true
      attempt = 0  // 一旦成功连接就重置退避计数

      await consumeSseStream(response, (message: SseMessage) => {
        lastActivityAt = Date.now()
        // 心跳事件仅用于刷新 watchdog，不向上派发
        if (message.event === 'ping') return
        if (!ALLOWED_STREAM_EVENT_TYPES.has(message.event)) return

        try {
          const parsed = JSON.parse(message.data) as GenerationTaskStreamEvent
          // 跟踪 lastEventId（优先 SSE 协议层 id，其次 payload.id）
          const incomingId = message.id
            ? Number.parseInt(message.id, 10)
            : (typeof parsed.id === 'number' ? parsed.id : 0)
          if (Number.isFinite(incomingId) && incomingId > lastEventId) {
            lastEventId = incomingId
          }
          options.onEvent(parsed)
          if (TERMINAL_EVENT_TYPES.has(parsed.type)) {
            terminated = true
          }
        } catch {
          // 忽略解析失败的事件消息。
        }
      })
    } catch (error) {
      // 用户主动取消：直接退出，不重连
      if (externalSignal?.aborted) return
      // 已经收到终止事件后再抛错也直接退出
      if (terminated) return
      // 永久性 HTTP 错误（4xx/5xx response.ok=false）不重试
      const message = error instanceof Error ? error.message : ''
      if (/订阅任务状态失败 \(4\d{2}\)/.test(message)) throw error
    } finally {
      clearInterval(watchdogTimer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }

    if (terminated || externalSignal?.aborted) return

    // 退避后重连
    if (attempt >= RETRY_DELAYS_MS.length) {
      throw new Error('订阅任务状态失败：超过最大重试次数')
    }
    const delay = RETRY_DELAYS_MS[attempt]
    attempt++
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, delay)
      externalSignal?.addEventListener('abort', () => {
        clearTimeout(timer)
        resolve(undefined)
      }, { once: true })
    })
    if (!connected && attempt === 1) {
      // 首次连接就失败，可能是网络层问题，继续重试
    }
  }
}
