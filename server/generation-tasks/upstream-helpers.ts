import fs from 'node:fs/promises'
import path from 'node:path'
import { getPublicModelCatalog, resolveGatewayProviderUpstream } from '../provider-config/service'
import { getUploadsDir } from '../storage/service'
import { buildAgentChatMessages } from '../../src/shared/agent-skills-core'
import { normalizeGenerationErrorMessage } from '../../src/shared/generation-error'
import {
  applyCapabilityFlags,
  parseModelCapabilitySpec,
  type ModelCapabilityFlags,
} from '../../src/shared/provider-capability'
import {
  buildImageEditRequestFormData,
  normalizeImageGenerationRequestBody,
} from '../../src/shared/upstream-request-normalizer'
import {
  extractChatTextFromJsonPayload,
  extractChatReasoningFromJsonPayload,
  extractImageUrlsFromJsonResponse,
  extractImageUrlsFromText,
  parseChatChunkError,
  parseChatChunkText,
  parseChatChunkReasoning,
  parseUpstreamStreamChunk,
} from '../../src/shared/upstream-stream-parser'

export {
  extractChatTextFromJsonPayload,
  extractChatReasoningFromJsonPayload,
  extractImageUrlsFromJsonResponse,
  extractImageUrlsFromText,
  parseChatChunkError,
  parseChatChunkText,
  parseChatChunkReasoning,
  parseUpstreamStreamChunk,
} from '../../src/shared/upstream-stream-parser'

const BURST_RATE_RETRY_DELAYS = [1200, 2600, 5200]
// 网络层错误（TypeError: fetch failed / socket reset / TLS abort 等）的重试节奏。
// 与 BURST_RATE 分开计数：429 是上游显式拒绝，网络错是底层失败，二者重试策略不耦合。
const NETWORK_ERROR_RETRY_DELAYS = [1500, 4000]
// 单次上游请求的硬超时基线（毫秒）。单张文生图/图生图正常 5-30s，基线 90s 给慢模型留余量。
// 一次请求 n>1 时由 resolveUpstreamFetchTimeoutMs 按张数线性放宽，避免 N 张被一刀 90s 截断。
const UPSTREAM_FETCH_TIMEOUT_BASE_MS = 90_000
const UPSTREAM_FETCH_TIMEOUT_PER_IMAGE_MS = 60_000
const UPSTREAM_FETCH_TIMEOUT_MAX_MS = 600_000

const resolveUpstreamFetchTimeoutMs = (imageCount?: number) => {
  const normalizedCount = Math.max(1, Math.floor(Number(imageCount) || 1))
  const computed = UPSTREAM_FETCH_TIMEOUT_BASE_MS + (normalizedCount - 1) * UPSTREAM_FETCH_TIMEOUT_PER_IMAGE_MS
  return Math.min(computed, UPSTREAM_FETCH_TIMEOUT_MAX_MS)
}
const UPLOADS_PUBLIC_PATH_PREFIX = '/uploads/'

type RetryState = {
  attempt: number
  waitDurationMs: number
  status: number
  errorPreview: string
  stage: string
}

type UpstreamLogger = (stage: string, detail: Record<string, unknown>) => void

type FetchWithBurstRateRetryInput = {
  url: string
  init: RequestInit
  signal: AbortSignal
  stage: string
  detail: Record<string, unknown>
  onRetry?: (retryState: RetryState) => Promise<void> | void
  logGenerationTask: UpstreamLogger
  // 单次请求的硬超时毫秒；缺省走基线 90s。多张图请求由调用方按 n 估算后传入。
  timeoutMs?: number
}

type RequestImageGenerationInput = {
  signal: AbortSignal
  providerId: string
  modelKey: string
  requestBody: Record<string, unknown>
  onRetry?: (retryState: RetryState) => Promise<void> | void
  fetchWithBurstRateRetry: (input: Omit<FetchWithBurstRateRetryInput, 'logGenerationTask'>) => Promise<Response>
}

type RequestImageEditInput = {
  signal: AbortSignal
  providerId: string
  modelKey: string
  prompt: string
  size?: string
  count?: number
  referenceImages: string[]
  onRetry?: (retryState: RetryState) => Promise<void> | void
  fetchWithBurstRateRetry: (input: Omit<FetchWithBurstRateRetryInput, 'logGenerationTask'>) => Promise<Response>
}

const resolveServerReferenceImageBlob = async (imageValue: string) => {
  const normalizedValue = String(imageValue || '').trim()
  if (normalizedValue.startsWith(UPLOADS_PUBLIC_PATH_PREFIX)) {
    const uploadsDir = getUploadsDir()
    const relativePath = decodeURIComponent(normalizedValue.slice(UPLOADS_PUBLIC_PATH_PREFIX.length))
    const filePath = path.resolve(uploadsDir, relativePath)
    if (!filePath.startsWith(uploadsDir)) {
      throw new Error('参考图路径非法')
    }

    const fileBuffer = await fs.readFile(filePath)
    const mimeType = normalizedValue.toLowerCase().includes('.webp')
      ? 'image/webp'
      : normalizedValue.toLowerCase().includes('.gif')
        ? 'image/gif'
        : normalizedValue.toLowerCase().includes('.bmp')
          ? 'image/bmp'
          : normalizedValue.toLowerCase().includes('.svg')
            ? 'image/svg+xml'
            : normalizedValue.toLowerCase().includes('.jpg') || normalizedValue.toLowerCase().includes('.jpeg')
              ? 'image/jpeg'
              : 'image/png'
    return new Blob([fileBuffer], { type: mimeType })
  }

  const response = await fetch(normalizedValue)
  if (!response.ok) {
    throw new Error(`参考图读取失败 (${response.status})`)
  }

  return response.blob()
}

export interface AgentWorkspaceModelPlanResult {
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

export const fetchWithBurstRateRetry = async (input: FetchWithBurstRateRetryInput) => {
  let networkErrorAttempt = 0

  for (let attemptIndex = 0; attemptIndex <= BURST_RATE_RETRY_DELAYS.length; attemptIndex += 1) {
    // 超时只覆盖"等响应头"阶段：
    //   - fetch 返回 Response 之前若超过 headersTimeoutMs 仍未拿到头，主动 abort、按网络错重试。
    //   - fetch 返回后立即 clearTimeout，让 response.body 的流式读取可以慢慢走，避免 SSE 大模型
    //     n>1 顺序生成时 body 读到一半被同一 timer 误杀。
    //   - 外部 signal（用户停止任务）通过事件转发持续生效，body 阶段仍能被中断。
    const headersTimeoutMs = input.timeoutMs ?? UPSTREAM_FETCH_TIMEOUT_BASE_MS
    const fetchController = new AbortController()
    const forwardExternalAbort = () => fetchController.abort(input.signal.reason)
    if (input.signal.aborted) {
      forwardExternalAbort()
    } else {
      input.signal.addEventListener('abort', forwardExternalAbort, { once: true })
    }

    let headersTimedOut = false
    const headersTimeoutHandle = setTimeout(() => {
      headersTimedOut = true
      fetchController.abort(new DOMException(
        `等待响应头超过 ${headersTimeoutMs} ms`,
        'TimeoutError',
      ))
    }, headersTimeoutMs)

    let response: Response
    try {
      response = await fetch(input.url, {
        ...input.init,
        signal: fetchController.signal,
      })
    } catch (error) {
      clearTimeout(headersTimeoutHandle)
      // 区分三种异常：
      //   1) 外部主动 abort（用户停止任务）→ 直接抛出，不重试
      //   2) headers 阶段超时 → 视作网络错误，按 NETWORK_ERROR_RETRY_DELAYS 重试
      //   3) socket reset / TLS abort 等 TypeError → 同上
      if (input.signal.aborted) {
        throw error
      }

      const isTimeout = headersTimedOut
      const isNetworkError = isTimeout
        || error instanceof TypeError
        || (error instanceof DOMException && error.name === 'TimeoutError')

      if (!isNetworkError || networkErrorAttempt >= NETWORK_ERROR_RETRY_DELAYS.length) {
        throw error
      }

      const baseDelayMs = NETWORK_ERROR_RETRY_DELAYS[networkErrorAttempt]
      const jitterMs = Math.floor(Math.random() * 400)
      const waitDurationMs = baseDelayMs + jitterMs
      const errorMessage = error instanceof Error ? error.message : String(error)
      // undici 把真实底层错（ECONNRESET / UND_ERR_SOCKET / UND_ERR_HEADERS_TIMEOUT / EPROTO …）
      // 包在 TypeError.cause 里，仅看 message 永远只能看到 "fetch failed"。
      const causeRaw = (error as { cause?: unknown })?.cause
      const causeError = causeRaw instanceof Error ? causeRaw : null
      const causeCode = causeError && typeof (causeError as { code?: unknown }).code === 'string'
        ? String((causeError as { code?: unknown }).code)
        : null
      const causePreview = causeError
        ? `${causeError.name}: ${causeError.message}`
        : (causeRaw ? String(causeRaw) : null)

      input.logGenerationTask(`${input.stage}:network_error_retry`, {
        ...input.detail,
        attempt: networkErrorAttempt + 1,
        waitDurationMs,
        isTimeout,
        errorPreview: errorMessage.slice(0, 240),
        causeCode,
        causePreview: causePreview ? causePreview.slice(0, 240) : null,
      })

      await input.onRetry?.({
        attempt: networkErrorAttempt + 1,
        waitDurationMs,
        status: 0,
        errorPreview: [errorMessage, causePreview].filter(Boolean).join(' | ').slice(0, 240),
        stage: input.stage,
      })

      await sleepWithAbortSignal(input.signal, waitDurationMs)
      networkErrorAttempt += 1
      // 网络错重试时不消耗 burst rate 重试预算
      attemptIndex -= 1
      continue
    }

    // 拿到 Response 后立即关闭 headers timer；保留 external→fetchController 的转发，
    // 让 body 读取阶段仍能被用户停止任务中断。
    clearTimeout(headersTimeoutHandle)

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

    input.logGenerationTask(`${input.stage}:burst_rate_retry`, {
      ...input.detail,
      status: response.status,
      attempt: attemptIndex + 1,
      waitDurationMs,
      errorPreview: responseText.slice(0, 240),
    })

    await input.onRetry?.({
      attempt: attemptIndex + 1,
      waitDurationMs,
      status: response.status,
      errorPreview: responseText.slice(0, 240),
      stage: input.stage,
    })

    await sleepWithAbortSignal(input.signal, waitDurationMs)
  }

  throw new Error('上游请求重试流程异常结束')
}

export const isChatCompletionsEndpoint = (endpoint: string) => {
  return /chat\/completions/i.test(String(endpoint || '').trim())
}

export const extractChatTextFromNonStreamResponse = async (response: Response) => {
  const result: any = await response.json().catch(() => null)
  const messageContent = result?.choices?.[0]?.message?.content
  if (typeof messageContent === 'string' && messageContent.trim()) {
    return messageContent
  }
  return ''
}

export const extractImageUrlsFromStreamResponse = async (response: Response, signal: AbortSignal) => {
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

        const parsedChunk = parseUpstreamStreamChunk(chunk)
        if (parsedChunk.text) {
          fullContent += parsedChunk.text
        }
        if (parsedChunk.imageUrls.length) {
          imageUrls.push(...parsedChunk.imageUrls)
        }
      }
    }
  }

  imageUrls.push(...extractImageUrlsFromText(fullContent))

  return imageUrls
}

export const requestImageGeneration = async (input: RequestImageGenerationInput) => {
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

  const requestBody = normalizeImageGenerationRequestBody({
    requestBody: input.requestBody,
    modelKey: input.modelKey,
  })

  const upstreamImageCount = Math.max(1, Math.floor(Number((requestBody as Record<string, unknown>).n) || 1))
  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  const response = await input.fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: 'image_generation',
    timeoutMs: resolveUpstreamFetchTimeoutMs(upstreamImageCount),
    detail: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      endpointType: 'image',
      imageCount: upstreamImageCount,
    },
    onRetry: input.onRetry,
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

export const requestImageEdit = async (input: RequestImageEditInput) => {
  const upstream = await resolveGatewayProviderUpstream({
    providerId: input.providerId,
    endpointType: 'image-edit',
    modelKey: input.modelKey,
  })
  const editImageCount = Math.max(1, Math.floor(Number(input.count) || 1))
  const formData = await buildImageEditRequestFormData({
    modelKey: input.modelKey,
    prompt: input.prompt,
    size: input.size,
    count: editImageCount,
    referenceImages: input.referenceImages,
    fileNamePrefix: 'reference',
    resolveReferenceImageBlob: resolveServerReferenceImageBlob,
  })

  const headers = new Headers()
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  const response = await input.fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: 'image_edit',
    timeoutMs: resolveUpstreamFetchTimeoutMs(editImageCount),
    detail: {
      providerId: input.providerId,
      modelKey: input.modelKey,
      endpointType: 'image-edit',
      referenceImageCount: input.referenceImages.length,
      imageCount: editImageCount,
    },
    onRetry: input.onRetry,
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

export const resolveWorkspaceImageModel = async (binding?: {
  providerId: string
  modelKey: string
}) => {
  const catalog = await getPublicModelCatalog()
  if (binding?.providerId && binding?.modelKey) {
    const matchedImageModel = catalog.models.image.find(item => {
      return item.providerId === binding.providerId && item.modelKey === binding.modelKey
    })
    if (!matchedImageModel) {
      throw new Error('当前技能绑定的图片模型不可用，请在后台技能配置中重新选择')
    }
    return matchedImageModel
  }

  const imageModel = catalog.models.image[0]
  if (!imageModel) {
    throw new Error('未配置可用图片模型，请先在后台启用图片模型')
  }

  return imageModel
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

export const requestAgentWorkspaceModelPlan = async (input: {
  signal: AbortSignal
  providerId: string
  modelKey: string
  capabilityFlags?: ModelCapabilityFlags | null
  skill: string
  skillLabel: string
  workspaceSkillKey: string
  dependencySkillKeys?: string[]
  prompt: string
  referenceImages?: string[]
  fetchWithBurstRateRetry: (input: Omit<FetchWithBurstRateRetryInput, 'logGenerationTask'>) => Promise<Response>
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

  const capabilitySpec = parseModelCapabilitySpec(upstream.modelCapabilityJson)
  const appliedCapability = applyCapabilityFlags(input.capabilityFlags || null, capabilitySpec)

  const messages = [
    ...buildAgentChatMessages(input.skill, input.prompt, input.referenceImages),
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
        input.referenceImages?.length ? `当前还提供了 ${input.referenceImages.length} 张参考图，你必须结合这些参考图理解主体、风格、构图或保留要求。` : '当前没有提供参考图。',
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
  const response = await input.fetchWithBurstRateRetry({
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
        ...appliedCapability.upstreamFields,
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
    ? parsed.plan_items.map((item) => {
        if (typeof item === 'string') {
          return item.trim()
        }

        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          return String(record.title || record.label || record.text || '').trim()
        }

        return ''
      }).filter(Boolean)
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
