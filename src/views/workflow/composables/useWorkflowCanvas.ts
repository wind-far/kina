/**
 * 画布状态管理
 * 管理节点、边和画布状态
 */
import { ref } from 'vue'
import { getDefaultChatModelKey, getDefaultImageModelKey, getDefaultVideoModelKey, getModelByName } from '@/config/models'
import type { WorkflowCanvasPosition } from './workflow-orchestrator-types'

export type WorkflowNodeType = 'text' | 'imageConfig' | 'videoConfig' | 'image' | 'video' | 'llmConfig'

export interface WorkflowNodeDataBase {
  label?: string
  createdAt?: number
  updatedAt?: number
  loading?: boolean
  error?: string
  taskRecordId?: string
  autoExecute?: boolean
  executed?: boolean
  outputNodeId?: string
}

export interface WorkflowTextNodeData extends WorkflowNodeDataBase {
  content: string
  polishModel?: string
}

export interface WorkflowImageConfigNodeData extends WorkflowNodeDataBase {
  prompt?: string
  model?: string
  size?: string
  quality?: string
}

export interface WorkflowVideoConfigNodeData extends WorkflowNodeDataBase {
  prompt?: string
  ratio?: string
  duration?: number
  model?: string
}

export interface WorkflowImageNodeData extends WorkflowNodeDataBase {
  url: string
  base64?: string
  duration?: number
}

export interface WorkflowVideoNodeData extends WorkflowNodeDataBase {
  url: string
  duration: number
}

export interface WorkflowLlmConfigNodeData extends WorkflowNodeDataBase {
  systemPrompt?: string
  model?: string
  outputFormat?: string
  outputContent?: string
}

export interface WorkflowNodeDataMap {
  text: WorkflowTextNodeData
  imageConfig: WorkflowImageConfigNodeData
  videoConfig: WorkflowVideoConfigNodeData
  image: WorkflowImageNodeData
  video: WorkflowVideoNodeData
  llmConfig: WorkflowLlmConfigNodeData
}

export type WorkflowNodeData = WorkflowNodeDataMap[WorkflowNodeType]

export interface WorkflowCanvasNode<T extends WorkflowNodeType = WorkflowNodeType> {
  id: string
  type: T
  position: WorkflowCanvasPosition
  data: WorkflowNodeDataMap[T]
  zIndex?: number
  selected?: boolean
}

export type WorkflowEdgeType = 'promptOrder' | 'imageOrder' | 'imageRole'

export interface WorkflowPromptOrderEdgeData {
  promptOrder: number
}

export interface WorkflowImageOrderEdgeData {
  imageOrder: number
}

export interface WorkflowImageRoleEdgeData {
  imageRole: string
}

export type WorkflowEdgeData =
  | WorkflowPromptOrderEdgeData
  | WorkflowImageOrderEdgeData
  | WorkflowImageRoleEdgeData
  | Record<string, unknown>
  | undefined

export interface WorkflowCanvasEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: WorkflowEdgeType
  data?: WorkflowEdgeData
}

export interface WorkflowCanvasStateSnapshot {
  nodes: WorkflowCanvasNode[]
  edges: WorkflowCanvasEdge[]
}

export interface WorkflowCanvasViewportSnapshot {
  x: number
  y: number
  zoom: number
}

type WorkflowNodeUpdatePayload = Partial<WorkflowNodeData> & {
  position?: WorkflowCanvasPosition
  zIndex?: number
}

export interface WorkflowEdgePatch {
  data?: WorkflowEdgeData
}

export interface WorkflowAddEdgeParams {
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: WorkflowEdgeType
  data?: WorkflowEdgeData
}

// 节点 ID 计数器
let nodeId = 0
const getNodeId = () => `node_${nodeId++}`

// 节点和边
export const nodes = ref<WorkflowCanvasNode[]>([])
export const edges = ref<WorkflowCanvasEdge[]>([])

// 视口状态
export const canvasViewport = ref({ x: 100, y: 50, zoom: 0.8 })

// 撤销/重做历史
const history = ref<WorkflowCanvasStateSnapshot[]>([])
const historyIndex = ref(-1)
const MAX_HISTORY = 50
let isRestoring = false

const cloneCanvasState = (state: WorkflowCanvasStateSnapshot): WorkflowCanvasStateSnapshot => {
  return JSON.parse(JSON.stringify(state)) as WorkflowCanvasStateSnapshot
}

/**
 * 保存当前状态到历史
 */
const saveToHistory = () => {
  if (isRestoring) return

  const state: WorkflowCanvasStateSnapshot = {
    nodes: cloneCanvasState({ nodes: nodes.value, edges: [] }).nodes,
    edges: cloneCanvasState({ nodes: [], edges: edges.value }).edges,
  }

  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  history.value.push(state)

  if (history.value.length > MAX_HISTORY) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

/**
 * 获取节点类型的默认数据
 */
const getDefaultNodeData = <T extends WorkflowNodeType>(type: T): WorkflowNodeDataMap[T] => {
  switch (type) {
    case 'text':
      return { content: '', label: '文本输入' } as WorkflowNodeDataMap[T]
    case 'imageConfig': {
      const model = getModelByName(getDefaultImageModelKey())
      return {
        prompt: '',
        model: getDefaultImageModelKey(),
        size: model?.defaultParams?.size || '1x1',
        quality: model?.defaultParams?.quality || 'standard',
        label: '文生图'
      } as WorkflowNodeDataMap[T]
    }
    case 'videoConfig': {
      const model = getModelByName(getDefaultVideoModelKey())
      return {
        prompt: '',
        ratio: model?.defaultParams?.ratio || '16x9',
        duration: model?.defaultParams?.duration || 5,
        model: getDefaultVideoModelKey(),
        label: '图生视频'
      } as WorkflowNodeDataMap[T]
    }
    case 'video':
      return { url: '', duration: 0, label: '视频节点' } as WorkflowNodeDataMap[T]
    case 'image':
      return { url: '', label: '图片节点' } as WorkflowNodeDataMap[T]
    case 'llmConfig':
      return {
        systemPrompt: '',
        model: getDefaultChatModelKey(),
        outputFormat: 'text',
        outputContent: '',
        label: 'LLM文本生成'
      } as WorkflowNodeDataMap[T]
    default:
      throw new Error(`不支持的节点类型: ${String(type)}`)
  }
}

// 添加节点
export const addNode = <T extends WorkflowNodeType>(
  type: T,
  position: WorkflowCanvasPosition = { x: 100, y: 100 },
  data: Partial<WorkflowNodeDataMap[T]> = {},
) => {
  const id = getNodeId()
  const now = Date.now()
  const nextNode: WorkflowCanvasNode<T> = {
    id,
    type,
    position,
    data: {
      ...getDefaultNodeData(type),
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    } as WorkflowNodeDataMap[T],
  }
  nodes.value = [...nodes.value, nextNode]
  saveToHistory()
  return id
}

// 更新节点数据
export const updateNode = (id: string, patch: WorkflowNodeUpdatePayload) => {
  const { position, zIndex, ...dataPatch } = patch
  nodes.value = nodes.value.map(node =>
    node.id === id ? {
      ...node,
      position: position || node.position,
      zIndex: zIndex ?? node.zIndex,
      data: {
        ...node.data,
        ...dataPatch,
      },
    } : node,
  )
}

// 删除节点
export const removeNode = (id: string) => {
  nodes.value = nodes.value.filter(node => node.id !== id)
  edges.value = edges.value.filter(edge => edge.source !== id && edge.target !== id)
  saveToHistory()
}

// 复制节点
export const duplicateNode = (id: string) => {
  const source = nodes.value.find(node => node.id === id)
  if (!source) return null

  const newId = getNodeId()
  const maxZ = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))

  nodes.value = [...nodes.value, {
    id: newId,
    type: source.type,
    position: { x: source.position.x + 50, y: source.position.y + 50 },
    data: { ...source.data },
    zIndex: maxZ + 1
  }]
  saveToHistory()
  return newId
}

export const addEdge = (params: WorkflowAddEdgeParams) => {
  const nextEdge: WorkflowCanvasEdge = {
    id: `edge_${params.source}_${params.target}`,
    ...params,
  }
  edges.value = [...edges.value, nextEdge]
  saveToHistory()
}

// 更新边数据
export const updateEdge = (id: string, patch: WorkflowEdgePatch) => {
  edges.value = edges.value.map(edge =>
    edge.id === id ? {
      ...edge,
      data: {
        ...(edge.data && typeof edge.data === 'object' ? edge.data : {}),
        ...(patch.data && typeof patch.data === 'object' ? patch.data : {}),
      },
    } : edge,
  )
  saveToHistory()
}

// 删除边
export const removeEdge = (id: string) => {
  edges.value = edges.value.filter(edge => edge.id !== id)
  saveToHistory()
}

// 清空画布
export const clearCanvas = () => {
  nodes.value = []
  edges.value = []
  nodeId = 0
}

// 更新视口
export const updateViewport = (viewport: typeof canvasViewport.value) => {
  canvasViewport.value = viewport
}

// 撤销
export const undo = () => {
  if (historyIndex.value <= 0) return false
  historyIndex.value--
  restoreState(history.value[historyIndex.value])
  return true
}

// 重做
export const redo = () => {
  if (historyIndex.value >= history.value.length - 1) return false
  historyIndex.value++
  restoreState(history.value[historyIndex.value])
  return true
}

const restoreState = (state: WorkflowCanvasStateSnapshot) => {
  isRestoring = true
  const nextState = cloneCanvasState(state)
  nodes.value = nextState.nodes
  edges.value = nextState.edges
  setTimeout(() => { isRestoring = false }, 100)
}

const syncNodeIdCounter = (canvasNodes: WorkflowCanvasNode[]) => {
  const maxNodeIndex = canvasNodes.reduce((maxValue, node) => {
    const matched = String(node.id || '').match(/^node_(\d+)$/)
    if (!matched) {
      return maxValue
    }

    const nextValue = Number(matched[1])
    return Number.isFinite(nextValue) ? Math.max(maxValue, nextValue) : maxValue
  }, -1)

  nodeId = maxNodeIndex + 1
}

// 直接应用外部读取到的画布快照，供工作流持久化加载使用。
export const applyCanvasSnapshot = (
  state: WorkflowCanvasStateSnapshot,
  viewportState?: WorkflowCanvasViewportSnapshot | null,
) => {
  const nextState = cloneCanvasState(state)
  nodes.value = nextState.nodes
  edges.value = nextState.edges
  syncNodeIdCounter(nextState.nodes)

  if (viewportState) {
    canvasViewport.value = {
      x: Number(viewportState.x || 0),
      y: Number(viewportState.y || 0),
      zoom: Number(viewportState.zoom || 1) || 1,
    }
  }

  initHistory()
}

export const canUndo = () => historyIndex.value > 0
export const canRedo = () => historyIndex.value < history.value.length - 1
export const manualSaveHistory = () => saveToHistory()

/**
 * 初始化画布（带示例数据）
 */
export const initSampleData = () => {
  clearCanvas()
  addNode('text', { x: 150, y: 150 }, {
    content: '一只金毛寻回犬在草地上奔跑，摇着尾巴，脸上带着快乐的表情。',
    label: '文本输入'
  })
  addNode('imageConfig', { x: 500, y: 150 }, { label: '文生图' })
  addEdge({
    source: 'node_0',
    target: 'node_1',
    sourceHandle: 'right',
    targetHandle: 'left'
  })
}

/**
 * 初始化历史（页面加载时调用）
 */
export const initHistory = () => {
  history.value = [{
    nodes: cloneCanvasState({ nodes: nodes.value, edges: [] }).nodes,
    edges: cloneCanvasState({ nodes: [], edges: edges.value }).edges,
  }]
  historyIndex.value = 0
}
