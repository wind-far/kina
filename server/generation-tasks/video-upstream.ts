import fs from 'node:fs/promises'
import path from 'node:path'
import { joinUpstreamUrl } from '../ai-gateway/shared'
import { resolveGatewayProviderUpstream } from '../provider-config/service'
import { getUploadsDir, resolveProviderPublicUploadUrl, saveUploadedBuffer } from '../storage/service'
import { isPathInsideDirectory } from '../shared/path-security'
import type { SkillMediaReference } from '../../src/shared/skill-runtime'

const UPLOADS_PUBLIC_PATH_PREFIX = '/uploads/'
const VIDEO_POLL_INTERVAL_MS = 5_000
const VIDEO_POLL_MAX_ATTEMPTS = 120

type JsonObject = Record<string, unknown>

export interface VideoGenerationUpstreamInput {
  signal: AbortSignal
  userId?: string
  providerId: string
  modelKey: string
  prompt: string
  ratio?: string
  resolution?: string
  duration?: string
  referenceImages: string[]
  referenceImageRoles: string[]
  mediaReferences?: SkillMediaReference[]
}

export interface VideoGenerationUpstreamResult {
  upstreamUrl: string
  taskId?: string
  videoUrl: string
  mimeType?: string
}

type VideoOutputMaterializeDependencies = {
  fetchImpl?: typeof fetch
  saveBuffer?: typeof saveUploadedBuffer
}

type H3TaskMode = 't2va' | 'i2va' | 'l2va' | 'fl2va' | 'ref2va'
type VideoReferenceTransport = 'url' | 'file'

const isMiniMaxH3Upstream = (upstream: { code?: string; extraJson?: Record<string, unknown> }) => (
  String(upstream.code || '').trim().toLowerCase() === 'minimax-h3'
  || String(upstream.extraJson?.adapter || '').trim().toLowerCase() === 'minimax-h3'
)

export const resolveVideoReferenceTransport = (upstream: {
  code?: string
  baseUrl?: string
  extraJson?: Record<string, unknown>
}): VideoReferenceTransport => {
  const configured = String(upstream.extraJson?.videoReferenceTransport || '').trim().toLowerCase()
  if (configured === 'url' || configured === 'file') return configured
  const providerCode = String(upstream.code || '').trim().toLowerCase()
  let hostname = ''
  try {
    hostname = new URL(String(upstream.baseUrl || '')).hostname.toLowerCase()
  } catch {
    hostname = ''
  }
  return providerCode === 'openai' || hostname === 'api.openai.com' ? 'file' : 'url'
}

const readH3TaskId = (payload: unknown) => readFirstString(payload, [
  ['task', 'id'], ['data', 'task', 'id'], ['data', 'id'], ['task_id'], ['id'],
])

const readH3Status = (payload: unknown) => readFirstString(payload, [
  ['task', 'status'], ['data', 'task', 'status'], ['data', 'status'], ['status'],
]).toLowerCase()

const readH3VideoUrl = (payload: unknown) => readFirstString(payload, [
  ['task', 'output', 'video_url'], ['task', 'output', 'url'],
  ['data', 'output', 'video_url'], ['data', 'video_url'], ['video_url'], ['url'],
])

const readH3FileId = (payload: unknown) => readFirstString(payload, [
  ['file_id'], ['data', 'file_id'], ['task', 'file_id'], ['data', 'task', 'file_id'],
])

const inferVideoMimeType = (value: string) => {
  const normalized = value.toLowerCase().split('?')[0]
  if (normalized.endsWith('.webm')) return 'video/webm'
  if (normalized.endsWith('.mov')) return 'video/quicktime'
  return 'video/mp4'
}

const shouldAuthorizeVideoDownload = (videoUrl: string, upstreamBaseUrl: string) => {
  try {
    return new URL(videoUrl).origin === new URL(upstreamBaseUrl).origin
  } catch {
    return false
  }
}

export const materializeVideoOutput = async (input: {
  videoUrl: string
  upstreamBaseUrl: string
  apiKey: string
  signal: AbortSignal
}, dependencies: VideoOutputMaterializeDependencies = {}) => {
  const videoUrl = String(input.videoUrl || '').trim()
  if (!/^https?:\/\//i.test(videoUrl)) {
    return { videoUrl, mimeType: inferVideoMimeType(videoUrl) }
  }

  const fetchImpl = dependencies.fetchImpl || fetch
  const saveBuffer = dependencies.saveBuffer || saveUploadedBuffer
  const includeAuthorization = Boolean(input.apiKey) && shouldAuthorizeVideoDownload(videoUrl, input.upstreamBaseUrl)
  const response = await fetchImpl(videoUrl, {
    headers: includeAuthorization ? { Authorization: `Bearer ${input.apiKey}` } : undefined,
    signal: input.signal,
  })
  if (!response.ok) {
    throw new Error(`视频任务读取失败 (${response.status})`)
  }

  const responseMimeType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (responseMimeType && !responseMimeType.startsWith('video/') && responseMimeType !== 'application/octet-stream') {
    throw new Error(`视频任务读取失败：上游返回了 ${responseMimeType}，不是视频内容`)
  }
  const mimeType = responseMimeType.startsWith('video/') ? responseMimeType : inferVideoMimeType(videoUrl)
  const stored = await saveBuffer({
    buffer: Buffer.from(await response.arrayBuffer()),
    filename: `generated-video${mimeType === 'video/webm' ? '.webm' : mimeType === 'video/quicktime' ? '.mov' : '.mp4'}`,
    mimeType,
    category: 'generation/video',
  })
  return { videoUrl: stored.publicUrl, mimeType }
}

const persistVideoGenerationResult = async (
  result: VideoGenerationUpstreamResult,
  upstream: { baseUrl: string; apiKey: string },
  signal: AbortSignal,
): Promise<VideoGenerationUpstreamResult> => ({
  ...result,
  ...await materializeVideoOutput({
    videoUrl: result.videoUrl,
    upstreamBaseUrl: upstream.baseUrl,
    apiKey: upstream.apiKey,
    signal,
  }),
})

export const buildMiniMaxH3MediaPayload = (references: SkillMediaReference[]) => {
  const images = references.filter(item => item.mediaType === 'image')
  const videos = references.filter(item => item.mediaType === 'video')
  const audios = references.filter(item => item.mediaType === 'audio')
  const first = images.find(item => item.role === 'first_frame')
  const last = images.find(item => item.role === 'last_frame')
  const isReferenceMode = videos.length > 0 || audios.length > 0 || images.some(item => ['reference', 'subject', 'style'].includes(item.role))
  const mode: H3TaskMode = isReferenceMode
    ? 'ref2va'
    : first && last ? 'fl2va'
      : first ? 'i2va'
        : last ? 'l2va'
          : 't2va'
  return {
    mode,
    firstFrame: first?.url,
    lastFrame: last?.url,
    references: {
      images: images.filter(item => !['first_frame', 'last_frame'].includes(item.role)).map(item => ({ url: item.url, role: item.role, label: item.label })),
      videos: videos.map(item => ({ url: item.url, role: item.role, start_seconds: item.startSeconds, end_seconds: item.endSeconds, label: item.label })),
      audios: audios.map(item => ({ url: item.url, role: item.role, start_seconds: item.startSeconds, end_seconds: item.endSeconds, label: item.label })),
    },
  }
}

const assertH3MediaLimits = (references: SkillMediaReference[]) => {
  const images = references.filter(item => item.mediaType === 'image')
  const videos = references.filter(item => item.mediaType === 'video')
  const audios = references.filter(item => item.mediaType === 'audio')
  if (images.length > 9) throw new Error('MiniMax H3 Ref2VA 最多支持 9 张图片')
  if (videos.length > 3) throw new Error('MiniMax H3 Ref2VA 最多支持 3 个视频参考')
  if (audios.length > 3) throw new Error('MiniMax H3 Ref2VA 最多支持 3 个音频参考')
  if (images.length + videos.length + audios.length > 12) throw new Error('MiniMax H3 Ref2VA 最多支持 12 个混合参考素材')
  if (audios.length && !images.length && !videos.length) throw new Error('MiniMax H3 音频参考必须与图片或视频参考一起使用')
}

const requestMiniMaxH3Generation = async (
  input: VideoGenerationUpstreamInput,
  upstream: { baseUrl: string; apiKey: string; endpoint: string; extraJson?: Record<string, unknown> },
): Promise<VideoGenerationUpstreamResult> => {
  const references = await Promise.all((input.mediaReferences || []).map(async reference => (
    reference.mediaType === 'image'
      ? { ...reference, url: await materializeVideoReferenceUrl(reference.url, input.signal) }
      : reference
  )))
  assertH3MediaLimits(references)
  for (const reference of references) {
    if (reference.mediaType === 'image' && !isProviderHttpUrl(reference.url)) {
      throw new Error('MiniMax H3 视频参考素材必须使用上游可访问的 HTTPS URL')
    }
  }
  const h3 = upstream.extraJson?.h3 && typeof upstream.extraJson.h3 === 'object' && !Array.isArray(upstream.extraJson.h3)
    ? upstream.extraJson.h3 as Record<string, unknown> : {}
  // H3 开源权重与 MiniMax 托管 Video API 不是同一份公开请求契约；禁止猜测端点后发起请求。
  // 管理员必须在受控厂商配置中填写经验证的 H3 托管接口路径与状态接口路径。
  const endpoint = String(h3.createEndpoint || '').trim()
  const statusEndpoint = String(h3.statusEndpoint || '').trim()
  if (!endpoint || !statusEndpoint) {
    throw new Error('MiniMax H3 需要在厂商配置的 extraJson.h3 中设置已验证的 createEndpoint 与 statusEndpoint')
  }
  const media = buildMiniMaxH3MediaPayload(references)
  const duration = Number(input.duration || 0)
  if (duration && (duration < 4 || duration > 15)) throw new Error('MiniMax H3 单段视频时长必须为 4 到 15 秒')
  const createUrl = joinUpstreamUrl(upstream.baseUrl, endpoint)
  const requestBody = {
    model: input.modelKey || 'MiniMax-H3',
    prompt: input.prompt,
    duration: duration || undefined,
    ratio: input.ratio || undefined,
    resolution: input.resolution || undefined,
    task_type: media.mode,
    first_frame_image: media.firstFrame,
    last_frame_image: media.lastFrame,
    references: media.mode === 'ref2va' ? media.references : undefined,
    generate_audio: h3.generateAudio !== false,
  }
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(upstream.apiKey ? { Authorization: `Bearer ${upstream.apiKey}` } : {}),
    },
    body: JSON.stringify(Object.fromEntries(Object.entries(requestBody).filter(([, value]) => value !== undefined))),
    signal: input.signal,
  })
  const createdPayload = await readResponsePayload(createResponse)
  assertSuccessfulResponse(createResponse, createdPayload)
  const directVideoUrl = readH3VideoUrl(createdPayload)
  const taskId = readH3TaskId(createdPayload)
  if (directVideoUrl) {
    return persistVideoGenerationResult(
      { upstreamUrl: createUrl, taskId: taskId || undefined, videoUrl: directVideoUrl },
      upstream,
      input.signal,
    )
  }
  if (!taskId) throw new Error(extractVideoError(createdPayload) || 'MiniMax H3 未返回任务 ID 或视频地址')

  const statusUrl = `${joinUpstreamUrl(upstream.baseUrl, statusEndpoint)}${statusEndpoint.includes('?') ? '&' : '?'}task_id=${encodeURIComponent(taskId)}`
  for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await waitForNextPoll(input.signal)
    const statusResponse = await fetch(statusUrl, {
      headers: upstream.apiKey ? { Authorization: `Bearer ${upstream.apiKey}` } : undefined,
      signal: input.signal,
    })
    const statusPayload = await readResponsePayload(statusResponse)
    assertSuccessfulResponse(statusResponse, statusPayload)
    const videoUrl = readH3VideoUrl(statusPayload)
    if (videoUrl) {
      return persistVideoGenerationResult({ upstreamUrl: createUrl, taskId, videoUrl }, upstream, input.signal)
    }
    const fileId = readH3FileId(statusPayload)
    if (fileId) {
      const fileEndpoint = String(h3.fileEndpoint || '').trim()
      if (!fileEndpoint) throw new Error('MiniMax H3 状态返回文件 ID，但未配置 extraJson.h3.fileEndpoint')
      const fileUrl = `${joinUpstreamUrl(upstream.baseUrl, fileEndpoint)}${fileEndpoint.includes('?') ? '&' : '?'}file_id=${encodeURIComponent(fileId)}`
      const fileResponse = await fetch(fileUrl, {
        headers: upstream.apiKey ? { Authorization: `Bearer ${upstream.apiKey}` } : undefined,
        signal: input.signal,
      })
      const filePayload = await readResponsePayload(fileResponse)
      assertSuccessfulResponse(fileResponse, filePayload)
      const resolvedVideoUrl = readH3VideoUrl(filePayload) || readFirstString(filePayload, [
        ['file', 'download_url'], ['data', 'file', 'download_url'], ['download_url'],
      ])
      if (!resolvedVideoUrl) throw new Error('MiniMax H3 文件查询未返回可下载视频地址')
      return persistVideoGenerationResult(
        { upstreamUrl: createUrl, taskId, videoUrl: resolvedVideoUrl },
        upstream,
        input.signal,
      )
    }
    const status = readH3Status(statusPayload)
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) throw new Error(extractVideoError(statusPayload) || 'MiniMax H3 视频生成失败')
  }
  throw new Error('MiniMax H3 视频生成超时')
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

const resolveReferenceImageBlob = async (imageValue: string, signal?: AbortSignal) => {
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
  const publicUrl = resolveProviderPublicUploadUrl(normalizedValue)
  if (!publicUrl) throw new Error('视频参考图必须是可访问的公网 HTTPS URL')
  const response = await fetch(publicUrl, { signal })
  if (!response.ok) throw new Error(`参考图读取失败 (${response.status})`)
  return response.blob()
}

const isProviderAssetUrl = (value: string) => String(value || '').trim().startsWith('asset://')
const isProviderHttpUrl = (value: string) => /^https:\/\//i.test(String(value || '').trim())

const absoluteManagedVideoReferenceUrl = (value: string) => {
  const normalizedValue = String(value || '').trim()
  if (isProviderAssetUrl(normalizedValue)) return normalizedValue
  return resolveProviderPublicUploadUrl(normalizedValue)
}

const materializeVideoReferenceUrl = async (imageValue: string, signal?: AbortSignal) => {
  const normalizedValue = String(imageValue || '').trim()
  if (isProviderAssetUrl(normalizedValue)) return normalizedValue
  const managedUrl = absoluteManagedVideoReferenceUrl(normalizedValue)
  if (managedUrl) return managedUrl

  if (normalizedValue.startsWith(UPLOADS_PUBLIC_PATH_PREFIX)) {
    throw new Error('视频参考图缺少公网 URL；请配置对象存储或 VIDEO_REFERENCE_PUBLIC_BASE_URL')
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    throw new Error('视频参考图必须是可访问的公网 HTTPS URL')
  }

  const blob = await resolveReferenceImageBlob(normalizedValue, signal)
  const stored = await saveUploadedBuffer({
    buffer: Buffer.from(await blob.arrayBuffer()),
    filename: 'video-reference',
    mimeType: blob.type || inferImageMimeType(normalizedValue),
    category: 'generation/reference',
  })
  const storedUrl = stored.providerPublicUrl || absoluteManagedVideoReferenceUrl(stored.publicUrl)
  if (!storedUrl) {
    throw new Error('视频参考图缺少公网 URL；请配置对象存储或 VIDEO_REFERENCE_PUBLIC_BASE_URL')
  }
  return storedUrl
}

const normalizeReferenceRole = (value: string) => {
  const role = String(value || '').trim()
  return ['first_frame_image', 'last_frame_image', 'input_reference'].includes(role)
    ? role
    : 'input_reference'
}

export const appendVideoReferenceImages = async (
  formData: FormData,
  referenceImages: string[],
  referenceImageRoles: string[],
  transport: VideoReferenceTransport,
  signal?: AbortSignal,
  dependencies: {
    materializeUrl?: typeof materializeVideoReferenceUrl
    resolveBlob?: typeof resolveReferenceImageBlob
  } = {},
) => {
  const materializeUrl = dependencies.materializeUrl || materializeVideoReferenceUrl
  const resolveBlob = dependencies.resolveBlob || resolveReferenceImageBlob
  for (const [index, imageValue] of referenceImages.entries()) {
    const normalizedValue = String(imageValue || '').trim()
    if (!normalizedValue) continue
    const role = normalizeReferenceRole(referenceImageRoles[index] || '')
    if (transport === 'url') {
      formData.append(role, await materializeUrl(normalizedValue, signal))
      continue
    }
    const blob = await resolveBlob(normalizedValue, signal)
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
    userId: input.userId,
  })
  if (isMiniMaxH3Upstream(upstream)) {
    return requestMiniMaxH3Generation(input, upstream)
  }
  const upstreamUrl = joinUpstreamUrl(upstream.baseUrl, upstream.endpoint)
  const formData = new FormData()
  formData.append('model', input.modelKey)
  if (input.prompt) formData.append('prompt', input.prompt)
  if (input.ratio) formData.append('ratio', input.ratio)
  if (input.resolution) formData.append('quality', input.resolution)
  if (input.duration) formData.append('duration', input.duration)
  await appendVideoReferenceImages(
    formData,
    input.referenceImages,
    input.referenceImageRoles,
    resolveVideoReferenceTransport(upstream),
    input.signal,
  )

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
  if (directVideoUrl) {
    return persistVideoGenerationResult(
      { upstreamUrl, taskId: taskId || undefined, videoUrl: directVideoUrl },
      upstream,
      input.signal,
    )
  }
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
    if (videoUrl) {
      return persistVideoGenerationResult({ upstreamUrl, taskId, videoUrl }, upstream, input.signal)
    }
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
