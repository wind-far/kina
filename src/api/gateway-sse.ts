/**
 * AI 网关 SSE 运行时
 * 统一处理网关请求、鉴权报错与 SSE 分包逻辑。
 */

import { AI_GATEWAY_REQUEST_PATH, createGatewayPayload } from './ai-gateway'
import { buildApiUrl } from './http'
import { handleUnauthorizedResponse, readApiErrorMessage } from './response'
import { MARKETING_POINTS_UPDATED_EVENT } from '@/stores/marketing-center'
import type { AiEndpointType } from '@/api/provider-config'

export interface GatewaySseMessage {
  event: string
  data: string
}

export interface GatewaySseRequestOptions {
  endpointType: AiEndpointType
  data: Record<string, unknown>
  signal?: AbortSignal
  requestTag: string
  headers?: Record<string, string>
  ignoreReadError?: boolean
}

const notifyMarketingPointsUpdated = (response: Response) => {
  if (typeof window === 'undefined') return
  if (response.headers.get('x-marketing-points-updated') !== '1') return
  window.dispatchEvent(new CustomEvent(MARKETING_POINTS_UPDATED_EVENT))
}

const parseSseBlock = (rawBlock: string): GatewaySseMessage[] => {
  const lines = rawBlock.split('\n')
  let eventName = 'message'
  const messages: GatewaySseMessage[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(':')) {
      continue
    }

    if (trimmed.startsWith('event:')) {
      eventName = trimmed.slice(6).trim() || 'message'
      continue
    }

    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') {
        continue
      }

      messages.push({
        event: eventName,
        data,
      })
    }
  }

  return messages
}

const fetchGatewaySseResponse = async (options: GatewaySseRequestOptions) => {
  const response = await fetch(buildApiUrl(AI_GATEWAY_REQUEST_PATH), {
    method: 'POST',
    // AI 网关依赖会话 Cookie 识别当前用户，流式请求也必须显式携带。
    credentials: 'include',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(await createGatewayPayload(options.endpointType, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      data: {
        ...options.data,
        stream: true,
      },
    })),
  })

  notifyMarketingPointsUpdated(response)

  if (!response.ok) {
    handleUnauthorizedResponse(response.status, options.requestTag)
    const { message } = await readApiErrorMessage(response)
    throw new Error(message)
  }

  return response
}

// 统一读取 AI 网关 SSE 数据块，供上层策略决定如何解析。
export async function* iterateGatewaySseMessages(options: GatewaySseRequestOptions) {
  const response = await fetchGatewaySseResponse(options)
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('SSE 响应缺少可读流')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    let done = false
    let value: Uint8Array<ArrayBufferLike> | undefined

    try {
      ({ done, value } = await reader.read())
    } catch {
      if (!options.ignoreReadError) {
        throw new Error('SSE 流读取失败')
      }
      break
    }

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    let boundaryIndex = -1
    while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex + 2)

      const parsedMessages = parseSseBlock(block)
      for (const message of parsedMessages) {
        yield message
      }
    }
  }

  if (buffer.trim()) {
    const parsedMessages = parseSseBlock(buffer)
    for (const message of parsedMessages) {
      yield message
    }
  }
}
