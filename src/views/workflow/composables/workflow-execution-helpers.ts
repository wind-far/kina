/**
 * 工作流执行辅助工具
 * 统一管理 watcher、超时等待与节点完成判定逻辑。
 */

import { watch } from 'vue'
import { nodes, type WorkflowCanvasNode } from './useWorkflowCanvas'

type WorkflowWatcherStop = () => void

const EXECUTION_TIMEOUT_MS = 5 * 60 * 1000

const hasNodeOutputUrl = (
  node: WorkflowCanvasNode,
): node is WorkflowCanvasNode<'image' | 'video'> => 'url' in node.data && typeof node.data.url === 'string'

export const clearWorkflowWatchers = (activeWatchers: WorkflowWatcherStop[]) => {
  activeWatchers.forEach((stop) => stop())
  activeWatchers.length = 0
}

export const waitForWorkflowConfigComplete = (
  configNodeId: string,
  activeWatchers: WorkflowWatcherStop[],
  addLog: (type: string, message: string) => void,
) => {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('执行超时')), EXECUTION_TIMEOUT_MS)
    let stopWatcher: WorkflowWatcherStop | null = null

    const checkNode = (node?: WorkflowCanvasNode) => {
      if (!node) return false
      if (node.data?.error) {
        clearTimeout(timeout)
        stopWatcher?.()
        reject(new Error(node.data.error))
        return true
      }
      if (node.data?.executed && node.data?.outputNodeId) {
        clearTimeout(timeout)
        stopWatcher?.()
        addLog('success', `节点 ${configNodeId} 完成`)
        resolve(node.data.outputNodeId)
        return true
      }
      return false
    }

    const node = nodes.value.find((item) => item.id === configNodeId)
    if (checkNode(node)) return

    stopWatcher = watch(
      () => nodes.value.find((item) => item.id === configNodeId),
      (node) => checkNode(node),
      { deep: true },
    )
    activeWatchers.push(stopWatcher)
  })
}

export const waitForWorkflowOutputReady = (
  outputNodeId: string,
  activeWatchers: WorkflowWatcherStop[],
) => {
  return new Promise<WorkflowCanvasNode>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('输出节点超时')), EXECUTION_TIMEOUT_MS)
    let stopWatcher: WorkflowWatcherStop | null = null

    const checkNode = (node?: WorkflowCanvasNode) => {
      if (!node) return false
      if (node.data?.error) {
        clearTimeout(timeout)
        stopWatcher?.()
        reject(new Error(node.data.error))
        return true
      }
      if (hasNodeOutputUrl(node) && node.data.url && !node.data.loading) {
        clearTimeout(timeout)
        stopWatcher?.()
        resolve(node)
        return true
      }
      return false
    }

    const node = nodes.value.find((item) => item.id === outputNodeId)
    if (checkNode(node)) return

    stopWatcher = watch(
      () => nodes.value.find((item) => item.id === outputNodeId),
      (node) => checkNode(node),
      { deep: true },
    )
    activeWatchers.push(stopWatcher)
  })
}
