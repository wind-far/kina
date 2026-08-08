/**
 * 图片工作流批量结果的公共约束。
 *
 * 任务供应商的单次返回上限不一致；画布统一限制在 1-4 张，确保直连生成和
 * 服务端编排生成使用相同请求参数，且结果可以稳定地序列化到图片组节点。
 */
export const WORKFLOW_IMAGE_BATCH_MIN = 1
export const WORKFLOW_IMAGE_BATCH_MAX = 4

export const normalizeWorkflowImageBatchCount = (value: unknown) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return WORKFLOW_IMAGE_BATCH_MIN
  return Math.min(WORKFLOW_IMAGE_BATCH_MAX, Math.max(WORKFLOW_IMAGE_BATCH_MIN, Math.floor(numeric)))
}

export const readWorkflowGenerationImageUrls = (record: {
  images?: unknown
  outputs?: unknown
} | null | undefined) => {
  const images = Array.isArray(record?.images) ? record.images : []
  const outputUrls = Array.isArray(record?.outputs)
    ? record.outputs.map((output) => (
      output && typeof output === 'object' ? (output as { url?: unknown }).url : ''
    ))
    : []
  return [...images, ...outputUrls]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
}

export const createWorkflowImageBatchChildren = (taskRecordId: string, urls: string[]) => (
  urls.map((url, index) => ({
    id: `${taskRecordId || 'image'}-${index + 1}`,
    url,
  }))
)
