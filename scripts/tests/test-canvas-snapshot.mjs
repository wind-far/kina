import assert from 'node:assert/strict'
import {
  CANVAS_SNAPSHOT_SCHEMA_VERSION,
  canvasSnapshotToWorkflowPayload,
  normalizeCanvasImport,
} from '../../src/shared/canvas-snapshot.ts'

const imported = normalizeCanvasImport({
  project: { name: '目标项目导出' },
  canvas: {
    nodes: [
      { id: 'prompt', type: 'text', position: { x: 20, y: 30 }, rotation: 15, data: { content: 'hello' } },
      { id: 'remote', type: 'third-party-node', position: { x: 500, y: 30 }, data: { value: 1 } },
    ],
    edges: [
      { id: 'valid', source: 'prompt', target: 'remote' },
      { id: 'invalid', source: 'prompt', target: 'missing' },
    ],
    viewport: { x: 8, y: 9, zoom: 9 },
    backgroundMode: 'lines',
  },
})

assert.equal(imported.snapshot.schemaVersion, CANVAS_SNAPSHOT_SCHEMA_VERSION)
assert.equal(imported.snapshot.scene, 'INFINITE_CANVAS')
assert.equal(imported.snapshot.nodes.length, 2)
assert.equal(imported.snapshot.nodes[1].type, 'unknown')
assert.equal(imported.snapshot.nodes[1].data.originalType, 'third-party-node')
assert.equal(imported.snapshot.edges.length, 1)
assert.equal(imported.snapshot.viewport.zoom, 4)
assert.equal(imported.snapshot.backgroundMode, 'lines')
assert.equal(imported.warnings.length, 2)

const payload = canvasSnapshotToWorkflowPayload(imported.snapshot)
assert.equal(payload.definitionJson.schemaVersion, CANVAS_SNAPSHOT_SCHEMA_VERSION)
assert.equal(payload.runtimeConfigJson.canvasSnapshotSchemaVersion, CANVAS_SNAPSHOT_SCHEMA_VERSION)
assert.deepEqual(payload.nodesJson[0].position, { x: 20, y: 30 })
assert.equal(payload.nodesJson[0].data.rotation, 15)

// basketikun/infinite-canvas 当前导出的 projects.json（ZIP 内元数据）兼容 fixture。
const targetExport = normalizeCanvasImport({
  app: 'infinite-canvas',
  version: 3,
  exportedAt: '2026-08-08T00:00:00.000Z',
  projects: [{
    project: {
      id: 'target-project',
      title: '目标项目',
      nodes: [
        { id: 'copy', type: 'text', title: '文案', position: { x: 16, y: 24 }, width: 360, height: 180, metadata: { content: '夏季新品', fontSize: 16 } },
        { id: 'config', type: 'config', title: '生图设置', position: { x: 420, y: 24 }, width: 360, height: 180, metadata: { generationMode: 'image', model: 'gpt-image', size: '1024x1024' } },
        { id: 'image', type: 'image', title: '主视觉', position: { x: 830, y: 24 }, width: 480, height: 360, rotation: -30, metadata: { storageKey: 'image:hero', mimeType: 'image/png', images: [{ id: 'hero', content: 'data:image/png;base64,AA==', storageKey: 'image:hero', mimeType: 'image/png' }], primaryImageId: 'hero' } },
        { id: 'plugin', type: 'demo:mask', title: '插件节点', position: { x: 16, y: 300 }, width: 360, height: 180, metadata: {} },
      ],
      connections: [
        { id: 'copy-config', fromNodeId: 'copy', toNodeId: 'config' },
        { id: 'config-image', fromNodeId: 'config', toNodeId: 'image' },
      ],
      viewport: { x: 11, y: -7, k: 1.25 },
      backgroundMode: 'lines',
      showImageInfo: true,
      chatSessions: [{ id: 'chat-1', messages: [] }],
      activeChatId: 'chat-1',
    },
    files: [{ storageKey: 'image:hero', path: 'projects/target-project/files/hero.png', mimeType: 'image/png', bytes: 2 }],
  }],
})
assert.deepEqual(targetExport.snapshot.nodes.map(node => node.type), ['text', 'imageConfig', 'image', 'unknown'])
assert.equal(targetExport.snapshot.nodes[0].data.content, '夏季新品')
assert.equal(targetExport.snapshot.nodes[2].data.url, 'data:image/png;base64,AA==')
assert.equal(targetExport.snapshot.nodes[2].data.sourceResource.storageKey, 'image:hero')
assert.equal(targetExport.snapshot.nodes[2].data.rotation, -30)
assert.equal(targetExport.snapshot.edges.length, 2)
assert.deepEqual(targetExport.snapshot.viewport, { x: 11, y: -7, zoom: 1.25 })
assert.equal(targetExport.snapshot.backgroundMode, 'lines')
assert.equal(targetExport.snapshot.chatSessions.length, 1)
assert.equal(targetExport.snapshot.extensions.importSource, 'basketikun/infinite-canvas')
assert.equal(targetExport.snapshot.extensions.sourceAssetManifest.length, 1)
assert.match(targetExport.warnings.join('\n'), /资源引用/)

console.log('canvas snapshot import/export regression passed')
