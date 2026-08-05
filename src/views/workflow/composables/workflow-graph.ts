import type { WorkflowCanvasEdge, WorkflowCanvasNode, WorkflowNodeType } from './useWorkflowCanvas'

export type WorkflowGraphIssueLevel = 'error' | 'warning'

export interface WorkflowGraphIssue {
  level: WorkflowGraphIssueLevel
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export interface WorkflowGraphValidationResult {
  valid: boolean
  issues: WorkflowGraphIssue[]
  topologicalOrder: string[]
}

export const EXECUTABLE_WORKFLOW_NODE_TYPES: WorkflowNodeType[] = [
  'llmConfig',
  'imageConfig',
  'videoConfig',
]

const topologicalSort = (nodes: WorkflowCanvasNode[], edges: WorkflowCanvasEdge[]) => {
  const ids = new Set(nodes.map(node => node.id))
  const indegree = new Map(nodes.map(node => [node.id, 0]))
  const outgoing = new Map<string, string[]>()

  edges.forEach((edge) => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target])
  })

  const queue = nodes.filter(node => (indegree.get(node.id) || 0) === 0).map(node => node.id)
  const order: string[] = []
  while (queue.length) {
    const current = queue.shift()!
    order.push(current)
    for (const target of outgoing.get(current) || []) {
      const next = (indegree.get(target) || 0) - 1
      indegree.set(target, next)
      if (next === 0) queue.push(target)
    }
  }

  return order
}

export const validateWorkflowGraph = (
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
): WorkflowGraphValidationResult => {
  const issues: WorkflowGraphIssue[] = []
  const nodeById = new Map(nodes.map(node => [node.id, node]))

  if (!nodes.length) {
    issues.push({ level: 'error', code: 'EMPTY_GRAPH', message: '工作流画布为空' })
  }

  const edgeKeys = new Set<string>()
  edges.forEach((edge) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      issues.push({
        level: 'error',
        code: 'MISSING_EDGE_ENDPOINT',
        message: '连线引用了不存在的节点',
        edgeId: edge.id,
      })
      return
    }
    if (edge.source === edge.target) {
      issues.push({ level: 'error', code: 'SELF_CONNECTION', message: '节点不能连接到自身', edgeId: edge.id })
    }
    const key = `${edge.source}:${edge.sourceHandle || ''}->${edge.target}:${edge.targetHandle || ''}`
    if (edgeKeys.has(key)) {
      issues.push({ level: 'error', code: 'DUPLICATE_EDGE', message: '存在重复连线', edgeId: edge.id })
    }
    edgeKeys.add(key)
  })

  const topologicalOrder = topologicalSort(nodes, edges)
  if (topologicalOrder.length !== nodes.length) {
    issues.push({ level: 'error', code: 'CYCLE_DETECTED', message: '工作流存在循环依赖，无法执行' })
  }

  nodes.forEach((node) => {
    if (!EXECUTABLE_WORKFLOW_NODE_TYPES.includes(node.type)) return
    const incoming = edges.filter(edge => edge.target === node.id)
    const hasOwnPrompt = node.type === 'llmConfig'
      ? Boolean(node.data && 'systemPrompt' in node.data && String(node.data.systemPrompt || '').trim())
      : Boolean(node.data && 'prompt' in node.data && String(node.data.prompt || '').trim())
    if (!incoming.length && !hasOwnPrompt) {
      issues.push({
        level: 'error',
        code: 'MISSING_NODE_INPUT',
        message: `节点“${node.data.label || node.id}”缺少输入`,
        nodeId: node.id,
      })
    }

    incoming.forEach((edge) => {
      const source = nodeById.get(edge.source)
      if (!source) return
      if ((source.type === 'imageConfig' || source.type === 'videoConfig') && EXECUTABLE_WORKFLOW_NODE_TYPES.includes(node.type)) {
        issues.push({
          level: 'error',
          code: 'CONFIG_OUTPUT_NOT_CONNECTED',
          message: `节点“${source.data.label || source.id}”应通过其结果节点连接下游`,
          nodeId: source.id,
          edgeId: edge.id,
        })
      }
    })
  })

  return {
    valid: !issues.some(issue => issue.level === 'error'),
    issues,
    topologicalOrder,
  }
}
