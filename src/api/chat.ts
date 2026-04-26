/**
 * 流式对话 API（SSE）
 * 前端请求同源网关，再由网关转发到第三方聊天接口。
 */

import { AI_GATEWAY_REQUEST_PATH, createGatewayPayload } from './ai-gateway'
import { handleUnauthorizedResponse } from './response'

/**
 * 流式对话补全
 */
export async function* streamChatCompletions(data: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(AI_GATEWAY_REQUEST_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createGatewayPayload('chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: { ...data, stream: true },
    })),
    signal,
  })

  if (!response.ok) {
    handleUnauthorizedResponse(response.status, 'chat-stream')
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error?.message || error?.message || '请求失败')
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const chunk = trimmed.slice(5).trim()
      if (chunk === '[DONE]') return

      try {
        const parsed = JSON.parse(chunk)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // 跳过无效 JSON
      }
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const chunk = trimmed.slice(5).trim()
      if (chunk === '[DONE]') return
      try {
        const parsed = JSON.parse(chunk)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // 跳过无效 JSON
      }
    }
  }
}
