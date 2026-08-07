import assert from 'node:assert/strict'
import {
  buildBlankCanvasProjectPayload,
  buildBlankWorkflowProjectPayload,
} from '../../src/views/agentic-assets-canvas/new-agentic-project.ts'

const savedAt = new Date('2026-08-07T01:02:03.000Z')
const payload = buildBlankWorkflowProjectPayload(savedAt)

assert.equal(payload.name, `未命名工作流 ${savedAt.toLocaleTimeString('zh-CN', { hour12: false })}`)
assert.equal(payload.scene, 'WORKFLOW_CANVAS')
assert.equal(payload.status, 'DRAFT')
assert.deepEqual(payload.nodesJson, [])
assert.deepEqual(payload.edgesJson, [])
assert.deepEqual(payload.definitionJson, {
  scene: 'WORKFLOW_CANVAS',
  nodeCount: 0,
  edgeCount: 0,
})
assert.deepEqual(payload.viewportJson, { x: 100, y: 50, zoom: 0.8 })
assert.equal(payload.runtimeConfigJson.savedAt, savedAt.toISOString())

const canvasPayload = buildBlankCanvasProjectPayload(savedAt)
assert.equal(canvasPayload.name, `未命名画布 ${savedAt.toLocaleTimeString('zh-CN', { hour12: false })}`)
assert.equal(canvasPayload.scene, 'INFINITE_CANVAS')
assert.deepEqual(canvasPayload.nodesJson, [])
assert.deepEqual(canvasPayload.edgesJson, [])
assert.deepEqual(canvasPayload.viewportJson, { x: 0, y: 0, zoom: 1 })
assert.deepEqual(canvasPayload.definitionJson, {
  scene: 'INFINITE_CANVAS',
  schemaVersion: 2,
  nodeCount: 0,
  edgeCount: 0,
})

console.log('agentic assets new project regression passed')
