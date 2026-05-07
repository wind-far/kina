/**
 * 流式对话 API（SSE）
 * 前端请求同源网关，再由网关转发到第三方聊天接口。
 */

import { iterateGatewaySseMessages } from './gateway-sse'
import { createChatTextStreamStrategy, streamGatewaySseWithStrategy } from './gateway-sse-strategies'

/**
 * 流式对话补全
 */
export async function* streamChatCompletions(data: Record<string, unknown>, signal?: AbortSignal) {
  const messages = iterateGatewaySseMessages({
    endpointType: 'chat',
    data,
    signal,
    requestTag: 'chat-stream',
  })

  const chunkStream = streamGatewaySseWithStrategy(messages, createChatTextStreamStrategy())
  for await (const chunk of chunkStream) {
    if (chunk) {
      yield chunk
    }
  }
}
