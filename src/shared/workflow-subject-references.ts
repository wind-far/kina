export interface WorkflowSubjectNodeLike {
  id: string
  type?: string
  data?: Record<string, unknown>
}

export interface WorkflowSubjectReference {
  id: string
  url: string
  label: string
  isSubject: true
}

const REFERENCE_URL_KEYS = ['url', 'imageUrl', 'outputUrl', 'previewUrl', 'thumbnailUrl', 'coverUrl', 'src'] as const

export const resolveWorkflowReferenceUrl = (node: WorkflowSubjectNodeLike | undefined) => {
  const data = node?.data || {}
  for (const key of REFERENCE_URL_KEYS) {
    const value = data[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export const isWorkflowSubjectNode = (node: WorkflowSubjectNodeLike | undefined) => Boolean(
  node?.type === 'image' && node.data?.isSubject,
)

export const collectWorkflowSubjectReferences = (
  nodes: WorkflowSubjectNodeLike[],
): WorkflowSubjectReference[] => nodes
  .filter(isWorkflowSubjectNode)
  .map(node => ({
    id: node.id,
    url: resolveWorkflowReferenceUrl(node),
    label: String(node.data?.label || '主体'),
    isSubject: true as const,
  }))
  .filter(reference => Boolean(reference.url))
