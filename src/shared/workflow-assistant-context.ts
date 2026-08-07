export interface WorkflowAssistantContextNode {
  id: string
  type?: string
  data?: Record<string, unknown>
}

export interface WorkflowAssistantContextEdge {
  source: string
  target: string
}

export interface WorkflowAssistantContextReference {
  id: string
  type: string
  label: string
  relation: 'selected' | 'upstream'
  url?: string
  content?: string
}

export const collectWorkflowAssistantContext = (
  nodes: WorkflowAssistantContextNode[],
  edges: WorkflowAssistantContextEdge[],
  selectedNodeIds: Iterable<string>,
  limit = 12,
): WorkflowAssistantContextReference[] => {
  const selectedIds = new Set(selectedNodeIds)
  const queue = [...selectedIds]
  const seen = new Set<string>()
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const upstreamByTarget = new Map<string, string[]>()

  for (const edge of edges) {
    const upstream = upstreamByTarget.get(edge.target) || []
    upstream.push(edge.source)
    upstreamByTarget.set(edge.target, upstream)
  }

  const result: WorkflowAssistantContextReference[] = []
  const safeLimit = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 12))
  while (queue.length && result.length < safeLimit) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = nodeById.get(id)
    if (!node) continue

    const data = node.data || {}
    const type = String(node.type || 'unknown')
    const content = String(data.content || data.outputContent || data.systemPrompt || '').trim()
    const url = type === 'image' || type === 'video' ? String(data.url || '').trim() : ''
    result.push({
      id,
      type,
      label: String(data.label || `${type} 节点`),
      relation: selectedIds.has(id) ? 'selected' : 'upstream',
      ...(url ? { url } : {}),
      ...(content ? { content: content.slice(0, 1200) } : {}),
    })

    for (const upstreamId of upstreamByTarget.get(id) || []) {
      if (!seen.has(upstreamId)) queue.push(upstreamId)
    }
  }

  return result
}

export const buildWorkflowAssistantContextPrompt = (
  content: string,
  references: WorkflowAssistantContextReference[],
) => {
  if (!references.length) return content
  const contextLines = references.map((item) => {
    const relation = item.relation === 'selected' ? '选中' : '上游'
    const details = item.content
      ? `：${String(item.content).slice(0, 800)}`
      : item.url
        ? `：${item.url}`
        : ''
    return `- [${relation}/${item.type}] ${item.label}${details}`
  })
  return `${content}\n\n以下是当前画布上下文，请仅在相关时使用：\n${contextLines.join('\n')}`
}

export const collectWorkflowAssistantImageReferences = (
  uploadedImageUrls: string[],
  contextReferences: WorkflowAssistantContextReference[],
  creationType: string,
) => [...new Set([
  ...uploadedImageUrls.filter(Boolean),
  ...(creationType === 'image'
    ? contextReferences.filter(item => item.type === 'image' && item.url).map(item => item.url!)
    : []),
])]
