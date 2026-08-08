/**
 * 画布状态管理
 *
 * 管理节点、边、视口、背景、助手会话等所有"画布项目级"状态，
 * 并维护一份扩展过的撤销/重做历史栈：
 *
 *   - 快照单元覆盖 nodes / edges / viewport / backgroundMode / showImageInfo
 *     / chatSessions / activeChatId（与 infinite-canvas 对齐）
 *   - 通过 watch + 180ms 防抖自动入栈，所有 mutator 不必显式调用
 *   - 拖拽期间通过 pauseHistory / resumeHistory 暂停入栈，
 *     避免连续位置变化把历史撑满
 *   - 最大 50 条；序列化比对避免无意义重复入栈
 *   - canUndo / canRedo 暴露为 computed，模板里直接 :disabled="!canUndo"
 *
 * API 兼容性：addNode / addEdge / updateNode / updateEdge / removeNode / removeEdge /
 *   duplicateNode / undo / redo / applyCanvasSnapshot / manualSaveHistory /
 *   initHistory / initSampleData / updateViewport / clearCanvas 签名保持不变。
 *   新增：pauseHistory / resumeHistory / canvasBackgroundMode / canvasShowImageInfo /
 *   canvasChatSessions / canvasActiveChatId。
 */
import { computed, ref, watch } from 'vue'
import { getDefaultChatModelKey, getDefaultImageModelKey, getDefaultVideoModelKey, getModelByName } from '@/config/models'
import type { WorkflowCanvasPosition } from './workflow-orchestrator-types'
import workflowReferenceSample from '@/assets/workflow-reference-sample.svg'
import { resolveWorkflowNodeMenuTarget } from '@/shared/workflow-node-menu'
import type { WorkflowGenerationMetadata } from '@/shared/workflow-generation-metadata'

export type WorkflowBuiltinNodeType = 'text' | 'imageConfig' | 'videoConfig' | 'image' | 'video' | 'llmConfig' | 'director' | 'audio' | 'unknown'
/** 受信插件在主应用中只能使用这个命名空间，避免覆盖内置节点。 */
export type WorkflowPluginNodeType = `plugin:${string}`
export type WorkflowNodeType = WorkflowBuiltinNodeType | WorkflowPluginNodeType
export type WorkflowNodeAddMenuType = 'text' | 'image' | 'video' | 'director' | 'audio' | 'reference'

export interface WorkflowNodeDataBase {
  label?: string
  /** 节点绕中心旋转的角度（度）。画布层负责规范化到 -180 ~ 180。 */
  rotation?: number
  createdAt?: number
  updatedAt?: number
  loading?: boolean
  error?: string
  taskRecordId?: string
  /** 生成任务的结果写入状态；awaiting_confirmation 时结果仍只保留在服务端任务中。 */
  generationStatus?: 'running' | 'awaiting_confirmation' | 'completed' | 'discarded' | 'failed' | 'stopped'
  autoExecute?: boolean
  executed?: boolean
  outputNodeId?: string
  executionCancelToken?: number
  /** 生成结果的可审计参数；只含可展示和可重试字段，不含密钥。 */
  generationMeta?: WorkflowGenerationMetadata
  /** 从服务端素材库插入时保留资源可追溯信息。 */
  sourceAssetId?: string
  promptSourceId?: string
  source?: string
  tags?: string[]
}

export interface WorkflowTextNodeData extends WorkflowNodeDataBase {
  content: string
  polishModel?: string
  /** 文本字号，px。hover toolbar 通过 +/- 调节，默认 14 */
  fontSize?: number
}

export interface WorkflowImageConfigNodeData extends WorkflowNodeDataBase {
  prompt?: string
  model?: string
  size?: string
  quality?: string
  /** 单次生成图片数量；服务端和画布直连生成均限制在 1-4 张。 */
  batchCount?: number
}

export interface WorkflowVideoConfigNodeData extends WorkflowNodeDataBase {
  prompt?: string
  ratio?: string
  resolution?: string
  duration?: number
  model?: string
}

export interface WorkflowImageNodeData extends WorkflowNodeDataBase {
  url: string
  /** 作为画布主体引用，随工作流持久化并自动加入生成参考 */
  isSubject?: boolean
  base64?: string
  duration?: number
  /** 批量生图组首标记（节点内自渲染叠卡） */
  isBatchRoot?: boolean
  /** 组内子图列表（包含主图副本） */
  batchChildren?: Array<{ id: string; url: string }>
  /** 当前显示为主图的子图 id（指向 batchChildren 中的某项） */
  primaryImageId?: string
  /** 是否展开为网格视图（false=叠卡折叠，true=网格展开） */
  batchExpanded?: boolean
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

export interface WorkflowDirectorNodeData extends WorkflowNodeDataBase {
  brief: string
  shotPlan: string
  mode?: 'storyboard' | 'commercial' | 'short-video'
}

export interface WorkflowAudioNodeData extends WorkflowNodeDataBase {
  url: string
  fileName?: string
  transcript?: string
  duration?: number
}

/** 导入的远程插件节点在插件未启用时仍可安全地保留和导出。 */
export interface WorkflowUnknownNodeData extends WorkflowNodeDataBase {
  originalType?: string
  originalNode?: Record<string, unknown>
}

export interface WorkflowPluginNodeData extends WorkflowNodeDataBase {
  pluginId: string
  pluginNodeId: string
  pluginDescription?: string
  pluginColor?: string
  pluginVersion?: number
  [key: string]: unknown
}

export interface WorkflowNodeDataMap {
  text: WorkflowTextNodeData
  imageConfig: WorkflowImageConfigNodeData
  videoConfig: WorkflowVideoConfigNodeData
  image: WorkflowImageNodeData
  video: WorkflowVideoNodeData
  llmConfig: WorkflowLlmConfigNodeData
  director: WorkflowDirectorNodeData
  audio: WorkflowAudioNodeData
  unknown: WorkflowUnknownNodeData
}

export type WorkflowNodeDataFor<T extends WorkflowNodeType> = T extends keyof WorkflowNodeDataMap
  ? WorkflowNodeDataMap[T]
  : WorkflowPluginNodeData
export type WorkflowNodeData = WorkflowNodeDataFor<WorkflowNodeType>

export interface WorkflowCanvasNode<T extends WorkflowNodeType = WorkflowNodeType> {
  id: string
  type: T
  position: WorkflowCanvasPosition
  data: WorkflowNodeDataFor<T>
  zIndex?: number
  selected?: boolean
  /** 仅用于 Vue Flow 节点宿主的展示变量；业务数据仍以 data.rotation 为准。 */
  style?: Record<string, string | number>
}

export type WorkflowEdgeType = 'promptOrder' | 'imageOrder' | 'imageRole' | 'mediaRole'

export interface WorkflowPromptOrderEdgeData {
  promptOrder: number
}

export interface WorkflowImageOrderEdgeData {
  imageOrder: number
}

export interface WorkflowImageRoleEdgeData {
  imageRole: string
}

export interface WorkflowMediaRoleEdgeData {
  mediaRole: string
}

export type WorkflowEdgeData =
  | WorkflowPromptOrderEdgeData
  | WorkflowImageOrderEdgeData
  | WorkflowImageRoleEdgeData
  | WorkflowMediaRoleEdgeData
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

/** 画布背景模式（dots / lines / blank） */
export type WorkflowBackgroundMode = 'dots' | 'lines' | 'blank'

/** 助手会话快照（详细消息结构在 P3 useChatSessions 中定义，此处先用 unknown 保留位） */
export interface WorkflowAssistantSessionSnapshot {
  id: string
  title: string
  messages: unknown[]
  createdAt: number
  updatedAt: number
}

export interface WorkflowCanvasViewportSnapshot {
  x: number
  y: number
  zoom: number
}

/**
 * 画布快照单元（撤销/重做的最小颗粒）
 * viewport / backgroundMode / showImageInfo / chatSessions / activeChatId 都纳入历史。
 */
export interface WorkflowCanvasStateSnapshot {
  nodes: WorkflowCanvasNode[]
  edges: WorkflowCanvasEdge[]
  viewport?: WorkflowCanvasViewportSnapshot
  backgroundMode?: WorkflowBackgroundMode
  showImageInfo?: boolean
  chatSessions?: WorkflowAssistantSessionSnapshot[]
  activeChatId?: string | null
}

type WorkflowNodeUpdatePayload = Partial<WorkflowNodeData> & {
  position?: WorkflowCanvasPosition
  zIndex?: number
  /** 用于在节点状态切换时同步修正 Vue Flow 的可视尺寸。 */
  style?: Record<string, string | number>
}

const normalizeNodeRotation = (value: unknown): number => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const normalized = ((numeric % 360) + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}

const applyNodeRotationPresentation = <T extends WorkflowNodeType>(node: WorkflowCanvasNode<T>): WorkflowCanvasNode<T> => {
  const rotation = normalizeNodeRotation(node.data.rotation)
  return {
    ...node,
    data: {
      ...node.data,
      rotation,
    },
    // Vue Flow 的外层 transform 用于定位，不能被 rotate 覆盖；以 CSS 变量
    // 交给节点内容旋转，既保留拖拽定位，也让所有自定义节点共用同一表现。
    style: {
      ...node.style,
      '--canvas-node-rotation': `${rotation}deg`,
    },
  }
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

export interface WorkflowConnectionValidationResult {
  valid: boolean
  message?: string
}

// 节点 ID 计数器
let nodeId = 0
const getNodeId = () => `node_${nodeId++}`

// === 画布数据状态 ===
export const nodes = ref<WorkflowCanvasNode[]>([])
export const edges = ref<WorkflowCanvasEdge[]>([])
export const canvasViewport = ref<WorkflowCanvasViewportSnapshot>({ x: 100, y: 50, zoom: 0.8 })

// 画布外观（迁移自 infinite-canvas，纳入历史快照）
export const canvasBackgroundMode = ref<WorkflowBackgroundMode>('dots')
export const canvasShowImageInfo = ref<boolean>(false)

// 助手会话（P3 实现 useChatSessions 时会读写这两个字段，先建好位）
export const canvasChatSessions = ref<WorkflowAssistantSessionSnapshot[]>([])
export const canvasActiveChatId = ref<string | null>(null)

// === 撤销/重做历史栈 ===
const history = ref<WorkflowCanvasStateSnapshot[]>([])
const historyIndex = ref(-1)
const MAX_HISTORY = 50
const HISTORY_DEBOUNCE_MS = 180

let isRestoring = false
let historyPaused = false
let pendingHistoryTimer: ReturnType<typeof setTimeout> | null = null
// 缓存上次入栈的序列化结果，跳过完全相同的"无意义入栈"
let lastSerializedSnapshot = ''

const cloneCanvasState = (state: WorkflowCanvasStateSnapshot): WorkflowCanvasStateSnapshot => {
  return JSON.parse(JSON.stringify(state)) as WorkflowCanvasStateSnapshot
}

const captureSnapshot = (): WorkflowCanvasStateSnapshot => ({
  nodes: nodes.value,
  edges: edges.value,
  viewport: { ...canvasViewport.value },
  backgroundMode: canvasBackgroundMode.value,
  showImageInfo: canvasShowImageInfo.value,
  chatSessions: canvasChatSessions.value,
  activeChatId: canvasActiveChatId.value,
})

const commitHistory = () => {
  pendingHistoryTimer = null
  if (isRestoring || historyPaused) return

  const raw = captureSnapshot()
  const serialized = JSON.stringify(raw)
  if (serialized === lastSerializedSnapshot) return
  lastSerializedSnapshot = serialized

  const state = cloneCanvasState(raw)

  // 用户在中段 undo 后再做新操作 → 截断 future
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  history.value.push(state)

  if (history.value.length > MAX_HISTORY) {
    history.value.splice(0, history.value.length - MAX_HISTORY)
  }
  historyIndex.value = history.value.length - 1
}

/** 入栈（带 180ms 防抖；拖拽期间被 pause 时跳过） */
const saveToHistory = () => {
  if (isRestoring || historyPaused) return
  if (pendingHistoryTimer) clearTimeout(pendingHistoryTimer)
  pendingHistoryTimer = setTimeout(commitHistory, HISTORY_DEBOUNCE_MS)
}

/**
 * 暂停入栈（典型用法：节点拖拽 onNodeDragStart 时调用）
 * 暂停期间所有变化都不会入栈；与 resumeHistory 配对使用。
 */
export const pauseHistory = () => {
  historyPaused = true
  if (pendingHistoryTimer) {
    clearTimeout(pendingHistoryTimer)
    pendingHistoryTimer = null
  }
}

/**
 * 恢复入栈
 * @param commitNow 默认 true，恢复时立即提交一次（典型：拖拽结束把最终位置作为 1 条历史）
 */
export const resumeHistory = (commitNow = true) => {
  historyPaused = false
  if (commitNow) commitHistory()
}

// 监听所有纳入快照的字段，自动防抖入栈（mutator 不必再显式调用 saveToHistory）
watch(
  [nodes, edges, canvasViewport, canvasBackgroundMode, canvasShowImageInfo, canvasChatSessions, canvasActiveChatId],
  () => saveToHistory(),
  { deep: true },
)

/**
 * 获取节点类型的默认数据
 */
const getDefaultNodeData = <T extends WorkflowBuiltinNodeType>(type: T): WorkflowNodeDataMap[T] => {
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
        batchCount: 1,
        label: '文生图'
      } as WorkflowNodeDataMap[T]
    }
    case 'videoConfig': {
      const model = getModelByName(getDefaultVideoModelKey())
      return {
        prompt: '',
        ratio: model?.defaultParams?.ratio || '16x9',
        resolution: String(model?.defaultParams?.quality || '720p'),
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
    case 'director':
      return {
        brief: '',
        shotPlan: '',
        mode: 'storyboard',
        label: '导演台',
      } as WorkflowNodeDataMap[T]
    case 'audio':
      return {
        url: '',
        transcript: '',
        duration: 0,
        label: '音频节点',
      } as WorkflowNodeDataMap[T]
    case 'unknown':
      return { label: '未安装的插件节点' } as WorkflowNodeDataMap[T]
    default:
      throw new Error(`不支持的节点类型: ${String(type)}`)
  }
}

// 添加节点
export const addNode = <T extends WorkflowBuiltinNodeType>(
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
    } as WorkflowNodeDataFor<T>,
  }
  nodes.value = [...nodes.value, applyNodeRotationPresentation(nextNode)]
  // 入栈由全局 watch 防抖触发，无需显式调用
  return id
}

/** 插件节点由宿主创建，永远附带归属信息；插件脚本不能直接写入 nodes。 */
export const addPluginNode = (
  type: WorkflowPluginNodeType,
  position: WorkflowCanvasPosition,
  data: WorkflowPluginNodeData,
) => {
  const id = getNodeId()
  const now = Date.now()
  const nextNode: WorkflowCanvasNode = {
    id,
    type,
    position,
    data: { ...data, createdAt: data.createdAt || now, updatedAt: data.updatedAt || now },
  }
  nodes.value = [...nodes.value, applyNodeRotationPresentation(nextNode)]
  return id
}

// 更新节点数据
export const updateNode = (id: string, patch: WorkflowNodeUpdatePayload) => {
  const { position, zIndex, style, ...dataPatch } = patch
  nodes.value = nodes.value.map(node =>
    node.id === id
      ? applyNodeRotationPresentation({
          ...node,
          position: position || node.position,
          zIndex: zIndex ?? node.zIndex,
          style: style ? { ...node.style, ...style } : node.style,
          data: {
            ...node.data,
            ...dataPatch,
          },
        })
      : node,
  )
  // 拖拽位置变更也通过 watch 入栈（拖拽中由调用方 pauseHistory，结束 resumeHistory）
}

// 删除节点
export const removeNode = (id: string) => {
  nodes.value = nodes.value.filter(node => node.id !== id)
  edges.value = edges.value.filter(edge => edge.source !== id && edge.target !== id)
}

// 复制节点
export const duplicateNode = (id: string) => {
  const source = nodes.value.find(node => node.id === id)
  if (!source) return null

  const newId = getNodeId()
  const maxZ = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))

  const nextNode: WorkflowCanvasNode = {
    id: newId,
    type: source.type,
    position: { x: source.position.x + 50, y: source.position.y + 50 },
    data: { ...source.data },
    zIndex: maxZ + 1,
  }
  nodes.value = [...nodes.value, applyNodeRotationPresentation(nextNode)]
  return newId
}

/**
 * 批量旋转当前选中的节点。旋转属于节点数据，自动进入版本快照和撤销历史。
 * 返回实际变换的节点数，便于 UI 在空选区时保持静默。
 */
export const rotateNodes = (nodeIds: Iterable<string>, delta: number): number => {
  const ids = new Set(nodeIds)
  const step = Number(delta)
  if (!ids.size || !Number.isFinite(step) || step === 0) return 0

  let changed = 0
  nodes.value = nodes.value.map((node) => {
    if (!ids.has(node.id)) return node
    changed += 1
    return applyNodeRotationPresentation({
      ...node,
      data: {
        ...node.data,
        rotation: normalizeNodeRotation(normalizeNodeRotation(node.data.rotation) + step),
      },
    })
  })
  return changed
}

/** 将一组节点归正到 0°，用于右键菜单的“重置旋转”。 */
export const resetNodeRotation = (nodeIds: Iterable<string>): number => {
  const ids = new Set(nodeIds)
  if (!ids.size) return 0

  let changed = 0
  nodes.value = nodes.value.map((node) => {
    if (!ids.has(node.id) || normalizeNodeRotation(node.data.rotation) === 0) return node
    changed += 1
    return applyNodeRotationPresentation({
      ...node,
      data: { ...node.data, rotation: 0 },
    })
  })
  return changed
}

const wouldCreateCycle = (source: string, target: string) => {
  const outgoing = new Map<string, string[]>()
  edges.value.forEach((edge) => {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target])
  })

  const pending = [target]
  const visited = new Set<string>()
  while (pending.length) {
    const current = pending.pop()!
    if (current === source) return true
    if (visited.has(current)) continue
    visited.add(current)
    pending.push(...(outgoing.get(current) || []))
  }
  return false
}

export const validateWorkflowConnection = (params: WorkflowAddEdgeParams): WorkflowConnectionValidationResult => {
  if (!params.source || !params.target) {
    return { valid: false, message: '连接缺少起点或终点' }
  }
  if (params.source === params.target) {
    return { valid: false, message: '节点不能连接到自身' }
  }
  if (!nodes.value.some(node => node.id === params.source) || !nodes.value.some(node => node.id === params.target)) {
    return { valid: false, message: '连接的节点不存在' }
  }
  const duplicated = edges.value.some(edge =>
    edge.source === params.source
    && edge.target === params.target
    && (edge.sourceHandle || undefined) === (params.sourceHandle || undefined)
    && (edge.targetHandle || undefined) === (params.targetHandle || undefined),
  )
  if (duplicated) {
    return { valid: false, message: '相同节点之间已经存在连接' }
  }
  if (wouldCreateCycle(params.source, params.target)) {
    return { valid: false, message: '当前工作流不允许形成循环依赖' }
  }
  return { valid: true }
}

export const addEdge = (params: WorkflowAddEdgeParams) => {
  const validation = validateWorkflowConnection(params)
  if (!validation.valid) return null
  const nextEdge: WorkflowCanvasEdge = {
    id: `edge_${params.source}_${params.target}`,
    ...params,
  }
  edges.value = [...edges.value, nextEdge]
  return nextEdge.id
}

/** 按节点类型补齐连线语义，供拖拽连线和节点外侧加号复用。 */
export const addTypedWorkflowEdge = (params: WorkflowAddEdgeParams) => {
  const sourceNode = nodes.value.find(node => node.id === params.source)
  const targetNode = nodes.value.find(node => node.id === params.target)

  if (sourceNode?.type === 'text' && targetNode?.type === 'imageConfig') {
    const promptOrder = edges.value.filter(edge => edge.target === params.target && edge.type === 'promptOrder').length + 1
    return addEdge({ ...params, type: 'promptOrder', data: { promptOrder } })
  }
  if (sourceNode?.type === 'image' && targetNode?.type === 'imageConfig') {
    const imageOrder = edges.value.filter(edge => edge.target === params.target && edge.type === 'imageOrder').length + 1
    return addEdge({ ...params, type: 'imageOrder', data: { imageOrder } })
  }
  if (sourceNode?.type === 'image' && targetNode?.type === 'videoConfig') {
    return addEdge({ ...params, type: 'mediaRole', data: { mediaRole: 'first_frame' } })
  }
  if (sourceNode?.type === 'video' && targetNode?.type === 'videoConfig') {
    return addEdge({ ...params, type: 'mediaRole', data: { mediaRole: 'video_reference' } })
  }
  if (sourceNode?.type === 'audio' && targetNode?.type === 'videoConfig') {
    return addEdge({ ...params, type: 'mediaRole', data: { mediaRole: 'audio_reference' } })
  }
  if (sourceNode?.type === 'text' && targetNode?.type === 'videoConfig') {
    return addEdge({ ...params, type: 'promptOrder', data: { promptOrder: 1 } })
  }
  return addEdge(params)
}

/** 参考站左右加号：按菜单类型创建真实节点，并立即连线。 */
export const addConnectedWorkflowNode = (
  anchorId: string,
  side: 'left' | 'right',
  menuType: WorkflowNodeAddMenuType,
) => {
  const anchor = nodes.value.find(node => node.id === anchorId)
  if (!anchor) return null

  const { nodeType, label } = resolveWorkflowNodeMenuTarget(menuType)
  const id = addNode(nodeType, {
    x: anchor.position.x + (side === 'right' ? 440 : -440),
    y: anchor.position.y,
  }, { label } as Partial<WorkflowNodeDataMap[typeof nodeType]>)
  const source = side === 'right' ? anchorId : id
  const target = side === 'right' ? id : anchorId
  const edgeId = addTypedWorkflowEdge({ source, target, sourceHandle: 'right', targetHandle: 'left' })
  if (!edgeId) {
    removeNode(id)
    return null
  }
  return id
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
}

// 删除边
export const removeEdge = (id: string) => {
  edges.value = edges.value.filter(edge => edge.id !== id)
}

// 清空画布
export const clearCanvas = () => {
  nodes.value = []
  edges.value = []
  nodeId = 0
}

// 更新视口（频繁触发，依赖防抖合并）
export const updateViewport = (viewport: WorkflowCanvasViewportSnapshot) => {
  canvasViewport.value = viewport
}

// 撤销
export const undo = (): boolean => {
  if (historyIndex.value <= 0) return false
  historyIndex.value--
  restoreState(history.value[historyIndex.value])
  return true
}

// 重做
export const redo = (): boolean => {
  if (historyIndex.value >= history.value.length - 1) return false
  historyIndex.value++
  restoreState(history.value[historyIndex.value])
  return true
}

const restoreState = (state: WorkflowCanvasStateSnapshot) => {
  isRestoring = true
  const nextState = cloneCanvasState(state)
  nodes.value = nextState.nodes.map(node => applyNodeRotationPresentation(node))
  edges.value = nextState.edges
  if (nextState.viewport) canvasViewport.value = { ...nextState.viewport }
  if (nextState.backgroundMode !== undefined) canvasBackgroundMode.value = nextState.backgroundMode
  if (nextState.showImageInfo !== undefined) canvasShowImageInfo.value = nextState.showImageInfo
  if (nextState.chatSessions !== undefined) canvasChatSessions.value = nextState.chatSessions
  if (nextState.activeChatId !== undefined) canvasActiveChatId.value = nextState.activeChatId
  // 同步 lastSerialized，避免 restore 后 watch 把同一状态再入一次栈
  lastSerializedSnapshot = JSON.stringify(captureSnapshot())
  // 等 watch microtask 跑完再解锁
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
  isRestoring = true
  nodes.value = nextState.nodes.map(node => applyNodeRotationPresentation(node))
  edges.value = nextState.edges
  syncNodeIdCounter(nodes.value)

  if (viewportState) {
    canvasViewport.value = {
      x: Number(viewportState.x || 0),
      y: Number(viewportState.y || 0),
      zoom: Number(viewportState.zoom || 1) || 1,
    }
  } else if (nextState.viewport) {
    canvasViewport.value = { ...nextState.viewport }
  }

  if (nextState.backgroundMode !== undefined) canvasBackgroundMode.value = nextState.backgroundMode
  if (nextState.showImageInfo !== undefined) canvasShowImageInfo.value = nextState.showImageInfo
  if (nextState.chatSessions !== undefined) canvasChatSessions.value = nextState.chatSessions
  if (nextState.activeChatId !== undefined) canvasActiveChatId.value = nextState.activeChatId

  setTimeout(() => { isRestoring = false }, 100)
  initHistory()
}

/** 撤销可用性（响应式 computed，模板用 :disabled="!canUndo"） */
export const canUndo = computed(() => historyIndex.value > 0)
/** 重做可用性（响应式 computed） */
export const canRedo = computed(() => historyIndex.value < history.value.length - 1)

/** 手动立即入栈（不防抖），用于显式提交场景 */
export const manualSaveHistory = () => {
  if (isRestoring || historyPaused) return
  if (pendingHistoryTimer) {
    clearTimeout(pendingHistoryTimer)
    pendingHistoryTimer = null
  }
  commitHistory()
}

/**
 * 初始化画布（带示例数据）
 */
export const initSampleData = () => {
  clearCanvas()
  const sourceId = addNode('image', { x: 115, y: 45 }, {
    url: workflowReferenceSample,
    label: '图片节点',
  })
  const targetId = addNode('image', { x: 812, y: 155 }, { label: 'Image' })
  addEdge({
    source: sourceId,
    target: targetId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })
}

/**
 * 初始化历史（页面加载/重置时调用，把当前状态作为唯一基线）
 */
export const initHistory = () => {
  // 取消潜在的 pending 入栈
  if (pendingHistoryTimer) {
    clearTimeout(pendingHistoryTimer)
    pendingHistoryTimer = null
  }
  const baseline = cloneCanvasState(captureSnapshot())
  history.value = [baseline]
  historyIndex.value = 0
  lastSerializedSnapshot = JSON.stringify(baseline)
}
