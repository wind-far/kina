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
assert.match(workflow, /downloadCurrentCanvasProject/)
assert.match(workflow, /runCanvasAssistantPreview/)
assert.match(server, /canvas-projects/)
assert.match(pluginHandler, /requireAdminSessionUser/)
assert.match(pluginHost, /sandbox="allow-scripts"/)
assert.doesNotMatch(pluginHost, /allow-same-origin/)
assert.match(schema, /model CanvasPlugin/)
assert.match(schema, /model CanvasPluginInstall/)

console.log('canvas workstation platform declarations passed')
