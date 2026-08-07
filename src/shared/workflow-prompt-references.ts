export const WORKFLOW_PROMPT_REFERENCE_LIMIT = 4

export const WORKFLOW_PROMPT_REFERENCE_ACCEPT = 'image/jpeg,.jpeg,image/jpg,.jpg,image/png,.png,image/webp,.webp,image/bmp,.bmp'

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

/**
 * 将浏览器上传的参考图转成能被图片任务 JSON 和视频 FormData 共同消费的数据 URL。
 * 不能保留 blob: 临时地址：它只能在当前浏览器上下文中读取，后端图片任务无法访问。
 */
export const workflowPromptFileToDataUrl = async (file: Blob) => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = String(file.type || 'application/octet-stream').trim() || 'application/octet-stream'
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`
}

export const getWorkflowPromptAvailableReferenceSlots = (currentCount: number) => {
  const normalizedCount = Number.isFinite(currentCount) ? Math.max(0, Math.floor(currentCount)) : 0
  return Math.max(0, WORKFLOW_PROMPT_REFERENCE_LIMIT - normalizedCount)
}

export const mergeWorkflowPromptReferences = <T extends { id: string }>(...groups: T[][]) => {
  const merged = groups.flat()
  return merged
    .filter((reference, index) => merged.findIndex(item => item.id === reference.id) === index)
    .slice(0, WORKFLOW_PROMPT_REFERENCE_LIMIT)
}
