import fs from 'node:fs/promises'
import path from 'node:path'
import { joinUpstreamUrl } from '../ai-gateway/shared'
import { resolveGatewayProviderUpstream } from '../provider-config/service'
import { getUploadsDir } from '../storage/service'
import { isPathInsideDirectory } from '../shared/path-security'

const UPLOADS_PUBLIC_PATH_PREFIX = '/uploads/'
const VIDEO_POLL_INTERVAL_MS = 5_000
const VIDEO_POLL_MAX_ATTEMPTS = 120

type JsonObject = Record<string, unknown>

export interface VideoGenerationUpstreamInput {
  signal: AbortSignal
  providerId: string
  modelKey: string
  prompt: string
  ratio?: string
  resolution?: string
  duration?: string
  referenceImages: string[]
  referenceImageRoles: string[]
}

export interface VideoGenerationUpstreamResult {
  upstreamUrl: string
  taskId?: string
  videoUrl: string
}

const asObject = (value: unknown): JsonObject | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
)

const readPath = (value: unknown, pathParts: Array<string | number>) => {
  let current: unknown = value
  for (const part of pathParts) {
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return undefined
      current = current[part]
      continue
    }
    const objectValue = asObject(current)
    if (!objectValue) return undefined
    current = objectValue[part]
  }
  return current
}

const readFirstString = (value: unknown, paths: Array<Array<string | number>>) => {
  for (const pathParts of paths) {
    const candidate = String(readPath(value, pathParts) || '').trim()
    if (candidate) return candidate
  }
  return ''
}

export const extractVideoTaskId = (payload: unknown) => readFirstString(payload, [
  ['id'],
  ['task_id'],
  ['taskId'],
  ['data', 'id'],
  ['data', 'task_id'],
  ['data', 'taskId'],
  ['result', 'id'],
  ['result', 'task_id'],
])

export const extractVideoUrl = (payload: unknown) => readFirstString(payload, [
  ['url'],
  ['video_url'],
  ['videoUrl'],
  ['data', 0, 'url'],
  ['data', 0, 'video_url'],
  ['data', 'url'],
  ['data', 'video_url'],
  ['output', 'url'],
  ['output', 'video_url'],
  ['result', 'url'],
  ['result', 'video_url'],
])

export const extractVideoTaskStatus = (payload: unknown) => readFirstString(payload, [
  ['status'],
  ['state'],
  ['data', 'status'],
  ['data', 'state'],
  ['result', 'status'],
  ['result', 'state'],
]).toLowerCase()

const extractVideoError = (payload: unknown) => readFirstString(payload, [
  ['error', 'message'],
  ['error'],
  ['message'],
  ['data', 'error', 'message'],
  ['data', 'message'],
])

const readResponsePayload = async (response: Response) => {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text }
  }
}

const assertSuccessfulResponse = (response: Response, payload: unknown) => {
  if (response.ok) return
  throw new Error(extractVideoError(payload) || `视频上游请求失败 (${response.status})`)
}

const waitForNextPoll = (signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) {
    reject(new DOMException('视频任务轮询已取消', 'AbortError'))
    return
  }
  const handleAbort = () => {
    clearTimeout(timer)
    reject(new DOMException('视频任务轮询已取消', 'AbortError'))
  }
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', handleAbort)
    resolve()
  }, VIDEO_POLL_INTERVAL_MS)
  signal.addEventListener('abort', handleAbort, { once: true })
})

const inferImageMimeType = (value: string) => {
  const normalized = value.toLowerCase().split('?')[0]
  if (normalized.endsWith('.webp')) return 'image/webp'
  if (normalized.endsWith('.gif')) return 'image/gif'
  if (normalized.endsWith('.bmp')) return 'image/bmp'
  if (normalized.endsWith('.svg')) return 'image/svg+xml'
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg'
  return 'image/png'
}

const resolveReferenceImageBlob = async (imageValue: string) => {
  const normalizedValue = String(imageValue || '').trim()
  if (normalizedValue.startsWith(UPLOADS_PUBLIC_PATH_PREFIX)) {
    const uploadsDir = getUploadsDir()
    const relativePath = decodeURIComponent(normalizedValue.slice(UPLOADS_PUBLIC_PATH_PREFIX.length))
    const filePath = path.resolve(uploadsDir, relativePath)
    if (!isPathInsideDirectory(uploadsDir, filePath)) throw new Error('参考图路径非法')
    return new Blob([await fs.readFile(filePath)], { type: inferImageMimeType(normalizedValue) })
  }
  if (normalizedValue.startsWith('blob:')) {
    throw new Error('浏览器临时图片无法用于服务端视频生成，请先上传后再运行')
  }
  const response = await fetch(normalizedValue)
  if (!response.ok) throw new Error(`参考图读取失败 (${response.status})`)
  return response.blob()
}

const normalizeReferenceRole = (value: string) => {
  const role = String(value || '').trim()
  return ['first_frame_image', 'last_frame_image', 'input_reference'].includes(role)
    ? role
    : 'input_reference'
}

const appendReferenceImages = async (
  formData: FormData,
  referenceImages: string[],
  referenceImageRoles: string[],
) => {
  for (const [index, imageValue] of referenceImages.entries()) {
    const normalizedValue = String(imageValue || '').trim()
    if (!normalizedValue) continue
    const role = normalizeReferenceRole(referenceImageRoles[index] || '')
    if (/^https?:\/\//i.test(normalizedValue)) {
      formData.append(role, normalizedValue)
      continue
    }
    const blob = await resolveReferenceImageBlob(normalizedValue)
    formData.append(role, blob, `reference-${index + 1}.${blob.type === 'image/jpeg' ? 'jpg' : 'png'}`)
  }
}

export const requestVideoGeneration = async (
  input: VideoGenerationUpstreamInput,
): Promise<VideoGenerationUpstreamResult> => {
  const upstream = await resolveGatewayProviderUpstream({
    providerId: input.providerId,
    endpointType: 'video',
    modelKey: input.modelKey,
  })
  const upstreamUrl = joinUpstreamUrl(upstream.baseUrl, upstream.endpoint)
  const formData = new FormData()
  formData.append('model', input.modelKey)
  if (input.prompt) formData.append('prompt', input.prompt)
  if (input.ratio) formData.append('ratio', input.ratio)
  if (input.resolution) formData.append('quality', input.resolution)
  if (input.duration) formData.append('duration', input.duration)
  await appendReferenceImages(formData, input.referenceImages, input.referenceImageRoles)

  const response = await fetch(upstreamUrl, {
    method: 'POST',
    headers: upstream.apiKey ? { Authorization: `Bearer ${upstream.apiKey}` } : undefined,
    body: formData,
    signal: input.signal,
  })
  const createdPayload = await readResponsePayload(response)
  assertSuccessfulResponse(response, createdPayload)
  const directVideoUrl = extractVideoUrl(createdPayload)
  const taskId = extractVideoTaskId(createdPayload)
  if (directVideoUrl) return { upstreamUrl, taskId: taskId || undefined, videoUrl: directVideoUrl }
  if (!taskId) throw new Error(extractVideoError(createdPayload) || '视频上游未返回任务 ID 或视频地址')

  const statusUrl = `${upstreamUrl.replace(/\/+$/, '')}/${encodeURIComponent(taskId)}`
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await waitForNextPoll(input.signal)
    const statusResponse = await fetch(statusUrl, {
      headers: upstream.apiKey ? { Authorization: `Bearer ${upstream.apiKey}` } : undefined,
      signal: input.signal,
    })
    const statusPayload = await readResponsePayload(statusResponse)
    assertSuccessfulResponse(statusResponse, statusPayload)
    const videoUrl = extractVideoUrl(statusPayload)
    if (videoUrl) return { upstreamUrl, taskId, videoUrl }
    const status = extractVideoTaskStatus(statusPayload)
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(extractVideoError(statusPayload) || '视频生成失败')
    }
    if (['completed', 'succeeded', 'success', 'finished', 'done'].includes(status)) {
      throw new Error('视频任务已完成，但上游未返回视频地址')
    }
  }

  throw new Error('视频生成超时')
}
