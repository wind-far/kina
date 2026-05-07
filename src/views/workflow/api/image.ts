/**
 * 图片生成 API
 * 支持 /images/generations 和 /chat/completions 两种协议
 */

import { request } from './request'
import { iterateGatewaySseMessages } from '@/api/gateway-sse'
import { collectGatewaySseWithStrategy, createImageUrlCollectStrategy } from '@/api/gateway-sse-strategies'
import { buildImageEditRequestFormData } from '@/shared/upstream-request-normalizer'

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
  }

  const messages = iterateGatewaySseMessages({
    endpointType: 'image',
    data: body,
    signal,
    requestTag: 'image-chat-generation',
    ignoreReadError: true,
  })

  return collectGatewaySseWithStrategy(messages, createImageUrlCollectStrategy())
}
