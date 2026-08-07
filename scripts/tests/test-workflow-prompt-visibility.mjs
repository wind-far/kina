import assert from 'node:assert/strict'
import {
  isWorkflowPromptAnchorNodeType,
  isWorkflowPromptSendDisabled,
  shouldDismissWorkflowPromptDock,
} from '../../src/shared/workflow-prompt-visibility.ts'

assert.equal(isWorkflowPromptAnchorNodeType('image'), true)
assert.equal(isWorkflowPromptAnchorNodeType('text'), false)
assert.equal(isWorkflowPromptAnchorNodeType('imageConfig'), false)
assert.equal(isWorkflowPromptAnchorNodeType('video'), false)
assert.equal(isWorkflowPromptAnchorNodeType(undefined), false)

assert.equal(shouldDismissWorkflowPromptDock({ anchorNodeId: 'image-1', clickedNodeId: 'image-1', clickInsideDock: false }), false)
assert.equal(shouldDismissWorkflowPromptDock({ anchorNodeId: 'image-1', clickInsideDock: true }), false)
assert.equal(shouldDismissWorkflowPromptDock({ anchorNodeId: 'image-1', clickInsideDock: false, clickInsideModal: true }), false)
assert.equal(shouldDismissWorkflowPromptDock({ anchorNodeId: 'image-1', clickedNodeId: 'image-2', clickInsideDock: false }), true)
assert.equal(shouldDismissWorkflowPromptDock({ anchorNodeId: 'image-1', clickInsideDock: false }), true)
assert.equal(shouldDismissWorkflowPromptDock({ anchorNodeId: '', clickInsideDock: false }), false)

assert.equal(isWorkflowPromptSendDisabled({ sending: false, modelKey: '', text: '生成视频', referenceCount: 1 }), true)
assert.equal(isWorkflowPromptSendDisabled({ sending: false, modelKey: 'gpt-image-2', text: '', referenceCount: 1 }), false)
assert.equal(isWorkflowPromptSendDisabled({ sending: false, modelKey: 'gpt-image-2', text: '', referenceCount: 0 }), true)
assert.equal(isWorkflowPromptSendDisabled({ sending: true, modelKey: 'gpt-image-2', text: '生成图片', referenceCount: 1 }), true)

console.log('workflow prompt visibility regression passed')
