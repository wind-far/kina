import assert from 'node:assert/strict'
import {
  buildWorkflowAssistantContextPrompt,
  collectWorkflowAssistantContext,
  collectWorkflowAssistantImageReferences,
} from '../../src/shared/workflow-assistant-context.ts'

const nodes = [
  { id: 'prompt', type: 'text', data: { label: '提示词', content: '一只橘猫' } },
  { id: 'config', type: 'imageConfig', data: { label: '图片配置' } },
  { id: 'image', type: 'image', data: { label: '结果图', url: '/uploads/cat.png' } },
]
const edges = [
  { source: 'prompt', target: 'config' },
  { source: 'config', target: 'image' },
  { source: 'image', target: 'prompt' },
]

const context = collectWorkflowAssistantContext(nodes, edges, ['image'])
assert.deepEqual(context.map(item => item.id), ['image', 'config', 'prompt'])
assert.deepEqual(context.map(item => item.relation), ['selected', 'upstream', 'upstream'])
assert.equal(context[0].url, '/uploads/cat.png')
assert.equal(context[2].content, '一只橘猫')
assert.equal(collectWorkflowAssistantContext(nodes, edges, ['image'], 2).length, 2)
assert.deepEqual(collectWorkflowAssistantContext(nodes, edges, [], 12), [])

const prompt = buildWorkflowAssistantContextPrompt('请分析构图', context)
assert.match(prompt, /^请分析构图/)
assert.match(prompt, /\[选中\/image\] 结果图/)
assert.match(prompt, /\[上游\/text\] 提示词：一只橘猫/)
assert.equal(buildWorkflowAssistantContextPrompt('原始问题', []), '原始问题')

assert.deepEqual(
  collectWorkflowAssistantImageReferences(['upload.png'], context, 'agent'),
  ['upload.png'],
)
assert.deepEqual(
  collectWorkflowAssistantImageReferences(['upload.png', '/uploads/cat.png'], context, 'image'),
  ['upload.png', '/uploads/cat.png'],
)

console.log('workflow assistant context regression passed')
