import assert from 'node:assert/strict'
import { normalizeReferenceImageToPng } from '../../server/generation-tasks/reference-image.ts'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

const normalized = await normalizeReferenceImageToPng(new Blob([tinyPng], { type: 'image/png' }))
assert.equal(normalized.type, 'image/png')
assert.deepEqual(
  Buffer.from(await normalized.arrayBuffer()).subarray(0, 8),
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
)

await assert.rejects(
  () => normalizeReferenceImageToPng(new Blob([Buffer.from('not an image')], { type: 'image/webp' })),
  /参考图无法读取/,
)

console.log('reference image normalization regression passed')
