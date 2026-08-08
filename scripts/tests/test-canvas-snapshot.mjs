import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  CANVAS_SNAPSHOT_SCHEMA_VERSION,
  canvasSnapshotToWorkflowPayload,
  normalizeCanvasImport,
} from '../../src/shared/canvas-snapshot.ts'

const imported = normalizeCanvasImport({
  project: { name: '目标项目导出' },
  canvas: {
    nodes: [
      { id: 'prompt', type: 'text', position: { x: 20, y: 30 }, rotation: 15, style: { width: '420px', height: '240px', color: 'red' }, data: { content: 'hello' } },
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
assert.deepEqual(payload.nodesJson[0].style, { width: '420px', height: '240px' })

// 按 basketikun/infinite-canvas v3 导出结构构造的 projects.json 兼容 fixture；并非真实用户导出文件。
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
        { id: 'config', type: 'config', title: '生图设置', position: { x: 420, y: 24 }, width: 360, height: 180, metadata: { generationMode: 'image-generation', model: 'gpt-image', aspectRatio: '16:9', quality: 'high', count: 3 } },
        { id: 'image', type: 'image', title: '主视觉', position: { x: 830, y: 24 }, width: 480, height: 360, rotation: -30, metadata: { storageKey: 'image:hero', mimeType: 'image/png', images: [{ id: 'hero', content: 'data:image/png;base64,AA==', storageKey: 'image:hero', mimeType: 'image/png' }], primaryImageId: 'hero' } },
        { id: 'video-config', type: 'config', title: '视频设置', position: { x: 830, y: 430 }, width: 360, height: 180, metadata: { generationMode: 'video-generation', model: 'seedance', seconds: 8, vquality: '1080p' } },
        { id: 'voice', type: 'audio', title: '配音', position: { x: 1230, y: 430 }, width: 320, height: 120, metadata: { storageKey: 'audio:voice', assetUrl: 'https://cdn.example/voice.mp3', mimeType: 'audio/mpeg' } },
        { id: 'plugin', type: 'demo:mask', title: '插件节点', position: { x: 16, y: 300 }, width: 360, height: 180, metadata: {} },
      ],
      connections: [
        { id: 'copy-config', fromNodeId: 'copy', toNodeId: 'config' },
        { id: 'config-image', fromNodeId: 'config', toNodeId: 'image', type: 'imageOrder', data: { imageRole: 'input_reference' } },
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
assert.deepEqual(targetExport.snapshot.nodes.map(node => node.type), ['text', 'imageConfig', 'image', 'videoConfig', 'audio', 'unknown'])
assert.equal(targetExport.snapshot.nodes[0].data.content, '夏季新品')
assert.equal(targetExport.snapshot.nodes[1].data.size, '16:9')
assert.equal(targetExport.snapshot.nodes[1].data.quality, 'high')
assert.equal(targetExport.snapshot.nodes[1].data.batchCount, 3)
assert.equal(targetExport.snapshot.nodes[2].data.url, 'data:image/png;base64,AA==')
assert.equal(targetExport.snapshot.nodes[2].data.sourceResource.storageKey, 'image:hero')
assert.equal(targetExport.snapshot.nodes[2].data.rotation, -30)
assert.deepEqual(targetExport.snapshot.nodes[2].style, { width: '480px', height: '360px' })
assert.equal(targetExport.snapshot.nodes[3].data.duration, 8)
assert.equal(targetExport.snapshot.nodes[3].data.resolution, '1080p')
assert.equal(targetExport.snapshot.nodes[4].data.url, 'https://cdn.example/voice.mp3')
assert.equal(targetExport.snapshot.nodes[5].data.originalType, 'demo:mask')
assert.equal(targetExport.snapshot.edges.length, 2)
assert.equal(targetExport.snapshot.edges[1].type, 'imageOrder')
assert.equal(targetExport.snapshot.edges[1].data.imageRole, 'input_reference')
assert.deepEqual(targetExport.snapshot.viewport, { x: 11, y: -7, zoom: 1.25 })
assert.equal(targetExport.snapshot.backgroundMode, 'lines')
assert.equal(targetExport.snapshot.chatSessions.length, 1)
assert.equal(targetExport.snapshot.extensions.importSource, 'basketikun/infinite-canvas')
assert.equal(targetExport.snapshot.extensions.sourceAssetManifest.length, 1)
assert.match(targetExport.warnings.join('\n'), /资源引用/)

// 浏览器验收也会使用这份无敏感数据 fixture，确保上传路径与纯函数适配器保持一致。
const browserFixture = JSON.parse(fs.readFileSync(new URL('./fixtures/target-infinite-canvas-v3-import.json', import.meta.url), 'utf8'))
const browserFixtureImport = normalizeCanvasImport(browserFixture)
assert.deepEqual(browserFixtureImport.snapshot.nodes.map(node => node.type), ['text', 'imageConfig', 'videoConfig', 'unknown', 'image'])
assert.equal(browserFixtureImport.snapshot.nodes[1].data.batchCount, 3)
assert.equal(browserFixtureImport.snapshot.nodes[2].data.duration, 8)
assert.equal(browserFixtureImport.snapshot.nodes[4].data.sourceResource.storageKey, 'image:not-in-archive')
assert.equal(browserFixtureImport.snapshot.backgroundMode, 'lines')
assert.equal(browserFixtureImport.snapshot.chatSessions.length, 1)
assert.equal(browserFixtureImport.snapshot.edges.length, 2)
assert.match(browserFixtureImport.warnings.join('\n'), /image:not-in-archive/)

console.log('canvas snapshot import/export regression passed')
