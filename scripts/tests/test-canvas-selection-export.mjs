import assert from 'node:assert/strict'
import { createCanvasSelectionSnapshot } from '../../server/canvas-projects/service.ts'

const snapshot = {
  schemaVersion: 3,
  scene: 'INFINITE_CANVAS',
  nodes: [
    { id: 'a', type: 'text', position: { x: 0, y: 0 }, data: { content: 'A' } },
    { id: 'b', type: 'image', position: { x: 100, y: 0 }, data: { url: 'https://assets.example/b.png' } },
    { id: 'c', type: 'text', position: { x: 200, y: 0 }, data: { content: 'C' } },
  ],
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
  backgroundMode: 'dots',
  showImageInfo: false,
  chatSessions: [{ id: 'private-session' }],
  activeChatId: 'private-session',
  extensions: {},
}

const selection = createCanvasSelectionSnapshot(snapshot, ['a', 'b'])
assert.deepEqual(selection.nodes.map(node => node.id), ['a', 'b'])
assert.deepEqual(selection.edges.map(edge => edge.id), ['ab'])
assert.equal(selection.nodes[1].data.url, 'https://assets.example/b.png')
assert.deepEqual(selection.chatSessions, [])
assert.equal(selection.activeChatId, null)
assert.throws(() => createCanvasSelectionSnapshot(snapshot, []), /至少一个/)

console.log('canvas selection export regression passed')
