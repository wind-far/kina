import assert from 'node:assert/strict'
import {
  buildWorkflowGenerationMetadata,
  isWorkflowGenerationMetadata,
} from '../../src/shared/workflow-generation-metadata.ts'

const metadata = buildWorkflowGenerationMetadata({
  kind: 'video',
  prompt: '  生成一支产品展示短片  ',
  model: 'Video Pro',
  modelKey: 'video-pro',
  systemPrompt: '你是一个视频导演',
  outputFormat: 'markdown',
  ratio: '16x9',
  resolution: '1080p',
  duration: 5,
  references: [
    { url: '/uploads/reference.png', mediaType: 'image', role: 'first_frame' },
    { url: '', mediaType: 'video' },
  ],
  sourceConfigNodeId: 'config-1',
})

assert.equal(metadata.version, 1)
assert.equal(metadata.prompt, '生成一支产品展示短片')
assert.equal(metadata.references.length, 1)
assert.equal(metadata.references[0].role, 'first_frame')
assert.equal(metadata.duration, 5)
assert.equal(metadata.systemPrompt, '你是一个视频导演')
assert.equal(metadata.outputFormat, 'markdown')
assert.ok(isWorkflowGenerationMetadata(metadata))
assert.equal(isWorkflowGenerationMetadata({ version: 2, kind: 'video', prompt: '', references: [] }), false)

console.log('workflow generation metadata: ok')
