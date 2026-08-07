import assert from 'node:assert/strict'
import { resolveWorkflowNodeMenuTarget } from '../../src/shared/workflow-node-menu.ts'
import {
  collectWorkflowSubjectReferences,
  isWorkflowSubjectNode,
  resolveWorkflowReferenceUrl,
} from '../../src/shared/workflow-subject-references.ts'

assert.deepEqual(resolveWorkflowNodeMenuTarget('director'), { nodeType: 'director', label: '导演台' })
assert.deepEqual(resolveWorkflowNodeMenuTarget('audio'), { nodeType: 'audio', label: '音频节点' })
assert.deepEqual(resolveWorkflowNodeMenuTarget('reference'), { nodeType: 'image', label: '参考节点' })

const nodes = [
  { id: 'subject', type: 'image', data: { label: '角色 A', url: '/uploads/a.png', isSubject: true } },
  { id: 'normal', type: 'image', data: { label: '普通图片', url: '/uploads/b.png' } },
  { id: 'empty', type: 'image', data: { label: '无图片主体', isSubject: true } },
  { id: 'text', type: 'text', data: { content: '说明', isSubject: true } },
]

assert.equal(isWorkflowSubjectNode(nodes[0]), true)
assert.equal(isWorkflowSubjectNode(nodes[1]), false)
assert.equal(resolveWorkflowReferenceUrl({ id: 'fallback', data: { previewUrl: ' /preview.png ' } }), '/preview.png')
assert.deepEqual(collectWorkflowSubjectReferences(nodes), [
  { id: 'subject', url: '/uploads/a.png', label: '角色 A', isSubject: true },
])

console.log('workflow node capability regression passed')
