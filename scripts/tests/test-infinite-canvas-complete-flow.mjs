import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

const [imageConfig, videoConfig, imageNode, confirmation, projectList, projectGrid] = await Promise.all([
  read('src/views/workflow/components/nodes/ImageConfigNode.vue'),
  read('src/views/workflow/components/nodes/VideoConfigNode.vue'),
  read('src/views/workflow/components/nodes/ImageNode.vue'),
  read('src/shared/canvas-generation-confirmation.ts'),
  read('src/views/agentic-assets-canvas/AgenticAssetsCanvasView.vue'),
  read('src/views/agentic-assets-canvas/components/AssetsGridSection.vue'),
])

// 外部创建的自动执行配置节点必须立即继续生成，不能停在配置卡片。
assert.match(imageConfig, /props\.data\?\.autoExecute[\s\S]*?\{ immediate: true \}/)
assert.match(videoConfig, /props\.data\?\.autoExecute[\s\S]*?\{ immediate: true \}/)

// 普通生成结果自动回流，同时仍触发画布版本检查点。
assert.match(confirmation, /confirmCanvasGenerationResult = async \(_input: CanvasGenerationConfirmationInput\) => true/)
assert.doesNotMatch(confirmation, /ElMessageBox/)
assert.match(confirmation, /notifyCanvasGenerationResultConfirmed/)

// 图片衍生工具必须产生新节点，避免破坏原始素材。
assert.match(imageNode, /createDerivedImageNode\('裁剪结果'/)
assert.match(imageNode, /createDerivedImageNode\('本地放大 2×'/)
assert.match(imageNode, /saveToAssetLibrary/)
assert.match(imageNode, /reversePromptFromImage/)
assert.match(imageNode, /currentNodeInfoJson/)

// 项目入口支持批量选择与批量删除，形成完整项目生命周期。
assert.match(projectList, /handleBatchDeleteProjects/)
assert.match(projectList, /toggleSelectAllProjects/)
assert.match(projectGrid, /toggle-selection/)
assert.match(projectGrid, /is-selected-project/)

console.log('infinite canvas complete flow regression passed')
