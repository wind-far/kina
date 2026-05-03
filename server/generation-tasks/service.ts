import { getGenerationRecordById, createGenerationRecord, updateGenerationRecord } from '../generation-records/service'
import type { GenerationRecordPayload } from '../generation-records/shared'
import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import { getPublicModelCatalog, resolveGatewayProviderUpstream } from '../provider-config/service'
import {
  attachGenerationPointRecordId,
  consumeGenerationPoints,
  refundGenerationPoints,
  resolveGenerationPointCost,
} from '../marketing-center/service'
import { resolveGenerationTaskStrategy, type GenerationTaskStrategyKey } from './strategy'
import { buildAgentChatMessages } from '../../src/shared/agent-skills-core'
import {
  AgentWorkspaceStoppedError,
  getAgentWorkspaceSkillMeta,
  buildWorkspaceCompletionSummary,
  getWorkspaceRandomDelay,
  planAgentWorkspace,
  sleepWithWorkspaceAbort,
  workspaceTimingProfile,
} from './agent-workspace-runtime'
import {
  applyAgentWorkspaceEvent,
  buildAgentErrorRun,
  buildAgentPendingRun,
  buildAgentStoppedRun,
  type AgentWorkspaceEvent,
} from '../../src/shared/agent-workspace'
import { normalizeGenerationErrorMessage } from '../../src/shared/generation-error'

interface RunningGenerationTask {
  recordId: string
  userId: string
  type: 'image' | 'agent'
  strategyKey: GenerationTaskStrategyKey
  abortController: AbortController
  associationNo: string
  billedEndpointType: 'chat' | 'image' | 'video'
  billedPointCost: number
  billedProviderId: string
  billedModelKey: string
  billedModelName: string
  refundCommitted: boolean
}

const runningGenerationTasks = new Map<string, RunningGenerationTask>()
const taskStreamSubscribers = new Map<string, Set<any>>()

// 统一输出生成任务日志，方便排查离页后任务是否仍在服务端继续执行。
const logGenerationTask = (stage: string, detail: Record<string, unknown>) => {
  console.log('[generation-tasks]', stage, JSON.stringify(detail))
}

// 统一输出生成任务异常日志。
const logGenerationTaskError = (stage: string, error: unknown, detail: Record<string, unknown>) => {
  const err = error as { message?: string; stack?: string }
  console.error('[generation-tasks][service-error]', stage, JSON.stringify({
    ...detail,
    errorMessage: err?.message || '未知异常',
    errorStack: err?.stack || null,
  }))
}

const BURST_RATE_RETRY_DELAYS = [1200, 2600, 5200]

const sleepWithAbortSignal = async (signal: AbortSignal, durationMs: number) => {
  if (durationMs <= 0) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, durationMs)

    const handleAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', handleAbort)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

const parseRetryAfterMs = (response: Response) => {
  const retryAfterValue = String(response.headers.get('retry-after') || '').trim()
  if (!retryAfterValue) {
    return 0
  }

  const seconds = Number(retryAfterValue)
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000
  }

  const retryAt = Date.parse(retryAfterValue)
  if (Number.isFinite(retryAt)) {
    return Math.max(retryAt - Date.now(), 0)
  }

  return 0
}

const isBurstRateLimitedResponse = (status: number, responseText: string) => {
  if (status === 429) {
    return true
  }

  const normalizedText = String(responseText || '').trim()
  if (!normalizedText) {
    return false
  }

  return /limit_burst_rate/i.test(normalizedText)
    || /Request rate increased too quickly/i.test(normalizedText)
}

const fetchWithBurstRateRetry = async (input: {
  url: string
  init: RequestInit
  signal: AbortSignal
  stage: string
  detail: Record<string, unknown>
}) => {
  for (let attemptIndex = 0; attemptIndex <= BURST_RATE_RETRY_DELAYS.length; attemptIndex += 1) {
    const response = await fetch(input.url, {
      ...input.init,
      signal: input.signal,
    })

    if (response.ok) {
      return response
    }

    const responseText = await response.clone().text().catch(() => '')
    const isBurstRateLimited = isBurstRateLimitedResponse(response.status, responseText)
    if (!isBurstRateLimited || attemptIndex >= BURST_RATE_RETRY_DELAYS.length) {
      return response
    }

    const retryAfterMs = parseRetryAfterMs(response)
    const baseDelayMs = BURST_RATE_RETRY_DELAYS[attemptIndex]
    const jitterMs = Math.floor(Math.random() * 400)
    const waitDurationMs = Math.max(retryAfterMs, baseDelayMs + jitterMs)

    logGenerationTask(`${input.stage}:burst_rate_retry`, {
      ...input.detail,
      status: response.status,
      attempt: attemptIndex + 1,
      waitDurationMs,
      errorPreview: responseText.slice(0, 240),
    })

    await sleepWithAbortSignal(input.signal, waitDurationMs)
  }

  throw new Error('上游请求重试流程异常结束')
}

// 向当前任务的所有 SSE 订阅者广播最新状态。
const emitTaskStreamEvent = (recordId: string, event: GenerationTaskStreamEvent) => {
  const subscribers = taskStreamSubscribers.get(recordId)
  if (!subscribers?.size) {
    return
  }

  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  for (const res of subscribers) {
    try {
      res.write(payload)
    } catch {
      subscribers.delete(res)
    }
  }

  if (!subscribers.size) {
    taskStreamSubscribers.delete(recordId)
  }
}

// 推送当前任务的业务阶段进度，让事件流更易理解。
const emitTaskProgressEvent = (recordId: string, input: {
  stage: string
  message: string
  done?: boolean
  stopped?: boolean
  record?: Record<string, unknown> | null
}) => {
  emitTaskStreamEvent(recordId, {
    type: 'progress',
    recordId,
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    stage: input.stage,
    message: input.message,
    record: input.record,
  })
}

// 向前端推送文本增量，供通用对话任务直接流式展示。
const emitTaskContentDeltaEvent = (recordId: string, input: {
  stage: string
  delta: string
  content: string
}) => {
  emitTaskStreamEvent(recordId, {
    type: 'content_delta',
    recordId,
    done: false,
    stopped: false,
    stage: input.stage,
    delta: input.delta,
    content: input.content,
    message: '对话内容持续生成中',
  })
}

// 向前端广播技能工作台事件，并同步附带最新记录快照。
const emitTaskAgentEvent = (recordId: string, input: {
  agentEvent: AgentWorkspaceEvent
  record?: Record<string, unknown> | null
  done?: boolean
  stopped?: boolean
  stage?: string
  message?: string
}) => {
  emitTaskStreamEvent(recordId, {
    type: 'agent_event',
    recordId,
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    record: input.record,
    stage: input.stage,
    message: input.message,
    agentEvent: input.agentEvent,
  })
}

// 当服务端内存里已经没有运行中的任务，但数据库里仍是未完成态时，
// 说明它多半是旧实例遗留或异常中断，需要主动回收，避免前端一直订阅。
const resolveTaskRecordSnapshot = async (recordId: string, currentUserId: string) => {
  let record = await getGenerationRecordById(recordId, currentUserId)

  if (
    !record.done
    && !record.stopped
    && !runningGenerationTasks.has(recordId)
  ) {
    await updateGenerationRecord(recordId, {
      type: record.type,
      prompt: record.prompt,
      content: record.content,
      error: record.error,
      model: record.model,
      modelKey: record.modelKey,
      ratio: record.ratio,
      resolution: record.resolution,
      duration: record.duration,
      feature: record.feature,
      skill: record.skill,
      done: true,
      stopped: true,
      images: record.images,
      agentRun: record.agentRun,
    }, currentUserId)

    record = await getGenerationRecordById(recordId, currentUserId)
  }

  return record
}

// 注册 SSE 订阅连接，并立即推送一次当前快照。
export const subscribeGenerationTaskStream = async (recordId: string, currentUserId: string, res: any) => {
  const record = await resolveTaskRecordSnapshot(recordId, currentUserId)

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  let subscribers = taskStreamSubscribers.get(recordId)
  if (!subscribers) {
    subscribers = new Set()
    taskStreamSubscribers.set(recordId, subscribers)
  }
  subscribers.add(res)

  res.write(`event: connected\ndata: ${JSON.stringify({
    type: 'connected',
    recordId,
    done: Boolean(record.done),
    stopped: Boolean(record.stopped),
    stage: record.done ? 'connected_completed' : 'connected_running',
    message: '任务事件流已连接',
  } satisfies GenerationTaskStreamEvent)}\n\n`)
  res.write(`event: snapshot\ndata: ${JSON.stringify({
    type: 'snapshot',
    recordId,
    done: Boolean(record.done),
    stopped: Boolean(record.stopped),
    record,
    stage: record.done ? 'snapshot_completed' : 'snapshot_running',
    message: record.done ? '已返回任务最终快照' : '已返回任务当前快照',
  } satisfies GenerationTaskStreamEvent)}\n\n`)

  // 已完成任务只需要返回一次快照，避免继续挂长连接和心跳。
  if (record.done) {
    res.end()
    return
  }

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      // 连接写入失败时，由 close 事件统一清理。
    }
  }, 15000)

  const cleanup = () => {
    clearInterval(heartbeatTimer)
    const currentSubscribers = taskStreamSubscribers.get(recordId)
    if (!currentSubscribers) {
      return
    }
    currentSubscribers.delete(res)
    if (!currentSubscribers.size) {
      taskStreamSubscribers.delete(recordId)
    }
  }

  res.on('close', cleanup)
  res.on('error', cleanup)
}

const buildGatewayAssociationNo = () => {
  return `GTK${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

const isChatCompletionsEndpoint = (endpoint: string) => {
  return /chat\/completions/i.test(String(endpoint || '').trim())
}

const buildInitialRecordPayload = (payload: GenerationTaskStartPayload): GenerationRecordPayload => ({
  sessionId: String(payload.sessionId || '').trim() || undefined,
  type: payload.type,
  prompt: String(payload.prompt || '').trim(),
  content: '',
  error: '',
  model: String(payload.model || '').trim(),
  modelKey: String(payload.modelKey || '').trim(),
  ratio: String(payload.ratio || '').trim(),
  resolution: String(payload.resolution || '').trim(),
  duration: String(payload.duration || '').trim(),
  feature: String(payload.feature || '').trim(),
  skill: String(payload.skill || '').trim() || 'general',
  referenceImages: Array.isArray(payload.referenceImages) ? [...payload.referenceImages] : [],
  done: false,
  stopped: false,
  images: [],
})

const extractImageUrlsFromJsonResponse = (result: any) => {
  const urls: string[] = []

  if (!Array.isArray(result?.data)) {
    return urls
  }

  for (const item of result.data) {
    if (item?.url) {
      urls.push(item.url)
      continue
    }

    if (item?.b64_json) {
      urls.push(`data:image/png;base64,${item.b64_json}`)
    }
  }

  return urls
}

const extractImageUrlsFromStreamResponse = async (response: Response, signal: AbortSignal) => {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('图片流式响应缺少可读数据')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  const imageUrls: string[] = []

  while (!signal.aborted) {
    let readResult: ReadableStreamReadResult<Uint8Array>
    try {
      readResult = await reader.read()
    } catch {
      break
    }

    const { done, value } = readResult
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let boundaryIndex = -1
    while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
      const message = buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex + 2)

      for (const line of message.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const chunk = trimmed.slice(5).trim()
        if (chunk === '[DONE]') continue

        try {
          const parsed = JSON.parse(chunk)
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content) fullContent += delta.content
          if (Array.isArray(delta?.images)) {
            for (const img of delta.images) {
              const url = img?.image_url?.url
              if (url) imageUrls.push(url)
            }
          }
          if (delta?.inline_data?.data) {
            imageUrls.push(`data:${delta.inline_data.mime_type};base64,${delta.inline_data.data}`)
          }
        } catch {
          // 跳过无效 SSE 数据块，继续处理后续消息。
        }
      }
    }
  }

  const markdownImages = fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)
  if (markdownImages) {
    for (const item of markdownImages) {
      const matched = item.match(/\((https?:\/\/[^\s)]+)\)/)
      if (matched?.[1]) {
        imageUrls.push(matched[1])
      }
    }
  }

  const base64Image = fullContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
  if (base64Image?.[0]) {
    imageUrls.push(base64Image[0])
  }

  return imageUrls
}

const requestImageGeneration = async (input: {
  signal: AbortSignal
  providerId: string
  modelKey: string
  requestBody: Record<string, unknown>
}) => {
  const upstream = await resolveGatewayProviderUpstream({
    providerId: input.providerId,
    endpointType: 'image',
    modelKey: input.modelKey,
  })

  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const requestBody = {
    ...input.requestBody,
    model: input.modelKey,
  }
  delete (requestBody as Record<string, unknown>).providerId

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  const response = await fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: 'image_generation',
    detail: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      endpointType: 'image',
    },
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(normalizeGenerationErrorMessage(
      responseText,
      `图片生成失败 (${response.status})`,
    ))
  }

  const imageUrls = isChatCompletionsEndpoint(upstream.endpoint)
    ? await extractImageUrlsFromStreamResponse(response, input.signal)
    : extractImageUrlsFromJsonResponse(await response.json())

  if (!imageUrls.length) {
    throw new Error('未能获取到生成的图片')
  }

  return {
    upstreamUrl,
    imageUrls,
  }
}

const inferReferenceImageMimeType = (value: string) => {
  const normalizedValue = String(value || '').trim()
  if (/^data:image\/png/i.test(normalizedValue)) return 'image/png'
  if (/^data:image\/webp/i.test(normalizedValue)) return 'image/webp'
  if (/^data:image\/gif/i.test(normalizedValue)) return 'image/gif'
  if (/^data:image\/bmp/i.test(normalizedValue)) return 'image/bmp'
  if (/^data:image\/svg\+xml/i.test(normalizedValue)) return 'image/svg+xml'
  if (/^data:image\/jpe?g/i.test(normalizedValue)) return 'image/jpeg'
  return 'image/png'
}

const sanitizeReferenceImageExtension = (mimeType: string) => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'image/bmp':
      return 'bmp'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'png'
  }
}

const decodeReferenceImageToBlob = async (value: string) => {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    throw new Error('参考图内容为空')
  }

  if (/^data:/i.test(normalizedValue)) {
    const response = await fetch(normalizedValue)
    const blob = await response.blob()
    return {
      blob,
      mimeType: blob.type || inferReferenceImageMimeType(normalizedValue),
    }
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    const response = await fetch(normalizedValue)
    if (!response.ok) {
      throw new Error(`参考图下载失败 (${response.status})`)
    }
    const blob = await response.blob()
    return {
      blob,
      mimeType: blob.type || inferReferenceImageMimeType(normalizedValue),
    }
  }

  throw new Error('暂不支持当前参考图格式，请重新上传图片后再试')
}

const requestImageEdit = async (input: {
  signal: AbortSignal
  providerId: string
  modelKey: string
  prompt: string
  size?: string
  referenceImages: string[]
}) => {
  const upstream = await resolveGatewayProviderUpstream({
    providerId: input.providerId,
    endpointType: 'image-edit',
    modelKey: input.modelKey,
  })

  const formData = new FormData()
  formData.set('model', input.modelKey)
  formData.set('prompt', input.prompt)
  formData.set('n', '1')
  if (input.size) {
    formData.set('size', input.size)
  }

  for (let index = 0; index < input.referenceImages.length; index += 1) {
    const { blob, mimeType } = await decodeReferenceImageToBlob(input.referenceImages[index])
    formData.append(
      'image',
      blob,
      `reference-${index + 1}.${sanitizeReferenceImageExtension(mimeType)}`,
    )
  }

  const headers = new Headers()
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  const response = await fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: 'image_edit',
    detail: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      endpointType: 'image-edit',
      referenceImageCount: input.referenceImages.length,
    },
    init: {
      method: 'POST',
      headers,
      body: formData,
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(normalizeGenerationErrorMessage(
      responseText,
      `图片编辑失败 (${response.status})`,
    ))
  }

  const imageUrls = extractImageUrlsFromJsonResponse(await response.json())
  if (!imageUrls.length) {
    throw new Error('未能获取到编辑后的图片')
  }

  return {
    upstreamUrl,
    imageUrls,
  }
}

const resolveWorkspaceImageModel = async () => {
  const catalog = await getPublicModelCatalog()
  const imageModel = catalog.models.image[0]
  if (!imageModel) {
    throw new Error('未配置可用图片模型，请先在后台启用图片模型')
  }

  return imageModel
}

const executeImageGenerationTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  const modelKey = String(payload.modelKey || '').trim()
  if (!modelKey) {
    throw new Error('缺少图片模型标识')
  }

  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  if (!providerId) {
    throw new Error('缺少图片厂商配置')
  }

  emitTaskProgressEvent(task.recordId, {
    stage: 'resolved_provider',
    message: '已解析厂商与模型配置，准备请求上游图片接口',
  })

  const requestMode = String(payload.requestMode || '').trim() === 'image-edit'
    ? 'image-edit'
    : 'image-generation'
  const referenceImages = Array.isArray(payload.referenceImages)
    ? payload.referenceImages.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const requestBody = {
    ...(payload.requestBody || {}),
    model: modelKey,
  }

  logGenerationTask('image_task:request_start', {
    recordId: task.recordId,
    userId: task.userId,
    modelKey,
    requestMode,
    referenceImageCount: referenceImages.length,
  })
  emitTaskProgressEvent(task.recordId, {
    stage: 'requesting_upstream',
    message: '已开始请求上游图片模型',
  })

  const { upstreamUrl, imageUrls } = requestMode === 'image-edit'
    ? await requestImageEdit({
      signal: task.abortController.signal,
      providerId,
      modelKey,
      prompt: String(requestBody.prompt || payload.prompt || '').trim(),
      size: String(requestBody.size || '').trim() || undefined,
      referenceImages,
    })
    : await requestImageGeneration({
      signal: task.abortController.signal,
      providerId,
      modelKey,
      requestBody,
    })

  logGenerationTask('image_task:request_upstream', {
    recordId: task.recordId,
    userId: task.userId,
    upstreamUrl,
    modelKey,
  })
  emitTaskProgressEvent(task.recordId, {
    stage: 'receiving_upstream_result',
    message: '上游已返回结果，正在解析图片内容',
  })
  emitTaskProgressEvent(task.recordId, {
    stage: 'syncing_record',
    message: '图片结果已解析，正在同步记录与资源信息',
  })

  await updateGenerationRecord(task.recordId, {
    ...buildInitialRecordPayload(payload),
    done: true,
    stopped: false,
    images: imageUrls,
  }, task.userId)
  const completedRecord = await getGenerationRecordById(task.recordId, task.userId)
  emitTaskStreamEvent(task.recordId, {
    type: 'completed',
    recordId: task.recordId,
    done: true,
    stopped: false,
    record: completedRecord,
    stage: 'completed',
    message: '图片生成完成，结果已写入记录',
  })

  logGenerationTask('image_task:request_success', {
    recordId: task.recordId,
    userId: task.userId,
    imageCount: imageUrls.length,
  })
}

const persistAgentTaskContentIfNeeded = async (input: {
  task: RunningGenerationTask
  payload: GenerationTaskStartPayload
  content: string
  force?: boolean
}, state: {
  lastPersistAt: number
  lastPersistContentLength: number
}) => {
  const now = Date.now()
  const shouldPersist = Boolean(input.force)
    || (input.content.length - state.lastPersistContentLength >= 24)
    || (now - state.lastPersistAt >= 400)

  if (!shouldPersist) {
    return
  }

  await updateGenerationRecord(input.task.recordId, {
    ...buildInitialRecordPayload(input.payload),
    content: input.content,
    done: false,
    stopped: false,
  }, input.task.userId)

  state.lastPersistAt = now
  state.lastPersistContentLength = input.content.length
}

const extractChatTextFromNonStreamResponse = async (response: Response) => {
  const result = await response.json().catch(() => null as any)
  const messageContent = result?.choices?.[0]?.message?.content
  if (typeof messageContent === 'string' && messageContent.trim()) {
    return messageContent
  }
  return ''
}

const extractChatTextFromJsonPayload = (result: any) => {
  const normalizeContentValue = (value: unknown): string => {
    if (typeof value === 'string' && value.trim()) {
      return value
    }

    if (Array.isArray(value)) {
      const joined = value
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>
            if (typeof record.text === 'string') {
              return record.text
            }
            if (typeof record.content === 'string') {
              return record.content
            }
          }
          return ''
        })
        .filter(Boolean)
        .join('')
      if (joined.trim()) {
        return joined
      }
    }

    return ''
  }

  const candidates = [
    result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.delta?.content,
    result?.choices?.[0]?.delta?.reasoning_content,
    result?.choices?.[0]?.text,
    result?.message?.content,
    result?.delta?.content,
    result?.content,
    result?.text,
    result?.response,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeContentValue(candidate)
    if (normalized) {
      return normalized
    }
  }

  return ''
}

const parseChatChunkText = (chunk: string) => {
  try {
    const parsed = JSON.parse(chunk)
    return extractChatTextFromJsonPayload(parsed)
  } catch {
    return ''
  }
}

const parseChatChunkError = (chunk: string) => {
  try {
    const parsed = JSON.parse(chunk)
    const errorMessage = parsed?.error?.message
    if (typeof errorMessage === 'string' && errorMessage.trim()) {
      return errorMessage.trim()
    }
    return ''
  } catch {
    return ''
  }
}

interface AgentWorkspaceModelPlanResult {
  analysisLines: string[]
  workflowLabel?: string
  workflowParams?: Record<string, unknown>
  planItems?: string[]
  imageTasks?: Array<{
    label: string
    promptText: string
  }>
  submitLines: string[]
  rawTextPreview?: string
}

const extractJsonObjectFromText = (text: string) => {
  const normalized = String(text || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    return normalized
  }

  const startIndex = normalized.indexOf('{')
  if (startIndex === -1) {
    return ''
  }

  let depth = 0
  for (let index = startIndex; index < normalized.length; index += 1) {
    const currentChar = normalized[index]
    if (currentChar === '{') {
      depth += 1
    } else if (currentChar === '}') {
      depth -= 1
      if (depth === 0) {
        return normalized.slice(startIndex, index + 1)
      }
    }
  }

  return ''
}

const readChatResponseText = async (response: Response, signal: AbortSignal) => {
  if (!response.body) {
    return await extractChatTextFromNonStreamResponse(response)
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('text/event-stream')) {
    const rawText = await response.text().catch(() => '')
    if (!rawText.trim()) {
      return ''
    }

    try {
      const parsed = JSON.parse(rawText)
      const extractedText = extractChatTextFromJsonPayload(parsed)
      return extractedText || rawText
    } catch {
      return rawText
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let streamErrorMessage = ''

  while (!signal.aborted) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) {
        continue
      }

      const chunk = trimmed.slice(5).trim()
      if (!chunk || chunk === '[DONE]') {
        continue
      }

      const chunkError = parseChatChunkError(chunk)
      if (chunkError) {
        streamErrorMessage = chunkError
        break
      }

      fullContent += parseChatChunkText(chunk)
    }

    if (streamErrorMessage) {
      break
    }
  }

  if (streamErrorMessage) {
    throw new Error(streamErrorMessage)
  }

  return fullContent
}

const requestAgentWorkspaceModelPlan = async (input: {
  signal: AbortSignal
  providerId: string
  modelKey: string
  skill: string
  skillLabel: string
  workspaceSkillKey: string
  dependencySkillKeys?: string[]
  prompt: string
}) => {
  const upstream = await resolveGatewayProviderUpstream({
    providerId: input.providerId,
    endpointType: 'chat',
    modelKey: input.modelKey,
  })

  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const messages = [
    ...buildAgentChatMessages(input.skill, input.prompt),
    {
      role: 'system',
      content: [
        '你是一个 AI 技能工作流规划器。',
        '你需要先理解用户需求，再输出适合图片生成的结构化执行计划。',
        '必须返回纯 JSON，不要输出 Markdown，不要输出解释。',
        'JSON 字段固定为：analysis_lines, workflow_label, workflow_params, plan_items, image_tasks, submit_lines。',
        'analysis_lines 至少 3 条，用中文简洁说明：需求理解、技能匹配、执行策略。',
        `当前技能展示名：${input.skillLabel}。当前技能键：${input.workspaceSkillKey}。`,
        input.dependencySkillKeys?.length ? `依赖技能键：${input.dependencySkillKeys.join('、')}。` : '当前无依赖技能。',
        'workflow_params.workflow_type 当前仅允许 text_to_image。',
        'plan_items 和 image_tasks 默认给 4 项，并保持一一对应。',
        '每个 image_tasks 元素必须包含 label 和 promptText；promptText 要适合直接用于图片生成，必须中文，且彼此有明确差异。',
        'submit_lines 给 1 到 2 条，用于描述将如何提交并回传结果。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `用户需求：${input.prompt}`,
        '请基于当前技能生成结构化工作流计划。',
      ].join('\n'),
    },
  ]

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  const response = await fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: 'agent_workspace_planner',
    detail: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      endpointType: 'chat',
      skill: input.skill,
    },
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: input.modelKey,
        stream: false,
        messages,
        temperature: 0.6,
      }),
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `规划模型调用失败 (${response.status})`)
  }

  const rawText = await readChatResponseText(response, input.signal)
  const jsonText = extractJsonObjectFromText(rawText)
  if (!jsonText) {
    throw new Error('规划模型未返回有效 JSON')
  }

  const parsed = JSON.parse(jsonText) as Record<string, unknown>
  const analysisLines = Array.isArray(parsed.analysis_lines)
    ? parsed.analysis_lines.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const submitLines = Array.isArray(parsed.submit_lines)
    ? parsed.submit_lines.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const planItems = Array.isArray(parsed.plan_items)
    ? parsed.plan_items.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const imageTasks = Array.isArray(parsed.image_tasks)
    ? parsed.image_tasks.map((item) => {
        const record = item as Record<string, unknown>
        return {
          label: String(record.label || '').trim(),
          promptText: String(record.promptText || record.prompt_text || '').trim(),
        }
      }).filter(item => item.label && item.promptText)
    : []

  const workflowParams = parsed.workflow_params && typeof parsed.workflow_params === 'object'
    ? parsed.workflow_params as Record<string, unknown>
    : undefined

  const hasUsablePlan = analysisLines.length >= 2
    || submitLines.length >= 1
    || planItems.length >= 2
    || imageTasks.length >= 2
    || Boolean(String(parsed.workflow_label || '').trim())

  if (!hasUsablePlan) {
    throw new Error(`规划模型返回内容不完整：${jsonText.slice(0, 240)}`)
  }

  if (workflowParams?.workflow_type && workflowParams.workflow_type !== 'text_to_image') {
    throw new Error(`规划模型返回了不支持的工作流类型：${String(workflowParams.workflow_type)}`)
  }

  return {
    analysisLines,
    workflowLabel: String(parsed.workflow_label || '').trim() || undefined,
    workflowParams,
    planItems,
    imageTasks,
    submitLines,
    rawTextPreview: rawText.slice(0, 400),
  } satisfies AgentWorkspaceModelPlanResult
}

const executeAgentChatTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  const modelKey = String(payload.modelKey || '').trim()
  if (!modelKey) {
    throw new Error('缺少对话模型标识')
  }

  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  if (!providerId) {
    throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
  }

  const upstream = await resolveGatewayProviderUpstream({
    providerId,
    endpointType: 'chat',
    modelKey,
  })
  emitTaskProgressEvent(task.recordId, {
    stage: 'resolved_provider',
    message: '已解析厂商与模型配置，准备请求上游对话模型',
  })

  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const requestBody = {
    ...(payload.requestBody || {}),
    model: modelKey,
    stream: true,
  }
  delete (requestBody as Record<string, unknown>).providerId

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  logGenerationTask('agent_task:request_start', {
    recordId: task.recordId,
    userId: task.userId,
    upstreamUrl,
    modelKey,
  })

  emitTaskProgressEvent(task.recordId, {
    stage: 'requesting_upstream',
    message: '已开始请求上游对话模型',
  })

  const response = await fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: task.abortController.signal,
    stage: 'agent_chat',
    detail: {
      recordId: task.recordId,
      userId: task.userId,
      providerId,
      modelKey,
      endpointType: 'chat',
    },
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `对话生成失败 (${response.status})`)
  }

  emitTaskProgressEvent(task.recordId, {
    stage: 'receiving_upstream_result',
    message: '上游已开始返回内容，正在持续生成对话',
  })

  const responseContentType = String(response.headers.get('content-type') || '').toLowerCase()
  logGenerationTask('agent_task:response_headers', {
    recordId: task.recordId,
    userId: task.userId,
    contentType: responseContentType,
  })

  if (!response.body) {
    const content = await extractChatTextFromNonStreamResponse(response)
    await updateGenerationRecord(task.recordId, {
      ...buildInitialRecordPayload(payload),
      content,
      done: true,
      stopped: false,
    }, task.userId)
    const completedRecord = await getGenerationRecordById(task.recordId, task.userId)
    emitTaskStreamEvent(task.recordId, {
      type: 'completed',
      recordId: task.recordId,
      done: true,
      stopped: false,
      record: completedRecord,
      stage: 'completed',
      message: '对话生成完成，结果已写入记录',
    })
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let rawResponseText = ''
  let hasSseDelta = false
  let streamErrorMessage = ''
  const rawDataSamples: string[] = []
  const persistState = {
    lastPersistAt: Date.now(),
    lastPersistContentLength: 0,
  }

  while (!task.abortController.signal.aborted) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    const decodedChunk = decoder.decode(value, { stream: true })
    rawResponseText += decodedChunk
    buffer += decodedChunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const chunk = trimmed.slice(5).trim()
      if (chunk === '[DONE]') {
        continue
      }

      if (rawDataSamples.length < 5) {
        rawDataSamples.push(chunk.slice(0, 500))
      }

      const chunkError = parseChatChunkError(chunk)
      if (chunkError) {
        streamErrorMessage = chunkError
        break
      }

      try {
        const delta = parseChatChunkText(chunk)
        if (!delta) continue

        hasSseDelta = true
        fullContent += delta
        emitTaskContentDeltaEvent(task.recordId, {
          stage: 'receiving_upstream_result',
          delta,
          content: fullContent,
        })
        await persistAgentTaskContentIfNeeded({
          task,
          payload,
          content: fullContent,
        }, persistState)
      } catch {
        // 跳过无效 SSE 数据块，继续处理后续消息。
      }
    }

    if (streamErrorMessage) {
      break
    }
  }

  if (streamErrorMessage) {
    throw new Error(streamErrorMessage)
  }

  if (!hasSseDelta && rawResponseText.trim()) {
    const trimmedText = rawResponseText.trim()
    const parsedFromWholeJson = (() => {
      try {
        return extractChatTextFromJsonPayload(JSON.parse(trimmedText))
      } catch {
        return ''
      }
    })()

    if (parsedFromWholeJson) {
      fullContent = parsedFromWholeJson
      emitTaskContentDeltaEvent(task.recordId, {
        stage: 'receiving_upstream_result',
        delta: parsedFromWholeJson,
        content: fullContent,
      })
    } else {
      const fallbackText = trimmedText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line) => {
          if (line.startsWith('data:')) {
            return parseChatChunkText(line.slice(5).trim())
          }
          return ''
        })
        .join('')

      if (fallbackText) {
        fullContent = fallbackText
        emitTaskContentDeltaEvent(task.recordId, {
          stage: 'receiving_upstream_result',
          delta: fallbackText,
          content: fullContent,
        })
      }
    }
  }

  if (!fullContent.trim()) {
    logGenerationTask('agent_task:empty_stream_debug', {
      recordId: task.recordId,
      userId: task.userId,
      sampleCount: rawDataSamples.length,
      dataSamples: rawDataSamples,
      rawResponseSnippet: rawResponseText.slice(0, 1200),
    })
    throw new Error('上游未返回有效对话内容')
  }

  emitTaskProgressEvent(task.recordId, {
    stage: 'syncing_record',
    message: '对话内容已生成，正在同步记录',
  })

  await updateGenerationRecord(task.recordId, {
    ...buildInitialRecordPayload(payload),
    content: fullContent,
    done: true,
    stopped: false,
  }, task.userId)
  const completedRecord = await getGenerationRecordById(task.recordId, task.userId)
  emitTaskStreamEvent(task.recordId, {
    type: 'completed',
    recordId: task.recordId,
    done: true,
    stopped: false,
    record: completedRecord,
    stage: 'completed',
    message: '对话生成完成，结果已写入记录',
  })

  logGenerationTask('agent_task:request_success', {
    recordId: task.recordId,
    userId: task.userId,
    contentLength: fullContent.length,
  })
}

const persistAgentWorkspaceRecord = async (input: {
  task: RunningGenerationTask
  payload: GenerationTaskStartPayload
  agentRun: Record<string, unknown>
  done?: boolean
  stopped?: boolean
  error?: string
}) => {
  const agentRunImages = Array.isArray((input.agentRun as any)?.result?.images)
    ? ((input.agentRun as any).result.images as Array<Record<string, unknown>>)
    : []

  await updateGenerationRecord(input.task.recordId, {
    ...buildInitialRecordPayload(input.payload),
    content: '',
    agentRun: input.agentRun,
    outputs: agentRunImages
      .filter((image) => String(image?.imageSrc || '').trim())
      .map((image, index) => ({
        outputType: 'image' as const,
        url: String(image.imageSrc || '').trim(),
        sortOrder: index,
        metaJson: {
          promptText: String(image.promptText || '').trim(),
        },
      })),
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    error: input.error || '',
  }, input.task.userId)

  return getGenerationRecordById(input.task.recordId, input.task.userId)
}

const executeAgentWorkspaceTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  const skill = String(payload.skill || '').trim() || 'general'
  const skillPrompt = String(payload.prompt || '').trim()
  const skillMeta = await getAgentWorkspaceSkillMeta(skill)
  const workspaceSkillKey = skillMeta.workspaceSkillKey
  const dependencySkillKeys = skillMeta.dependencySkillKeys
  const plannerProviderId = String((payload.requestBody || {}).providerId || '').trim()
  const plannerModelKey = String(payload.modelKey || '').trim()
  let currentRun = buildAgentPendingRun(task.recordId, String(payload.prompt || '').trim(), skill)

  const initialRecord = await persistAgentWorkspaceRecord({
    task,
    payload,
    agentRun: currentRun as unknown as Record<string, unknown>,
    done: false,
    stopped: false,
  })

  emitTaskProgressEvent(task.recordId, {
    stage: 'queued',
    message: '技能任务已创建，等待服务端执行',
    record: initialRecord as unknown as Record<string, unknown>,
  })
  const emitWorkspaceEvent = async (agentEvent: AgentWorkspaceEvent) => {
    currentRun = applyAgentWorkspaceEvent(currentRun, agentEvent)
    const isTerminalEvent = agentEvent.type === 'run_completed'
      || agentEvent.type === 'run_failed'
      || agentEvent.type === 'run_stopped'
    const currentError = agentEvent.type === 'run_failed' ? agentEvent.errorMessage : ''
    const persistedRecord = await persistAgentWorkspaceRecord({
      task,
      payload,
      agentRun: currentRun as unknown as Record<string, unknown>,
      done: isTerminalEvent,
      stopped: agentEvent.type === 'run_stopped',
      error: currentError,
    })

    emitTaskAgentEvent(task.recordId, {
      agentEvent,
      record: persistedRecord as unknown as Record<string, unknown>,
      done: isTerminalEvent,
      stopped: agentEvent.type === 'run_stopped',
      stage: isTerminalEvent
        ? (agentEvent.type === 'run_completed'
          ? 'completed'
          : agentEvent.type === 'run_stopped'
            ? 'stopped'
            : 'failed')
        : 'agent_workspace_running',
      message: isTerminalEvent
        ? (agentEvent.type === 'run_completed'
          ? '技能任务已完成'
          : agentEvent.type === 'run_stopped'
            ? agentEvent.message
            : agentEvent.errorMessage)
        : '技能任务执行中',
    })
  }

  const emitWorkspaceReasoningBatch = async (input: {
    stageKey: string
    stageLabel: string
    lines: string[]
  }) => {
    for (const line of input.lines) {
      const text = line.trim()
      if (!text) {
        continue
      }
      await emitWorkspaceEvent({
        type: 'reasoning_delta',
        taskId: task.recordId,
        stageKey: input.stageKey,
        stageLabel: input.stageLabel,
        text,
      })
      await sleepWithWorkspaceAbort(
        task.abortController.signal,
        getWorkspaceRandomDelay(workspaceTimingProfile.reasoningChunkDelayRange),
      )
    }
  }

  const emitActivateSkillToolCall = async (skillKey: string, label: string, sectionKey: string) => {
    await emitWorkspaceEvent({
      type: 'tool_call_started',
      taskId: task.recordId,
      toolName: 'activate_skill',
      argumentsText: `技能标识：${skillKey}`,
      sectionKey,
      label,
    })
    await sleepWithWorkspaceAbort(
      task.abortController.signal,
      getWorkspaceRandomDelay(workspaceTimingProfile.toolCallDelayRange),
    )
  }

  try {
    await sleepWithWorkspaceAbort(task.abortController.signal, workspaceTimingProfile.preAnalyzeDelay)
    await emitWorkspaceEvent({ type: 'run_started', taskId: task.recordId })

    const skillLabel = skillMeta.skillLabel
    await emitWorkspaceReasoningBatch({
      stageKey: 'reasoning-analyze',
      stageLabel: '需求分析',
      lines: [
        `正在分析你的需求：“${skillPrompt || '当前主题'}”。`,
        workspaceSkillKey !== skill
          ? `根据当前技能规则，这类任务优先匹配技能 ${workspaceSkillKey}，对应前台展示为“${skillLabel}”。`
          : `根据当前技能规则，这类任务匹配“${skillLabel}”技能。`,
        `为了按照技能规范执行，我会先调用 activate_skill 加载 ${workspaceSkillKey} 的完整指南。`,
      ],
    })

    await emitActivateSkillToolCall(
      workspaceSkillKey,
      `调用技能：${workspaceSkillKey}`,
      'tool-call-primary-skill',
    )

    await sleepWithWorkspaceAbort(task.abortController.signal, 900)
    await emitWorkspaceEvent({
      type: 'skill_activated',
      taskId: task.recordId,
      skillLabel,
    })

    await sleepWithWorkspaceAbort(task.abortController.signal, getWorkspaceRandomDelay([1200, 1800]))
    await emitWorkspaceEvent({
      type: 'skill_loaded',
      taskId: task.recordId,
      skillLabel,
      dependencySkillLabel: dependencySkillKeys[0] || '',
      sectionKey: 'skill-guide-primary',
      label: `已加载技能：${workspaceSkillKey}`,
    })

    if (dependencySkillKeys.length) {
      await emitWorkspaceReasoningBatch({
        stageKey: 'reasoning-dependency',
        stageLabel: '依赖技能',
        lines: [
          `已完成 ${workspaceSkillKey} 技能加载。`,
          `根据技能依赖规则，还需要继续加载 ${dependencySkillKeys.join('、')}，这样后续的图片生成策略、提示词结构和结果数量才能保持完整。`,
          '接下来继续调用 activate_skill，补齐依赖技能链。',
        ],
      })

      for (const dependencySkillKey of dependencySkillKeys) {
        await emitActivateSkillToolCall(
          dependencySkillKey,
          `调用技能：${dependencySkillKey}`,
          'tool-call-dependency-skill',
        )

        await emitWorkspaceEvent({
          type: 'skill_loaded',
          taskId: task.recordId,
          skillLabel: dependencySkillKey,
          sectionKey: 'skill-guide-dependency',
          label: `已加载依赖技能：${dependencySkillKey}`,
        })
      }
    }

    await sleepWithWorkspaceAbort(task.abortController.signal, getWorkspaceRandomDelay(workspaceTimingProfile.analyzeDelayRange))
    let plan = await planAgentWorkspace({
      prompt: skillPrompt,
      skill,
    })

    let planningReasoningLines = [
      `现在我已经具备主技能${dependencySkillKeys.length ? '与依赖技能' : ''}的执行上下文，开始整理最终工作流。`,
      plan.imageTasks.length > 1
        ? `本次会默认生成 ${plan.imageTasks.length} 张结果，确保方向差异、构图变化和传播可选性。`
        : '本次将生成单张结果，并优先保证主题聚焦与完成度。',
      `工作流会按“${plan.workflowLabel}”执行，并为每一张结果分别构建独立提示词。`,
    ]
    let submitReasoningLines = [
      `即将把 ${plan.imageTasks.length} 个子任务提交到图片生成服务。`,
      '服务端会逐张回传结果，并实时同步到当前记录流。',
    ]

    if (plannerProviderId && plannerModelKey) {
      await emitWorkspaceEvent({
        type: 'tool_call_started',
        taskId: task.recordId,
        toolName: 'chat.completions',
        argumentsText: `模型：${plannerModelKey}`,
        sectionKey: 'tool-call-model-planner',
        label: `调用模型规划：${plannerModelKey}`,
      })

      try {
        const modelPlan = await requestAgentWorkspaceModelPlan({
          signal: task.abortController.signal,
          providerId: plannerProviderId,
          modelKey: plannerModelKey,
          skill,
          skillLabel,
          workspaceSkillKey,
          dependencySkillKeys,
          prompt: skillPrompt,
        })

        logGenerationTask('agent_workspace:model_plan_success', {
          recordId: task.recordId,
          userId: task.userId,
          skill,
          plannerModelKey,
          analysisLineCount: modelPlan.analysisLines.length,
          planItemCount: modelPlan.planItems?.length || 0,
          imageTaskCount: modelPlan.imageTasks?.length || 0,
          workflowLabel: modelPlan.workflowLabel || '',
          rawTextPreview: modelPlan.rawTextPreview || '',
        })

        if (modelPlan.workflowLabel || modelPlan.workflowParams || modelPlan.planItems?.length || modelPlan.imageTasks?.length) {
          plan = {
            workflowLabel: modelPlan.workflowLabel || plan.workflowLabel,
            workflowParams: modelPlan.workflowParams || plan.workflowParams,
            planItems: modelPlan.planItems?.length ? modelPlan.planItems : plan.planItems,
            imageTasks: modelPlan.imageTasks?.length ? modelPlan.imageTasks : plan.imageTasks,
          }
        }

        if (modelPlan.analysisLines.length) {
          planningReasoningLines = modelPlan.analysisLines
        }
        if (modelPlan.submitLines.length) {
          submitReasoningLines = modelPlan.submitLines
        }
      } catch (error) {
        logGenerationTaskError('agent_workspace:model_plan_failed', error, {
          recordId: task.recordId,
          userId: task.userId,
          skill,
          plannerModelKey,
        })
        planningReasoningLines = [
          '规划模型调用失败，当前已自动回退到本地工作流规划。',
          ...planningReasoningLines,
        ]
      }
    }

    await emitWorkspaceReasoningBatch({
      stageKey: 'reasoning-plan',
      stageLabel: '任务规划',
      lines: planningReasoningLines,
    })

    await emitWorkspaceEvent({
      type: 'workflow_planned',
      taskId: task.recordId,
      workflowLabel: plan.workflowLabel,
      workflowParams: plan.workflowParams,
      expectedImageCount: plan.imageTasks.length,
      planItems: plan.planItems,
    })

    await sleepWithWorkspaceAbort(task.abortController.signal, getWorkspaceRandomDelay(workspaceTimingProfile.postPlanDelayRange))
    await sleepWithWorkspaceAbort(task.abortController.signal, workspaceTimingProfile.preSubmitDelay)

    await emitWorkspaceReasoningBatch({
      stageKey: 'reasoning-submit',
      stageLabel: '提交任务',
      lines: submitReasoningLines,
    })

    await emitWorkspaceEvent({
      type: 'submission_started',
      taskId: task.recordId,
      workflowLabel: plan.workflowLabel,
      expectedImageCount: plan.imageTasks.length,
    })

    const imageModel = await resolveWorkspaceImageModel()
    const defaultRequestBody = imageModel.defaultParamsJson && typeof imageModel.defaultParamsJson === 'object'
      ? { ...imageModel.defaultParamsJson }
      : {}

    for (const [index, imageTask] of plan.imageTasks.entries()) {
      await sleepWithWorkspaceAbort(task.abortController.signal, getWorkspaceRandomDelay(workspaceTimingProfile.betweenImageDelayRange))

      const requestBody = {
        ...defaultRequestBody,
        prompt: imageTask.promptText,
        n: 1,
      } as Record<string, unknown>

      const { imageUrls } = await requestImageGeneration({
        signal: task.abortController.signal,
        providerId: imageModel.providerId,
        modelKey: imageModel.modelKey,
        requestBody,
      })

      await emitWorkspaceEvent({
        type: 'image_completed',
        taskId: task.recordId,
        workflowLabel: plan.workflowLabel,
        expectedImageCount: plan.imageTasks.length,
        completedCount: index + 1,
        image: {
          id: `workspace-image-${index + 1}`,
          imageSrc: imageUrls[0],
          promptText: imageTask.promptText,
        },
      })
    }

    await sleepWithWorkspaceAbort(task.abortController.signal, getWorkspaceRandomDelay(workspaceTimingProfile.completionDelayRange))
    await emitWorkspaceEvent({
      type: 'run_completed',
      taskId: task.recordId,
      workflowLabel: plan.workflowLabel,
      expectedImageCount: plan.imageTasks.length,
      summary: buildWorkspaceCompletionSummary({
        prompt: String(payload.prompt || '').trim(),
        planItems: plan.planItems,
      }),
    })
  } catch (error) {
    if (error instanceof AgentWorkspaceStoppedError) {
      await refundTaskPointsIfNeeded(task, 'task_aborted')
      await emitWorkspaceEvent({
        type: 'run_stopped',
        taskId: task.recordId,
        message: error.message || '任务已停止',
      })
      return
    }

    const errorMessage = normalizeGenerationErrorMessage(error, '技能任务执行失败')
    await refundTaskPointsIfNeeded(task, 'task_failed')
    await emitWorkspaceEvent({
      type: 'run_failed',
      taskId: task.recordId,
      errorMessage,
    })
  }
}

const refundTaskPointsIfNeeded = async (task: RunningGenerationTask, reason: string) => {
  if (!task.billedPointCost || task.refundCommitted) {
    return
  }

  task.refundCommitted = true
  await refundGenerationPoints({
    userId: task.userId,
    pointCost: task.billedPointCost,
    sourceId: task.associationNo,
    associationNo: task.associationNo,
    endpointType: task.billedEndpointType,
    providerId: task.billedProviderId,
    modelKey: task.billedModelKey,
    modelName: task.billedModelName,
    metaJson: {
      refundReason: reason,
      generationRecordId: task.recordId,
    },
  })
}

const runImageTaskInBackground = (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  void (async () => {
    try {
      await executeImageGenerationTask(task, payload)
    } catch (error) {
      const isAbortError = error instanceof DOMException
        ? error.name === 'AbortError'
        : error instanceof Error && /abort/i.test(String(error.name || error.message || ''))

      if (isAbortError) {
        await refundTaskPointsIfNeeded(task, 'task_aborted')
        emitTaskProgressEvent(task.recordId, {
          stage: 'stopping',
          stopped: true,
          message: '任务已收到停止指令，正在收口状态',
        })
        await updateGenerationRecord(task.recordId, {
          ...buildInitialRecordPayload(payload),
          done: true,
          stopped: true,
          error: '',
          images: [],
        }, task.userId)
        const stoppedRecord = await getGenerationRecordById(task.recordId, task.userId)
        emitTaskStreamEvent(task.recordId, {
          type: 'stopped',
          recordId: task.recordId,
          done: true,
          stopped: true,
          record: stoppedRecord,
          stage: 'stopped',
          message: '任务已停止',
        })
        logGenerationTask('image_task:stopped', {
          recordId: task.recordId,
          userId: task.userId,
        })
      } else {
        await refundTaskPointsIfNeeded(task, 'task_failed')
        const errorMessage = normalizeGenerationErrorMessage(error, '图片生成失败')
        emitTaskProgressEvent(task.recordId, {
          stage: 'failing',
          message: '任务执行异常，正在写入失败状态',
        })
        await updateGenerationRecord(task.recordId, {
          ...buildInitialRecordPayload(payload),
          done: true,
          stopped: false,
          error: errorMessage,
          images: [],
        }, task.userId)
        const failedRecord = await getGenerationRecordById(task.recordId, task.userId)
        emitTaskStreamEvent(task.recordId, {
          type: 'failed',
          recordId: task.recordId,
          done: true,
          stopped: false,
          record: failedRecord,
          stage: 'failed',
          message: errorMessage,
        })
        logGenerationTaskError('image_task:failed', error, {
          recordId: task.recordId,
          userId: task.userId,
        })
      }
    } finally {
      runningGenerationTasks.delete(task.recordId)
    }
  })()
}

const runAgentTaskInBackground = (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  void (async () => {
    try {
      if (task.strategyKey === 'agent-workspace') {
        await executeAgentWorkspaceTask(task, payload)
      } else {
        await executeAgentChatTask(task, payload)
      }
    } catch (error) {
      const isAbortError = error instanceof DOMException
        ? error.name === 'AbortError'
        : error instanceof Error && /abort/i.test(String(error.name || error.message || ''))

      if (isAbortError) {
        await refundTaskPointsIfNeeded(task, 'task_aborted')
        if (task.strategyKey === 'agent-workspace') {
          const currentRecord = await getGenerationRecordById(task.recordId, task.userId)
          const stoppedRun = currentRecord.agentRun
            ? buildAgentStoppedRun(currentRecord.agentRun as any, '任务已停止')
            : null
          await updateGenerationRecord(task.recordId, {
            ...buildInitialRecordPayload(payload),
            content: '',
            agentRun: stoppedRun as unknown as Record<string, unknown> | null,
            done: true,
            stopped: true,
            error: '',
          }, task.userId)
          const stoppedRecord = await getGenerationRecordById(task.recordId, task.userId)
          emitTaskStreamEvent(task.recordId, {
            type: 'stopped',
            recordId: task.recordId,
            done: true,
            stopped: true,
            record: stoppedRecord,
            stage: 'stopped',
            message: '任务已停止',
          })
        } else {
          emitTaskProgressEvent(task.recordId, {
            stage: 'stopping',
            stopped: true,
            message: '任务已收到停止指令，正在收口状态',
          })
          const currentRecord = await getGenerationRecordById(task.recordId, task.userId)
          await updateGenerationRecord(task.recordId, {
            ...buildInitialRecordPayload(payload),
            content: currentRecord.content,
            done: true,
            stopped: true,
            error: '',
          }, task.userId)
          const stoppedRecord = await getGenerationRecordById(task.recordId, task.userId)
          emitTaskStreamEvent(task.recordId, {
            type: 'stopped',
            recordId: task.recordId,
            done: true,
            stopped: true,
            record: stoppedRecord,
            stage: 'stopped',
            message: '任务已停止',
          })
        }
      } else {
        const errorMessage = normalizeGenerationErrorMessage(error, '对话生成失败')
        await refundTaskPointsIfNeeded(task, 'task_failed')
        if (task.strategyKey === 'agent-workspace') {
          const currentRecord = await getGenerationRecordById(task.recordId, task.userId)
          const errorRun = currentRecord.agentRun
            ? buildAgentErrorRun(currentRecord.agentRun as any, errorMessage)
            : null
          await updateGenerationRecord(task.recordId, {
            ...buildInitialRecordPayload(payload),
            content: '',
            agentRun: errorRun as unknown as Record<string, unknown> | null,
            done: true,
            stopped: false,
            error: errorMessage,
          }, task.userId)
          const failedRecord = await getGenerationRecordById(task.recordId, task.userId)
          emitTaskStreamEvent(task.recordId, {
            type: 'failed',
            recordId: task.recordId,
            done: true,
            stopped: false,
            record: failedRecord,
            stage: 'failed',
            message: errorMessage,
          })
          logGenerationTaskError('agent_workspace_task:failed', error, {
            recordId: task.recordId,
            userId: task.userId,
          })
        } else {
          emitTaskProgressEvent(task.recordId, {
            stage: 'failing',
            message: '任务执行异常，正在写入失败状态',
          })
          const currentRecord = await getGenerationRecordById(task.recordId, task.userId)
          await updateGenerationRecord(task.recordId, {
            ...buildInitialRecordPayload(payload),
            content: currentRecord.content,
            done: true,
            stopped: false,
            error: errorMessage,
          }, task.userId)
          const failedRecord = await getGenerationRecordById(task.recordId, task.userId)
          emitTaskStreamEvent(task.recordId, {
            type: 'failed',
            recordId: task.recordId,
            done: true,
            stopped: false,
            record: failedRecord,
            stage: 'failed',
            message: errorMessage,
          })
          logGenerationTaskError('agent_task:failed', error, {
            recordId: task.recordId,
            userId: task.userId,
          })
        }
      }
    } finally {
      runningGenerationTasks.delete(task.recordId)
    }
  })()
}

// 创建新的生成任务，并立即把运行态记录持久化。
export const startGenerationTask = async (payload: GenerationTaskStartPayload, currentUserId: string) => {
  const strategy = resolveGenerationTaskStrategy(payload)

  if (strategy.key === 'agent-chat') {
    const providerId = String((payload.requestBody || {}).providerId || '').trim()
    const modelKey = String(payload.modelKey || '').trim()

    if (!providerId) {
      throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
    }

    if (!modelKey) {
      throw new Error('缺少对话模型标识')
    }

    const billingDetail = await resolveGenerationPointCost({
      providerId,
      modelKey,
      endpointType: 'chat',
    })

    const associationNo = buildGatewayAssociationNo()
    const pointLog = billingDetail.pointCost > 0
      ? await consumeGenerationPoints({
        userId: currentUserId,
        pointCost: billingDetail.pointCost,
        sourceId: associationNo,
        associationNo,
        endpointType: 'chat',
        providerId,
        modelKey,
        modelName: billingDetail.modelName,
        metaJson: {
          source: 'generation-task',
          taskType: 'agent-chat',
        },
      })
      : null

    const createdRecord = await createGenerationRecord(buildInitialRecordPayload(payload), currentUserId)
    await attachGenerationPointRecordId({
      associationNo,
      userId: currentUserId,
      generationRecordId: createdRecord.id,
    })
    const task: RunningGenerationTask = {
      recordId: createdRecord.id,
      userId: currentUserId,
      type: 'agent',
      strategyKey: strategy.key,
      abortController: new AbortController(),
      associationNo,
      billedEndpointType: 'chat',
      billedPointCost: pointLog ? billingDetail.pointCost : 0,
      billedProviderId: providerId,
      billedModelKey: modelKey,
      billedModelName: billingDetail.modelName || String(payload.model || '').trim(),
      refundCommitted: false,
    }

    runningGenerationTasks.set(createdRecord.id, task)
    emitTaskStreamEvent(createdRecord.id, {
      type: 'progress',
      recordId: createdRecord.id,
      done: false,
      stopped: false,
      record: createdRecord as unknown as Record<string, unknown>,
      stage: 'queued',
      message: '任务已创建，等待服务端执行',
    })

    logGenerationTask('task_created', {
      recordId: createdRecord.id,
      userId: currentUserId,
      type: payload.type,
      strategyKey: strategy.key,
      providerId,
      modelKey,
    })

    runAgentTaskInBackground(task, payload)
    return createdRecord
  }

  if (strategy.key === 'agent-workspace') {
    const providerId = String((payload.requestBody || {}).providerId || '').trim()
    const modelKey = String(payload.modelKey || '').trim()

    if (!providerId) {
      throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
    }

    if (!modelKey) {
      throw new Error('缺少对话模型标识')
    }

    const billingDetail = await resolveGenerationPointCost({
      providerId,
      modelKey,
      endpointType: 'chat',
    })

    const associationNo = buildGatewayAssociationNo()
    const pointLog = billingDetail.pointCost > 0
      ? await consumeGenerationPoints({
        userId: currentUserId,
        pointCost: billingDetail.pointCost,
        sourceId: associationNo,
        associationNo,
        endpointType: 'chat',
        providerId,
        modelKey,
        modelName: billingDetail.modelName,
        metaJson: {
          source: 'generation-task',
          taskType: 'agent-workspace',
          skill: String(payload.skill || '').trim(),
        },
      })
      : null

    const initialPayload = {
      ...buildInitialRecordPayload(payload),
      agentRun: buildAgentPendingRun(`record-${Date.now()}`, String(payload.prompt || '').trim(), String(payload.skill || '').trim() || 'general') as unknown as Record<string, unknown>,
    }
    const createdRecord = await createGenerationRecord(initialPayload, currentUserId)
    await attachGenerationPointRecordId({
      associationNo,
      userId: currentUserId,
      generationRecordId: createdRecord.id,
    })
    const task: RunningGenerationTask = {
      recordId: createdRecord.id,
      userId: currentUserId,
      type: 'agent',
      strategyKey: strategy.key,
      abortController: new AbortController(),
      associationNo,
      billedEndpointType: 'chat',
      billedPointCost: pointLog ? billingDetail.pointCost : 0,
      billedProviderId: providerId,
      billedModelKey: modelKey,
      billedModelName: billingDetail.modelName || String(payload.model || '').trim(),
      refundCommitted: false,
    }

    runningGenerationTasks.set(createdRecord.id, task)
    emitTaskStreamEvent(createdRecord.id, {
      type: 'progress',
      recordId: createdRecord.id,
      done: false,
      stopped: false,
      record: createdRecord as unknown as Record<string, unknown>,
      stage: 'queued',
      message: '技能任务已创建，等待服务端执行',
    })

    logGenerationTask('task_created', {
      recordId: createdRecord.id,
      userId: currentUserId,
      type: payload.type,
      strategyKey: strategy.key,
      skill: payload.skill,
      modelKey: payload.modelKey,
    })

    runAgentTaskInBackground(task, payload)
    return createdRecord
  }

  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  const modelKey = String(payload.modelKey || '').trim()

  if (!providerId) {
    throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
  }

  if (!modelKey) {
    throw new Error('缺少图片模型标识')
  }

  const billingDetail = await resolveGenerationPointCost({
    providerId,
    modelKey,
    endpointType: 'image',
  })

  const associationNo = buildGatewayAssociationNo()
  const pointLog = billingDetail.pointCost > 0
    ? await consumeGenerationPoints({
      userId: currentUserId,
      pointCost: billingDetail.pointCost,
      sourceId: associationNo,
      associationNo,
      endpointType: 'image',
      providerId,
      modelKey,
      modelName: billingDetail.modelName,
      metaJson: {
        source: 'generation-task',
      },
    })
    : null

  const createdRecord = await createGenerationRecord(buildInitialRecordPayload(payload), currentUserId)
  await attachGenerationPointRecordId({
    associationNo,
    userId: currentUserId,
    generationRecordId: createdRecord.id,
  })

  const task: RunningGenerationTask = {
    recordId: createdRecord.id,
    userId: currentUserId,
    type: 'image',
    strategyKey: strategy.key,
    abortController: new AbortController(),
    associationNo,
    billedEndpointType: 'image',
    billedPointCost: pointLog ? billingDetail.pointCost : 0,
    billedProviderId: providerId,
    billedModelKey: modelKey,
    billedModelName: billingDetail.modelName,
    refundCommitted: false,
  }

  runningGenerationTasks.set(createdRecord.id, task)
  emitTaskStreamEvent(createdRecord.id, {
    type: 'progress',
    recordId: createdRecord.id,
    done: false,
    stopped: false,
    record: createdRecord as unknown as Record<string, unknown>,
    stage: 'queued',
    message: '任务已创建，等待服务端执行',
  })

  logGenerationTask('task_created', {
    recordId: createdRecord.id,
    userId: currentUserId,
    type: payload.type,
    strategyKey: strategy.key,
    providerId,
    modelKey,
  })

  runImageTaskInBackground(task, payload)
  return createdRecord
}

// 查询任务对应的最新生成记录。
export const getGenerationTaskRecord = async (recordId: string, currentUserId: string) => {
  return resolveTaskRecordSnapshot(recordId, currentUserId)
}

// 停止正在运行的任务；若任务已不在内存中，则尝试直接把记录落成已停止。
export const stopGenerationTask = async (recordId: string, currentUserId: string) => {
  const task = runningGenerationTasks.get(recordId)

  if (task) {
    if (task.userId !== currentUserId) {
      throw new Error('无权停止当前生成任务')
    }
    task.abortController.abort()
  } else {
    const currentRecord = await getGenerationRecordById(recordId, currentUserId)
    if (currentRecord.done) {
      return currentRecord
    }

    await updateGenerationRecord(recordId, {
      type: currentRecord.type,
      prompt: currentRecord.prompt,
      content: currentRecord.content,
      error: '',
      model: currentRecord.model,
      modelKey: currentRecord.modelKey,
      ratio: currentRecord.ratio,
      resolution: currentRecord.resolution,
      duration: currentRecord.duration,
      feature: currentRecord.feature,
      skill: currentRecord.skill,
      done: true,
      stopped: true,
      images: currentRecord.images,
      agentRun: currentRecord.agentRun,
    }, currentUserId)
    const stoppedRecord = await getGenerationRecordById(recordId, currentUserId)
    emitTaskStreamEvent(recordId, {
      type: 'stopped',
      recordId,
      done: true,
      stopped: true,
      record: stoppedRecord,
      stage: 'stopped',
      message: '任务已停止',
    })
  }

  return getGenerationRecordById(recordId, currentUserId)
}
