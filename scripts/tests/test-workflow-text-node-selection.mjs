import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = fs.readFileSync(path.join(rootDir, 'src/views/workflow/components/nodes/TextNode.vue'), 'utf8')
const hoverToolbarSource = fs.readFileSync(path.join(rootDir, 'src/components/canvas/CanvasNodeHoverToolbar.vue'), 'utf8')

// 参考工作台的普通选择态不显示通用缩放器的四个圆角。
assert.doesNotMatch(source, /CanvasNodeResizer/)
assert.doesNotMatch(source, /CanvasNodeHoverToolbar/)
assert.doesNotMatch(source, /label: '缩小字号'/)
assert.match(hoverToolbarSource, /enabled: false/)
assert.match(hoverToolbarSource, /v-if="enabled && visible && actions\.length > 0"/)

// 空白编辑器失焦后必须恢复为空态菜单；再次选择/主动编辑时仍可获得焦点。
assert.match(source, /watch\(isSelected, async \(selected, wasSelected\) =>/)
assert.match(source, /!selected && wasSelected && !content\.value\.trim\(\) && !isPolishing\.value/)
assert.match(source, /forceEditMode\.value = false/)
assert.match(source, /selected && forceEditMode\.value && !content\.value\.trim\(\)/)
assert.match(source, /textareaRef\.value\?\.focus\(\)/)

// 文本节点不应在选中后追加大块 AI Prompt 输入面板。
assert.doesNotMatch(source, /text-node-prompt-panel/)
assert.doesNotMatch(source, /<ContentGenerator/)

console.log('workflow text node selection regression passed')
