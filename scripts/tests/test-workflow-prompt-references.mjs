import assert from 'node:assert/strict'
import { File } from 'node:buffer'
import {
  getWorkflowPromptAvailableReferenceSlots,
  mergeWorkflowPromptReferences,
  workflowPromptFileToDataUrl,
  WORKFLOW_PROMPT_REFERENCE_ACCEPT,
  WORKFLOW_PROMPT_REFERENCE_LIMIT,
} from '../../src/shared/workflow-prompt-references.ts'
import { collectWorkflowSubjectReferences } from '../../src/shared/workflow-subject-references.ts'

const imageFile = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], 'sample.png', { type: 'image/png' })
assert.equal(await workflowPromptFileToDataUrl(imageFile), 'data:image/png;base64,iVBORw==')

assert.equal(WORKFLOW_PROMPT_REFERENCE_LIMIT, 4)
assert.equal(getWorkflowPromptAvailableReferenceSlots(0), 4)
assert.equal(getWorkflowPromptAvailableReferenceSlots(1), 3)
assert.equal(getWorkflowPromptAvailableReferenceSlots(4), 0)
assert.equal(getWorkflowPromptAvailableReferenceSlots(9), 0)
assert.equal(getWorkflowPromptAvailableReferenceSlots(Number.NaN), 4)

assert.deepEqual(mergeWorkflowPromptReferences(
  [{ id: 'canvas' }, { id: 'upload-1' }],
  [{ id: 'canvas' }, { id: 'mention-1' }, { id: 'mention-2' }, { id: 'mention-3' }],
).map(reference => reference.id), ['canvas', 'upload-1', 'mention-1', 'mention-2'])

const subjectReferences = collectWorkflowSubjectReferences([
  { id: 'subject-1', type: 'image', data: { isSubject: true, url: '/subject-1.png', label: '人物' } },
  { id: 'subject-empty', type: 'image', data: { isSubject: true, url: '', label: '空主体' } },
  { id: 'regular-image', type: 'image', data: { url: '/regular.png' } },
])
assert.deepEqual(subjectReferences.map(reference => reference.id), ['subject-1'])
assert.deepEqual(mergeWorkflowPromptReferences(
  subjectReferences,
  [{ id: 'connected-1' }, { id: 'connected-2' }, { id: 'subject-1' }],
  [{ id: 'upload-1' }, { id: 'upload-2' }],
).map(reference => reference.id), ['subject-1', 'connected-1', 'connected-2', 'upload-1'])

assert.match(WORKFLOW_PROMPT_REFERENCE_ACCEPT, /image\/jpeg/)
assert.match(WORKFLOW_PROMPT_REFERENCE_ACCEPT, /\.webp/)
assert.match(WORKFLOW_PROMPT_REFERENCE_ACCEPT, /\.bmp/)

console.log('workflow prompt reference regression passed')
