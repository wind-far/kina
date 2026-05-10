/**
 * 上游流式响应解析工具
 * 统一处理聊天与图片流中的文本增量、图片地址和错误信息提取逻辑。
 */

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

export const extractChatTextFromJsonPayload = (result: any) => {
  const candidates = [
    result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.delta?.content,
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

/**
 * 抽取上游"思考过程"内容，覆盖三类厂商：
 * - OpenAI 兼容（DeepSeek-R1 / 阿里通义 thinking / OpenAI o-系列）：`choices[0].delta.reasoning_content`
 *   也可能是 `reasoning` / `thinking`（部分实现）
 * - Anthropic Claude：流式中 `delta.thinking` 或 `content_block` type='thinking' + `delta.thinking`
 * - Google Gemini：`candidates[0].content.parts[].thought` 文本
 *
 * 不会与最终答案混合：仅匹配明确语义为"思考"的字段。
 */
export const extractChatReasoningFromJsonPayload = (result: any) => {
  // OpenAI 兼容路径（DeepSeek / 通义 / OpenAI）
  const openAiCandidates = [
    result?.choices?.[0]?.delta?.reasoning_content,
    result?.choices?.[0]?.delta?.reasoning,
    result?.choices?.[0]?.message?.reasoning_content,
    result?.choices?.[0]?.message?.reasoning,
  ]
  for (const candidate of openAiCandidates) {
    const normalized = normalizeContentValue(candidate)
    if (normalized) return normalized
  }

  // Anthropic Claude 流式：content_block_delta 中 delta.thinking
  // 非流式：content[].thinking
  const anthropicCandidates = [
    result?.delta?.thinking,
    result?.delta?.type === 'thinking_delta' ? result?.delta?.thinking : undefined,
    Array.isArray(result?.content)
      ? result.content
          .filter((item: any) => item?.type === 'thinking' && typeof item.thinking === 'string')
          .map((item: any) => item.thinking)
          .join('')
      : undefined,
  ]
  for (const candidate of anthropicCandidates) {
    const normalized = normalizeContentValue(candidate)
    if (normalized) return normalized
  }

  // Gemini：content.parts[].thought 为 true 时 text 是思考片段
  if (Array.isArray(result?.candidates)) {
    const buffer: string[] = []
    for (const candidate of result.candidates) {
      const parts = candidate?.content?.parts
      if (!Array.isArray(parts)) continue
      for (const part of parts) {
        if (part?.thought === true && typeof part.text === 'string') {
          buffer.push(part.text)
        }
      }
    }
    if (buffer.length) {
      const joined = buffer.join('')
      if (joined.trim()) return joined
    }
  }

  return ''
}

export const parseChatChunkText = (chunk: string) => {
  try {
    const parsed = JSON.parse(chunk)
    return extractChatTextFromJsonPayload(parsed)
  } catch {
    return ''
  }
}

/** 与 parseChatChunkText 对偶，专门抽取思考过程片段。 */
export const parseChatChunkReasoning = (chunk: string) => {
  try {
    const parsed = JSON.parse(chunk)
    return extractChatReasoningFromJsonPayload(parsed)
  } catch {
    return ''
  }
}

export const parseChatChunkError = (chunk: string) => {
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

export const extractImageUrlsFromJsonResponse = (result: any) => {
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

export const extractImageUrlsFromText = (text: string) => {
  const urls: string[] = []
  const normalizedText = String(text || '')

  const markdownImages = normalizedText.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)
  if (markdownImages) {
    for (const item of markdownImages) {
      const matched = item.match(/\((https?:\/\/[^\s)]+)\)/)
      if (matched?.[1]) {
        urls.push(matched[1])
      }
    }
  }

  const base64Image = normalizedText.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
  if (base64Image?.[0]) {
    urls.push(base64Image[0])
  }

  return urls
}

export const parseUpstreamStreamChunk = (chunk: string) => {
  try {
    const parsed = JSON.parse(chunk)
    const delta = parsed?.choices?.[0]?.delta
    const text = extractChatTextFromJsonPayload(parsed)
    const imageUrls: string[] = []

    if (Array.isArray(delta?.images)) {
      for (const image of delta.images) {
        const imageUrl = image?.image_url?.url
        if (imageUrl) {
          imageUrls.push(imageUrl)
        }
      }
    }

    if (delta?.inline_data?.data) {
      imageUrls.push(`data:${delta.inline_data.mime_type};base64,${delta.inline_data.data}`)
    }

    const errorMessage = typeof parsed?.error?.message === 'string' && parsed.error.message.trim()
      ? parsed.error.message.trim()
      : ''

    return {
      text,
      imageUrls,
      errorMessage,
    }
  } catch {
    return {
      text: '',
      imageUrls: [],
      errorMessage: '',
    }
  }
}
