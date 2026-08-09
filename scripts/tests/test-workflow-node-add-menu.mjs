import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = fs.readFileSync(path.join(rootDir, 'src/components/canvas/CanvasNodeAddHandle.vue'), 'utf8')
const workflowSource = fs.readFileSync(path.join(rootDir, 'src/views/workflow/index.vue'), 'utf8')
const placementSource = fs.readFileSync(path.join(rootDir, 'src/shared/workflow-node-add-menu.ts'), 'utf8')

assert.match(source, /nodeId\?: string/)
assert.match(source, /const toggleAddMenu = \(event: MouseEvent\) =>/)
assert.match(source, /addConnectedWorkflowNode\(props\.nodeId, props\.side, type, dropPosition\.value\?\.flow\)/)
assert.match(source, /引用该节点生成/)
for (const label of ['文本', '图片', '视频', '导演台', '音频', '参考节点']) {
  assert.match(source, new RegExp(`label: '${label}'`))
}
assert.match(source, /@click\.stop="toggleAddMenu"/)
assert.match(source, /canvasmind:close-node-add-menus/)
assert.match(source, /const closeSiblingAddMenu/)
assert.match(source, /canvasmind:open-node-add-menu/)
assert.match(source, /dropPosition\.value\?\.flow/)
assert.match(source, /<Teleport to="body">/)
assert.match(source, /resolveWorkflowNodeAddMenuPlacement/)
assert.match(workflowSource, /const onConnectStart =/)
assert.match(workflowSource, /const onConnectEnd =/)
assert.match(workflowSource, /pendingConnectionMenuLine/)
assert.match(workflowSource, /workflow-pending-connection-line/)
assert.match(workflowSource, /@connect-start="onConnectStart"/)
assert.match(workflowSource, /@connect-end="onConnectEnd"/)
assert.match(workflowSource, /resolveWorkflowNodeAddMenuPlacement/)
assert.match(placementSource, /alternate\.distance < preferred\.distance/)
assert.match(placementSource, /edge: \{/)

console.log('workflow node add menu regression passed')
