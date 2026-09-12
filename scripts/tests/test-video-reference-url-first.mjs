#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readSource = relativePath => readFile(path.join(rootDir, relativePath), 'utf8')
const sliceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`)
  return source.slice(start, end)
}

const [videoApiSource, runtimeSource, videoReferenceUrlSource, videoConfigNodeSource, videoNodeSource, videoUpstreamSource, providerServiceSource, adminProvidersSource] = await Promise.all([
  readSource('src-infinite-canvas/services/api/video.ts'),
  readSource('src-infinite-canvas/services/canvasmind-model-runtime.ts'),
  readSource('src/shared/video-reference-url.ts'),
  readSource('src/views/workflow/components/nodes/VideoConfigNode.vue'),
  readSource('src/views/workflow/components/nodes/VideoNode.vue'),
  readSource('server/generation-tasks/video-upstream.ts'),
  readSource('server/provider-config/service.ts'),
  readSource('src/views/admin/providers/AdminProviders.vue'),
])

// CanvasMind 的服务端任务只接收稳定图片 URL；此分支不能再把参考图编码为 data URL。
const canvasMindVideoBranch = sliceBetween(
  videoApiSource,
  'if (shouldUseCanvasMindModelRuntime(config, "video")) {',
  'const task = await createVideoGenerationTask',
)
assert.match(canvasMindVideoBranch, /runtimeTaskReferenceImageUrl\(image, options\?\.signal\)/)
assert.doesNotMatch(canvasMindVideoBranch, /imageToDataUrl/)
assert.match(canvasMindVideoBranch, /requestCanvasMindVideo\(config, prompt, imageUrls, mediaReferences, options\)/)

// Seedance 的 image_url 同样必须是稳定 URL；本地图片通过站内上传物化，不能回退 Base64。
const seedanceImageResolver = sliceBetween(
  videoApiSource,
  'async function resolveSeedanceImageUrl',
  'async function resolveSeedanceVideoUrl',
)
assert.match(seedanceImageResolver, /runtimeReferenceImageUrl\(image, signal\)/)
assert.doesNotMatch(seedanceImageResolver, /imageToDataUrl/)

// 已有远程 URL 原样保留；本地或 data URL 图片上传后再提交服务端返回的 publicUrl。
const runtimeReferenceHelper = sliceBetween(
  runtimeSource,
  'async function resolveRuntimeReferenceImageUrl',
  'async function notifyTaskCreated',
)
assert.match(runtimeReferenceHelper, /const remoteUrl = candidates\.find/)
assert.match(runtimeReferenceHelper, /if \(remoteUrl\) return remoteUrl/)
assert.match(runtimeReferenceHelper, /getImageBlob\(image\.storageKey\)/)
assert.match(runtimeReferenceHelper, /runtimeReferenceImageUploads\.set/)
assert.match(runtimeSource, /fetch\("\/api\/storage\/upload"/)
assert.match(runtimeSource, /"x-upload-category": "reference"/)
assert.match(runtimeSource, /uploaded\.providerPublicUrl/)
assert.match(runtimeSource, /export async function runtimeTaskReferenceImageUrl/)
assert.match(runtimeSource, /isProviderPublicHttpsUrl/)
assert.doesNotMatch(runtimeReferenceHelper, /window\.location\.origin/)

// OpenAI 原生 Videos API 仍保留 multipart input_reference 文件契约。
const openAiVideoBranch = sliceBetween(
  videoApiSource,
  'async function createOpenAIVideoTask',
  'function openAIVideoPrompt',
)
assert.match(openAiVideoBranch, /referenceImagesToSingleFile/)
assert.match(openAiVideoBranch, /body\.append\("input_reference", referenceFile\)/)

// Vue 视频提示栏上传的参考图片也必须保存成后端 publicUrl，不能留在 data URL 中。
assert.match(videoReferenceUrlSource, /uploadStorageFile\(file, 'reference'\)/)
assert.match(videoReferenceUrlSource, /resolveVideoReferenceUrl\(uploaded\?\.publicUrl \|\| uploaded\?\.providerPublicUrl \|\| ''\)/)
assert.doesNotMatch(videoReferenceUrlSource, /API_BASE_URL|window\.location\.origin/)

const videoNodePromptUpload = sliceBetween(
  videoNodeSource,
  'const handlePromptFiles = async (files: File[]) => {',
  'const handlePromptRemoveReference',
)
assert.match(videoNodePromptUpload, /uploadVideoReferenceImage\(file\)/)
assert.doesNotMatch(videoNodePromptUpload, /workflowPromptFileToDataUrl/)

// 历史画布中的 data:/blob: 图片也要在创建视频任务前物化成 URL。
const collectVideoInputs = sliceBetween(
  videoConfigNodeSource,
  'const collectInputs = async () => {',
  'const buildCurrentGenerationMeta',
)
assert.match(collectVideoInputs, /ensureVideoReferenceImageUrl\(sourceUrl/)
assert.match(collectVideoInputs, /if \(url !== sourceUrl\) updateNode\(src\.id, \{ url \}\)/)
assert.match(videoConfigNodeSource, /try \{\s*collectedInputs = await collectInputs\(\)/)
assert.match(videoConfigNodeSource, /视频参考图处理失败/)

// 服务端按供应商契约分流：默认 URL-first，OpenAI 官方端点继续使用 File。
assert.match(videoUpstreamSource, /export const resolveVideoReferenceTransport/)
assert.match(videoUpstreamSource, /providerCode === 'openai'/)
assert.match(videoUpstreamSource, /hostname === 'api\.openai\.com'/)
assert.match(videoUpstreamSource, /resolveVideoReferenceTransport\(upstream\)/)
assert.match(providerServiceSource, /videoReferenceTransport: normalizedPayload\.videoReferenceTransport/)
assert.match(providerServiceSource, /existingProvider\.extraJson/)
assert.match(providerServiceSource, /normalized === 'auto'/)
assert.match(adminProvidersSource, /v-model="providerForm\.videoReferenceTransport"/)
assert.match(adminProvidersSource, /<option value="auto">自动识别（推荐）<\/option>/)
assert.match(adminProvidersSource, /videoReferenceTransport: 'auto'/)
assert.match(adminProvidersSource, /providerForm\.videoReferenceTransport = 'auto'/)
assert.match(adminProvidersSource, /File（OpenAI Videos）/)

// 参考图上传需要登录且限制图片/20MB；安装页及普通视频、音频上传仍保持原有兼容性。
const storageUploadHandlerSource = await readSource('server/storage/request-handler.ts')
const storageApiSource = await readSource('src/api/storage.ts')
assert.match(storageUploadHandlerSource, /if \(isVideoReferenceImage\) \{\s*const currentUser = await requireCurrentSessionUser/)
assert.match(storageUploadHandlerSource, /readRawBuffer\(req, isVideoReferenceImage \? VIDEO_REFERENCE_IMAGE_MAX_BYTES : Number\.POSITIVE_INFINITY\)/)
assert.match(storageApiSource, /fetch\(buildApiUrl\('\/api\/storage\/upload'\), \{\s*method: 'POST',\s*credentials: 'include'/)

console.log('video reference URL-first regression passed')
