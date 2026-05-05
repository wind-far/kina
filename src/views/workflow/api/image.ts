/**
 * 图片生成 API
 * 支持 /images/generations 和 /chat/completions 两种协议
 */

import { request } from './request'
import { AI_GATEWAY_REQUEST_PATH, createGatewayPayload } from '@/api/ai-gateway'
import { buildApiUrl } from '@/api/http'
import { handleUnauthorizedResponse, readApiErrorMessage } from '@/api/response'
import { MARKETING_POINTS_UPDATED_EVENT } from '@/stores/marketing-center'
import { extractImageUrlsFromText, parseUpstreamStreamChunk } from '@/shared/upstream-stream-parser'
import { buildImageEditRequestFormData } from '@/shared/upstream-request-normalizer'

const notifyMarketingPointsUpdated = (response: Response) => {
  if (typeof window === 'undefined') return
  if (response.headers.get('x-marketing-points-updated') !== '1') return
  window.dispatchEvent(new CustomEvent(MARKETING_POINTS_UPDATED_EVENT))
}

const DEFAULT_IMAGE_ENDPOINT = '/images/generations'

export interface WorkflowImageGeneratePayload {
  model?: string
  prompt?: string
  size?: string
  quality?: string
  n?: number
  image?: string[]
}

export interface WorkflowImageGenerateOptions {
  requestType?: 'json' | 'formdata'
  endpoint?: string
  signal?: AbortSignal
}

const toImageEditFormData = async (data: WorkflowImageGeneratePayload) => {
  return buildImageEditRequestFormData({
    modelKey: String(data?.model || '').trim(),
    prompt: String(data?.prompt || '').trim(),
    size: String(data?.size || '').trim(),
    quality: String(data?.quality || '').trim(),
    count: Number(data?.n || 1),
    referenceImages: Array.isArray(data?.image) ? data.image : [],
    fileNamePrefix: 'workflow-reference',
  })
}

export const generateImage = async (
  data: WorkflowImageGeneratePayload,
  options: WorkflowImageGenerateOptions = {},
) => {
  const { requestType = 'json', endpoint, signal } = options
  const url = endpoint || DEFAULT_IMAGE_ENDPOINT
  const referenceImages = Array.isArray(data?.image)
    ? data.image.filter((item: unknown) => typeof item === 'string' && String(item).trim())
    : []

  // 如果路径包含 chat/completions，使用 chat 协议
  if (url.includes('chat/completions')) {
    return generateImageViaChat(data, signal)
  }

  if (referenceImages.length) {
    const formData = await toImageEditFormData(data)
    return request({
      url: '/images/edits',
      method: 'post',
      data: formData,
      signal,
    }, 'image-edit')
  }

  return request({
    url,
    method: 'post',
    data,
    headers: requestType === 'formdata' ? { 'Content-Type': 'multipart/form-data' } : {},
    signal,
  }, 'image')
}

/**
 * 通过 chat completions 接口生成图片
 * 从 SSE 流中提取图片 URL 或 base64
 */
async function generateImageViaChat(data: WorkflowImageGeneratePayload, signal?: AbortSignal) {
  const body = {
    model: data.model,
    messages: [{ role: 'user', content: data.prompt }],
    stream: true
  }
  const gatewayPayload = await createGatewayPayload('image', {
    method: 'POST',
    data: body,
  })

  const response = await fetch(buildApiUrl(AI_GATEWAY_REQUEST_PATH), {
    method: 'POST',
    // 图片生成走同源网关时也要携带会话 Cookie，否则会被后端判未登录。
    credentials: 'include',
    signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(gatewayPayload),
  })

  notifyMarketingPointsUpdated(response)

  if (!response.ok) {
    handleUnauthorizedResponse(response.status, 'image-chat-generation')
    const { message } = await readApiErrorMessage(response)
    throw new Error(message)
  }

  // 解析 SSE 流，收集完整内容
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  const imageUrls: string[] = []

  while (true) {
    let done: boolean | undefined
    let value: Uint8Array<ArrayBufferLike> | undefined
    try {
      ({ done, value } = await reader.read())
    } catch {
      // 网络中断，用已收到的数据继续处理
      break
    }
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE 消息以双换行分隔
    let boundary
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const message = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)

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

  // 处理 buffer 中剩余数据
  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
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

  imageUrls.push(...extractImageUrlsFromText(fullContent))

  if (imageUrls.length) {
    return { data: imageUrls.map((url: string) => ({ url })) }
  }

  throw new Error('未能从响应中提取到图片')
}
