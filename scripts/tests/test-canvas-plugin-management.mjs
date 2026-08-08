import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeCanvasPluginManifest } from '../../server/canvas-plugins/service.ts'

const managerSource = fs.readFileSync(new URL('../../src/views/workflow/components/CanvasPluginManager.vue', import.meta.url), 'utf8')
assert.match(managerSource, /\/api\/canvas\/plugins\/\$\{encodeURIComponent\(plugin\.id\)\}\/install/)
assert.match(managerSource, /插件在沙箱 iframe 中运行/)

const requestHandlerSource = fs.readFileSync(new URL('../../server/canvas-plugins/request-handler.ts', import.meta.url), 'utf8')
assert.match(requestHandlerSource, /canvas_plugin\.publish/)
assert.match(requestHandlerSource, /recordAdminAuditLog/)

const workflowSource = fs.readFileSync(new URL('../../src/views/workflow/index.vue', import.meta.url), 'utf8')
assert.match(workflowSource, /const handleCanvasPluginProposal[\s\S]*?applyCanvasAssistantProposal/)

assert.deepEqual(normalizeCanvasPluginManifest({ entry: '/plugin.html', capabilities: ['canvas.read', 'canvas.propose', 'canvas.read'] }), {
  entry: '/plugin.html', capabilities: ['canvas.read', 'canvas.propose'],
})
assert.throws(
  () => normalizeCanvasPluginManifest({ entry: '/plugin.html', capabilities: ['network.anywhere'] }),
  /不受支持的能力/,
)

const hostSource = fs.readFileSync(new URL('../../src/views/workflow/components/CanvasPluginHost.vue', import.meta.url), 'utf8')
assert.match(hostSource, /allowsCapability\(plugin, 'canvas\.read'\)/)
assert.match(hostSource, /allowsCapability\(plugin, 'canvas\.propose'\)/)

console.log('canvas plugin management regression passed')
