// 基于 fetch 的 SSE 订阅器，支持同源 Cookie 与手动中断。

export interface SseMessage {
  event: string
  data: string
}

const parseSseChunk = (rawBlock: string): SseMessage | null => {
  const lines = rawBlock.split('\n')
  let eventName = 'message'
  const dataLines: string[] = []

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() || 'message'
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (!dataLines.length) {
    return null
  }

  return {
    event: eventName,
    data: dataLines.join('\n'),
  }
}

// 读取 SSE 流并把消息逐条交给调用方处理。
export const consumeSseStream = async (
  response: Response,
  onMessage: (message: SseMessage) => void,
) => {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('SSE 响应缺少可读流')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    let boundaryIndex = -1
    while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex + 2)
      const message = parseSseChunk(block)
      if (message) {
        onMessage(message)
      }
    }
  }

  if (buffer.trim()) {
    const message = parseSseChunk(buffer)
    if (message) {
      onMessage(message)
    }
  }
}
