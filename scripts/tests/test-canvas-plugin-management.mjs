import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { assertTrustedCanvasPluginPackageUrl, downloadAndVerifyCanvasPluginPackage, normalizeCanvasPluginManifest, publishTrustedCanvasPlugin, startCanvasPluginGeneration } from '../../server/canvas-plugins/service.ts'
import { buildCanvasPluginGenerationNodeData, buildCanvasPluginGenerationPendingNodeData, buildCanvasPluginGenerationTerminalNodeData, canvasPluginNodeType, normalizeCanvasPluginRuntimeContributions } from '../../src/shared/canvas-plugin-runtime.ts'

const managerSource = fs.readFileSync(new URL('../../src/views/workflow/components/CanvasPluginManager.vue', import.meta.url), 'utf8')
assert.match(managerSource, /\/api\/canvas\/plugins\/\$\{encodeURIComponent\(plugin\.id\)\}\/install/)
assert.match(managerSource, /插件在沙箱 iframe 中运行/)

const requestHandlerSource = fs.readFileSync(new URL('../../server/canvas-plugins/request-handler.ts', import.meta.url), 'utf8')
assert.match(requestHandlerSource, /canvas_plugin\.publish/)
assert.match(requestHandlerSource, /recordAdminAuditLog/)
assert.match(requestHandlerSource, /listCanvasPluginsForAdmin/)
const adminPageSource = fs.readFileSync(new URL('../../src/views/admin/plugins/AdminCanvasPlugins.vue', import.meta.url), 'utf8')
assert.match(adminPageSource, /发布受信插件/)
assert.match(adminPageSource, /publishCanvasPlugin/)

const workflowSource = fs.readFileSync(new URL('../../src/views/workflow/index.vue', import.meta.url), 'utf8')
assert.match(workflowSource, /const handleCanvasPluginProposal[\s\S]*?applyCanvasAssistantProposal/)

assert.deepEqual(normalizeCanvasPluginManifest({ entry: '/plugin.html', capabilities: ['canvas.read', 'canvas.propose', 'canvas.read'] }), {
  entry: '/plugin.html', capabilities: ['canvas.read', 'canvas.propose'], generationTemplates: [],
})
assert.throws(
  () => normalizeCanvasPluginManifest({ entry: '/plugin.html', capabilities: ['network.anywhere'] }),
  /不受支持的能力/,
)

assert.deepEqual(
  normalizeCanvasPluginRuntimeContributions({
    nodes: [{ id: 'note', title: 'Plugin note', color: '#123456', defaultData: { value: 'safe' } }],
    toolbar: [{ id: 'summarize', title: 'Summarize' }],
    inspectors: [{ id: 'inspect', title: 'Inspect' }],
    migrations: [{ id: 'v1-v2', fromVersion: 1, toVersion: 2 }],
    generation: [{ id: 'generate', title: 'Generate', resultNodeId: 'note' }],
  },
  ['nodes', 'toolbar', 'inspector', 'migration', 'generation'],
  ),
  {
    nodes: [{ id: 'note', title: 'Plugin note', description: '', color: '#123456', defaultData: { value: 'safe' } }],
    toolbar: [{ id: 'summarize', title: 'Summarize', description: '' }],
    inspectors: [{ id: 'inspect', title: 'Inspect', description: '' }],
    migrations: [{ id: 'v1-v2', fromVersion: 1, toVersion: 2 }],
    generation: [{ id: 'generate', title: 'Generate', description: '', resultNodeId: 'note' }],
  },
)
assert.equal(canvasPluginNodeType('demo-plugin', 'note'), 'plugin:demo-plugin/note')
assert.deepEqual(buildCanvasPluginGenerationNodeData({
  taskId: 'task-1', templateId: 'rewrite', prompt: '  精简文案  ', model: 'Chat Model', modelKey: 'provider::chat',
  referenceImages: ['/uploads/a.png', 'https://untrusted.example/image.png'], content: '完成结果',
  outputs: [{ url: '/uploads/result.png', outputType: 'image' }, { url: '', outputType: 'image' }],
}), {
  generationTaskId: 'task-1', generationTemplateId: 'rewrite', generationStatus: 'completed',
  generationModel: 'Chat Model', generationModelKey: 'provider::chat', generatedContent: '完成结果',
  generatedOutputs: [{ url: '/uploads/result.png', outputType: 'image' }],
  generationRetry: { templateId: 'rewrite', prompt: '精简文案', referenceImages: ['/uploads/a.png'] },
})
assert.deepEqual(buildCanvasPluginGenerationPendingNodeData({
  taskId: 'task-2', templateId: 'rewrite', prompt: '再次精简', referenceImages: ['/uploads/a.png'],
}), {
  generationTaskId: 'task-2', generationTemplateId: 'rewrite', generationStatus: 'running',
  generationRetry: { templateId: 'rewrite', prompt: '再次精简', referenceImages: ['/uploads/a.png'] },
})
assert.deepEqual(buildCanvasPluginGenerationTerminalNodeData({ taskId: 'task-2', status: 'stopped', error: '用户停止' }), {
  generationTaskId: 'task-2', generationStatus: 'stopped', generationError: '用户停止',
})
assert.deepEqual(buildCanvasPluginGenerationTerminalNodeData({ taskId: 'task-3', status: 'anything-else', error: '失败' }), {
  generationTaskId: 'task-3', generationStatus: 'failed', generationError: '失败',
})
assert.deepEqual(normalizeCanvasPluginRuntimeContributions({ toolbar: [{ id: 'nope', title: 'Nope' }] }, []), {
  nodes: [], toolbar: [], inspectors: [], migrations: [], generation: [],
})

const packageBody = Buffer.from('<!doctype html><title>trusted plugin</title>')
const packageHash = createHash('sha256').update(packageBody).digest('hex')
const fakeResponse = {
  ok: true,
  status: 200,
  headers: { get: name => name === 'content-type' ? 'text/html; charset=utf-8' : String(packageBody.byteLength) },
  body: null,
  arrayBuffer: async () => packageBody,
}
assert.equal(
  await assertTrustedCanvasPluginPackageUrl('https://registry.example.com/demo.html', {
    environment: { CANVAS_PLUGIN_REGISTRY_HOSTS: 'registry.example.com' },
    resolveHostname: async () => [{ address: '8.8.8.8' }],
  }),
  'https://registry.example.com/demo.html',
)
assert.rejects(
  () => assertTrustedCanvasPluginPackageUrl('https://localhost/demo.html', {
    environment: { CANVAS_PLUGIN_REGISTRY_HOSTS: 'localhost' },
    resolveHostname: async () => [{ address: '127.0.0.1' }],
  }),
  /受限网络地址/,
)
assert.deepEqual(await downloadAndVerifyCanvasPluginPackage('https://registry.example.com/demo.html', packageHash, async () => fakeResponse), packageBody)
await assert.rejects(
  () => downloadAndVerifyCanvasPluginPackage('https://registry.example.com/demo.html', '0'.repeat(64), async () => fakeResponse),
  /SHA-256/,
)

const publishPayload = {
  slug: 'demo-plugin', name: 'Demo Plugin', version: '1.0.0', packageUrl: 'https://registry.example.com/demo.html', integritySha256: packageHash,
  manifest: { entry: '/plugin.html', capabilities: ['nodes', 'canvas.propose'] },
}
const deletedPackages = []
let savedPackageInput
const published = await publishTrustedCanvasPlugin(publishPayload, 'admin-1', {
  environment: { CANVAS_PLUGIN_REGISTRY_HOSTS: 'registry.example.com' },
  resolveHostname: async () => [{ address: '8.8.8.8' }],
  fetchImpl: async () => fakeResponse,
  savePackage: async (input) => { savedPackageInput = input; return { publicUrl: '/uploads/canvas-plugin/new.html', relativePath: 'canvas-plugin/new.html', storageType: 'local', storageCode: 'local' } },
  deletePackage: async (input) => { deletedPackages.push(input) },
  repository: {
    upsertPlugin: async () => ({ id: 'plugin-1' }),
    findRelease: async () => ({ packageStoragePath: 'canvas-plugin/old.html', packageStorageType: 'local', packageStorageCode: null }),
    upsertRelease: async (input) => ({ id: 'release-1', ...input }),
  },
})
assert.equal(savedPackageInput.category, 'canvas-plugin/demo-plugin/1.0.0')
assert.equal(published.release.packageUrl, '/uploads/canvas-plugin/new.html')
assert.deepEqual(deletedPackages, [{ relativePath: 'canvas-plugin/old.html', storageType: 'local', storageCode: undefined }])

const failedDeletedPackages = []
await assert.rejects(
  () => publishTrustedCanvasPlugin(publishPayload, 'admin-1', {
    environment: { CANVAS_PLUGIN_REGISTRY_HOSTS: 'registry.example.com' },
    resolveHostname: async () => [{ address: '8.8.8.8' }],
    fetchImpl: async () => fakeResponse,
    savePackage: async () => ({ publicUrl: '/uploads/canvas-plugin/fail.html', relativePath: 'canvas-plugin/fail.html', storageType: 'local', storageCode: 'local' }),
    deletePackage: async (input) => { failedDeletedPackages.push(input) },
    repository: {
      upsertPlugin: async () => ({ id: 'plugin-1' }),
      findRelease: async () => null,
      upsertRelease: async () => { throw new Error('database unavailable') },
    },
  }),
  /database unavailable/,
)
assert.deepEqual(failedDeletedPackages, [{ relativePath: 'canvas-plugin/fail.html', storageType: 'local', storageCode: 'local' }])

const generationRequests = []
const pluginGeneration = await startCanvasPluginGeneration('user-1', 'plugin-1', {
  templateId: 'rewrite', prompt: '把这段文案改得更简洁', providerId: 'attacker', modelKey: 'attacker-model', requestBody: { url: 'https://attacker.example' },
}, {
  findInstalledPlugin: async () => ({
    slug: 'demo-plugin', manifest: { capabilities: ['generation'], generationTemplates: [{ id: 'rewrite', type: 'agent', modelSelectionKey: 'provider-1::CHAT::chat-model', systemPrompt: '保持简洁', promptPrefix: '任务：' }] },
  }),
  getModelCatalog: async () => ({ models: { chat: [{ selectionKey: 'provider-1::CHAT::chat-model', providerId: 'provider-1', modelKey: 'chat-model' }], image: [], video: [] } }),
  startTask: async (payload, userId) => { generationRequests.push({ payload, userId }); return { id: 'task-1' } },
})
assert.equal(pluginGeneration.id, 'task-1')
assert.equal(generationRequests[0].userId, 'user-1')
assert.equal(generationRequests[0].payload.requestBody.providerId, 'provider-1')
assert.equal(generationRequests[0].payload.modelKey, 'chat-model')
assert.doesNotMatch(JSON.stringify(generationRequests[0].payload), /attacker/)
await assert.rejects(
  () => startCanvasPluginGeneration('user-1', 'plugin-1', { templateId: 'not-registered', prompt: 'x' }, {
    findInstalledPlugin: async () => ({ slug: 'demo-plugin', manifest: { capabilities: ['generation'], generationTemplates: [] } }),
  }),
  /模板未登记/,
)

const hostSource = fs.readFileSync(new URL('../../src/views/workflow/components/CanvasPluginHost.vue', import.meta.url), 'utf8')
assert.match(hostSource, /allowsCapability\(plugin, 'canvas\.read'\)/)
assert.match(hostSource, /allowsCapability\(plugin, 'canvas\.propose'\)/)
assert.match(hostSource, /plugin\.release\.isMirrored/)
assert.match(hostSource, /canvas-plugin:register/)
assert.match(hostSource, /defineExpose\(\{ invoke, retryGeneration \}\)/)
assert.match(hostSource, /@load="notifyReady\(plugin\)"/)
assert.match(hostSource, /canvas-plugin:request-generation/)
assert.match(hostSource, /subscribeGenerationTaskEvents/)
assert.match(hostSource, /emit\('generationResult'/)
assert.match(hostSource, /const retryGeneration/)
assert.match(hostSource, /const recoverPluginGenerationTasks/)
assert.match(hostSource, /data\.generationStatus !== 'running'/)
assert.match(hostSource, /emit\('generationTerminal'/)
assert.match(workflowSource, /const handleCanvasPluginGenerationResult/)
assert.match(workflowSource, /预览插件生成结果/)
assert.match(workflowSource, /buildCanvasPluginGenerationNodeData/)
assert.match(workflowSource, /const retrySelectedPluginGeneration/)
assert.match(workflowSource, /const handleCanvasPluginGenerationStarted/)
assert.match(workflowSource, /const handleCanvasPluginGenerationTerminal/)
assert.match(workflowSource, /按节点保存的受限模板重新生成/)
assert.match(managerSource, /!plugin\.release\?\.isMirrored/)
assert.match(workflowSource, /applyCanvasPluginProposal/)
assert.match(workflowSource, /addPluginNode/)
assert.match(workflowSource, /resetCanvasPluginRegistrations/)
assert.match(workflowSource, /const refreshCanvasPluginNodeTypes/)
assert.match(workflowSource, /filter\(node => isCanvasPluginNodeType\(node\.type\)\)/)

console.log('canvas plugin management regression passed')
