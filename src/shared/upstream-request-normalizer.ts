/**
 * 上游请求归一化工具
 * 统一处理图片生成请求体清洗、图生图表单组装与参考图格式归一化。
 */

const normalizeStringValue = (value: unknown) => String(value || '').trim()

const resolveImageMimeType = (value: string) => {
  const dataMatch = value.match(/^data:([^;,]+)[;,]/i)
  if (dataMatch?.[1]) return dataMatch[1]

  const lowerValue = value.toLowerCase()
  if (lowerValue.includes('.webp')) return 'image/webp'
  if (lowerValue.includes('.gif')) return 'image/gif'
  if (lowerValue.includes('.bmp')) return 'image/bmp'
  if (lowerValue.includes('.svg')) return 'image/svg+xml'
  if (lowerValue.includes('.jpg') || lowerValue.includes('.jpeg')) return 'image/jpeg'
  return 'image/png'
}

const resolveImageFileExtension = (mimeType: string) => {
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/bmp') return 'bmp'
  if (mimeType === 'image/svg+xml') return 'svg'
  if (mimeType === 'image/jpeg') return 'jpg'
  return 'png'
}

export const normalizeReferenceImageList = (items: unknown) => {
  return Array.isArray(items)
    ? items.map(item => normalizeStringValue(item)).filter(Boolean)
    : []
}

// 清洗图片生成请求体，避免把内部字段与空值直接透传给上游。
export const normalizeImageGenerationRequestBody = (input: {
  requestBody: Record<string, unknown>
  modelKey: string
}) => {
  const normalizedBody: Record<string, unknown> = {
    ...input.requestBody,
    model: normalizeStringValue(input.modelKey),
  }

  delete normalizedBody.providerId

  const prompt = normalizeStringValue(normalizedBody.prompt)
  if (prompt) {
    normalizedBody.prompt = prompt
  } else {
    delete normalizedBody.prompt
  }

  const size = normalizeStringValue(normalizedBody.size)
  if (size) {
    normalizedBody.size = size
  } else {
    delete normalizedBody.size
  }

  const quality = normalizeStringValue(normalizedBody.quality)
  if (quality) {
    normalizedBody.quality = quality
  } else {
    delete normalizedBody.quality
  }

  const normalizedImages = normalizeReferenceImageList(normalizedBody.image)
  if (normalizedImages.length) {
    normalizedBody.image = normalizedImages
  } else {
    delete normalizedBody.image
  }

  return normalizedBody
}

// 将参考图统一转换为上游可消费的 multipart/form-data。
export const buildImageEditRequestFormData = async (input: {
  modelKey: string
  prompt: string
  size?: string
  quality?: string
  count?: number
  referenceImages: string[]
  fileNamePrefix?: string
}) => {
  const formData = new FormData()
  const modelKey = normalizeStringValue(input.modelKey)
  const prompt = normalizeStringValue(input.prompt)
  const size = normalizeStringValue(input.size)
  const quality = normalizeStringValue(input.quality)
  const referenceImages = normalizeReferenceImageList(input.referenceImages)
  const fileNamePrefix = normalizeStringValue(input.fileNamePrefix) || 'reference-image'

  if (modelKey) formData.append('model', modelKey)
  if (prompt) formData.append('prompt', prompt)
  formData.append('n', String(Number(input.count) > 0 ? Number(input.count) : 1))
  if (size) formData.append('size', size)
  if (quality) formData.append('quality', quality)

  for (let index = 0; index < referenceImages.length; index += 1) {
    const imageValue = referenceImages[index]
    const response = await fetch(imageValue)
    if (!response.ok) {
      throw new Error(`参考图读取失败 (${response.status})`)
    }

    const blob = await response.blob()
    const mimeType = blob.type || resolveImageMimeType(imageValue)
    const extension = resolveImageFileExtension(mimeType)
    formData.append('image', blob, `${fileNamePrefix}-${index + 1}.${extension}`)
  }

  return formData
}
