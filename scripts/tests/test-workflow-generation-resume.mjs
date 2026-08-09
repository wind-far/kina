import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = async (relativePath) => readFile(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8')
const [imageConfig, imageNode, videoConfig, llmConfig, generationApi] = await Promise.all([
  read('src/views/workflow/components/nodes/ImageConfigNode.vue'),
  read('src/views/workflow/components/nodes/ImageNode.vue'),
  read('src/views/workflow/components/nodes/VideoConfigNode.vue'),
  read('src/views/workflow/components/nodes/LlmConfigNode.vue'),
  read('src/api/generation-tasks.ts'),
])

for (const source of [imageConfig, videoConfig, llmConfig]) {
  assert.match(source, /const resumePendingTask/)
  assert.match(source, /resumePendingTask\(\)/)
  assert.match(source, /subscribeGenerationTaskEvents/)
}
assert.match(imageConfig, /只恢复已有任务的 SSE 订阅/)
assert.match(imageNode, /刷新后续接/)
assert.match(imageNode, /任务完成但未返回图片，请重试/)
assert.match(imageNode, /taskRecordId: taskId,\s*generationMeta,\s*generationStatus: 'running'/)
assert.match(imageNode, /const reconcileOrphanedImageLoading/)
assert.match(imageNode, /isManagedByPendingImageConfig/)
assert.match(imageNode, /taskRecordId: '',\s*generationMeta,\s*generationStatus: 'running'/)
assert.match(videoConfig, /不重新提交视频请求/)
assert.match(videoConfig, /任务完成但未返回视频/)
assert.match(llmConfig, /刷新不会再次发送文本生成请求/)
assert.match(generationApi, /lastEventId/)
assert.match(generationApi, /WATCHDOG_TIMEOUT_MS/)
assert.match(generationApi, /normalizedEventType === 'snapshot' && parsed\.done/)

console.log('workflow generation resume declarations passed')
