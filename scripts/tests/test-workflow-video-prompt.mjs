import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const modulePath = join(process.cwd(), 'src/shared/workflow-video-prompt.ts')
const { resolveWorkflowVideoReferenceRole } = await import(pathToFileURL(modulePath).href)

assert.equal(resolveWorkflowVideoReferenceRole('all-reference', 0), 'input_reference')
assert.equal(resolveWorkflowVideoReferenceRole('all-reference', 1), 'input_reference')
assert.equal(resolveWorkflowVideoReferenceRole('first-last-frame', 0), 'first_frame_image')
assert.equal(resolveWorkflowVideoReferenceRole('first-last-frame', 1), 'last_frame_image')
assert.equal(resolveWorkflowVideoReferenceRole('first-last-frame', 2), 'input_reference')
assert.equal(resolveWorkflowVideoReferenceRole('smart-multi-frame', 0), 'first_frame_image')
assert.equal(resolveWorkflowVideoReferenceRole('smart-multi-frame', 1), 'input_reference')

console.log('workflow video prompt regression passed')
