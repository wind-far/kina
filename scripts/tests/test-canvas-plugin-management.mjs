import assert from 'node:assert/strict'
import fs from 'node:fs'

const managerSource = fs.readFileSync(new URL('../../src/views/workflow/components/CanvasPluginManager.vue', import.meta.url), 'utf8')
assert.match(managerSource, /\/api\/canvas\/plugins\/\$\{encodeURIComponent\(plugin\.id\)\}\/install/)
assert.match(managerSource, /插件在沙箱 iframe 中运行/)

const requestHandlerSource = fs.readFileSync(new URL('../../server/canvas-plugins/request-handler.ts', import.meta.url), 'utf8')
assert.match(requestHandlerSource, /canvas_plugin\.publish/)
assert.match(requestHandlerSource, /recordAdminAuditLog/)

console.log('canvas plugin management regression passed')
