import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = await readFile(fileURLToPath(new URL('../../src/views/workflow/components/nodes/ImageNode.vue', import.meta.url)), 'utf8')

assert.match(source, /const selectBatchChild/)
assert.match(source, /manualSaveHistory\(\)/)
assert.match(source, /const retryFromBatchChild/)
assert.match(source, /referenceImages: \[child\.url\]/)
assert.match(source, /count: 1/)
assert.match(source, /@click\.stop="retryFromBatchChild\(child\)"/)

console.log('workflow image batch retry declarations passed')
