/**
 * 参考页的节点输入栏只属于图片节点；文本、配置、视频等节点保持各自节点内编辑能力。
 */
export const isWorkflowPromptAnchorNodeType = (nodeType: unknown) => nodeType === 'image'

export const isWorkflowPromptSendDisabled = (input: {
  sending: boolean
  modelKey: string
  text: string
  referenceCount: number
}) => input.sending
  || !String(input.modelKey || '').trim()
  || (!String(input.text || '').trim() && Math.max(0, Number(input.referenceCount) || 0) === 0)
