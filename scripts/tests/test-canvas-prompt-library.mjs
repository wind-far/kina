import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = async (path) => readFile(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')
const [schema, prompts, promptHandler, providerService, providerHandler, workspace] = await Promise.all([
  read('prisma/schema.prisma'),
  read('server/canvas-prompts/service.ts'),
  read('server/canvas-prompts/request-handler.ts'),
  read('server/provider-config/service.ts'),
  read('server/provider-config/request-handler.ts'),
  read('src/views/workflow/index.vue'),
])

assert.match(schema, /model CanvasPromptSource/)
assert.match(schema, /model CanvasPrompt/)
assert.match(prompts, /raw\.githubusercontent\.com/)
assert.match(prompts, /AbortSignal\.timeout/)
assert.match(promptHandler, /prompt-sources/)
assert.match(providerService, /normalizeProviderRequestTemplates/)
assert.match(providerService, /FORBIDDEN_TEMPLATE_HEADERS/)
assert.match(providerHandler, /request-templates/)
assert.match(workspace, /CanvasPromptLibrary/)

console.log('canvas prompt library and managed request templates declarations passed')
