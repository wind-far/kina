import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = fs.readFileSync(path.join(rootDir, 'src/views/workflow/components/nodes/ImageNode.vue'), 'utf8')
const canvasSource = fs.readFileSync(path.join(rootDir, 'src/views/workflow/composables/useWorkflowCanvas.ts'), 'utf8')

// 图片节点根元素必须参与普通布局，Vue Flow 才能测得可见框及其 Handle。
assert.doesNotMatch(source, /:min-width="imageUrl \? 475 : 333"/)
assert.match(source, /\.image-node-wrapper \{[\s\S]*?position: relative;[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?min-width: 280px;[\s\S]*?min-height: 220px;/)
assert.match(source, /border: 1px solid color-mix\(in srgb, var\(--text-tertiary\) 52%, transparent\);/)
assert.doesNotMatch(source, /CanvasNodeResizer/)

// 空态节点被缩小时，上传入口仍必须留在可视区域，菜单转为节点内部滚动。
assert.match(source, /上传入口必须始终处于首屏/)
assert.match(source, /<span>上传图片<\/span>[\s\S]*?<div class="image-node-empty-title">或使用图片工具：<\/div>/)
assert.match(source, /\.image-node-empty \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;/)
assert.match(source, /\.image-node-upload-pill \{[\s\S]*?min-height: 36px;/)

// 恢复最初的图片展示规则：节点尺寸不由图片加载事件自动覆盖，图片保持填满节点。
assert.doesNotMatch(source, /const syncImageAspectRatio =/)
assert.match(source, /@load="refreshNodeInternals"/)
assert.match(source, /\.image-node-image \{[\s\S]*?object-fit: cover;/)
assert.match(source, /const showImage = computed\(\(\) => !showError\.value && !!imageUrl\.value\)/)
assert.match(source, /const showLoading = computed\(\(\) => !showError\.value && isLoading\.value && !showImage\.value\)/)
assert.match(source, /\.image-node-card \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;[\s\S]*?width: auto;[\s\S]*?height: auto;/)
assert.match(source, /\.image-node-loading,[\s\S]*?\.image-node-error \{[\s\S]*?width: 100%;[\s\S]*?height: 100%;/)
assert.match(source, /\.image-node-loading,[\s\S]*?\.image-node-error \{[\s\S]*?text-align: center;/)

// 图片 URL 加载失败时必须回退至可见、可上传的紧凑错误状态，不能留下白色巨框。
assert.match(source, /const handleImageLoadError = \(\) =>/)
assert.match(source, /const error = '图片加载失败'/)
assert.match(source, /error,\n\s*\/\/ 失效图片/)
assert.match(source, /style: \{ width: 300, height: 220 \}/)
assert.match(source, /@error="handleImageLoadError"/)
assert.match(source, /updateNode\(props\.id, \{ url: uploaded\.publicUrl, loading: false, error: '' \}\)/)
assert.match(canvasSource, /style\?: Record<string, string \| number>/)
assert.match(canvasSource, /const \{ position, zIndex, style, \.\.\.dataPatch \} = patch/)
assert.match(canvasSource, /style: style \? \{ \.\.\.node\.style, \.\.\.style \} : node\.style/)
assert.match(canvasSource, /const restoreMissingImageOutputs/)
assert.match(canvasSource, /outputNodeId = String\(configNode\.data\?\.outputNodeId \|\| ''\)\.trim\(\)/)
assert.match(canvasSource, /id: `recovered_\$\{configNode\.id\}_\$\{outputNodeId\}`/)
assert.match(canvasSource, /const restoreLegacyMultiAngleImageNodes/)
assert.match(canvasSource, /const hasRoleResult = restored\.nodes\.some\(node => node\.type === 'image' && String\(node\.data\?\.label \|\| ''\) === '角色图结果'\)/)
assert.match(canvasSource, /'主角色图',\n\s*'正视 \(Front View\)'/)
assert.match(canvasSource, /type: 'image' as const/)
assert.match(canvasSource, /const restoreWorkflowCanvasState/)

console.log('workflow image node resize regression passed')
