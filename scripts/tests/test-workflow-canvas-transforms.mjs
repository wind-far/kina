import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const readSource = (path) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const [canvasState, workflowView, clipboard, shortcuts, nodeSources] = await Promise.all([
  readSource('../../src/views/workflow/composables/useWorkflowCanvas.ts'),
  readSource('../../src/views/workflow/index.vue'),
  readSource('../../src/composables/useCanvasClipboard.ts'),
  readSource('../../src/components/canvas/CanvasZoomControls.vue'),
  Promise.all([
    'TextNode.vue', 'ImageNode.vue', 'VideoNode.vue', 'DirectorNode.vue', 'AudioNode.vue', 'UnknownNode.vue', 'PluginNode.vue',
  ].map((name) => readSource(`../../src/views/workflow/components/nodes/${name}`))),
])

assert.match(canvasState, /rotation\?: number/)
assert.match(canvasState, /const normalizeNodeRotation/)
assert.match(canvasState, /export const rotateNodes/)
assert.match(canvasState, /export const resetNodeRotation/)
assert.match(canvasState, /'--canvas-node-rotation'/)
assert.match(canvasState, /applyCanvasSnapshot[\s\S]*?applyNodeRotationPresentation/)
assert.match(workflowView, /useShortcut\('Alt\+ArrowLeft'/)
assert.match(workflowView, /useShortcut\('Alt\+ArrowRight'/)
assert.match(workflowView, /向左旋转 15°/)
assert.match(workflowView, /\.workflow-canvas \.vue-flow__node > \*/)
assert.match(clipboard, /addPluginNode/)
assert.match(clipboard, /isCanvasPluginNodeType\(sourceNode\.type\)/)
assert.match(shortcuts, /旋转选中节点/)

const resizer = await readSource('../../src/components/canvas/CanvasNodeResizer.vue')
const configShell = await readSource('../../src/components/canvas/CanvasConfigNodeShell.vue')
assert.match(resizer, /NodeResizer/)
assert.match(resizer, /pauseHistory\(\)/)
assert.match(resizer, /resumeHistory\(true\)/)
for (const source of nodeSources) assert.match(source, /CanvasNodeResizer/)
assert.match(configShell, /CanvasNodeResizer/)

console.log('workflow canvas transforms regression passed')
