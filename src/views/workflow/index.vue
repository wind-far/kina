<script setup lang="ts">
/**
 * 工作流主页面
 * 基于 Vue Flow 的节点连线工作流画布
 */
import { computed, ref, watch, onMounted, onUnmounted, nextTick, markRaw, reactive } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VueFlow, useVueFlow, SelectionMode, type Connection, type NodeMouseEvent, type NodeTypesObject } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { useAsyncAction, useShortcut } from '@/composables'
import { useLoadingStore } from '@/stores/loading'
import {
  nodes, edges, addNode, addEdge, updateNode, applyCanvasSnapshot,
  canvasViewport, updateViewport,
  undo, redo, canUndo, canRedo, manualSaveHistory, initSampleData, initHistory,
  pauseHistory, resumeHistory,
  rotateNodes, resetNodeRotation,
  validateWorkflowConnection,
  addPluginNode,
  type WorkflowAddEdgeParams,
  type WorkflowCanvasEdge,
  type WorkflowBuiltinNodeType,
  type WorkflowNodeType,
  type WorkflowPluginNodeData,
} from './composables/useWorkflowCanvas'
import { WORKFLOW_TEMPLATES } from './config/workflows'
import { useWorkflowPersistence } from './composables/useWorkflowPersistence'
import type { WorkflowDefinitionSummary } from './api/definitions'
import { rollbackWorkflowDefinitionVersion, updateWorkflowDefinition } from './api/definitions'
import {
  exportCanvasProject as exportCanvasProjectFile,
  exportCanvasProjectSelection as exportCanvasProjectSelectionFile,
  importCanvasProject as importCanvasProjectFile,
  importCanvasProjectArchive as importCanvasProjectArchiveFile,
  recordCanvasAssistantApplication,
  startCanvasAssistantTask,
  type CanvasAssistantPreviewOperation,
} from './api/canvas-projects'
import { parseCanvasAssistantProposal, type CanvasAssistantProposal } from '@/shared/canvas-assistant-proposal'
import { subscribeGenerationTaskEvents } from '@/api/generation-tasks'
import type { WorkflowCanvasPosition } from './composables/workflow-orchestrator-types'
import {
  getWorkflowExecutionPlan,
  type WorkflowExecutionProgress,
} from './composables/workflow-execution-engine'
import {
  createWorkflowRun,
  getLatestWorkflowRun,
  retryWorkflowRun,
  stopWorkflowRun,
  type WorkflowRunDetail,
} from './api/runs'

// 节点组件
import TextNode from './components/nodes/TextNode.vue'
import ImageConfigNode from './components/nodes/ImageConfigNode.vue'
import ImageNode from './components/nodes/ImageNode.vue'
import VideoConfigNode from './components/nodes/VideoConfigNode.vue'
import VideoNode from './components/nodes/VideoNode.vue'
import LlmConfigNode from './components/nodes/LlmConfigNode.vue'
import DirectorNode from './components/nodes/DirectorNode.vue'
import AudioNode from './components/nodes/AudioNode.vue'
import UnknownNode from './components/nodes/UnknownNode.vue'
import PluginNode from './components/nodes/PluginNode.vue'
import CanvasPluginHost from './components/CanvasPluginHost.vue'
import CanvasPluginManager from './components/CanvasPluginManager.vue'
import CanvasPromptLibrary from './components/CanvasPromptLibrary.vue'
import CanvasAssetLibrary from './components/CanvasAssetLibrary.vue'
import AgentFab from './components/AgentFab.vue'

// 边组件
import ImageRoleEdge from './components/edges/ImageRoleEdge.vue'
import PromptOrderEdge from './components/edges/PromptOrderEdge.vue'
import ImageOrderEdge from './components/edges/ImageOrderEdge.vue'
import CanvasDefaultEdge from '@/components/canvas/CanvasDefaultEdge.vue'

// 画布壳（infinite-canvas → canana-vue 迁移产物）
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'
import CanvasZoomControls from '@/components/canvas/CanvasZoomControls.vue'
import CanvasMiniMap from '@/components/canvas/CanvasMiniMap.vue'
import CanvasConnectionLine from '@/components/canvas/CanvasConnectionLine.vue'
import WorkflowPromptInput, {
  type WorkflowPromptModelOption,
  type WorkflowPromptReference,
  type WorkflowPromptSendOptions,
} from '@/components/canvas/WorkflowPromptInput.vue'
import {
  getWorkflowPromptAvailableReferenceSlots,
  mergeWorkflowPromptReferences,
  workflowPromptFileToDataUrl,
} from '@/shared/workflow-prompt-references'
import { resolveWorkflowPromptImageParameters } from '@/shared/workflow-prompt-image-parameters'
import {
  isWorkflowPromptAnchorNodeType,
  shouldDismissWorkflowPromptDock,
} from '@/shared/workflow-prompt-visibility'
import { resolveWorkflowVideoReferenceRole } from '@/shared/workflow-video-prompt'
import { buildCanvasAssistantSessionSource } from '@/shared/canvas-assistant-session'
import { formatCanvasImportMigrationReport } from '@/shared/canvas-import-report'
import { createWorkflowImageBatchChildren } from '@/shared/workflow-image-batch'
import { isWorkflowGenerationMetadata, buildWorkflowGenerationMetadata } from '@/shared/workflow-generation-metadata'
import {
  CANVAS_GENERATION_CONFIRMED_EVENT,
  confirmCanvasGenerationResult,
  notifyCanvasGenerationResultConfirmed,
  type CanvasGenerationConfirmedDetail,
} from '@/shared/canvas-generation-confirmation'
import {
  buildCanvasPluginGenerationNodeData,
  buildCanvasPluginGenerationPendingNodeData,
  buildCanvasPluginGenerationTerminalNodeData,
  canvasPluginNodeType,
  isCanvasPluginNodeType,
  type CanvasPluginActionContribution,
  type CanvasPluginNodeContribution,
  type CanvasPluginRuntimeContributions,
} from '@/shared/canvas-plugin-runtime'
import { collectWorkflowAssistantContext } from '@/shared/workflow-assistant-context'
import {
  collectWorkflowSubjectReferences,
  isWorkflowSubjectNode,
  resolveWorkflowReferenceUrl,
} from '@/shared/workflow-subject-references'
import RightPanel from '@components/canana/RightPanel.vue'
import { useChatSessions } from '@/composables/useChatSessions'
import { useAuthStore } from '@/stores/auth'
import { useCanvasSelection } from '@/composables/useCanvasSelection'
import { useCanvasClipboard } from '@/composables/useCanvasClipboard'
import { useCanvasDrop } from '@/composables/useCanvasDrop'
import type { PersistedAssetItem } from '@/api/asset-items'
import {
  canvasBackgroundMode,
  removeNode,
  duplicateNode,
  clearCanvas,
} from './composables/useWorkflowCanvas'
import type { ContextMenuItem, ContextMenuPosition } from '@/types/canvas-interaction'
import {
  getAllImageModels,
  getAllVideoModels,
  getDefaultImageModelKey,
  getDefaultVideoModelKey,
  loadPublicModelCatalog,
  SEEDREAM_SIZE_OPTIONS,
} from '@/config/models'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
// /canvas 是账号级无限画布，/workflow 保持原有工作流语义和历史链接兼容。
const workspaceScene = computed(() => route.path === '/canvas' ? 'INFINITE_CANVAS' : 'WORKFLOW_CANVAS')
const { viewport, zoomIn, zoomOut, fitView, updateNodeInternals, screenToFlowCoordinate, setState } = useVueFlow()

// 注册自定义节点类型
const nodeTypes = reactive({
  text: markRaw(TextNode),
  imageConfig: markRaw(ImageConfigNode),
  image: markRaw(ImageNode),
  videoConfig: markRaw(VideoConfigNode),
  video: markRaw(VideoNode),
  llmConfig: markRaw(LlmConfigNode),
  director: markRaw(DirectorNode),
  audio: markRaw(AudioNode),
  unknown: markRaw(UnknownNode),
} as Record<string, any>) as NodeTypesObject

// 注册自定义边类型
const edgeTypes = {
  default: markRaw(CanvasDefaultEdge),
  imageRole: markRaw(ImageRoleEdge),
  promptOrder: markRaw(PromptOrderEdge),
  imageOrder: markRaw(ImageOrderEdge),
} as any

// 工作流持久化
const {
  currentWorkflowId,
  currentWorkflowDetail,
  workflowList,
  reloadWorkflowList,
  fetchWorkflowDetail,
  loadWorkflowDetail,
  applyWorkflowVersionToCanvas,
  saveWorkflow,
  autosaveWorkflow,
  resetCurrentWorkflowState,
} = useWorkflowPersistence()

// UI 状态
const showNodeMenu = ref(false)
const showTemplatePanel = ref(false)
const showPromptLibrary = ref(false)
const showCanvasAssetLibrary = ref(false)
const showCanvasPluginManager = ref(false)
const canvasAssistantStreaming = ref(false)
const canvasAssistantStreamContent = ref('')
const canvasAssistantStreamTaskId = ref('')
const canvasAssistantStreamController = ref<AbortController | null>(null)
const canvasPluginHostVersion = ref(0)
const canvasPluginHost = ref<null | {
  invoke: (input: { pluginId: string; scope: 'toolbar' | 'inspector' | 'generation'; actionId: string; nodeId?: string }) => boolean
  retryGeneration: (input: { pluginId: string; nodeId: string; templateId: string; prompt: string; referenceImages?: string[] }) => boolean
}>(null)
const canvasPluginRegistrations = ref<Record<string, { slug: string; contributions: CanvasPluginRuntimeContributions }>>({})
const showWorkflowLibraryPanel = ref(false)
const canvasImportFileInput = ref<HTMLInputElement | null>(null)
const canvasSnapToGrid = ref(true)
const canvasAlignmentGuides = ref(true)
const workflowName = ref('')
const workflowCode = ref('')
const workflowDescription = ref('')
const workflowCategory = ref('')
const workflowListKeyword = ref('')
const workflowLoadingByRoute = ref(false)
const promptAnchorNodeId = ref('')
const promptAnchorLastNodeClickAt = ref(0)
const initialCanvasBaselineSnapshot = ref('')
const selectedWorkflowVersionId = ref('')
const selectedLibraryWorkflowId = ref('')
const selectedLibraryWorkflowDetail = ref<null | {
  definition: WorkflowDefinitionSummary
  versions: Array<{
    id: string
    workflowId: string
    createdBy: string | null
    versionNo: number
    versionName: string | null
    changeSummary: string | null
    status: string
    definitionJson: unknown
    nodesJson: unknown
    edgesJson: unknown
    viewportJson: unknown
    inputSchemaJson: unknown
    outputSchemaJson: unknown
    runtimeConfigJson: unknown
    publishedAt: string | null
    createdAt: string
    updatedAt: string
  }>
}>(null)
const autosaveTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const autosaveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const autosaveErrorMessage = ref('')
const autosaveReady = ref(false)
const autosaveInFlight = ref<Promise<void> | null>(null)
const workflowRunning = ref(false)
const workflowExecutionProgress = ref<WorkflowExecutionProgress | null>(null)
const workflowStopping = ref(false)
const latestWorkflowRun = ref<WorkflowRunDetail | null>(null)
const activeWorkflowRunId = ref('')
const showWorkflowRunDetail = ref(false)
const workflowRunPollTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// 头部标题重命名
const renamingTitle = ref(false)
const renameTitleInput = ref('')

interface WorkflowTemplateNode {
  id: string
  type: WorkflowBuiltinNodeType
  position: WorkflowCanvasPosition
  data: Record<string, unknown>
  newId?: string
}

interface WorkflowTemplateDefinition {
  createNodes: (startPosition: WorkflowCanvasPosition) => {
    nodes: WorkflowTemplateNode[]
    edges: WorkflowCanvasEdge[]
  }
}

interface WorkflowNodeOption {
  type: WorkflowNodeType
  name: string
  color: string
  icon: string
}

const currentWorkflowTitle = computed(() => {
  return currentWorkflowDetail.value?.definition?.name || workflowName.value || '未命名项目'
})
// 无限画布的云端助手会话按项目隔离；普通工作流继续使用原有公共助手来源。
const assistantSessionSource = computed(() => workspaceScene.value === 'INFINITE_CANVAS'
  ? buildCanvasAssistantSessionSource(currentWorkflowId.value)
  : 'canvas-assistant')
const canvasPluginSnapshot = computed(() => ({
  nodes: nodes.value,
  edges: edges.value,
  viewport: canvasViewport.value,
  scene: workspaceScene.value,
}))

const registeredPluginNodes = computed(() => Object.entries(canvasPluginRegistrations.value).flatMap(([pluginId, entry]) => entry.contributions.nodes.map(node => ({ pluginId, slug: entry.slug, node }))))
const registeredPluginActions = computed(() => Object.entries(canvasPluginRegistrations.value).flatMap(([pluginId, entry]) => ([
  ...entry.contributions.toolbar.map(action => ({ pluginId, slug: entry.slug, scope: 'toolbar' as const, action })),
  ...entry.contributions.generation.map(action => ({ pluginId, slug: entry.slug, scope: 'generation' as const, action })),
])))
const selectedPluginNode = computed(() => nodes.value.find(node => node.selected && isCanvasPluginNodeType(node.type)) || null)
const registeredPluginInspectorActions = computed(() => {
  const node = selectedPluginNode.value
  if (!node) return []
  const pluginId = String((node.data as Record<string, unknown>).pluginId || '')
  const entry = canvasPluginRegistrations.value[pluginId]
  return entry ? entry.contributions.inspectors.map(action => ({ pluginId, slug: entry.slug, scope: 'inspector' as const, action, nodeId: node.id })) : []
})
const selectedPluginGenerationRetry = computed(() => {
  const node = selectedPluginNode.value
  if (!node) return null
  const data = node.data as Record<string, unknown>
  const pluginId = String(data.pluginId || '')
  const templateId = String(data.generationTemplateId || '')
  const retry = data.generationRetry && typeof data.generationRetry === 'object' && !Array.isArray(data.generationRetry)
    ? data.generationRetry as Record<string, unknown>
    : null
  const prompt = String(retry?.prompt || '').trim()
  const entry = canvasPluginRegistrations.value[pluginId]
  const action = entry?.contributions.generation.find(item => item.id === templateId && item.resultNodeId === String(data.pluginNodeId || ''))
  if (!entry || !action || !prompt) return null
  const referenceImages = Array.isArray(retry?.referenceImages) ? retry.referenceImages.map(String).filter(url => url.startsWith('/uploads/')).slice(0, 4) : []
  return { pluginId, nodeId: node.id, templateId, prompt, referenceImages, action }
})

const handleCanvasPluginRegistration = (registration: { pluginId: string; slug: string; contributions: CanvasPluginRuntimeContributions }) => {
  canvasPluginRegistrations.value = {
    ...canvasPluginRegistrations.value,
    [registration.pluginId]: { slug: registration.slug, contributions: registration.contributions },
  }
  registration.contributions.nodes.forEach(node => {
    // Vue Flow 的 NodeComponent 声明要求完整 NodeProps；运行时会注入这些 props。
    nodeTypes[canvasPluginNodeType(registration.slug, node.id)] = markRaw(PluginNode) as any
  })
  void nextTick(() => updateNodeInternals(nodes.value.filter(node => isCanvasPluginNodeType(node.type)).map(node => node.id)))
}

const resetCanvasPluginRegistrations = () => {
  Object.values(canvasPluginRegistrations.value).forEach(entry => {
    entry.contributions.nodes.forEach(node => {
      // 停用/卸载后仍用占位节点展示，确保项目数据可恢复、不会被静默删除。
      nodeTypes[canvasPluginNodeType(entry.slug, node.id)] = markRaw(UnknownNode) as any
    })
  })
  canvasPluginRegistrations.value = {}
}

/**
 * 版本快照可能在插件尚未安装时先于 iframe 宿主加载。此时仍需把插件命名空间
 * 节点渲染成安全的占位节点；插件完成登记后会由 handleCanvasPluginRegistration
 * 原位替换为 PluginNode，节点原始类型和数据始终不改写。
 */
const refreshCanvasPluginNodeTypes = () => {
  const registeredTypes = new Set(Object.values(canvasPluginRegistrations.value).flatMap(entry => (
    entry.contributions.nodes.map(node => canvasPluginNodeType(entry.slug, node.id))
  )))
  nodes.value
    .filter(node => isCanvasPluginNodeType(node.type))
    .forEach(node => {
      nodeTypes[node.type] = markRaw(registeredTypes.has(node.type)
        ? PluginNode
        : UnknownNode) as any
    })
}

watch(
  [
    () => nodes.value.map(node => node.type).filter(isCanvasPluginNodeType).join('|'),
    canvasPluginRegistrations,
  ],
  refreshCanvasPluginNodeTypes,
  { immediate: true },
)

const findRegisteredPluginNode = (pluginId: string, type: unknown) => {
  const entry = canvasPluginRegistrations.value[pluginId]
  const typeValue = String(type || '')
  return entry?.contributions.nodes.find(node => canvasPluginNodeType(entry.slug, node.id) === typeValue) || null
}

const invokeCanvasPluginAction = (input: { pluginId: string; scope: 'toolbar' | 'inspector' | 'generation'; action: CanvasPluginActionContribution; nodeId?: string }) => {
  if (!canvasPluginHost.value?.invoke({ pluginId: input.pluginId, scope: input.scope, actionId: input.action.id, nodeId: input.nodeId })) {
    ElMessage.warning('插件动作尚未就绪，请稍后再试。')
  }
}

const retrySelectedPluginGeneration = async () => {
  const retry = selectedPluginGenerationRetry.value
  if (!retry) return
  try {
    await ElMessageBox.confirm('将按此节点保存的受限模板、提示词和参考素材重新生成。新结果仍需确认后才会覆盖节点。', '重试插件生成', {
      confirmButtonText: '重新生成', cancelButtonText: '取消', type: 'info',
    })
    if (!canvasPluginHost.value?.retryGeneration(retry)) {
      ElMessage.warning('插件生成能力尚未就绪，请稍后再试。')
      return
    }
    ElMessage.success('已按保存的受限模板重新发起生成。')
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '插件生成重试暂时不可用')
  }
}

const handleCanvasPluginProposal = async (proposal: { pluginId: string; operations: unknown[] }) => {
  if (workspaceScene.value !== 'INFINITE_CANVAS') {
    ElMessage.warning('当前不是无限画布项目，不能应用插件操作。')
    return
  }
  try {
    await applyCanvasPluginProposal(proposal)
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.warning(error?.message || '插件提交了不受支持的画布操作，已拒绝。')
  }
}

/** 用户已经确认重试后，才将新任务身份写入所属节点；刷新可据此重新订阅 SSE。 */
const handleCanvasPluginGenerationStarted = (result: { pluginId: string; resultNodeId: string; targetNodeId: string; taskId: string; templateId: string; prompt: string; referenceImages: string[] }) => {
  const node = nodes.value.find(item => item.id === result.targetNodeId)
  if (!node || String((node.data as Record<string, unknown>).pluginId || '') !== result.pluginId || String((node.data as Record<string, unknown>).pluginNodeId || '') !== result.resultNodeId) return
  updateNode(node.id, buildCanvasPluginGenerationPendingNodeData(result) as any)
}

const handleCanvasPluginGenerationTerminal = (result: { pluginId: string; resultNodeId: string; targetNodeId: string; taskId: string; status: 'failed' | 'stopped'; error: string }) => {
  const node = nodes.value.find(item => item.id === result.targetNodeId)
  if (!node || String((node.data as Record<string, unknown>).pluginId || '') !== result.pluginId || String((node.data as Record<string, unknown>).pluginNodeId || '') !== result.resultNodeId) return
  updateNode(node.id, buildCanvasPluginGenerationTerminalNodeData(result) as any)
  ElMessage.warning(result.status === 'stopped' ? '插件生成已停止，可按保存的模板重试。' : '插件生成失败，可检查错误后重试。')
}

/** 插件生成结束后仍停在宿主预览层；确认前不会改变节点、版本或撤销历史。 */
const handleCanvasPluginGenerationResult = async (result: {
  pluginId: string
  templateId: string
  resultNodeId: string
  targetNodeId?: string
  taskId: string
  prompt: string
  referenceImages: string[]
  model: string
  modelKey: string
  content: string
  outputs: Array<{ url: string; outputType: string }>
}) => {
  if (workspaceScene.value !== 'INFINITE_CANVAS') return
  const entry = canvasPluginRegistrations.value[result.pluginId]
  const nodeType = entry ? canvasPluginNodeType(entry.slug, result.resultNodeId) : ''
  const declaration = entry?.contributions.nodes.find(node => canvasPluginNodeType(entry.slug, node.id) === nodeType)
  if (!entry || !declaration) {
    ElMessage.warning('插件生成结果对应的节点类型未登记，未写入画布。')
    return
  }
  const targetNode = result.targetNodeId ? nodes.value.find(node => node.id === result.targetNodeId) : null
  if (result.targetNodeId && (!targetNode
    || String((targetNode.data as Record<string, unknown>).pluginId || '') !== result.pluginId
    || String((targetNode.data as Record<string, unknown>).pluginNodeId || '') !== declaration.id)) {
    ElMessage.warning('插件生成结果只能更新其自身指定类型的节点，未写入画布。')
    return
  }
  const data = buildCanvasPluginGenerationNodeData(result)
  const outputSummary = result.outputs.length ? `，含 ${result.outputs.length} 个输出素材` : ''
  try {
    await ElMessageBox.confirm(
      `插件生成任务已完成${outputSummary}。确认后将${targetNode ? '更新目标节点' : '插入一个结果节点'}；任务、模型和重试参数会随节点保存。`,
      '预览插件生成结果',
      { confirmButtonText: targetNode ? '更新节点' : '插入节点', cancelButtonText: '取消', type: 'info' },
    )
    pauseHistory()
    try {
      if (targetNode) {
        updateNode(targetNode.id, data as any)
      } else {
        const x = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
        const y = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
        addPluginNode(nodeType as `plugin:${string}`, { x, y }, {
          ...declaration.defaultData,
          ...data,
          label: declaration.title,
          pluginId: result.pluginId,
          pluginNodeId: declaration.id,
          pluginDescription: declaration.description,
          pluginColor: declaration.color,
          pluginVersion: 1,
        } as WorkflowPluginNodeData)
      }
    } finally {
      resumeHistory(true)
    }
    ElMessage.success('插件生成结果已写入画布，可使用撤销恢复。')
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '插件生成结果暂时无法写入画布')
  }
}

/** 插件只能创建或更新自己已登记的节点；所有修改都复用历史栈和确认框。 */
const applyCanvasPluginProposal = async (proposal: { pluginId: string; operations: unknown[] }) => {
  const operations = Array.isArray(proposal.operations) ? proposal.operations : []
  if (!operations.length || operations.length > 20) throw new Error('插件操作数量不合法')
  const entry = canvasPluginRegistrations.value[proposal.pluginId]
  if (!entry) throw new Error('插件尚未登记运行时能力')
  const insertedIds = new Map<string, string>()
  for (const operation of operations as Array<Record<string, unknown>>) {
    const kind = String(operation.type || '')
    if (kind === 'insert_plugin_node') {
      if (!findRegisteredPluginNode(proposal.pluginId, operation.nodeType)) throw new Error('插件请求了未登记的节点类型')
      continue
    }
    if (kind === 'update_plugin_node') {
      const node = nodes.value.find(item => item.id === String(operation.nodeId || ''))
      if (!node || String((node.data as Record<string, unknown>).pluginId || '') !== proposal.pluginId) throw new Error('插件不能修改其他节点')
      continue
    }
    if (kind === 'connect_nodes') continue
    throw new Error('插件提交了不受支持的操作')
  }
  await ElMessageBox.confirm(`插件“${proposal.pluginId}”请求修改画布。确认后会进入撤销历史并自动保存。`, '应用插件操作', {
    confirmButtonText: '应用', cancelButtonText: '取消', type: 'info',
  })
  pauseHistory()
  try {
    for (const operation of operations as Array<Record<string, unknown>>) {
      if (operation.type === 'insert_plugin_node') {
        const declaration = findRegisteredPluginNode(proposal.pluginId, operation.nodeType) as CanvasPluginNodeContribution
        const dataInput = operation.data && typeof operation.data === 'object' && !Array.isArray(operation.data) ? operation.data as Record<string, unknown> : {}
        const id = addPluginNode(String(operation.nodeType) as `plugin:${string}`, {
          x: Number((operation.position as any)?.x) || 120,
          y: Number((operation.position as any)?.y) || 120,
        }, {
          ...declaration.defaultData,
          ...dataInput,
          label: String(dataInput.label || declaration.title),
          pluginId: proposal.pluginId,
          pluginNodeId: declaration.id,
          pluginDescription: declaration.description,
          pluginColor: declaration.color,
          pluginVersion: 1,
        } as WorkflowPluginNodeData)
        if (operation.clientKey) insertedIds.set(String(operation.clientKey), id)
      }
      if (operation.type === 'update_plugin_node') {
        const patch = operation.data && typeof operation.data === 'object' && !Array.isArray(operation.data) ? operation.data as Record<string, unknown> : {}
        delete patch.pluginId
        delete patch.pluginNodeId
        delete patch.pluginColor
        delete patch.pluginVersion
        updateNode(String(operation.nodeId), patch as any)
      }
      if (operation.type === 'connect_nodes') {
        const source = insertedIds.get(String(operation.sourceClientKey || ''))
        const target = insertedIds.get(String(operation.targetClientKey || ''))
        if (source && target) addEdge({ source, target, type: 'promptOrder', data: { promptOrder: 1 } })
      }
    }
  } finally {
    resumeHistory(true)
  }
  ElMessage.success('插件操作已应用到画布，可使用撤销恢复。')
}

type CanvasAssistantApplyAudit = {
  taskRecordId: string
  proposalId: string
  presetId?: string
}

const applyCanvasAssistantProposal = async (
  proposal: { summary?: string; operations?: unknown[] },
  fallbackPrompt = '',
  audit?: CanvasAssistantApplyAudit,
) => {
  const operations = Array.isArray(proposal?.operations) ? proposal.operations : []
  if (!operations.length) throw new Error('助手提案未返回可应用的操作')
  const allowed = new Set(['insert_text_node', 'insert_director_node', 'connect_nodes'])
  if (operations.some((operation: any) => !allowed.has(operation?.type))) {
    throw new Error('助手提案包含不受支持的操作，已拒绝应用')
  }
  await ElMessageBox.confirm(proposal.summary || '确认将助手提案插入画布？该操作可撤销，并会自动保存。', '应用助手提案', {
    confirmButtonText: '插入', cancelButtonText: '取消', type: 'info',
  })
  const insertedNodeIds = new Map<string, string>()
  const appliedNodeIds: string[] = []
  // 一次确认对应一个历史快照：撤销时不会遗留孤立节点或连接。
  pauseHistory()
  try {
    for (const operation of operations as CanvasAssistantPreviewOperation[]) {
      if (operation.type === 'insert_text_node') {
        const nodeId = addNode('text', { x: Number(operation.position?.x) || 120, y: Number(operation.position?.y) || 120 }, {
          content: String(operation.data?.content || fallbackPrompt), label: String(operation.data?.label || '助手草稿'),
        })
        appliedNodeIds.push(nodeId)
        if (operation.clientKey) insertedNodeIds.set(operation.clientKey, nodeId)
      }
      if (operation.type === 'insert_director_node') {
        const nodeId = addNode('director', { x: Number(operation.position?.x) || 420, y: Number(operation.position?.y) || 120 }, {
          label: String(operation.data?.label || '助手镜头计划'),
          brief: String(operation.data?.brief || fallbackPrompt),
          shotPlan: String(operation.data?.shotPlan || ''),
          mode: operation.data?.mode === 'commercial' || operation.data?.mode === 'storyboard' ? operation.data.mode : 'short-video',
        })
        appliedNodeIds.push(nodeId)
        if (operation.clientKey) insertedNodeIds.set(operation.clientKey, nodeId)
      }
      if (operation.type === 'connect_nodes') {
        const source = insertedNodeIds.get(String(operation.sourceClientKey || ''))
        const target = insertedNodeIds.get(String(operation.targetClientKey || ''))
        if (source && target) addEdge({ source, target, type: operation.edgeType || 'promptOrder', data: { promptOrder: 1 } })
      }
    }
  } finally {
    resumeHistory(true)
  }
  // 先确认项目草稿版本已写入，再提交用户确认审计；审计不会携带模型密钥或原始上下文。
  await flushAutosave()
  if (autosaveState.value === 'error') throw new Error(autosaveErrorMessage.value || '助手提案已应用，但版本保存失败')
  if (audit && currentWorkflowId.value) {
    await recordCanvasAssistantApplication(currentWorkflowId.value, {
      taskRecordId: audit.taskRecordId,
      proposalId: audit.proposalId,
      presetId: audit.presetId,
      versionId: String(currentWorkflowDetail.value?.definition?.currentVersionId || ''),
      appliedNodeIds,
      proposal,
    })
  }
  ElMessage.success('助手提案已应用到画布，可使用撤销恢复。')
}

const handleCloudCanvasProposal = async (proposal: CanvasAssistantProposal) => {
  if (workspaceScene.value !== 'INFINITE_CANVAS') {
    ElMessage.warning('当前不是无限画布项目，不能应用画布提案。')
    return
  }
  try {
    await applyCanvasAssistantProposal(proposal)
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.message || '画布助手提案暂时不可用')
  }
}

const CANVAS_ASSISTANT_PRESETS = [
  { id: 'explain-connections', title: '解释连线', shortLabel: '解', prompt: '解释当前选区节点及其上游依赖之间的连线关系、信息流和缺失环节，并生成一个简洁的说明文本节点。' },
  { id: 'organize-selection', title: '整理选区', shortLabel: '整', prompt: '整理当前选区：归纳其主题、重复内容和推荐顺序，并生成一个结构化的整理说明文本节点。' },
  { id: 'storyboard', title: '生成分镜', shortLabel: '镜', prompt: '基于当前选区和上游依赖，生成一个可执行的短视频分镜计划，包含镜头顺序、主体、动作和画面重点。' },
  { id: 'batch-rewrite', title: '批量改写', shortLabel: '改', prompt: '批量改写当前选区中的文本：保留原意，提升清晰度和可执行性；为每个有文本内容的节点生成对应的改写文本节点。' },
] as const

const resetCanvasAssistantStream = () => {
  canvasAssistantStreaming.value = false
  canvasAssistantStreamTaskId.value = ''
  canvasAssistantStreamController.value = null
}

const runCanvasAssistantTask = async (input: { prompt: string; presetId?: string }) => {
  if (workspaceScene.value !== 'INFINITE_CANVAS' || !currentWorkflowId.value) {
    ElMessage.warning('请先保存无限画布项目后再使用画布助手。')
    return
  }
  const prompt = String(input.prompt || '').trim()
  if (!prompt) return
  if (canvasAssistantStreaming.value) {
    ElMessage.warning('画布助手正在生成预览，请稍候。')
    return
  }
  const selection = nodes.value.filter(node => node.selected).map(node => node.id)
  if (input.presetId && !selection.length) {
    ElMessage.warning('请先选择至少一个节点，再使用画布助手预设。')
    return
  }
  try {
    const started = await startCanvasAssistantTask(currentWorkflowId.value, prompt, selection)
    const taskId = String(started.taskRecordId || '').trim()
    if (!taskId) throw new Error('画布助手任务创建失败')
    const controller = new AbortController()
    canvasAssistantStreaming.value = true
    canvasAssistantStreamContent.value = ''
    canvasAssistantStreamTaskId.value = taskId
    canvasAssistantStreamController.value = controller
    let finalContent = ''
    let streamError = ''
    await subscribeGenerationTaskEvents(taskId, {
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === 'content_delta') {
          const delta = String(event.delta || '')
          if (delta) canvasAssistantStreamContent.value += delta
          return
        }
        if (event.type === 'snapshot' || event.type === 'completed') {
          const content = String(event.record?.content || '')
          if (content.length >= canvasAssistantStreamContent.value.length) canvasAssistantStreamContent.value = content
          if (event.type === 'completed') finalContent = content
          return
        }
        if (event.type === 'failed') streamError = String(event.message || event.record?.error || '画布助手生成失败')
        if (event.type === 'stopped') streamError = '画布助手任务已停止'
      },
    })
    if (streamError) throw new Error(streamError)
    const parsed = parseCanvasAssistantProposal(finalContent || canvasAssistantStreamContent.value)
    if (!parsed.proposal) throw new Error('助手未返回有效的结构化提案，未对画布进行任何修改。')
    await applyCanvasAssistantProposal(parsed.proposal, prompt, {
      taskRecordId: taskId,
      proposalId: `canvas-proposal-${taskId}`,
      presetId: input.presetId,
    })
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.message || '画布助手暂时不可用')
  } finally {
    resetCanvasAssistantStream()
  }
}

const runCanvasAssistantPreview = async () => {
  try {
    const { value } = await ElMessageBox.prompt('描述要添加到画布的内容。助手会实时生成结构化提案；确认后才写入画布。', '画布助手', {
      confirmButtonText: '生成预览', cancelButtonText: '取消', inputPlaceholder: '例如：为选中的素材补一段镜头描述',
    })
    await runCanvasAssistantTask({ prompt: String(value || '') })
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '画布助手暂时不可用')
  }
}

const runCanvasAssistantPreset = (preset: typeof CANVAS_ASSISTANT_PRESETS[number]) => {
  void runCanvasAssistantTask({ prompt: preset.prompt, presetId: preset.id })
}

const insertLibraryPrompt = (prompt: { title: string; content: string; targetNodeType?: 'text' | 'imageConfig' | 'videoConfig'; tags?: string[]; sourceId?: string | null }) => {
  const x = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const y = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  const trace = { promptSourceId: prompt.sourceId || '', tags: Array.isArray(prompt.tags) ? prompt.tags : [] }
  if (prompt.targetNodeType === 'imageConfig') addNode('imageConfig', { x, y }, { label: prompt.title, prompt: prompt.content, ...trace })
  else if (prompt.targetNodeType === 'videoConfig') addNode('videoConfig', { x, y }, { label: prompt.title, prompt: prompt.content, ...trace })
  else addNode('text', { x, y }, { label: prompt.title, content: prompt.content, ...trace })
  showPromptLibrary.value = false
  ElMessage.success(prompt.targetNodeType === 'imageConfig' ? '生图配置已插入画布' : prompt.targetNodeType === 'videoConfig' ? '视频配置已插入画布' : '提示词已插入画布')
}

/** 服务端素材只以 URL/审计标识写入画布，浏览器不保存模型密钥或上传凭据。 */
const insertLibraryAsset = (asset: PersistedAssetItem) => {
  const position = screenToFlowCoordinate({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  const data = { label: asset.title || '素材库资源', sourceAssetId: asset.id, source: asset.source, tags: Array.isArray(asset.sourceMeta?.tags) ? asset.sourceMeta.tags.map(String).slice(0, 20) : [] }
  if (asset.assetType === 'image') addNode('image', position, { ...data, url: asset.fileUrl })
  else if (asset.assetType === 'video') addNode('video', position, { ...data, url: asset.fileUrl, duration: asset.durationSeconds || 0 })
  else addNode('audio', position, { ...data, url: asset.fileUrl, duration: asset.durationSeconds || 0, fileName: asset.title || '' })
  showCanvasAssetLibrary.value = false
  ElMessage.success('素材已插入画布')
}

const workflowUserName = computed(() => {
  const user = authStore.currentUser.value
  return user?.name || user?.maskedPhone || user?.maskedEmail || '个人账户'
})

const workflowUserInitial = computed(() => workflowUserName.value.slice(0, 1).toUpperCase())

const currentWorkflowStatusText = computed(() => {
  return currentWorkflowDetail.value?.definition?.status === 'ACTIVE' ? '已发布' : '草稿'
})

const autosaveStatusText = computed(() => {
  if (autosaveState.value === 'saving') {
    return '保存中'
  }

  if (autosaveState.value === 'saved') {
    return '已自动保存'
  }

  if (autosaveState.value === 'error') {
    return autosaveErrorMessage.value || '保存失败'
  }

  return currentWorkflowId.value ? '实时保存已开启' : '准备自动保存'
})

const workflowExecutionButtonText = computed(() => {
  if (!workflowRunning.value) return '运行工作流'
  const progress = workflowExecutionProgress.value
  if (!progress) return workflowStopping.value ? '正在停止…' : '停止运行'
  return `${workflowStopping.value ? '停止中' : '停止'} · ${progress.current}/${progress.total} ${progress.label}`
})

const workflowRunStatusText = computed(() => {
  const run = latestWorkflowRun.value
  if (!run) return ''
  const progress = `${run.completedNodes}/${run.totalNodes}`
  if (run.status === 'RUNNING') return `运行中 ${progress}`
  if (run.status === 'COMPLETED') return `上次运行成功 ${progress}`
  if (run.status === 'FAILED') return `上次运行失败 ${progress}`
  if (run.status === 'CANCELLED') return `上次运行已停止 ${progress}`
  if (run.status === 'INTERRUPTED') return `上次运行已中断 ${progress}`
  return `等待运行 ${progress}`
})

const workflowRunStatusLabel = (status: WorkflowRunDetail['status']) => ({
  PENDING: '等待运行',
  RUNNING: '运行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已停止',
  INTERRUPTED: '已中断',
}[status])

const workflowNodeRunStatusLabel = (status: WorkflowRunDetail['nodeRuns'][number]['status']) => ({
  PENDING: '等待',
  RUNNING: '运行中',
  COMPLETED: '完成',
  FAILED: '失败',
  CANCELLED: '取消',
}[status])

const readRunNodeOutput = (nodeRun: WorkflowRunDetail['nodeRuns'][number], key: string) => {
  if (!nodeRun.outputJson || typeof nodeRun.outputJson !== 'object') return ''
  return String((nodeRun.outputJson as Record<string, unknown>)[key] || '').trim()
}

const readRunNodeOutputValue = (nodeRun: WorkflowRunDetail['nodeRuns'][number], key: string): unknown => {
  if (!nodeRun.outputJson || typeof nodeRun.outputJson !== 'object') return undefined
  return (nodeRun.outputJson as Record<string, unknown>)[key]
}

const readRunNodeOutputUrl = (nodeRun: WorkflowRunDetail['nodeRuns'][number]) => {
  const value = readRunNodeOutput(nodeRun, 'outputUrl')
  if (!value) return ''
  if (value.startsWith('/')) return value
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

const readRunNodeOutputImageUrls = (nodeRun: WorkflowRunDetail['nodeRuns'][number]) => {
  if (!nodeRun.outputJson || typeof nodeRun.outputJson !== 'object') return []
  const raw = (nodeRun.outputJson as Record<string, unknown>).images
  if (!Array.isArray(raw)) return []
  return raw
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
}

const startRenameTitle = () => {
  renameTitleInput.value = currentWorkflowTitle.value
  renamingTitle.value = true
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>('.wf-header-meta__title-input')
    el?.focus()
    el?.select()
  })
}

const cancelRenameTitle = () => {
  renamingTitle.value = false
}

const submitRenameTitle = async () => {
  const nextTitle = renameTitleInput.value.trim()
  if (!nextTitle) {
    renamingTitle.value = false
    return
  }

  // 未保存的新工作流：只改本地 name，后续保存/自动保存时带上
  if (!currentWorkflowId.value) {
    workflowName.value = nextTitle
    renamingTitle.value = false
    return
  }

  try {
    const detail = await updateWorkflowDefinition(currentWorkflowId.value, { name: nextTitle })
    currentWorkflowDetail.value = detail
    workflowName.value = detail.definition.name
  } catch (error) {
    console.error('重命名工作流失败', error)
    ElMessage.error('重命名失败，请稍后重试')
  } finally {
    renamingTitle.value = false
  }
}

const buildComparableCanvasSnapshot = (input: {
  nodesJson: unknown
  edgesJson: unknown
  viewportJson: unknown
}) => {
  return JSON.stringify({
    nodesJson: Array.isArray(input.nodesJson) ? input.nodesJson : [],
    edgesJson: Array.isArray(input.edgesJson) ? input.edgesJson : [],
    viewportJson: input.viewportJson && typeof input.viewportJson === 'object'
      ? {
        x: Number((input.viewportJson as { x?: number }).x || 0),
        y: Number((input.viewportJson as { y?: number }).y || 0),
        zoom: Number((input.viewportJson as { zoom?: number }).zoom || 1) || 1,
      }
      : {
        x: 0,
        y: 0,
        zoom: 1,
      },
  })
}

const savedCanvasSnapshot = computed(() => {
  const currentVersion = selectedWorkflowVersionId.value
    ? currentWorkflowDetail.value?.versions?.find(item => item.id === selectedWorkflowVersionId.value)
    : currentWorkflowDetail.value?.definition?.currentVersion
      || currentWorkflowDetail.value?.definition?.latestVersion
      || currentWorkflowDetail.value?.versions?.[0]

  return buildComparableCanvasSnapshot({
    nodesJson: currentVersion?.nodesJson,
    edgesJson: currentVersion?.edgesJson,
    viewportJson: currentVersion?.viewportJson,
  })
})

const currentCanvasSnapshot = computed(() => {
  return buildComparableCanvasSnapshot({
    nodesJson: nodes.value,
    edgesJson: edges.value,
    viewportJson: canvasViewport.value,
  })
})

const isCanvasDirty = computed(() => {
  if (!currentWorkflowId.value) {
    return currentCanvasSnapshot.value !== initialCanvasBaselineSnapshot.value
  }

  return currentCanvasSnapshot.value !== savedCanvasSnapshot.value
})

const syncWorkflowFormFromDetail = () => {
  const definition = currentWorkflowDetail.value?.definition
  workflowName.value = definition?.name || ''
  workflowCode.value = definition?.code || ''
  workflowDescription.value = definition?.description || ''
  workflowCategory.value = definition?.category || ''
}

const clearAutosaveTimer = () => {
  if (autosaveTimer.value) {
    clearTimeout(autosaveTimer.value)
    autosaveTimer.value = null
  }
}

const syncWorkflowRouteQuery = async (workflowId?: string) => {
  const nextWorkflowId = String(workflowId || '').trim()
  const currentQueryWorkflowId = String(route.query.workflowId || '').trim()
  const nextVersionId = String(selectedWorkflowVersionId.value || '').trim()
  const currentQueryVersionId = String(route.query.versionId || '').trim()

  if (nextWorkflowId === currentQueryWorkflowId && nextVersionId === currentQueryVersionId) {
    return
  }

  const nextQuery = { ...route.query }
  if (nextWorkflowId) {
    nextQuery.workflowId = nextWorkflowId
  } else {
    delete nextQuery.workflowId
  }

  if (nextVersionId) {
    nextQuery.versionId = nextVersionId
  } else {
    delete nextQuery.versionId
  }

  await router.replace({
    path: route.path,
    query: nextQuery,
  })
}

const tryLoadWorkflowByRoute = async (
  workflowId: string,
  options: { versionId?: string | null } = {},
) => {
  const normalizedWorkflowId = String(workflowId || '').trim()
  const normalizedVersionId = String(options.versionId || '').trim()
  if (!normalizedWorkflowId) {
    return
  }

  if (normalizedWorkflowId === currentWorkflowId.value && normalizedVersionId === selectedWorkflowVersionId.value) {
    return
  }

  workflowLoadingByRoute.value = true
  try {
    await flushAutosave()
    const detail = await loadWorkflowDetail(normalizedWorkflowId)
    const latestRun = await getLatestWorkflowRun(normalizedWorkflowId)
    showWorkflowRunDetail.value = false
    selectedWorkflowVersionId.value = normalizedVersionId
    applyWorkflowVersionToCanvas(detail, normalizedVersionId || undefined)
    if (latestRun) {
      syncWorkflowRunState(latestRun)
      if (latestRun.status === 'PENDING' || latestRun.status === 'RUNNING') {
        void pollWorkflowRun(normalizedWorkflowId, latestRun.id)
      }
    }
    syncWorkflowFormFromDetail()
    await nextTick()
    updateNodeInternals(nodes.value.map(node => node.id))
    fitView({ padding: 0.24 })
  } catch (error: any) {
    ElMessage.error(error?.message || '打开项目失败')
    await syncWorkflowRouteQuery(currentWorkflowId.value || undefined)
  } finally {
    workflowLoadingByRoute.value = false
  }
}

const resetWorkflowDraftForm = () => {
  workflowName.value = ''
  workflowCode.value = ''
  workflowDescription.value = ''
  workflowCategory.value = ''
}

const createWorkflowAction = useAsyncAction(async () => {
  await flushAutosave()
  clearWorkflowRunPolling()

  resetCurrentWorkflowState()
  latestWorkflowRun.value = null
  activeWorkflowRunId.value = ''
  showWorkflowRunDetail.value = false
  selectedWorkflowVersionId.value = ''
  selectedLibraryWorkflowId.value = ''
  selectedLibraryWorkflowDetail.value = null
  resetWorkflowDraftForm()
  applyCanvasSnapshot({
    nodes: [],
    edges: [],
  }, {
    x: 100,
    y: 50,
    zoom: 0.8,
  })
  initialCanvasBaselineSnapshot.value = currentCanvasSnapshot.value
  await syncWorkflowRouteQuery(undefined)
  autosaveState.value = 'idle'
  autosaveErrorMessage.value = ''
  await nextTick()
  fitView({ padding: 0.24 })
  ElMessage.success('已新建空白工作流')
}, { globalKey: 'blocking', globalText: '正在新建工作流…' })

const handleCreateWorkflow = () => {
  void createWorkflowAction.run()
}

// 添加工作流模板
const handleAddWorkflow = async (workflow: WorkflowTemplateDefinition) => {
  const cx = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const cy = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  const start = { x: cx - 300, y: cy - 200 }
  const { nodes: newNodes, edges: newEdges } = workflow.createNodes(start)

  pauseHistory()
  try {
    newNodes.forEach((node) => {
      const id = addNode(node.type, node.position, node.data)
      newEdges.forEach((edge) => {
        if (edge.source === node.id) edge.source = id
        if (edge.target === node.id) edge.target = id
      })
      node.newId = id
    })

    newEdges.forEach(edge => {
      addEdge({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || 'right',
        targetHandle: edge.targetHandle || 'left',
        type: edge.type,
        data: edge.data,
      })
    })
    await nextTick()
    newNodes.forEach(node => {
      if (node.newId) {
        updateNodeInternals([node.newId])
      }
    })
  } finally {
    // 一个模板无论包含多少节点和边，都只占用一条撤销历史。
    resumeHistory(true)
  }

  showTemplatePanel.value = false
}

// 节点类型菜单选项
const builtInNodeTypeOptions: WorkflowNodeOption[] = [
  { type: 'text', name: '文本节点', color: '#3b82f6', icon: 'M4 6h16M4 12h8m-8 6h16' },
  { type: 'imageConfig', name: '文生图配置', color: '#22c55e', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { type: 'videoConfig', name: '视频生成配置', color: '#f59e0b', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { type: 'llmConfig', name: 'LLM 文本生成', color: '#a855f7', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z' },
  { type: 'image', name: '图片节点', color: '#8b5cf6', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { type: 'video', name: '视频节点', color: '#ef4444', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { type: 'director', name: '导演台', color: '#ec4899', icon: 'M4 6h16v12H4zM8 3l2 3m4-3 2 3M9 10h6m-6 4h4' },
  { type: 'audio', name: '音频节点', color: '#06b6d4', icon: 'M9 18V5l10-2v13M9 9l10-2M6 21a3 3 0 100-6 3 3 0 000 6zm10-2a3 3 0 100-6 3 3 0 000 6z' },
]
const nodeTypeOptions = computed<WorkflowNodeOption[]>(() => [
  ...builtInNodeTypeOptions,
  ...registeredPluginNodes.value.map(({ slug, node }) => ({
    type: canvasPluginNodeType(slug, node.id) as WorkflowNodeType,
    name: node.title,
    color: node.color,
    icon: 'M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13',
  })),
])

const handleOpenAssistant = () => {
  if (isAssistantCollapsed.value) toggleAssistantPanel()
}

const handleOpenWorkflowAssistant = (event: Event) => {
  const detail = (event as CustomEvent<{ nodeId?: string }>).detail
  if (detail?.nodeId) promptAnchorNodeId.value = detail.nodeId
  handleOpenAssistant()
}

const handleWorkflowImageToolPreset = (event: Event) => {
  const detail = (event as CustomEvent<{ nodeId?: string; text?: string }>).detail
  if (!detail?.nodeId || !nodes.value.some(node => node.id === detail.nodeId && node.type === 'image')) return
  promptAnchorNodeId.value = detail.nodeId
  workflowPromptGenerationMode.value = 'image'
  workflowPrompt.value = String(detail.text || '')
}

onMounted(() => {
  // Vue Flow 1.48 的组件 prop 只接受 boolean/null，但 store 支持完整 KeyFilter。
  // 用 store 配置 Ctrl / Cmd 框选，避免 selectionKeyCode=true 把普通左键拖动也变成框选。
  setState({ selectionKeyCode: ['Control', 'Meta'] })
  window.addEventListener('canvasmind:open-workflow-assistant', handleOpenWorkflowAssistant)
  window.addEventListener('canvasmind:workflow-image-tool-preset', handleWorkflowImageToolPreset)
})

onUnmounted(() => {
  window.removeEventListener('canvasmind:open-workflow-assistant', handleOpenWorkflowAssistant)
  window.removeEventListener('canvasmind:workflow-image-tool-preset', handleWorkflowImageToolPreset)
})

const handleAutoArrange = async () => {
  if (!nodes.value.length) return

  pauseHistory()
  try {
    nodes.value = nodes.value.map((node, index) => ({
      ...node,
      position: {
        x: 115 + (index % 2) * 560,
        y: 118 + Math.floor(index / 2) * 380,
      },
    }))
    await nextTick()
    updateNodeInternals(nodes.value.map(node => node.id))
  } finally {
    resumeHistory(true)
  }
  ElMessage.success('已整理画布节点')
}

// 工具栏按钮：其余节点类型仍可从“添加节点”菜单进入。
const tools = [
  { id: 'assistant', name: 'AI 编排', icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z', action: handleOpenAssistant },
  { id: 'text', name: '文本', icon: 'M4 6h16M4 12h8m-8 6h16', action: () => addNewNode('text') },
  { id: 'arrange', name: '一键整理', icon: 'M5 7h14M5 12h10M5 17h14', action: () => void handleAutoArrange() },
]

// 添加新节点
const addNewNode = (type: WorkflowNodeType) => {
  const cx = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const cy = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  let id = ''
  if (isCanvasPluginNodeType(type)) {
    const entry = registeredPluginNodes.value.find(item => canvasPluginNodeType(item.slug, item.node.id) === type)
    if (!entry) {
      ElMessage.warning('该插件节点未就绪。')
      return
    }
    id = addPluginNode(type, { x: cx - 140, y: cy - 100 }, {
      ...entry.node.defaultData,
      label: entry.node.title,
      pluginId: entry.pluginId,
      pluginNodeId: entry.node.id,
      pluginDescription: entry.node.description,
      pluginColor: entry.node.color,
      pluginVersion: 1,
    })
  } else {
    id = addNode(type as WorkflowBuiltinNodeType, { x: cx - 140, y: cy - 100 })
  }
  const maxZ = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))
  updateNode(id, { zIndex: maxZ + 1 })
  setTimeout(() => updateNodeInternals([id]), 50)
  showNodeMenu.value = false
}

// 快速连线：按住 Alt 点击节点 A，再按住 Alt 点击节点 B，自动连线。
// Shift 保留给 Vue Flow 的多选，避免两种交互争夺同一个修饰键。
const quickLinkSourceId = ref<string | null>(null)

// 把"按节点类型推断 edge type"的逻辑抽出来，拖拽连线（onConnect）与快速连线共用。
const applyTypedEdgeConnection = (params: WorkflowAddEdgeParams) => {
  const sourceNode = nodes.value.find(n => n.id === params.source)
  const targetNode = nodes.value.find(n => n.id === params.target)

  if (sourceNode?.type === 'text' && targetNode?.type === 'imageConfig') {
    const existing = edges.value.filter(e => e.target === params.target && e.type === 'promptOrder')
    addEdge({ ...params, type: 'promptOrder', data: { promptOrder: existing.length + 1 } })
  } else if (sourceNode?.type === 'image' && targetNode?.type === 'imageConfig') {
    const existing = edges.value.filter(e => e.target === params.target && e.type === 'imageOrder')
    addEdge({ ...params, type: 'imageOrder', data: { imageOrder: existing.length + 1 } })
  } else if (sourceNode?.type === 'image' && targetNode?.type === 'videoConfig') {
    addEdge({ ...params, type: 'imageRole', data: { imageRole: 'first_frame_image' } })
  } else if (sourceNode?.type === 'text' && targetNode?.type === 'videoConfig') {
    addEdge({ ...params, type: 'promptOrder', data: { promptOrder: 1 } })
  } else {
    addEdge(params)
  }
}

// 处理连接
const onConnect = (params: Connection) => {
  if (workflowRunning.value) {
    ElMessage.warning('工作流执行中，暂不能修改连线')
    return
  }
  if (!params.source || !params.target) return
  const connection = {
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? undefined,
    targetHandle: params.targetHandle ?? undefined,
  }
  const validation = validateWorkflowConnection(connection)
  if (!validation.valid) {
    ElMessage.warning(validation.message || '当前连接无效')
    return
  }
  applyTypedEdgeConnection(connection)
}

const hasExistingEdge = (source: string, target: string, sourceHandle?: string, targetHandle?: string) => {
  return edges.value.some(edge =>
    edge.source === source
    && edge.target === target
    && (edge.sourceHandle || undefined) === sourceHandle
    && (edge.targetHandle || undefined) === targetHandle,
  )
}

const handleNodeClick = (payload: { event: MouseEvent | TouchEvent; node: { id: string } }) => {
  const originalEvent = payload.event as MouseEvent
  const targetNodeId = payload.node?.id
  if (!targetNodeId) return
  const shouldOpenPrompt = isWorkflowPromptAnchorNodeType(nodes.value.find(node => node.id === targetNodeId)?.type)

  // Vue Flow 的 selected 标记在部分交互路径下不会同步到 v-model 节点数组。
  // 输入栏直接记录用户点击的节点，避免出现“节点已选中、输入栏却消失”的不一致。
  promptAnchorLastNodeClickAt.value = Date.now()
  promptAnchorNodeId.value = shouldOpenPrompt ? targetNodeId : ''
  // Vue Flow 会在节点点击后继续派发 pane-click。延迟一帧重设锚点，避免
  // pane-click 的清理逻辑把刚选中的节点输入栏立即卸载。
  requestAnimationFrame(() => {
    promptAnchorNodeId.value = shouldOpenPrompt ? targetNodeId : ''
  })

  // 只在按住 Alt 时介入；Shift 由 Vue Flow 用于多选。
  if (!(originalEvent && 'altKey' in originalEvent && originalEvent.altKey)) {
    return
  }

  if (!quickLinkSourceId.value) {
    quickLinkSourceId.value = targetNodeId
    return
  }

  if (quickLinkSourceId.value === targetNodeId) {
    quickLinkSourceId.value = null
    return
  }

  // 沿用 vue-flow 默认 handle 命名（与拖拽连线一致）：右出左入。
  const sourceHandle = 'right'
  const targetHandle = 'left'
  if (!hasExistingEdge(quickLinkSourceId.value, targetNodeId, sourceHandle, targetHandle)) {
    applyTypedEdgeConnection({
      source: quickLinkSourceId.value,
      target: targetNodeId,
      sourceHandle,
      targetHandle,
    })
  }
  quickLinkSourceId.value = null
  originalEvent.preventDefault?.()
  originalEvent.stopPropagation?.()
}

// 给挂起源节点动态打 .wf-quick-link-source class，提示"A 已选中，下一次 Alt+点击的节点为目标"。
// 这是整个快速连线流程仅保留的视觉反馈，跟挂起状态同生同灭。
const resolveNodeClass = (node: { id: string }) => {
  return node.id === quickLinkSourceId.value ? 'wf-quick-link-source' : undefined
}

// 顶部提示横幅用：挂起源节点的可读名称
const quickLinkSourceLabel = computed(() => {
  const sourceId = quickLinkSourceId.value
  if (!sourceId) return ''
  const node = nodes.value.find(n => n.id === sourceId)
  if (!node) return ''
  const label = (node.data as { label?: string })?.label
  if (label) return label
  const typeOption = nodeTypeOptions.value.find(opt => opt.type === node.type)
  const idSuffix = sourceId.replace(/^node_/, '')
  return `${typeOption?.name || node.type} #${idSuffix}`
})

const cancelQuickLink = () => {
  quickLinkSourceId.value = null
}

// 处理视口变化
const handleViewportChange = (v: typeof canvasViewport.value) => {
  updateViewport(v)
  updateWorkflowPromptDockPosition()
}

// 处理边变化
const onEdgesChange = (changes: Array<{ type?: string }>) => {
  if (changes.some(c => c.type === 'remove')) {
    nextTick(() => manualSaveHistory())
  }
}

// 处理画布点击
const onPaneClick = () => {
  showNodeMenu.value = false
  // Vue Flow 在部分缩放/拖拽状态下会把节点点击继续解释为 pane-click。
  // 忽略紧随节点点击产生的清理事件；真正点击空白画布仍会正常关闭输入栏。
  if (Date.now() - promptAnchorLastNodeClickAt.value < 240) return
  promptAnchorNodeId.value = ''
}

// 输入栏属于当前图片节点：点击输入栏、当前节点或灵感弹窗时保留，
// 点击画布空白、其他节点以及页面上的其他控件时立即关闭。
const handleWorkflowPromptOutsidePointerDown = (event: PointerEvent) => {
  const anchorNodeId = promptAnchorNodeId.value
  if (!anchorNodeId || !(event.target instanceof Element)) return

  const clickedNodeId = event.target.closest<HTMLElement>('.vue-flow__node')?.dataset.id
  if (!shouldDismissWorkflowPromptDock({
    anchorNodeId,
    clickedNodeId,
    clickInsideDock: Boolean(event.target.closest('.workflow-prompt-dock')),
    clickInsideModal: Boolean(event.target.closest('.workflow-inspiration-backdrop')),
  })) return

  promptAnchorNodeId.value = ''
}

// 返回项目入口：保存草稿 → 跳转。直接打开或刷新项目时会丢失 returnTo，
// 此时画布项目仍应回到资源管理的「无限画布」页，而不是首页。
const resolveReturnTo = () => {
  const returnTo = String(route.query.returnTo || '').trim()
  if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    return returnTo
  }

  return route.path === '/canvas' ? '/asset?tab=canvas' : '/agentic-assets-workflow'
}

// globalKey:'blocking' 期间会弹遮罩"正在保存草稿…"，避免用户感觉点了没反应。
// useAsyncAction 自身防止重复点击。
const goBackAction = useAsyncAction(async () => {
  await flushAutosave()
  await router.push(resolveReturnTo())
}, { globalKey: 'blocking', globalText: '正在保存草稿…' })

const goBackLoading = goBackAction.loading

const goBack = () => {
  void goBackAction.run()
}

const downloadCurrentCanvasProject = async () => {
  if (!currentWorkflowId.value || workspaceScene.value !== 'INFINITE_CANVAS') {
    ElMessage.warning('请先保存无限画布项目后再导出。')
    return
  }
  try {
    const payload = await exportCanvasProjectFile(currentWorkflowId.value)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentWorkflowTitle.value || 'infinite-canvas'}.json`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('画布项目已导出')
  } catch (error: any) {
    ElMessage.error(error?.message || '导出画布失败')
  }
}

const downloadSelectedCanvasNodes = async () => {
  if (!currentWorkflowId.value || workspaceScene.value !== 'INFINITE_CANVAS') {
    ElMessage.warning('请先保存无限画布项目后再导出。')
    return
  }
  const selection = nodes.value.filter(node => node.selected).map(node => node.id)
  if (!selection.length) {
    ElMessage.warning('请先选择要导出的节点。')
    return
  }
  try {
    const payload = await exportCanvasProjectSelectionFile(currentWorkflowId.value, selection)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentWorkflowTitle.value || 'infinite-canvas'}-selection.json`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${payload.canvas.nodes.length} 个选中节点`)
  } catch (error: any) {
    ElMessage.error(error?.message || '导出选区失败')
  }
}

const importCanvasProjectFromFile = () => {
  canvasImportFileInput.value?.click()
}

/** 静态隐藏 input 让键盘和自动化都能可靠触发导入；每次完成后清空，以便重复选择同一文件。 */
const handleCanvasImportFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'
    const result = isZip
      ? await importCanvasProjectArchiveFile(file, file.name.replace(/\.zip$/i, ''))
      : await importCanvasProjectFile(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ''))
    const workflowId = String(result.detail?.definition?.id || '').trim()
    if (!workflowId) throw new Error('导入结果缺少项目标识')
    const importedCount = Math.max(1, Number(result.importedCount) || 1)
    ElMessage.success(importedCount > 1 ? `已导入 ${importedCount} 个无限画布项目` : '无限画布已导入')
    await tryLoadWorkflowByRoute(workflowId)
    await syncWorkflowRouteQuery(workflowId)
    await handleRefreshWorkflowList()
    const migrationReport = formatCanvasImportMigrationReport(result.warnings)
    if (migrationReport) {
      await ElMessageBox.alert(migrationReport, '导入迁移报告', {
        confirmButtonText: '已了解',
        type: 'warning',
      })
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '导入画布失败，请检查 JSON 或 ZIP 文件。')
  } finally {
    input.value = ''
  }
}

const {
  run: handleRefreshWorkflowList,
  loading: workflowListLoading,
} = useAsyncAction(async () => {
  await reloadWorkflowList({
    scene: workspaceScene.value,
    keyword: workflowListKeyword.value || undefined,
  })
})

const loadWorkflowAction = useAsyncAction(async (workflow: WorkflowDefinitionSummary) => {
  const versionId = selectedLibraryWorkflowId.value === workflow.id
    ? selectedWorkflowVersionId.value || selectedLibraryWorkflowDetail.value?.definition.currentVersionId || ''
    : ''
  await tryLoadWorkflowByRoute(workflow.id, { versionId })
  await syncWorkflowRouteQuery(workflow.id)
  showWorkflowLibraryPanel.value = false
  ElMessage.success(`已打开项目：${workflow.name}`)
}, { globalKey: 'blocking', globalText: '正在加载工作流…' })

const handleLoadWorkflow = (workflow: WorkflowDefinitionSummary) => {
  void loadWorkflowAction.run(workflow)
}

const selectLibraryAction = useAsyncAction(async (workflow: WorkflowDefinitionSummary) => {
  selectedLibraryWorkflowDetail.value = await fetchWorkflowDetail(workflow.id)
})
const libraryDetailLoading = selectLibraryAction.loading

const handleSelectLibraryWorkflow = (workflow: WorkflowDefinitionSummary) => {
  selectedLibraryWorkflowId.value = workflow.id
  selectedLibraryWorkflowDetail.value = null
  void selectLibraryAction.run(workflow)
}

const loadWorkflowVersionAction = useAsyncAction(async (workflow: WorkflowDefinitionSummary, versionId: string) => {
  await tryLoadWorkflowByRoute(workflow.id, { versionId })
  await syncWorkflowRouteQuery(workflow.id)
  showWorkflowLibraryPanel.value = false
  ElMessage.success(`已打开 ${workflow.name} 的指定版本`)
}, { globalKey: 'blocking', globalText: '正在加载版本…' })

const handleLoadWorkflowVersion = (workflow: WorkflowDefinitionSummary, versionId: string) => {
  void loadWorkflowVersionAction.run(workflow, versionId)
}

const rollbackWorkflowVersionAction = useAsyncAction(async (workflow: WorkflowDefinitionSummary, versionId: string) => {
  await flushAutosave()
  const rollbackVersion = await rollbackWorkflowDefinitionVersion(workflow.id, versionId)
  const detail = await loadWorkflowDetail(workflow.id)
  selectedLibraryWorkflowDetail.value = detail
  selectedWorkflowVersionId.value = rollbackVersion.id
  applyWorkflowVersionToCanvas(detail, rollbackVersion.id)
  syncWorkflowFormFromDetail()
  await reloadWorkflowList({ scene: workspaceScene.value, keyword: workflowListKeyword.value || undefined })
  await syncWorkflowRouteQuery(workflow.id)
  showWorkflowLibraryPanel.value = false
  await nextTick()
  fitView({ padding: 0.24 })
}, { globalKey: 'blocking', globalText: '正在回滚版本…' })

const handleRollbackWorkflowVersion = async (workflow: WorkflowDefinitionSummary, versionId: string) => {
  const version = selectedLibraryWorkflowDetail.value?.versions.find(item => item.id === versionId)
  try {
    await ElMessageBox.confirm(
      `将基于 V${version?.versionNo || ''} 创建一个新的当前草稿，已有历史版本不会被修改。`,
      '确认版本回滚',
      {
        confirmButtonText: '确认回滚',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    throw error
  }
  await rollbackWorkflowVersionAction.run(workflow, versionId)
}

const clearWorkflowRunPolling = () => {
  if (workflowRunPollTimer.value) clearTimeout(workflowRunPollTimer.value)
  workflowRunPollTimer.value = null
}

const canvasRunOutputConfirmationKeys = new Set<string>()

const applyServerRunOutputs = async (run: WorkflowRunDetail) => {
  for (const nodeRun of run.nodeRuns) {
    if (nodeRun.status !== 'COMPLETED') continue
    const configNode = nodes.value.find(node => node.id === nodeRun.nodeId)
    if (!configNode) continue
    const taskRecordId = nodeRun.generationRecordId || readRunNodeOutput(nodeRun, 'taskRecordId')
    const outputContent = readRunNodeOutput(nodeRun, 'outputContent')
    const outputUrls = [readRunNodeOutputUrl(nodeRun), ...readRunNodeOutputImageUrls(nodeRun)]
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
    const storedGenerationMeta = readRunNodeOutputValue(nodeRun, 'generationMeta')
    const generationMeta = isWorkflowGenerationMetadata(storedGenerationMeta)
      ? storedGenerationMeta
      : buildWorkflowGenerationMetadata({
        kind: configNode.type === 'videoConfig' ? 'video' : configNode.type === 'llmConfig' ? 'text' : 'image',
        prompt: String((configNode.data as Record<string, unknown>).prompt || ''),
        model: String((configNode.data as Record<string, unknown>).model || ''),
        systemPrompt: String((configNode.data as Record<string, unknown>).systemPrompt || ''),
        outputFormat: String((configNode.data as Record<string, unknown>).outputFormat || ''),
        size: String((configNode.data as Record<string, unknown>).size || ''),
        quality: String((configNode.data as Record<string, unknown>).quality || ''),
        ratio: String((configNode.data as Record<string, unknown>).ratio || ''),
        resolution: String((configNode.data as Record<string, unknown>).resolution || ''),
        duration: Number((configNode.data as Record<string, unknown>).duration || 0),
        sourceConfigNodeId: configNode.id,
      })

    const confirmRunOutput = async (kind: 'image' | 'video' | 'text', options: { outputCount?: number; content?: string } = {}) => {
      if (workspaceScene.value !== 'INFINITE_CANVAS') return true
      const key = `${run.id}:${nodeRun.id}`
      if (canvasRunOutputConfirmationKeys.has(key)) return false
      canvasRunOutputConfirmationKeys.add(key)
      const confirmed = await confirmCanvasGenerationResult({ kind, ...options })
      if (!confirmed) updateNode(configNode.id, { loading: false, executed: false, generationStatus: 'discarded' })
      return confirmed
    }

    if (configNode.type === 'llmConfig') {
      if (!await confirmRunOutput('text', { content: outputContent })) continue
      updateNode(configNode.id, {
        loading: false,
        error: '',
        executed: true,
        taskRecordId,
        outputContent,
        generationMeta,
        generationStatus: 'completed',
      })
      notifyCanvasGenerationResultConfirmed({ kind: 'text', taskId: taskRecordId || nodeRun.id })
      continue
    }
    if (configNode.type === 'videoConfig') {
      const outputUrl = outputUrls[0]
      if (!outputUrl) continue
      if (!await confirmRunOutput('video', { outputCount: 1 })) continue
      const existingOutput = edges.value
        .filter(edge => edge.source === configNode.id)
        .map(edge => nodes.value.find(node => node.id === edge.target))
        .find(node => node?.type === 'video')
      const outputNodeId = existingOutput?.id || addNode('video', {
        x: (configNode.position?.x || 0) + 400,
        y: configNode.position?.y || 0,
      }, { url: outputUrl, duration: Number((configNode.data as Record<string, unknown>).duration || 0), label: '生成视频', loading: false })
      if (!existingOutput) {
        addEdge({ source: configNode.id, target: outputNodeId, sourceHandle: 'right', targetHandle: 'left' })
      }
      updateNode(outputNodeId, { url: outputUrl, label: '生成视频', loading: false, error: '', taskRecordId, generationMeta })
      updateNode(configNode.id, {
        loading: false,
        error: '',
        executed: true,
        taskRecordId,
        outputNodeId,
        generationStatus: 'completed',
      })
      notifyCanvasGenerationResultConfirmed({ kind: 'video', taskId: taskRecordId || nodeRun.id, outputCount: 1 })
      continue
    }
    if (configNode.type !== 'imageConfig' || !outputUrls.length) continue
    if (!await confirmRunOutput('image', { outputCount: outputUrls.length })) continue

    const existingOutput = edges.value
      .filter(edge => edge.source === configNode.id)
      .map(edge => nodes.value.find(node => node.id === edge.target))
      .find(node => node?.type === 'image')
    const outputNodeId = existingOutput?.id || addNode('image', {
      x: (configNode.position?.x || 0) + 400,
      y: configNode.position?.y || 0,
    }, { url: outputUrls[0], label: '生成图片', loading: false })
    if (!existingOutput) {
      addEdge({ source: configNode.id, target: outputNodeId, sourceHandle: 'right', targetHandle: 'left' })
    }
    const batchChildren = createWorkflowImageBatchChildren(taskRecordId || nodeRun.id, outputUrls)
    updateNode(outputNodeId, {
      url: outputUrls[0],
      label: outputUrls.length > 1 ? `生成图片（${outputUrls.length} 张）` : '生成图片',
      loading: false,
      error: '',
      isBatchRoot: outputUrls.length > 1,
      batchChildren,
      primaryImageId: batchChildren[0]?.id,
      batchExpanded: false,
      taskRecordId,
      generationMeta,
    })
    updateNode(configNode.id, {
      loading: false,
      error: '',
      executed: true,
      taskRecordId,
      outputNodeId,
      generationMeta,
      generationStatus: 'completed',
    })
    notifyCanvasGenerationResultConfirmed({ kind: 'image', taskId: taskRecordId || nodeRun.id, outputCount: outputUrls.length })
  }
}

const syncWorkflowRunState = (run: WorkflowRunDetail, notifyTerminal = false) => {
  const wasRunning = workflowRunning.value
  latestWorkflowRun.value = run
  void applyServerRunOutputs(run)
  const active = run.status === 'PENDING' || run.status === 'RUNNING'
  workflowRunning.value = active
  activeWorkflowRunId.value = active ? run.id : ''
  const current = run.nodeRuns.find(nodeRun => nodeRun.nodeId === run.currentNodeId)
  workflowExecutionProgress.value = active && current
    ? { current: Math.min(run.completedNodes + 1, run.totalNodes), total: run.totalNodes, nodeId: current.nodeId, label: current.label || current.nodeId }
    : null
  if (!active) {
    clearWorkflowRunPolling()
    if (wasRunning) void flushAutosave()
    if (notifyTerminal && run.status === 'COMPLETED') ElMessage.success(`工作流执行完成，共执行 ${run.completedNodes} 个节点`)
    if (notifyTerminal && run.status === 'FAILED') ElMessage.error(run.errorMessage || '工作流执行失败')
  }
}

const pollWorkflowRun = async (workflowId: string, runId: string) => {
  clearWorkflowRunPolling()
  try {
    const run = await getLatestWorkflowRun(workflowId)
    if (!run || run.id !== runId) return
    syncWorkflowRunState(run, true)
    if (run.status === 'PENDING' || run.status === 'RUNNING') {
      workflowRunPollTimer.value = setTimeout(() => void pollWorkflowRun(workflowId, runId), 1000)
    }
  } catch (error) {
    console.error('刷新工作流运行状态失败', error)
    workflowRunPollTimer.value = setTimeout(() => void pollWorkflowRun(workflowId, runId), 2500)
  }
}

const handleRunWorkflow = async () => {
  if (workflowRunning.value) return
  await flushAutosave()
  const plan = getWorkflowExecutionPlan()
  const workflowId = currentWorkflowId.value
  const version = currentWorkflowDetail.value?.definition.currentVersion
    || currentWorkflowDetail.value?.definition.latestVersion
    || currentWorkflowDetail.value?.versions[0]
  if (!workflowId || !version?.id) {
    ElMessage.error('工作流尚未保存，无法创建运行记录')
    return
  }

  try {
    const run = await createWorkflowRun(workflowId, {
      versionId: version.id,
      nodes: plan,
      executor: 'SERVER',
    })
    syncWorkflowRunState(run)
    showWorkflowRunDetail.value = true
    ElMessage.success('工作流已提交到服务端，关闭页面后仍会继续运行')
    void pollWorkflowRun(workflowId, run.id)
  } catch (error: any) {
    ElMessage.error(error?.message || '创建工作流运行记录失败')
  }
}

const handleStopWorkflow = async () => {
  if (!workflowRunning.value || workflowStopping.value) return
  workflowStopping.value = true
  try {
    if (currentWorkflowId.value && activeWorkflowRunId.value) {
      const run = await stopWorkflowRun(currentWorkflowId.value, activeWorkflowRunId.value)
      syncWorkflowRunState(run)
      ElMessage.info('工作流已停止')
    }
  } catch (error: any) {
    ElMessage.warning(error?.message || '工作流停止请求未确认')
  } finally {
    workflowStopping.value = false
  }
}

const handleRetryWorkflowRun = async () => {
  const workflowId = currentWorkflowId.value
  const run = latestWorkflowRun.value
  if (!workflowId || !run || !['FAILED', 'INTERRUPTED'].includes(run.status)) return
  try {
    const retried = await retryWorkflowRun(workflowId, run.id)
    syncWorkflowRunState(retried)
    ElMessage.success('已从失败节点重新提交')
    void pollWorkflowRun(workflowId, retried.id)
  } catch (error: any) {
    ElMessage.error(error?.message || '重新运行失败')
  }
}

const performAutosave = async () => {
  autosaveState.value = 'saving'
  autosaveErrorMessage.value = ''

  const detail = await autosaveWorkflow({
    workflowId: currentWorkflowId.value || undefined,
    name: workflowName.value || `未命名项目 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
    code: workflowCode.value || undefined,
    description: workflowDescription.value || null,
    category: workflowCategory.value || null,
    scene: workspaceScene.value,
  })

  currentWorkflowDetail.value = detail
  currentWorkflowId.value = detail.definition.id
  selectedWorkflowVersionId.value = detail.definition.currentVersionId || detail.definition.latestVersion?.id || ''
  syncWorkflowFormFromDetail()
  await syncWorkflowRouteQuery(detail.definition.id)
  autosaveState.value = 'saved'
}

const scheduleAutosave = () => {
  if (workflowRunning.value || !autosaveReady.value || workflowLoadingByRoute.value || !isCanvasDirty.value) {
    return
  }

  clearAutosaveTimer()
  autosaveTimer.value = setTimeout(() => {
    void flushAutosave()
  }, 1500)
}

const flushAutosave = async () => {
  clearAutosaveTimer()

  if (!autosaveReady.value || workflowLoadingByRoute.value || !isCanvasDirty.value) {
    return
  }

  if (autosaveInFlight.value) {
    await autosaveInFlight.value
    return
  }

  autosaveInFlight.value = (async () => {
    try {
      await performAutosave()
    } catch (error: any) {
      autosaveState.value = 'error'
      autosaveErrorMessage.value = error?.message || '自动保存失败'
    } finally {
      autosaveInFlight.value = null
    }
  })()

  await autosaveInFlight.value
}

const generationCheckpointTaskIds = new Set<string>()
const createCanvasGenerationCheckpoint = async (detail: CanvasGenerationConfirmedDetail) => {
  if (workspaceScene.value !== 'INFINITE_CANVAS' || !currentWorkflowId.value) return
  const taskId = String(detail.taskId || '').trim()
  if (!taskId || generationCheckpointTaskIds.has(taskId)) return
  generationCheckpointTaskIds.add(taskId)
  const label = detail.kind === 'image' ? '图片' : detail.kind === 'video' ? '视频' : '文本'
  try {
    // 先合并可能尚未落盘的节点更新，再基于确认后的结果创建独立版本。
    await flushAutosave()
    const saved = await saveWorkflow({
      workflowId: currentWorkflowId.value,
      scene: 'INFINITE_CANVAS',
      versionName: `确认${label}生成结果`,
      changeSummary: `确认写入服务端生成任务 ${taskId} 的${label}结果`,
    })
    currentWorkflowDetail.value = saved
    selectedWorkflowVersionId.value = saved.definition.currentVersionId || ''
    initialCanvasBaselineSnapshot.value = currentCanvasSnapshot.value
    await syncWorkflowRouteQuery(saved.definition.id)
    ElMessage.success(`${label}生成结果已确认并保存为新版本`)
  } catch (error: any) {
    generationCheckpointTaskIds.delete(taskId)
    ElMessage.error(error?.message || '生成结果已写入画布，但创建版本检查点失败')
  }
}

const handleCanvasGenerationConfirmed = (event: Event) => {
  const detail = (event as CustomEvent<CanvasGenerationConfirmedDetail>).detail
  if (!detail || !['image', 'video', 'text'].includes(detail.kind)) return
  void createCanvasGenerationCheckpoint(detail)
}

// 选择 / 剪贴板 / 拖入：选中态必须在快捷键注册前可用，Esc 才能同步清理。
const { selectAll, deselectAll, selectedNodeIds } = useCanvasSelection()
const { copySelected, pasteFromSlot, hasClipboard } = useCanvasClipboard()
const { onDrop: onCanvasFileDrop, onDragOver: onCanvasFileDragOver } = useCanvasDrop()

// 键盘快捷键（统一走 useShortcut 注册，自动管理生命周期 + 输入框焦点屏蔽）
useShortcut(
  'Escape',
  () => {
    if (quickLinkSourceId.value) {
      quickLinkSourceId.value = null
    }
    deselectAll()
    contextMenuVisible.value = false
    showNodeMenu.value = false
    promptAnchorNodeId.value = ''
  },
  // Esc 不阻止默认，让 el-dialog / el-popover 等浮层也能关闭
  { preventDefault: false },
)
useShortcut('CmdOrCtrl+Z', () => undo())
useShortcut(['CmdOrCtrl+Shift+Z', 'CmdOrCtrl+Y'], () => redo())
useShortcut('CmdOrCtrl+N', () => {
  void handleCreateWorkflow()
})

// 默认使用左键拖动画布；按住 Space 时禁用节点拖拽，保证从节点上开始也能平移。
// Ctrl / Cmd + 左键拖动则交给 selectionKeyCode 做框选，和目标画布的交互约定一致。
const isSpacePressed = ref(false)
const panOnDragValue = [0, 1, 2]

const isEditableSpaceTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return el.isContentEditable
}

const handleSpaceDown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && !isEditableSpaceTarget(event.target)) {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomIn({ duration: 160 })
      return
    }
    if (event.key === '-') {
      event.preventDefault()
      zoomOut({ duration: 160 })
      return
    }
    if (event.key === '0') {
      event.preventDefault()
      fitView({ duration: 220, padding: 0.2 })
      return
    }
  }
  if (event.code !== 'Space' || event.repeat) return
  if (isEditableSpaceTarget(event.target)) return
  event.preventDefault()
  isSpacePressed.value = true
}
const handleSpaceUp = (event: KeyboardEvent) => {
  if (event.code === 'Space') {
    isSpacePressed.value = false
  }
}

// 节点拖拽期间暂停历史入栈，拖拽结束统一作为 1 条历史记录
const onNodeDragStart = () => {
  pauseHistory()
}
const onNodeDragStop = () => {
  resumeHistory()
  updateWorkflowPromptDockPosition()
}

const ROTATION_STEP = 15
const selectedRotationTargetIds = (fallbackNodeId?: string) => {
  const selected = selectedNodeIds.value
  // 从已选中的节点右键进入菜单时，旋转整个选区；否则仅操作右键目标。
  return selected.size ? selected : new Set(fallbackNodeId ? [fallbackNodeId] : [])
}
const rotateSelectedNodes = (delta: number, fallbackNodeId?: string) => {
  const changed = rotateNodes(selectedRotationTargetIds(fallbackNodeId), delta)
  if (changed) updateWorkflowPromptDockPosition()
}
const resetSelectedNodeRotation = (fallbackNodeId?: string) => {
  const changed = resetNodeRotation(selectedRotationTargetIds(fallbackNodeId))
  if (changed) updateWorkflowPromptDockPosition()
}

// 画布助手上下文：选中节点优先，并沿入边收集上游节点（最多 12 个，避免提示词失控）。
const assistantContextReferences = computed(() => {
  return collectWorkflowAssistantContext(nodes.value, edges.value, selectedNodeIds.value)
})

// 输入栏跟随选中节点和画布视口移动，并为左侧工具栏保留安全区域。
const workflowCanvasWrap = ref<HTMLElement | null>(null)
const workflowPromptDockStyle = ref<Record<string, string>>({})
const workflowPromptDockMode = ref<'compact' | 'mini'>('compact')
let promptDockPositionFrame = 0

// 尺寸只随浏览器可视高度适配；不受画布节点或视口移动影响。
const updateWorkflowPromptDockMode = () => {
  workflowPromptDockMode.value = window.innerWidth <= 768 ? 'mini' : 'compact'
}

const updateWorkflowPromptDockPosition = () => {
  cancelAnimationFrame(promptDockPositionFrame)
  void nextTick(() => {
    promptDockPositionFrame = requestAnimationFrame(() => {
      const wrap = workflowCanvasWrap.value
      const selectedNodeId = promptAnchorNodeId.value || Array.from(selectedNodeIds.value)[0]
      // 小屏仍使用底部抽屉，避免大输入框从节点下方溢出屏幕。
      if (window.innerWidth <= 768 || !wrap || !selectedNodeId) {
        workflowPromptDockStyle.value = {}
        return
      }

      const node = wrap.querySelector<HTMLElement>(`.vue-flow__node[data-id="${selectedNodeId}"]`)
      const dock = wrap.querySelector<HTMLElement>('.workflow-prompt-dock')
      if (!node || !dock) return

      const wrapRect = wrap.getBoundingClientRect()
      const nodeRect = node.getBoundingClientRect()
      const dockRect = dock.getBoundingClientRect()
      const gutter = 24
      const nodeGap = 12
      const leftToolbarClearance = 132
      const left = Math.min(
        Math.max(leftToolbarClearance, nodeRect.left - wrapRect.left + nodeRect.width / 2 - dockRect.width / 2),
        Math.max(leftToolbarClearance, wrapRect.width - dockRect.width - gutter),
      )
      const top = Math.max(gutter, nodeRect.bottom - wrapRect.top + nodeGap)

      workflowPromptDockStyle.value = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        bottom: 'auto',
      }
    })
  })
}

watch([selectedNodeIds, promptAnchorNodeId], () => updateWorkflowPromptDockPosition(), { flush: 'post' })

// 节点被快捷键、右键菜单或画布操作删除时，及时清理输入栏锚点，避免悬浮残留。
watch(
  () => nodes.value.map(node => node.id),
  (nodeIds) => {
    if (promptAnchorNodeId.value && !nodeIds.includes(promptAnchorNodeId.value)) {
      promptAnchorNodeId.value = ''
      workflowPromptDockStyle.value = {}
    }
  },
)

// 小地图开关
const isMiniMapOpen = ref(false)
const toggleMiniMap = () => {
  isMiniMapOpen.value = !isMiniMapOpen.value
}

// 右键上下文菜单
const contextMenuVisible = ref(false)
const contextMenuPosition = ref<ContextMenuPosition>({ x: 0, y: 0 })
const contextMenuItems = ref<ContextMenuItem[]>([])
const closeContextMenu = () => {
  contextMenuVisible.value = false
}
const openPaneContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  const flowPos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  contextMenuItems.value = [
    { id: 'add-text', label: '新建文本', onClick: () => addNode('text', flowPos) },
    { id: 'add-image', label: '新建图片', onClick: () => addNode('image', flowPos) },
    { id: 'add-video', label: '新建视频', onClick: () => addNode('video', flowPos) },
    { id: 'add-director', label: '新建导演台', onClick: () => addNode('director', flowPos) },
    { id: 'add-audio', label: '新建音频', onClick: () => addNode('audio', flowPos) },
    { id: 'add-image-config', label: '新建文生图配置', onClick: () => addNode('imageConfig', flowPos) },
    { id: 'divider', label: '', type: 'divider' },
    {
      id: 'paste',
      label: '粘贴',
      shortcut: 'Cmd+V',
      disabled: !hasClipboard(),
      onClick: () => pasteFromSlot(),
    },
  ]
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}
const openNodeContextMenu = (payload: NodeMouseEvent) => {
  payload.event.preventDefault()
  const e = payload.event as unknown as MouseEvent
  contextMenuItems.value = [
    { id: 'duplicate', label: '复制', shortcut: 'Cmd+C', onClick: () => duplicateNode(payload.node.id) },
    { id: 'rotate-left', label: '向左旋转 15°', shortcut: 'Alt+←', onClick: () => rotateSelectedNodes(-ROTATION_STEP, payload.node.id) },
    { id: 'rotate-right', label: '向右旋转 15°', shortcut: 'Alt+→', onClick: () => rotateSelectedNodes(ROTATION_STEP, payload.node.id) },
    { id: 'reset-rotation', label: '重置旋转', onClick: () => resetSelectedNodeRotation(payload.node.id) },
    { id: 'divider-transform', label: '', type: 'divider' },
    { id: 'delete', label: '删除', shortcut: 'Del', danger: true, onClick: () => removeNode(payload.node.id) },
  ]
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

// 清空画布（带确认）
const clearCanvasWithConfirm = () => {
  if (typeof window === 'undefined') return
  if (window.confirm('确定要清空画布吗？此操作不可撤销。')) {
    clearCanvas()
  }
}

// 扩展快捷键
useShortcut('CmdOrCtrl+A', () => selectAll())
useShortcut('CmdOrCtrl+C', () => {
  copySelected()
})
useShortcut('CmdOrCtrl+V', () => {
  pasteFromSlot()
})
useShortcut('Alt+ArrowLeft', () => rotateSelectedNodes(-ROTATION_STEP))
useShortcut('Alt+ArrowRight', () => rotateSelectedNodes(ROTATION_STEP))

// 助手面板（复用 canana 视图的 RightPanel）
const { isPanelCollapsed: isAssistantCollapsed, togglePanel: toggleAssistantPanel } = useChatSessions()
const pendingAssistantMessage = ref('')
const workflowPrompt = ref('')
const workflowPromptGenerationMode = ref<'image' | 'video'>('image')
const workflowPromptImageModel = ref('gpt-image-2')
const workflowPromptVideoModel = ref('')
const workflowPromptCount = ref(1)
const workflowPromptUploadedReferences = ref<Array<{ id: string; url: string; label: string }>>([])
const workflowPromptExcludedReferenceIds = ref<string[]>([])

const readWorkflowPromptModelPrice = (model: { defaultParams?: Record<string, unknown> }, unit: '张' | '次') => {
  const billingRule = model.defaultParams?.billingRule
  const power = billingRule && typeof billingRule === 'object'
    ? Number((billingRule as Record<string, unknown>).power)
    : 0
  return `${Number.isFinite(power) && power > 0 ? power : 1} 积分/${unit}`
}

const workflowPromptImageModels = computed<WorkflowPromptModelOption[]>(() => {
  const catalog = getAllImageModels().map(model => ({
    key: model.key,
    label: model.label || model.modelKey,
    provider: model.providerName || model.providerCode,
    price: readWorkflowPromptModelPrice(model, '张'),
    maxCount: model.maxImagesPerRequest,
  }))
  return catalog.length ? catalog : [{ key: 'gpt-image-2', label: 'gpt-image-2', provider: '（慢）OpenAI', price: '1 积分/张', maxCount: 1 }]
})

const workflowPromptVideoModels = computed<WorkflowPromptModelOption[]>(() => getAllVideoModels().map(model => ({
  key: model.key,
  label: model.label || model.modelKey,
  provider: model.providerName || model.providerCode,
  price: readWorkflowPromptModelPrice(model, '次'),
})))

const workflowPromptModels = computed(() => workflowPromptGenerationMode.value === 'image'
  ? workflowPromptImageModels.value
  : workflowPromptVideoModels.value)

const workflowPromptModel = computed({
  get: () => workflowPromptGenerationMode.value === 'image' ? workflowPromptImageModel.value : workflowPromptVideoModel.value,
  set: (value: string) => {
    if (workflowPromptGenerationMode.value === 'image') workflowPromptImageModel.value = value
    else workflowPromptVideoModel.value = value
  },
})

const workflowPromptPrice = computed(() => workflowPromptGenerationMode.value === 'image'
  ? workflowPromptImageModels.value.find(model => model.key === workflowPromptImageModel.value)?.price || '1 积分/张'
  : '')

const selectedImageNodeId = computed(() => {
  const nodeId = promptAnchorNodeId.value || Array.from(selectedNodeIds.value)[0]
  return nodes.value.find(node => node.id === nodeId && node.type === 'image')?.id || ''
})

const selectedImageIsSubject = computed(() => isWorkflowSubjectNode(nodes.value.find(
  node => node.id === selectedImageNodeId.value,
)))

const resolveWorkflowPromptReferenceUrl = (node: (typeof nodes.value)[number] | undefined) => {
  return resolveWorkflowReferenceUrl(node)
}

const workflowPromptReferences = computed(() => {
  const selectedId = selectedImageNodeId.value
  const subjectReferences: WorkflowPromptReference[] = collectWorkflowSubjectReferences(nodes.value)
  if (!selectedId) return mergeWorkflowPromptReferences<WorkflowPromptReference>(subjectReferences, workflowPromptUploadedReferences.value)
  const incomingIds = edges.value
    .filter(edge => edge.target === selectedId)
    .map(edge => edge.source)
  const candidates = [selectedId, ...incomingIds]
    .map(id => nodes.value.find(node => node.id === id))
    .filter((node): node is (typeof nodes.value)[number] => Boolean(node))
  const referenceNode = candidates.find(node => resolveWorkflowPromptReferenceUrl(node))
    || candidates.find(node => node.type === 'image')
    || candidates[0]
  if (!referenceNode) return mergeWorkflowPromptReferences<WorkflowPromptReference>(subjectReferences, workflowPromptUploadedReferences.value)
  const data = (referenceNode.data || {}) as Record<string, unknown>
  const connectedReference: WorkflowPromptReference = {
    id: referenceNode.id,
    url: resolveWorkflowPromptReferenceUrl(referenceNode) || undefined,
    label: String(data.label || data.name || '参考图'),
  }
  return mergeWorkflowPromptReferences<WorkflowPromptReference>([connectedReference], subjectReferences, workflowPromptUploadedReferences.value)
    .filter(reference => !workflowPromptExcludedReferenceIds.value.includes(reference.id))
    .slice(0, 4)
})

const workflowPromptAvailableReferences = computed(() => nodes.value
  .filter(node => node.type === 'image')
  .map(node => {
    const data = (node.data || {}) as Record<string, unknown>
    return {
      id: node.id,
      url: resolveWorkflowPromptReferenceUrl(node) || undefined,
      label: String(data.label || data.name || 'image'),
      isSubject: Boolean(data.isSubject),
    }
  })
  .filter(reference => reference.url || reference.id === selectedImageNodeId.value))

const handleWorkflowPromptFiles = async (files: File[]) => {
  const availableSlots = getWorkflowPromptAvailableReferenceSlots(workflowPromptReferences.value.length)
  if (!availableSlots) {
    ElMessage.info('最多支持 4 张参考图')
    return
  }

  const selectedFiles = files.slice(0, availableSlots)
  if (selectedFiles.length < files.length) {
    ElMessage.info('最多支持 4 张参考图，已保留前 4 张')
  }

  const settled = await Promise.allSettled(selectedFiles.map(async file => ({
    id: `upload-${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`,
    url: await workflowPromptFileToDataUrl(file),
    label: file.name,
  })))
  const next = settled
    .filter((result): result is PromiseFulfilledResult<{ id: string; url: string; label: string }> => result.status === 'fulfilled' && Boolean(result.value.url))
    .map(result => result.value)
  workflowPromptUploadedReferences.value.push(...next)

  if (next.length < selectedFiles.length) {
    ElMessage.warning('部分参考图读取失败，请重新选择')
  }
}

const handleWorkflowPromptRemoveReference = (id: string) => {
  const uploaded = workflowPromptUploadedReferences.value.find(reference => reference.id === id)
  if (uploaded) {
    if (uploaded.url.startsWith('blob:')) URL.revokeObjectURL(uploaded.url)
    workflowPromptUploadedReferences.value = workflowPromptUploadedReferences.value.filter(reference => reference.id !== id)
    return
  }
  workflowPromptExcludedReferenceIds.value = [...new Set([...workflowPromptExcludedReferenceIds.value, id])]
}

const handleWorkflowPromptCreateSubject = () => {
  const node = nodes.value.find(item => item.id === selectedImageNodeId.value && item.type === 'image')
  if (!node || !resolveWorkflowPromptReferenceUrl(node)) {
    ElMessage.info('请先选择一张已有图片，再创建主体')
    return
  }
  const nextValue = !isWorkflowSubjectNode(node)
  updateNode(node.id, { isSubject: nextValue })
  workflowPromptExcludedReferenceIds.value = workflowPromptExcludedReferenceIds.value.filter(id => id !== node.id)
  ElMessage.success(nextValue ? '已设为主体，并加入当前参考' : '已取消主体标记')
}

const createWorkflowVideoFromPrompt = (text: string, options: WorkflowPromptSendOptions) => {
  if (!options.modelKey) {
    ElMessage.warning('当前暂无可用的视频模型，请先在后台配置模型')
    return false
  }
  const selectedNode = nodes.value.find(node => node.id === selectedImageNodeId.value)
  if (!selectedNode) {
    ElMessage.warning('请先选择一张图片作为视频参考')
    return false
  }

  const promptText = text || `根据${options.references.map(reference => reference.label).join('、') || '参考素材'}生成视频`
  const configPosition = { x: selectedNode.position.x + 380, y: selectedNode.position.y }
  const promptNodeId = addNode('text', { x: configPosition.x, y: configPosition.y + 300 }, {
    content: promptText,
    label: '视频提示词',
  })
  const configNodeId = addNode('videoConfig', configPosition, {
    prompt: promptText,
    model: options.modelKey,
    ratio: options.ratio,
    duration: options.duration || 5,
    resolution: options.resolution,
    label: '图生视频',
    autoExecute: false,
  })
  addEdge({ source: promptNodeId, target: configNodeId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })

  const connectedNodeIds = new Set<string>()
  options.references.forEach((reference, index) => {
    let referenceNodeId = nodes.value.find(node => node.id === reference.id && node.type === 'image')?.id || ''
    if (!referenceNodeId && reference.url) {
      referenceNodeId = addNode('image', {
        x: selectedNode.position.x,
        y: selectedNode.position.y + 300 + index * 190,
      }, { url: reference.url, label: reference.label || '参考图' })
    }
    if (!referenceNodeId || connectedNodeIds.has(referenceNodeId)) return
    connectedNodeIds.add(referenceNodeId)
    const role = resolveWorkflowVideoReferenceRole(options.feature, index)
    addEdge({
      source: referenceNodeId,
      target: configNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'imageRole',
      data: { imageRole: role },
    })
  })

  window.setTimeout(() => updateNode(configNodeId, { autoExecute: true }), 160)
  return true
}

const handleWorkflowPromptSend = (text: string, options: WorkflowPromptSendOptions) => {
  if (options.mode === 'image' && selectedImageNodeId.value) {
    const selectedModel = getAllImageModels().find(model => model.key === options.modelKey)
    const imageParameters = resolveWorkflowPromptImageParameters({
      ratio: options.ratio,
      resolution: options.resolution,
      defaultSize: String(selectedModel?.defaultParams?.size || ''),
      baseSizeOptions: selectedModel?.getSizesByQuality ? SEEDREAM_SIZE_OPTIONS : undefined,
      sizeOptions: selectedModel?.getSizesByQuality
        ? selectedModel.getSizesByQuality(options.resolution === '4k' ? '4k' : 'standard')
        : undefined,
    })
    window.dispatchEvent(new CustomEvent('canvasmind:workflow-image-prompt', {
      detail: {
        nodeId: selectedImageNodeId.value,
        text,
        modelKey: options.modelKey,
        ratio: imageParameters.size,
        resolution: imageParameters.quality,
        count: options.count,
        referenceImages: options.references.map(reference => reference.url).filter(Boolean),
      },
    }))
    workflowPrompt.value = ''
    return
  }
  if (options.mode === 'video' && createWorkflowVideoFromPrompt(text, options)) {
    workflowPrompt.value = ''
    return
  }
  if (!text) return
  pendingAssistantMessage.value = text
  workflowPrompt.value = ''
  if (isAssistantCollapsed.value) {
    toggleAssistantPanel()
  }
}

// 助手生成的图片落到画布：在视口中心创建 image 节点
const handleAssistantAddImage = ({ url }: { url: string }) => {
  if (!url) return
  const center = screenToFlowCoordinate({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  addNode('image', center, { url, label: '助手生成' })
}

watch(selectedImageNodeId, () => {
  workflowPromptExcludedReferenceIds.value = []
})

onMounted(() => {
  initSampleData()
  initHistory()
  void loadPublicModelCatalog().then(() => {
    const nextImageModel = getDefaultImageModelKey() || workflowPromptImageModels.value[0]?.key || 'gpt-image-2'
    const nextVideoModel = getDefaultVideoModelKey() || workflowPromptVideoModels.value[0]?.key || ''
    if (!workflowPromptImageModels.value.some(model => model.key === workflowPromptImageModel.value)) {
      workflowPromptImageModel.value = nextImageModel
    }
    workflowPromptVideoModel.value = nextVideoModel
  })
  initialCanvasBaselineSnapshot.value = currentCanvasSnapshot.value

  window.addEventListener('keydown', handleSpaceDown)
  window.addEventListener('keyup', handleSpaceUp)
  window.addEventListener('resize', updateWorkflowPromptDockMode)
  window.addEventListener(CANVAS_GENERATION_CONFIRMED_EVENT, handleCanvasGenerationConfirmed)
  document.addEventListener('pointerdown', handleWorkflowPromptOutsidePointerDown, true)

  // /canvas 入口沿用旧项目列表的 projectId 参数，统一映射到工作流定义。
  const initialWorkflowId = String(route.query.workflowId || route.query.projectId || '').trim()
  const initialVersionId = String(route.query.versionId || '').trim()
  if (initialWorkflowId) {
    void tryLoadWorkflowByRoute(initialWorkflowId, {
      versionId: initialVersionId || undefined,
    })
  }

  autosaveReady.value = true
  updateWorkflowPromptDockMode()
  updateWorkflowPromptDockPosition()
})

onUnmounted(() => {
  canvasAssistantStreamController.value?.abort()
  resetCanvasAssistantStream()
  window.removeEventListener('keydown', handleSpaceDown)
  window.removeEventListener('keyup', handleSpaceUp)
  window.removeEventListener('resize', updateWorkflowPromptDockMode)
  window.removeEventListener(CANVAS_GENERATION_CONFIRMED_EVENT, handleCanvasGenerationConfirmed)
  document.removeEventListener('pointerdown', handleWorkflowPromptOutsidePointerDown, true)
  cancelAnimationFrame(promptDockPositionFrame)
  clearAutosaveTimer()
  clearWorkflowRunPolling()
  for (const reference of workflowPromptUploadedReferences.value) {
    URL.revokeObjectURL(reference.url)
  }
})

watch(() => [route.query.workflowId, route.query.projectId], ([workflowId, projectId]) => {
  const normalizedWorkflowId = String(workflowId || projectId || '').trim()
  const normalizedVersionId = String(route.query.versionId || '').trim()

  if (!normalizedWorkflowId) {
    if (currentWorkflowId.value) {
      void handleCreateWorkflow()
    }
    return
  }

  if (!normalizedWorkflowId || workflowLoadingByRoute.value) {
    return
  }

  void tryLoadWorkflowByRoute(normalizedWorkflowId, {
    versionId: normalizedVersionId || undefined,
  })
})

// 浏览器后退、地址栏跳走等场景：同样让用户看到"正在保存草稿…"，
// 避免脏 canvas 触发 flushAutosave 时几秒无反馈
const loadingStore = useLoadingStore()
onBeforeRouteLeave(async (_to, _from, next) => {
  loadingStore.start('blocking', '正在保存草稿…')
  try {
    await flushAutosave()
  } finally {
    loadingStore.stop('blocking')
  }
  next()
})

watch(currentCanvasSnapshot, () => {
  scheduleAutosave()
})
</script>

<template>
  <div
    class="workflow-container"
    :class="{
      'workflow-right-panel-open': !isAssistantCollapsed,
      'workflow-running': workflowRunning,
    }"
  >
    <div class="workflow-workbench">
      <div class="workflow-main">
        <div
          ref="workflowCanvasWrap"
          class="workflow-canvas-wrap"
          :class="{
            'workflow-canvas-wrap--prompt-open': Boolean(promptAnchorNodeId),
            'workflow-canvas-wrap--alignment-guides': canvasAlignmentGuides,
          }"
          @dragover="onCanvasFileDragOver"
          @drop="onCanvasFileDrop"
        >
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            v-model:viewport="viewport"
            :node-types="nodeTypes"
            :edge-types="edgeTypes"
            :default-viewport="canvasViewport"
            :min-zoom="0.1"
            :max-zoom="8"
            :snap-to-grid="canvasSnapToGrid"
            :snap-grid="[20, 20]"
            :delete-key-code="['Delete', 'Backspace']"
            :multi-selection-key-code="['Shift', 'Control', 'Meta']"
            :selection-mode="SelectionMode.Partial"
            :pan-on-drag="panOnDragValue"
            :nodes-draggable="!isSpacePressed && !workflowRunning"
            :nodes-connectable="!workflowRunning"
            :pan-on-scroll="false"
            :connect-on-click="false"
            :connection-line-component="CanvasConnectionLine"
            :node-class-name="resolveNodeClass"
            @connect="onConnect"
            @node-click="handleNodeClick"
            @pane-click="onPaneClick"
            @viewport-change="handleViewportChange"
            @edges-change="onEdgesChange"
            @node-drag-start="onNodeDragStart"
            @node-drag="updateWorkflowPromptDockPosition"
            @node-drag-stop="onNodeDragStop"
            @pane-context-menu="openPaneContextMenu"
            @node-context-menu="openNodeContextMenu"
            class="workflow-canvas"
            :class="{ 'workflow-canvas--space-panning': isSpacePressed }"
          >
            <Background
              v-if="canvasBackgroundMode !== 'blank'"
              :gap="canvasBackgroundMode === 'dots' ? 24 : 20"
              :size="canvasBackgroundMode === 'dots' ? 1.2 : 1"
              :variant="canvasBackgroundMode === 'dots' ? 'dots' : 'lines'"
            />
          </VueFlow>

          <CanvasMiniMap :visible="isMiniMapOpen" />
          <CanvasZoomControls
            :mini-map-open="isMiniMapOpen"
            :snap-to-grid="canvasSnapToGrid"
            :alignment-guides="canvasAlignmentGuides"
            @toggle-mini-map="toggleMiniMap"
            @toggle-snap-to-grid="canvasSnapToGrid = !canvasSnapToGrid"
            @toggle-alignment-guides="canvasAlignmentGuides = !canvasAlignmentGuides"
            @open-asset-library="showCanvasAssetLibrary = true"
            @clear="clearCanvasWithConfirm"
          />
          <WorkflowPromptInput
            v-if="promptAnchorNodeId"
            :key="promptAnchorNodeId"
            v-model="workflowPrompt"
            v-model:generation-mode="workflowPromptGenerationMode"
            v-model:model-key="workflowPromptModel"
            class="workflow-prompt-dock"
            :class="{ 'workflow-prompt-dock--mini': workflowPromptDockMode === 'mini' }"
            :style="workflowPromptDockStyle"
            :model-options="workflowPromptModels"
            :references="workflowPromptReferences"
            :available-references="workflowPromptAvailableReferences"
            :create-subject-label="selectedImageIsSubject ? '取消主体' : '创建主体'"
            :count="workflowPromptCount"
            :price="workflowPromptPrice"
            placeholder="描述你想基于当前图片生成的内容，可切换为视频；按 Enter 发送"
            @add-files="handleWorkflowPromptFiles"
            @remove-reference="handleWorkflowPromptRemoveReference"
            @create-subject="handleWorkflowPromptCreateSubject"
            @count-change="workflowPromptCount = $event"
            @send="handleWorkflowPromptSend"
          />
          <CanvasContextMenu
            :visible="contextMenuVisible"
            :position="contextMenuPosition"
            :items="contextMenuItems"
            @close="closeContextMenu"
          />
        </div>

        <header class="workflow-header">
          <div class="workflow-header-left">
            <button class="wf-btn wf-btn-sm" :disabled="goBackLoading" aria-label="返回" data-tooltip="返回上一页" @click="goBack">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="wf-header-meta">
              <input
                v-if="renamingTitle"
                v-model="renameTitleInput"
                class="wf-header-meta__title wf-header-meta__title-input"
                type="text"
                maxlength="80"
                @blur="submitRenameTitle"
                @keyup.enter.prevent="submitRenameTitle"
                @keyup.esc.prevent="cancelRenameTitle"
              />
              <span
                v-else
                class="wf-header-meta__title"
                title="点击重命名项目"
                @click="startRenameTitle"
              >
                {{ currentWorkflowTitle }}
              </span>
              <span class="wf-header-meta__status">
                {{ currentWorkflowStatusText }} · {{ autosaveStatusText }}<template v-if="workflowRunStatusText"> · {{ workflowRunStatusText }}</template>
              </span>
            </div>
          </div>

          <div class="workflow-header-right">
            <div class="wf-header-run-controls">
            <button
              class="wf-btn wf-btn-md wf-btn-primary wf-run-workflow-btn"
              :class="{ 'wf-btn-danger': workflowRunning }"
              type="button"
              :disabled="workflowStopping"
              :data-tooltip="workflowRunning ? '停止当前工作流运行' : '校验并运行全部生成节点'"
              @click="workflowRunning ? handleStopWorkflow() : handleRunWorkflow()"
            >
              <span v-if="workflowRunning" class="wf-spinner"></span>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 5v14l11-7L8 5z" fill="currentColor"/>
              </svg>
              <span>{{ workflowExecutionButtonText }}</span>
            </button>
            <div v-if="latestWorkflowRun" class="wf-run-history">
              <button
                class="wf-btn wf-btn-sm wf-run-history__trigger"
                type="button"
                :class="{ active: showWorkflowRunDetail }"
                data-tooltip="查看最近一次运行详情"
                @click="showWorkflowRunDetail = !showWorkflowRunDetail"
              >
                运行记录
              </button>
              <div v-if="showWorkflowRunDetail" class="wf-run-history__panel" @click.stop>
                <div class="wf-run-history__header">
                  <div>
                    <strong>{{ workflowRunStatusLabel(latestWorkflowRun.status) }}</strong>
                    <span>V{{ latestWorkflowRun.workflowVersion.versionNo }}</span>
                  </div>
                  <span>{{ latestWorkflowRun.completedNodes }}/{{ latestWorkflowRun.totalNodes }}</span>
                </div>
                <div v-if="latestWorkflowRun.errorMessage" class="wf-run-history__error">
                  {{ latestWorkflowRun.errorMessage }}
                </div>
                <button
                  v-if="latestWorkflowRun.executor === 'SERVER' && ['FAILED', 'INTERRUPTED'].includes(latestWorkflowRun.status)"
                  class="wf-btn wf-btn-sm wf-run-history__retry"
                  type="button"
                  @click="handleRetryWorkflowRun"
                >从失败节点重试</button>
                <div class="wf-run-history__nodes">
                  <div v-for="nodeRun in latestWorkflowRun.nodeRuns" :key="nodeRun.id" class="wf-run-history__node">
                    <div class="wf-run-history__node-title">
                      <span>{{ nodeRun.label || nodeRun.nodeId }}</span>
                      <span :data-status="nodeRun.status">{{ workflowNodeRunStatusLabel(nodeRun.status) }}</span>
                    </div>
                    <div v-if="nodeRun.errorMessage" class="wf-run-history__error">{{ nodeRun.errorMessage }}</div>
                    <div v-if="readRunNodeOutput(nodeRun, 'outputContent')" class="wf-run-history__output">
                      {{ readRunNodeOutput(nodeRun, 'outputContent') }}
                    </div>
                    <a
                      v-if="readRunNodeOutputUrl(nodeRun)"
                      class="wf-run-history__link"
                      :href="readRunNodeOutputUrl(nodeRun)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >查看生成结果</a>
                  </div>
                </div>
              </div>
            </div>
            </div>
            <button
              class="wf-account-chip"
              type="button"
              data-tooltip="打开账户中心"
              @click="router.push('/account')"
            >
              <img v-if="authStore.currentUser.value?.avatarUrl" :src="authStore.currentUser.value.avatarUrl" alt="" />
              <span v-else class="wf-account-chip__fallback">{{ workflowUserInitial }}</span>
              <span class="wf-account-chip__name">{{ workflowUserName }}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- 快速连线状态横幅：Alt+点击挂起源节点后顶部提示 -->
        <Transition name="wf-quick-link-banner">
          <div v-if="quickLinkSourceId" class="wf-quick-link-banner" role="status" aria-live="polite">
            <span class="wf-quick-link-banner__dot" aria-hidden="true"></span>
            <span class="wf-quick-link-banner__text">
              正在连线：<strong>{{ quickLinkSourceLabel }}</strong> → 按住 Alt 点击目标节点完成
            </span>
            <span class="wf-quick-link-banner__hint">Esc 取消</span>
            <button
              class="wf-quick-link-banner__close"
              type="button"
              aria-label="取消快速连线"
              @click="cancelQuickLink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </Transition>

        <nav class="workflow-left-toolbar">
          <div class="workflow-left-toolbar-container">
            <button
              class="wf-btn wf-btn-icon"
              :class="{ active: showWorkflowLibraryPanel }"
              aria-label="工作区"
              data-tooltip="打开项目库"
              @click="showWorkflowLibraryPanel = !showWorkflowLibraryPanel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M9 5v14M4 10h16" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>

            <button
              v-if="workspaceScene === 'INFINITE_CANVAS'"
              class="wf-btn wf-btn-icon"
              :class="{ active: showPromptLibrary }"
              type="button"
              aria-label="提示词库"
              data-tooltip="提示词库"
              @click="showPromptLibrary = !showPromptLibrary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h10a4 4 0 0 1 4 4v12l-4-2-4 2-4-2-4 2V8a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 9h7M8 13h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
            <button
              v-if="workspaceScene === 'INFINITE_CANVAS'"
              class="wf-btn wf-btn-icon"
              :class="{ active: showCanvasPluginManager }"
              type="button"
              aria-label="画布插件"
              data-tooltip="画布插件"
              @click="showCanvasPluginManager = !showCanvasPluginManager"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.8 4.5a2.8 2.8 0 1 1 4.4 2.3V10h2.3a2.8 2.8 0 1 1 2.3 4.4V19H5v-4.6A2.8 2.8 0 1 1 7.3 10h2.3V6.8A2.8 2.8 0 0 1 8.8 4.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
            </button>
            <button
              class="wf-btn wf-btn-icon"
              :class="{ active: showNodeMenu }"
              aria-label="添加节点"
              data-tooltip="添加节点"
              @click="showNodeMenu = !showNodeMenu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>

            <button
              v-if="workspaceScene === 'INFINITE_CANVAS'"
              class="wf-btn wf-btn-icon"
              type="button"
              aria-label="画布助手"
              data-tooltip="画布助手（先预览，后确认）"
              @click="runCanvasAssistantPreview"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M19 16.5 19.8 19l2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </button>

            <template v-if="workspaceScene === 'INFINITE_CANVAS'">
              <button
                v-for="preset in CANVAS_ASSISTANT_PRESETS"
                :key="preset.id"
                class="wf-btn wf-btn-icon wf-canvas-assistant-preset"
                type="button"
                :aria-label="preset.title"
                :data-tooltip="`${preset.title}（基于当前选区）`"
                @click="runCanvasAssistantPreset(preset)"
              >{{ preset.shortLabel }}</button>
            </template>

            <button
              class="wf-btn wf-btn-icon"
              :class="{ active: showTemplatePanel }"
              aria-label="工作流模板"
              data-tooltip="插入工作流模板"
              @click="showTemplatePanel = !showTemplatePanel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>

            <button
              v-if="tools[0]"
              class="wf-btn wf-btn-icon"
              @click="tools[0].action"
              :aria-label="tools[0].name"
              :data-tooltip="tools[0].name"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path :d="tools[0].icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <div class="wf-divider"></div>

            <button
              v-for="tool in tools.slice(1)"
              :key="tool.id"
              class="wf-btn wf-btn-icon"
              @click="tool.action"
              :aria-label="tool.name"
              :data-tooltip="tool.name"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path :d="tool.icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <button
              v-for="item in registeredPluginActions"
              :key="`${item.pluginId}:${item.scope}:${item.action.id}`"
              class="wf-btn wf-btn-icon"
              type="button"
              :aria-label="item.action.title"
              :data-tooltip="item.action.description || item.action.title"
              @click="invokeCanvasPluginAction(item)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path :d="item.action.icon || 'M12 3v18M3 12h18'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <button
              v-for="item in registeredPluginInspectorActions"
              :key="`${item.pluginId}:inspector:${item.action.id}:${item.nodeId}`"
              class="wf-btn wf-btn-icon"
              type="button"
              :aria-label="item.action.title"
              :data-tooltip="item.action.description || item.action.title"
              @click="invokeCanvasPluginAction(item)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path :d="item.action.icon || 'M4 4h16v16H4zM8 8h8M8 12h5'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <button
              v-if="selectedPluginGenerationRetry"
              class="wf-btn wf-btn-icon"
              type="button"
              aria-label="重试插件生成"
              data-tooltip="按节点保存的受限模板重新生成"
              @click="retrySelectedPluginGeneration"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 11a8 8 0 10-2.34 5.66M20 4v7h-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <div class="wf-divider"></div>

            <button class="wf-btn wf-btn-icon" :disabled="workflowRunning || !canUndo" aria-label="撤销" data-tooltip="撤销（Ctrl/Command + Z）" @click="undo()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 14l-4-4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="wf-btn wf-btn-icon" :disabled="workflowRunning || !canRedo" aria-label="重做" data-tooltip="重做（Ctrl/Command + Shift + Z）" @click="redo()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M17 14l4-4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </nav>

        <div v-if="showNodeMenu" class="wf-node-menu">
          <button
            v-for="opt in nodeTypeOptions"
            :key="opt.type"
            class="wf-node-menu-item"
            @click="addNewNode(opt.type)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path :d="opt.icon" :stroke="opt.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>{{ opt.name }}</span>
          </button>
        </div>

        <div class="workflow-bottom-toolbar" v-if="false">
          <div class="workflow-bottom-toolbar-container">
            <button class="wf-btn wf-btn-sm" @click="fitView({ padding: 0.2 })" title="适应视图">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="wf-btn wf-btn-sm" @click="zoomOut()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <span class="wf-zoom-text">{{ Math.round(viewport.zoom * 100) }}%</span>
            <button class="wf-btn wf-btn-sm" @click="zoomIn()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <Transition name="wf-panel">
          <div v-if="showPromptLibrary" class="wf-template-panel" @click.self="showPromptLibrary = false">
            <div class="wf-template-panel-inner">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">提示词库</span>
                <button class="wf-btn wf-btn-sm" type="button" @click="showPromptLibrary = false">关闭</button>
              </div>
              <CanvasPromptLibrary @insert="insertLibraryPrompt" />
            </div>
          </div>
        </Transition>

        <Transition name="wf-panel">
          <div v-if="showCanvasAssetLibrary" class="wf-template-panel" @click.self="showCanvasAssetLibrary = false">
            <div class="wf-template-panel-inner">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">素材库</span>
                <button class="wf-btn wf-btn-sm" type="button" @click="showCanvasAssetLibrary = false">关闭</button>
              </div>
              <CanvasAssetLibrary @insert="insertLibraryAsset" />
            </div>
          </div>
        </Transition>

        <Transition name="wf-panel">
          <div v-if="showTemplatePanel" class="wf-template-panel" @click.self="showTemplatePanel = false">
            <div class="wf-template-panel-inner">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">工作流模板</span>
                <button class="wf-btn wf-btn-sm" @click="showTemplatePanel = false">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>
              <div class="wf-template-list">
                <div
                  v-for="tpl in WORKFLOW_TEMPLATES"
                  :key="tpl.id"
                  class="wf-template-card"
                  @click="handleAddWorkflow(tpl)"
                >
                  <div class="wf-template-card-title">{{ tpl.name }}</div>
                  <div class="wf-template-card-desc">{{ tpl.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <Transition name="wf-panel">
          <div v-if="showWorkflowLibraryPanel" class="wf-template-panel" @click.self="showWorkflowLibraryPanel = false">
            <div class="wf-template-panel-inner wf-persistence-panel">
              <div class="wf-persistence-panel__header">
                <div>
                  <div class="wf-persistence-panel__title">打开项目</div>
                  <div class="wf-persistence-panel__desc">查看保存过的项目，并把版本快照恢复到当前画布。</div>
                </div>
                <button class="wf-btn wf-btn-sm" @click="showWorkflowLibraryPanel = false">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>

              <div class="wf-persistence-toolbar">
                <input v-model="workflowListKeyword" class="wf-persistence-input" placeholder="按名称、编码、分类搜索" @keyup.enter="handleRefreshWorkflowList" />
                <input
                  ref="canvasImportFileInput"
                  type="file"
                  accept="application/json,.json,application/zip,.zip"
                  style="display: none"
                  @change="handleCanvasImportFileChange"
                />
                <button
                  v-if="workspaceScene === 'INFINITE_CANVAS'"
                  class="wf-btn wf-btn-md"
                  type="button"
                  @click="importCanvasProjectFromFile"
                >导入</button>
                <button
                  v-if="workspaceScene === 'INFINITE_CANVAS'"
                  class="wf-btn wf-btn-md"
                  type="button"
                  :disabled="!currentWorkflowId"
                  @click="downloadCurrentCanvasProject"
                >导出</button>
                <button
                  v-if="workspaceScene === 'INFINITE_CANVAS'"
                  class="wf-btn wf-btn-md"
                  type="button"
                  :disabled="!currentWorkflowId || !nodes.some(node => node.selected)"
                  @click="downloadSelectedCanvasNodes"
                >导出选区</button>
                <button
                  class="wf-btn wf-btn-md wf-btn-primary"
                  :class="{ 'wf-btn-danger': workflowRunning }"
                  type="button"
                  :disabled="workflowStopping"
                  @click="workflowRunning ? handleStopWorkflow() : handleRunWorkflow()"
                >
                  <span v-if="workflowRunning" class="wf-spinner"></span>
                  {{ workflowExecutionButtonText }}
                </button>
                <button class="wf-btn wf-btn-md" :disabled="workflowListLoading" @click="handleRefreshWorkflowList">
                  {{ workflowListLoading ? '加载中...' : '刷新' }}
                </button>
              </div>

              <div class="wf-workflow-list">
                <div
                  v-for="workflow in workflowList"
                  :key="workflow.id"
                  class="wf-workflow-list__group"
                >
                  <button
                    class="wf-workflow-list__item"
                    :class="{ 'is-active': workflow.id === currentWorkflowId || workflow.id === selectedLibraryWorkflowId }"
                    @click="handleSelectLibraryWorkflow(workflow)"
                  >
                    <div class="wf-workflow-list__main">
                      <div class="wf-workflow-list__title-row">
                        <span class="wf-workflow-list__title">{{ workflow.name }}</span>
                        <span class="wf-workflow-list__badge">{{ workflow.status === 'ACTIVE' ? '已发布' : '草稿' }}</span>
                      </div>
                      <div class="wf-workflow-list__code">{{ workflow.code }}</div>
                      <div class="wf-workflow-list__desc">{{ workflow.description || '暂无描述' }}</div>
                    </div>
                    <div class="wf-workflow-list__meta">
                      <span>版本 {{ workflow.latestVersionNo }}</span>
                      <span>{{ workflow.category || '未分类' }}</span>
                    </div>
                  </button>

                  <div
                    v-if="selectedLibraryWorkflowId === workflow.id"
                    class="wf-workflow-list__versions"
                  >
                    <div class="wf-workflow-list__versions-header">
                      <span>版本列表</span>
                      <button class="wf-btn wf-btn-md wf-btn-primary" @click="handleLoadWorkflow(workflow)">
                        打开当前版本
                      </button>
                    </div>

                    <div v-if="libraryDetailLoading" class="wf-workflow-list__empty">
                      正在加载版本列表...
                    </div>

                    <div
                      v-else-if="selectedLibraryWorkflowDetail?.versions?.length"
                      class="wf-workflow-list__version-list"
                    >
                      <div
                        v-for="version in selectedLibraryWorkflowDetail.versions"
                        :key="version.id"
                        class="wf-workflow-list__version-item"
                        :class="{ 'is-active': version.id === selectedWorkflowVersionId }"
                        @click="handleLoadWorkflowVersion(workflow, version.id)"
                      >
                        <div class="wf-workflow-list__version-main">
                          <span class="wf-workflow-list__version-title">
                            V{{ version.versionNo }} {{ version.versionName || '未命名版本' }}
                          </span>
                          <span class="wf-workflow-list__version-desc">
                            {{ version.changeSummary || '暂无版本说明' }}
                          </span>
                        </div>
                        <span class="wf-workflow-list__version-badge">
                          {{ version.status === 'PUBLISHED' ? '已发布' : version.status === 'DEPRECATED' ? '已废弃' : '草稿' }}
                        </span>
                        <button
                          v-if="version.id !== selectedLibraryWorkflowDetail.definition.currentVersionId"
                          class="wf-btn wf-btn-sm"
                          type="button"
                          @click.stop="handleRollbackWorkflowVersion(workflow, version.id)"
                        >
                          回滚到此版本
                        </button>
                      </div>
                    </div>

                    <div v-else class="wf-workflow-list__empty">
                      这个工作流暂时还没有版本数据。
                    </div>
                  </div>
                </div>

                <div v-if="!workflowListLoading && workflowList.length === 0" class="wf-workflow-list__empty">
                  还没有可打开的工作流，先保存一个吧。
                </div>
              </div>
            </div>
          </div>
        </Transition>

<!--        <ContentGenerator-->
<!--          class="workflow-content-generator"-->
<!--          :collapsible="true"-->
<!--          :default-expanded="false"-->
<!--          popup-placement="top"-->
<!--          @send="handlePromptSend"-->
<!--        />-->
      </div>

      <!-- 右侧助手面板（复用 canana 视图的 RightPanel）：fixed 定位 + translateX 动画 -->
      <aside class="workflow-assistant-aside">
        <RightPanel
          :key="assistantSessionSource"
          :title="currentWorkflowTitle"
          :visible="!isAssistantCollapsed"
          :initial-message="pendingAssistantMessage"
          :context-references="assistantContextReferences"
          :session-source="assistantSessionSource"
          :allow-canvas-proposals="workspaceScene === 'INFINITE_CANVAS'"
          @close="toggleAssistantPanel"
          @message-received="pendingAssistantMessage = ''"
          @add-image-to-canvas="handleAssistantAddImage"
          @canvas-proposal="handleCloudCanvasProposal"
        />
      </aside>

      <section v-if="canvasAssistantStreaming" class="wf-canvas-assistant-stream" role="status" aria-live="polite">
        <div class="wf-canvas-assistant-stream__header">
          <strong>画布助手正在生成结构化提案</strong>
          <button type="button" class="wf-btn wf-btn-sm" @click="canvasAssistantStreamController?.abort()">停止</button>
        </div>
        <p>{{ canvasAssistantStreamContent || '正在连接服务端模型…' }}</p>
      </section>

      <CanvasPluginHost
        v-if="workspaceScene === 'INFINITE_CANVAS'"
        ref="canvasPluginHost"
        :key="canvasPluginHostVersion"
        :snapshot="canvasPluginSnapshot"
        @proposal="handleCanvasPluginProposal"
        @registration="handleCanvasPluginRegistration"
        @generation-started="handleCanvasPluginGenerationStarted"
        @generation-terminal="handleCanvasPluginGenerationTerminal"
        @generation-result="handleCanvasPluginGenerationResult"
        @reset="resetCanvasPluginRegistrations"
      />
      <CanvasPluginManager
        v-if="workspaceScene === 'INFINITE_CANVAS' && showCanvasPluginManager"
        @close="showCanvasPluginManager = false"
        @updated="canvasPluginHostVersion += 1"
      />

      <!-- 折叠态下的展开把手 -->
      <AgentFab v-if="isAssistantCollapsed" @open="toggleAssistantPanel" />
    </div>
  </div>
</template>

<style>
@import './styles/workflow.css';

/* Vue Flow 外层 transform 只负责坐标定位；节点内容读取持久化的 CSS 变量旋转。 */
.workflow-canvas .vue-flow__node > * {
  transform: rotate(var(--canvas-node-rotation, 0deg));
  transform-origin: center;
}

.wf-canvas-assistant-preset {
  font-size: 11px;
  font-weight: 700;
}

.wf-canvas-assistant-stream {
  position: fixed;
  right: 28px;
  bottom: 24px;
  z-index: 30;
  width: min(420px, calc(100vw - 56px));
  padding: 12px 14px;
  border: 1px solid rgba(112, 93, 255, .25);
  border-radius: 12px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 12px 36px rgba(24, 32, 62, .16);
}

.wf-canvas-assistant-stream__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.wf-canvas-assistant-stream p {
  max-height: 130px;
  margin: 8px 0 0;
  overflow: auto;
  color: #5b6476;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
}
</style>
