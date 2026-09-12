import { uploadStorageFile } from '@/api/storage'

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value)

/** 服务端视频任务接收稳定 URL；站内 /uploads 会在请求上游前转换成公网地址。 */
export const resolveVideoReferenceUrl = (value: string) => {
  const normalized = String(value || '').trim()
  if (isHttpUrl(normalized) || normalized.startsWith('/uploads/')) return normalized
  return ''
}

/** 上传浏览器图片并返回稳定 URL，避免把 Base64 写入视频任务 JSON。 */
export const uploadVideoReferenceImage = async (file: File) => {
  if (!String(file.type || '').startsWith('image/')) throw new Error('视频参考素材必须是图片')
  const uploaded = await uploadStorageFile(file, 'reference')
  const url = resolveVideoReferenceUrl(uploaded?.publicUrl || uploaded?.providerPublicUrl || '')
  if (!url) throw new Error('视频参考图上传后未返回稳定 URL')
  return url
}

/** 兼容历史画布中的 data:/blob: 图片；提交视频任务前统一物化为 URL。 */
export const ensureVideoReferenceImageUrl = async (value: string, filename = 'video-reference.png') => {
  const directUrl = resolveVideoReferenceUrl(value)
  if (directUrl) return directUrl
  const normalized = String(value || '').trim()
  if (!normalized.startsWith('data:') && !normalized.startsWith('blob:')) {
    throw new Error('视频参考图不是可访问的 URL')
  }
  const response = await fetch(normalized)
  if (!response.ok) throw new Error(`视频参考图读取失败 (${response.status})`)
  const blob = await response.blob()
  const mimeType = blob.type || 'image/png'
  return uploadVideoReferenceImage(new File([blob], filename, { type: mimeType }))
}
