/**
 * 图生图请求辅助工具
 * 统一工作流与主生成器的参考图排序、清洗和请求字段注入逻辑
 */

export interface OrderedImageReferenceInput {
  order?: number | null | undefined
  imageData?: string | null | undefined
}

const normalizeImageData = (value: string | null | undefined) => {
  const normalizedValue = String(value || '').trim()
  return normalizedValue || ''
}

const normalizeOrder = (value: number | null | undefined) => {
  const nextOrder = Number(value)
  return Number.isFinite(nextOrder) ? nextOrder : Number.MAX_SAFE_INTEGER
}

/**
 * 按顺序收集参考图，输出项目内统一使用的 `image: string[]` 结构
 */
export const collectOrderedImageReferences = (items: OrderedImageReferenceInput[]) => {
  return items
    .map(item => ({
      order: normalizeOrder(item.order),
      imageData: normalizeImageData(item.imageData),
    }))
    .filter(item => item.imageData)
    .sort((left, right) => left.order - right.order)
    .map(item => item.imageData)
}

/**
 * 将参考图注入图片生成请求体。
 * 约定：最终协议统一使用 `image: string[]`
 */
export const appendImageReferencesToRequestBody = <T extends Record<string, unknown>>(
  baseBody: T,
  references: string[] | null | undefined,
) => {
  const normalizedReferences = collectOrderedImageReferences(
    Array.isArray(references)
      ? references.map((imageData, index) => ({ order: index + 1, imageData }))
      : [],
  )

  if (!normalizedReferences.length) {
    return baseBody
  }

  return {
    ...baseBody,
    image: normalizedReferences,
  }
}
