/**
 * 图片生成 API
 * 支持 /images/generations 和 /chat/completions 两种协议
 */

import { request } from './request'
import { loadPublicModelCatalog, resolveRequestModelKey, resolveRequestProviderId } from '@/config/models'
import { AI_GATEWAY_REQUEST_PATH } from '@/api/ai-gateway'
import { handleUnauthorizedResponse } from '@/api/response'
import { MARKETING_POINTS_UPDATED_EVENT } from '@/stores/marketing-center'

const notifyMarketingPointsUpdated = (response: Response) => {
  if (typeof window === 'undefined') return
  if (response.headers.get('x-marketing-points-updated') !== '1') return
  window.dispatchEvent(new CustomEvent(MARKETING_POINTS_UPDATED_EVENT))
}

const DEFAULT_IMAGE_ENDPOINT = '/images/generations'

const resolveImageMimeType = (value: string) => {
  const dataMatch = value.match(/^data:([^;,]+)[;,]/i)
  if (dataMatch?.[1]) return dataMatch[1]

  const lowerValue = value.toLowerCase()
  if (lowerValue.includes('.webp')) return 'image/webp'
  if (lowerValue.includes('.gif')) return 'image/gif'
  if (lowerValue.includes('.jpg') || lowerValue.includes('.jpeg')) return 'image/jpeg'
  return 'image/png'
}

const resolveImageFileExtension = (mimeType: string) => {
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/jpeg') return 'jpg'
  return 'png'
}

const toImageEditFormData = async (data: any) => {
  const formData = new FormData()
  const prompt = String(data?.prompt || '').trim()
  const model = String(data?.model || '').trim()
  const size = String(data?.size || '').trim()
  const quality = String(data?.quality || '').trim()
  const referenceImages = Array.isArray(data?.image) ? data.image : []

  if (model) formData.append('model', model)
  if (prompt) formData.append('prompt', prompt)
  formData.append('n', String(data?.n || 1))
  if (size) formData.append('size', size)
  if (quality) formData.append('quality', quality)

  for (let index = 0; index < referenceImages.length; index += 1) {
    const item = referenceImages[index]
    const imageValue = typeof item === 'string'
      ? item.trim()
      : ''
    if (!imageValue) continue

    const blob = await fetch(imageValue).then((response) => {
      if (!response.ok) {
        throw new Error(`参考图读取失败 (${response.status})`)
      }
      return response.blob()
    })
    const mimeType = blob.type || resolveImageMimeType(imageValue)
    const extension = resolveImageFileExtension(mimeType)
    formData.append('image', blob, `workflow-reference-${index + 1}.${extension}`)
  }

  return formData
}

export const generateImage = async (data: any, options: any = {}) => {
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
async function generateImageViaChat(data: any, signal?: AbortSignal) {
  const body = {
    model: data.model,
    messages: [{ role: 'user', content: data.prompt }],
    stream: true
  }

  await loadPublicModelCatalog()
  const providerId = resolveRequestProviderId(String(data.model || '').trim(), 'IMAGE')
  const requestModelKey = resolveRequestModelKey(String(data.model || '').trim(), 'IMAGE')
  if (!providerId) {
    throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
  }

  const response = await fetch(AI_GATEWAY_REQUEST_PATH, {
    method: 'POST',
    // 图片生成走同源网关时也要携带会话 Cookie，否则会被后端判未登录。
    credentials: 'include',
    signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      upstream: {
        providerId,
        endpointType: 'image',
        modelKey: requestModelKey,
      },
      request: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          ...body,
          model: requestModelKey,
        },
      },
    }),
  })

  notifyMarketingPointsUpdated(response)

  if (!response.ok) {
    handleUnauthorizedResponse(response.status, 'image-chat-generation')
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || '请求失败')
  }

  // 解析 SSE 流，收集完整内容
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  const imageUrls: string[] = []

  while (true) {
    let done, value
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

        try {
          const parsed = JSON.parse(chunk)
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content) fullContent += delta.content
          // delta.images 格式（Gemini 等）
          if (delta?.images) {
            for (const img of delta.images) {
              const url = img?.image_url?.url
              if (url) imageUrls.push(url)
            }
          }
          // inline_data 格式
          if (delta?.inline_data) {
            const d = delta.inline_data
            imageUrls.push(`data:${d.mime_type};base64,${d.data}`)
          }
        } catch {}
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
      try {
        const parsed = JSON.parse(chunk)
        const delta = parsed.choices?.[0]?.delta
        if (delta?.content) fullContent += delta.content
        if (delta?.images) {
          for (const img of delta.images) {
            const url = img?.image_url?.url
            if (url) imageUrls.push(url)
          }
        }
      } catch {}
    }
  }

  // 从内容中提取图片 URL（markdown 格式）
  const mdImages = fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)
  if (mdImages) {
    for (const m of mdImages) {
      const urlMatch = m.match(/\((https?:\/\/[^\s)]+)\)/)
      if (urlMatch) imageUrls.push(urlMatch[1])
    }
  }

  // 提取 base64 图片
  const b64Match = fullContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
  if (b64Match) imageUrls.push(b64Match[0])

  if (imageUrls.length) {
    return { data: imageUrls.map((url: string) => ({ url })) }
  }

  throw new Error('未能从响应中提取到图片')
}
