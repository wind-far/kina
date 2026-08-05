import assert from 'node:assert/strict'
import { validateWorkflowGraph } from '../../src/views/workflow/composables/workflow-graph.ts'

const node = (id, type = 'text', data = {}) => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })
const edge = (id, source, target) => ({ id, source, target })

const valid = validateWorkflowGraph(
  [node('input', 'text', { content: 'hello' }), node('llm', 'llmConfig')],
  [edge('e1', 'input', 'llm')],
)
assert.equal(valid.valid, true)
assert.deepEqual(valid.topologicalOrder, ['input', 'llm'])

const cyclic = validateWorkflowGraph(
  [node('a'), node('b')],
  [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')],
)
assert.equal(cyclic.valid, false)
assert.ok(cyclic.issues.some(issue => issue.code === 'CYCLE_DETECTED'))

const missingInput = validateWorkflowGraph([node('image', 'imageConfig')], [])
assert.equal(missingInput.valid, false)
assert.ok(missingInput.issues.some(issue => issue.code === 'MISSING_NODE_INPUT'))

const missingEndpoint = validateWorkflowGraph(
  [node('a')],
  [edge('e1', 'a', 'missing')],
)
assert.equal(missingEndpoint.valid, false)
assert.ok(missingEndpoint.issues.some(issue => issue.code === 'MISSING_EDGE_ENDPOINT'))

console.log('workflow graph validation regression passed')
