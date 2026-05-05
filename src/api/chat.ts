/**
 * 流式对话 API（SSE）
 * 前端请求同源网关，再由网关转发到第三方聊天接口。
 */

import { AI_GATEWAY_REQUEST_PATH, createGatewayPayload } from './ai-gateway'
import { buildApiUrl } from './http'
import { handleUnauthorizedResponse, readApiErrorMessage } from './response'
import { parseChatChunkText } from '@/shared/upstream-stream-parser'

/**
 * 流式对话补全
 */
export async function* streamChatCompletions(data: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(buildApiUrl(AI_GATEWAY_REQUEST_PATH), {
    method: 'POST',
    // 对话同样通过会话 Cookie 识别当前用户，避免网关误判未登录。
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(await createGatewayPayload('chat', {
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
    const { message } = await readApiErrorMessage(response)
    throw new Error(message)
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

      const content = parseChatChunkText(chunk)
      if (content) {
        yield content
      }
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const chunk = trimmed.slice(5).trim()
      if (chunk === '[DONE]') return
      const content = parseChatChunkText(chunk)
      if (content) {
        yield content
      }
    }
  }
}
