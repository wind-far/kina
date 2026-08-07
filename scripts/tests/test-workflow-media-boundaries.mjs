import assert from 'node:assert/strict'
import {
  WORKFLOW_AUDIO_ACCEPT,
  WORKFLOW_AUDIO_MAX_BYTES,
  validateWorkflowAudioFile,
} from '../../src/shared/workflow-audio-file.ts'
import {
  commitWorkflowGridNodesAtomically,
  requireCompleteWorkflowGridUpload,
} from '../../src/shared/workflow-grid-transaction.ts'

assert.equal(validateWorkflowAudioFile({ name: 'voice.mp3', type: 'audio/mpeg', size: 12 }).valid, true)
assert.equal(validateWorkflowAudioFile({ name: 'voice.m4a', type: '', size: 12 }).valid, true)
assert.equal(validateWorkflowAudioFile({ name: 'notes.txt', type: 'text/plain', size: 12 }).valid, false)
assert.equal(validateWorkflowAudioFile({ name: 'empty.mp3', type: 'audio/mpeg', size: 0 }).valid, false)
assert.equal(validateWorkflowAudioFile({
  name: 'large.wav',
  type: 'audio/wav',
  size: WORKFLOW_AUDIO_MAX_BYTES + 1,
}).valid, false)
assert.match(WORKFLOW_AUDIO_ACCEPT, /\.flac/)

assert.deepEqual(requireCompleteWorkflowGridUpload([
  { publicUrl: '/uploads/1.png' },
  { publicUrl: '/uploads/2.png' },
], 2).map(file => file.publicUrl), ['/uploads/1.png', '/uploads/2.png'])
assert.throws(
  () => requireCompleteWorkflowGridUpload([{ publicUrl: '/uploads/1.png' }, { publicUrl: '' }], 2),
  /未全部上传成功/,
)

const graphNodes = new Set()
assert.throws(() => commitWorkflowGridNodesAtomically({
  items: ['one', 'two', 'three'],
  createNode: (_item, index) => {
    const id = `grid-${index + 1}`
    graphNodes.add(id)
    return id
  },
  connectNode: (_nodeId, _item, index) => {
    if (index === 1) throw new Error('模拟连线失败')
  },
  rollbackNode: nodeId => graphNodes.delete(nodeId),
}), /模拟连线失败/)
assert.deepEqual([...graphNodes], [])

console.log('workflow media boundary regression passed')
