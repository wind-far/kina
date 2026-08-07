import assert from 'node:assert/strict'
import { isWorkflowRunsPath } from '../../server/workflow-runs/constants.ts'
import { normalizeWorkflowRunNodes } from '../../server/workflow-runs/service.ts'
import {
  assertWorkflowRunTransition,
  WorkflowRunRequestError,
} from '../../server/workflow-runs/shared.ts'

assert.equal(isWorkflowRunsPath('/api/workflows/w1/runs'), true)
assert.equal(isWorkflowRunsPath('/api/workflows/w1/runs/latest'), true)
assert.equal(isWorkflowRunsPath('/api/workflows/w1/runs/r1'), true)
assert.equal(isWorkflowRunsPath('/api/workflows/w1/runs/r1/stop'), true)
assert.equal(isWorkflowRunsPath('/api/workflows/w1/runs/r1/retry'), true)
assert.equal(isWorkflowRunsPath('/api/workflows/w1/versions'), false)

const savedNodes = [
  { id: 'input', type: 'text', data: { label: '输入' } },
  { id: 'llm', type: 'llmConfig', data: { label: '文本生成' } },
  { id: 'image', type: 'imageConfig', data: { label: '图片生成' } },
  { id: 'video', type: 'videoConfig', data: { label: '视频生成' } },
]
assert.deepEqual(normalizeWorkflowRunNodes([
  { id: 'llm', type: 'llmConfig' },
  { id: 'image', type: 'imageConfig', label: '自定义图片节点' },
  { id: 'video', type: 'videoConfig' },
], savedNodes), [
  { nodeId: 'llm', nodeType: 'llmConfig', label: '文本生成', sortOrder: 0 },
  { nodeId: 'image', nodeType: 'imageConfig', label: '自定义图片节点', sortOrder: 1 },
  { nodeId: 'video', nodeType: 'videoConfig', label: '视频生成', sortOrder: 2 },
])

assert.throws(
  () => normalizeWorkflowRunNodes([{ id: 'input', type: 'text' }], savedNodes),
  (error) => error instanceof WorkflowRunRequestError && error.statusCode === 400,
)
assert.throws(
  () => normalizeWorkflowRunNodes([
    { id: 'llm', type: 'llmConfig' },
    { id: 'llm', type: 'llmConfig' },
  ], savedNodes),
  WorkflowRunRequestError,
)

assert.doesNotThrow(() => assertWorkflowRunTransition('RUNNING', 'NODE_STARTED'))
assert.throws(
  () => assertWorkflowRunTransition('COMPLETED', 'NODE_STARTED'),
  (error) => error instanceof WorkflowRunRequestError && error.statusCode === 409,
)

console.log('workflow run persistence regression passed')
