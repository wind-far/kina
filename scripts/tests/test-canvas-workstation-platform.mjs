import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = async (relativePath) => readFile(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8')

const [workflow, server, pluginHandler, pluginHost, schema] = await Promise.all([
  read('src/views/workflow/index.vue'),
  read('server/index.ts'),
  read('server/canvas-plugins/request-handler.ts'),
  read('src/views/workflow/components/CanvasPluginHost.vue'),
  read('prisma/schema.prisma'),
])

assert.match(workflow, /workspaceScene.*INFINITE_CANVAS/)
assert.match(workflow, /importCanvasProjectFromFile/)
assert.match(workflow, /ref="canvasImportFileInput"/)
assert.match(workflow, /@change="handleCanvasImportFileChange"/)
assert.match(workflow, /input\.value = ''/)
assert.match(workflow, /downloadCurrentCanvasProject/)
assert.match(workflow, /runCanvasAssistantPreview/)
assert.match(workflow, /generationMeta/)
assert.match(workflow, /readRunNodeOutputValue/)
assert.match(workflow, /CANVAS_GENERATION_CONFIRMED_EVENT/)
assert.match(workflow, /const createCanvasGenerationCheckpoint/)
assert.match(workflow, /versionName: `确认\$\{label\}生成结果`/)
assert.match(workflow, /changeSummary: `确认写入服务端生成任务 \$\{taskId\}/)
assert.match(workflow, /:multi-selection-key-code="\['Shift', 'Control', 'Meta'\]"/)
assert.match(workflow, /'altKey' in originalEvent && originalEvent\.altKey/)
assert.doesNotMatch(workflow, /'shiftKey' in originalEvent && originalEvent\.shiftKey/)
assert.match(server, /canvas-projects/)
assert.match(pluginHandler, /requireAdminSessionUser/)
assert.match(pluginHost, /sandbox="allow-scripts"/)
assert.doesNotMatch(pluginHost, /allow-same-origin/)
assert.match(schema, /model CanvasPlugin/)
assert.match(schema, /model CanvasPluginInstall/)

const [metadata, confirmation, imageConfigNode, videoConfigNode, imageNode, videoNode, llmNode] = await Promise.all([
  read('src/shared/workflow-generation-metadata.ts'),
  read('src/shared/canvas-generation-confirmation.ts'),
  read('src/views/workflow/components/nodes/ImageConfigNode.vue'),
  read('src/views/workflow/components/nodes/VideoConfigNode.vue'),
  read('src/views/workflow/components/nodes/ImageNode.vue'),
  read('src/views/workflow/components/nodes/VideoNode.vue'),
  read('src/views/workflow/components/nodes/LlmConfigNode.vue'),
])
assert.match(metadata, /buildWorkflowGenerationMetadata/)
assert.match(confirmation, /window\.location\.pathname === '\/canvas'/)
assert.match(confirmation, /确认写入画布/)
assert.match(confirmation, /notifyCanvasGenerationResultConfirmed/)
assert.match(imageConfigNode, /confirmCanvasGenerationResult\(\{ kind: 'image'/)
assert.match(imageConfigNode, /generationStatus: 'awaiting_confirmation'/)
assert.match(videoConfigNode, /confirmCanvasGenerationResult\(\{ kind: 'video'/)
assert.match(videoConfigNode, /generationStatus: 'awaiting_confirmation'/)
// 图片节点已把可复用的“基于此重试”按钮抽到 CanvasGenerationInfo，
// 这里验证接入与事件回调，避免测试把展示文案耦合在具体节点实现中。
assert.match(imageNode, /CanvasGenerationInfo/)
assert.match(imageNode, /@retry="retryFromGenerationMetadata"/)
assert.match(imageNode, /retryFromBatchChild/)
assert.match(imageNode, /const splitBatchChildren/)
assert.match(imageNode, /拆分批量结果/)
assert.match(videoNode, /retryFromGenerationMetadata/)
assert.match(llmNode, /CanvasGenerationInfo/)
assert.match(llmNode, /retryFromGenerationMetadata/)
assert.match(llmNode, /confirmCanvasGenerationResult\(\{ kind: 'text'/)
assert.match(llmNode, /generationStatus: 'awaiting_confirmation'/)

console.log('canvas workstation platform declarations passed')
