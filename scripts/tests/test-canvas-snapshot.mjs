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
      { id: 'prompt', type: 'text', position: { x: 20, y: 30 }, data: { content: 'hello' } },
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

console.log('canvas snapshot import/export regression passed')
