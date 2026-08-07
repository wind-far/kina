export type WorkflowNodeMenuType = 'text' | 'image' | 'video' | 'director' | 'audio' | 'reference'

export const resolveWorkflowNodeMenuTarget = (menuType: WorkflowNodeMenuType) => {
  switch (menuType) {
    case 'text': return { nodeType: 'text', label: '文本输入' } as const
    case 'video': return { nodeType: 'video', label: '视频节点' } as const
    case 'director': return { nodeType: 'director', label: '导演台' } as const
    case 'audio': return { nodeType: 'audio', label: '音频节点' } as const
    case 'reference': return { nodeType: 'image', label: '参考节点' } as const
    default: return { nodeType: 'image', label: '图片节点' } as const
  }
}
