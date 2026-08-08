import assert from 'node:assert/strict'
import {
  WORKFLOW_IMAGE_BATCH_MAX,
  WORKFLOW_IMAGE_BATCH_MIN,
  createWorkflowImageBatchChildren,
  normalizeWorkflowImageBatchCount,
  readWorkflowGenerationImageUrls,
} from '../../src/shared/workflow-image-batch.ts'

assert.equal(normalizeWorkflowImageBatchCount(undefined), WORKFLOW_IMAGE_BATCH_MIN)
assert.equal(normalizeWorkflowImageBatchCount(0), WORKFLOW_IMAGE_BATCH_MIN)
assert.equal(normalizeWorkflowImageBatchCount(2.9), 2)
assert.equal(normalizeWorkflowImageBatchCount(99), WORKFLOW_IMAGE_BATCH_MAX)

assert.deepEqual(
  readWorkflowGenerationImageUrls({
    images: ['https://example.com/one.png', '', 'https://example.com/two.png'],
    outputs: [{ url: 'https://example.com/two.png' }, { url: 'https://example.com/three.png' }],
  }),
  ['https://example.com/one.png', 'https://example.com/two.png', 'https://example.com/three.png'],
)
assert.deepEqual(
  createWorkflowImageBatchChildren('task-7', ['first.png', 'second.png']),
  [{ id: 'task-7-1', url: 'first.png' }, { id: 'task-7-2', url: 'second.png' }],
)

console.log('workflow image batch helpers: ok')
