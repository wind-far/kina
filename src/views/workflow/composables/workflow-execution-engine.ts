import { watch } from 'vue'
import {
  nodes,
  edges,
  updateNode,
  type WorkflowCanvasNode,
} from './useWorkflowCanvas'
import {
  EXECUTABLE_WORKFLOW_NODE_TYPES,
  validateWorkflowGraph,
  type WorkflowGraphValidationResult,
} from './workflow-graph'

export interface WorkflowExecutionProgress {
  current: number
  total: number
  nodeId: string
  label: string
}

export interface ExecuteWorkflowGraphOptions {
  signal?: AbortSignal
  timeoutMs?: number
  onProgress?: (progress: WorkflowExecutionProgress) => void | Promise<void>
  onNodeComplete?: (progress: WorkflowExecutionProgress, node: WorkflowCanvasNode) => void | Promise<void>
}

export interface WorkflowExecutionPlanNode {
  id: string
  type: string
  label: string
}

const waitForExecutableNode = (
  nodeId: string,
  options: ExecuteWorkflowGraphOptions,
) => new Promise<void>((resolve, reject) => {
  let settled = false
  let stopWatcher: (() => void) | null = null
  const cleanup = () => {
    stopWatcher?.()
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', handleAbort)
  }
  const finish = (error?: Error) => {
    if (settled) return
    settled = true
    cleanup()
    if (error) reject(error)
    else resolve()
  }
  const handleAbort = () => finish(new DOMException('工作流执行已取消', 'AbortError'))
  const check = (node?: WorkflowCanvasNode) => {
    if (!node) {
      finish(new Error(`执行节点 ${nodeId} 已不存在`))
      return
    }
    if (node.data.error) {
      finish(new Error(node.data.error))
      return
    }
    if (node.data.executed) finish()
  }
  const timeout = setTimeout(
    () => finish(new Error(`节点 ${nodeId} 执行超时`)),
    options.timeoutMs || 10 * 60 * 1000,
  )
  options.signal?.addEventListener('abort', handleAbort, { once: true })
  stopWatcher = watch(
    () => nodes.value.find(node => node.id === nodeId),
    node => check(node),
    { deep: true },
  )

  updateNode(nodeId, {
    autoExecute: true,
    executed: false,
    error: '',
  })
})

export const inspectWorkflowGraph = (): WorkflowGraphValidationResult => (
  validateWorkflowGraph(nodes.value, edges.value)
)

export const getWorkflowExecutionPlan = (): WorkflowExecutionPlanNode[] => {
  const validation = inspectWorkflowGraph()
  if (!validation.valid) {
    throw new Error(validation.issues.filter(issue => issue.level === 'error').map(issue => issue.message).join('；'))
  }

  const nodeById = new Map(nodes.value.map(node => [node.id, node]))
  const executionNodes = validation.topologicalOrder
    .map(id => nodeById.get(id))
    .filter((node): node is WorkflowCanvasNode => Boolean(node) && EXECUTABLE_WORKFLOW_NODE_TYPES.includes(node!.type))

  if (!executionNodes.length) {
    throw new Error('当前工作流没有可执行节点')
  }

  return executionNodes.map(node => ({
    id: node.id,
    type: node.type,
    label: String(node.data.label || node.id),
  }))
}

export const executeWorkflowGraph = async (options: ExecuteWorkflowGraphOptions = {}) => {
  const plan = getWorkflowExecutionPlan()
  const nodeById = new Map(nodes.value.map(node => [node.id, node]))
  const executionNodes = plan
    .map(item => nodeById.get(item.id))
    .filter((node): node is WorkflowCanvasNode => Boolean(node))

  for (let index = 0; index < executionNodes.length; index += 1) {
    if (options.signal?.aborted) throw new DOMException('工作流执行已取消', 'AbortError')
    const node = executionNodes[index]
    const progress = {
      current: index + 1,
      total: executionNodes.length,
      nodeId: node.id,
      label: String(node.data.label || node.id),
    }
    await options.onProgress?.(progress)
    await waitForExecutableNode(node.id, options)
    await options.onNodeComplete?.(progress, node)
  }

  return { executedNodeIds: executionNodes.map(node => node.id) }
}
