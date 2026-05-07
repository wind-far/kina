<script setup lang="ts">
/**
 * 工作流主页面
 * 基于 Vue Flow 的节点连线工作流画布
 */
import { computed, ref, watch, onMounted, onUnmounted, nextTick, markRaw } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage } from 'element-plus'
import { VueFlow, useVueFlow, type Connection } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import {
  nodes, edges, addNode, addEdge, updateNode, applyCanvasSnapshot,
  canvasViewport, updateViewport,
  undo, redo, canUndo, canRedo, manualSaveHistory, initSampleData, initHistory,
  type WorkflowAddEdgeParams,
  type WorkflowCanvasEdge,
  type WorkflowNodeType,
} from './composables/useWorkflowCanvas'
import { WORKFLOW_TEMPLATES } from './config/workflows'
import ContentGenerator from '@/components/generate/ContentGenerator.vue'
import { useWorkflowOrchestrator } from './composables/useWorkflowOrchestrator'
import { useWorkflowPersistence } from './composables/useWorkflowPersistence'
import { buildAgentWorkflowStrategy } from '@/config/agentSkills'
import type { WorkflowDefinitionSummary } from './api/definitions'
import type { WorkflowCanvasPosition, WorkflowIntentAnalysisResult } from './composables/workflow-orchestrator-types'

// 节点组件
import TextNode from './components/nodes/TextNode.vue'
import ImageConfigNode from './components/nodes/ImageConfigNode.vue'
import ImageNode from './components/nodes/ImageNode.vue'
import VideoConfigNode from './components/nodes/VideoConfigNode.vue'
import VideoNode from './components/nodes/VideoNode.vue'
import LlmConfigNode from './components/nodes/LlmConfigNode.vue'

// 边组件
import ImageRoleEdge from './components/edges/ImageRoleEdge.vue'
import PromptOrderEdge from './components/edges/PromptOrderEdge.vue'
import ImageOrderEdge from './components/edges/ImageOrderEdge.vue'

const router = useRouter()
const route = useRoute()
const { viewport, zoomIn, zoomOut, fitView, updateNodeInternals } = useVueFlow()

// 注册自定义节点类型
const nodeTypes = {
  text: markRaw(TextNode),
  imageConfig: markRaw(ImageConfigNode),
  image: markRaw(ImageNode),
  videoConfig: markRaw(VideoConfigNode),
  video: markRaw(VideoNode),
  llmConfig: markRaw(LlmConfigNode),
} as any

// 注册自定义边类型
const edgeTypes = {
  imageRole: markRaw(ImageRoleEdge),
  promptOrder: markRaw(PromptOrderEdge),
  imageOrder: markRaw(ImageOrderEdge),
} as any

// 工作流编排器
const { analyzeIntent, executeWorkflow } = useWorkflowOrchestrator()

// 工作流持久化
const {
  currentWorkflowId,
  currentWorkflowDetail,
  workflowList,
  reloadWorkflowList,
  fetchWorkflowDetail,
  loadWorkflowDetail,
  applyWorkflowVersionToCanvas,
  autosaveWorkflow,
  resetCurrentWorkflowState,
} = useWorkflowPersistence()

// UI 状态
const showNodeMenu = ref(false)
const showTemplatePanel = ref(false)
const showWorkflowLibraryPanel = ref(false)
const workflowName = ref('')
const workflowCode = ref('')
const workflowDescription = ref('')
const workflowCategory = ref('')
const workflowListKeyword = ref('')
const workflowListLoading = ref(false)
const workflowLoadingByRoute = ref(false)
const initialCanvasBaselineSnapshot = ref('')
const selectedWorkflowVersionId = ref('')
const libraryDetailLoading = ref(false)
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

interface WorkflowTemplateNode {
  id: string
  type: WorkflowNodeType
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

interface PromptSendOptions {
  skill?: string
}

const currentWorkflowTitle = computed(() => {
  return currentWorkflowDetail.value?.definition?.name || workflowName.value || '未命名工作流'
})

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
    selectedWorkflowVersionId.value = normalizedVersionId
    applyWorkflowVersionToCanvas(detail, normalizedVersionId || undefined)
    syncWorkflowFormFromDetail()
    await nextTick()
    fitView({ padding: 0.24 })
  } catch (error: any) {
    ElMessage.error(error?.message || '打开工作流失败')
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

const handleCreateWorkflow = async () => {
  await flushAutosave()

  resetCurrentWorkflowState()
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
}

// 添加工作流模板
const handleAddWorkflow = (workflow: WorkflowTemplateDefinition) => {
  const cx = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const cy = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  const start = { x: cx - 300, y: cy - 200 }
  const { nodes: newNodes, edges: newEdges } = workflow.createNodes(start)

  newNodes.forEach((node) => {
    const id = addNode(node.type, node.position, node.data)
    newEdges.forEach((edge) => {
      if (edge.source === node.id) edge.source = id
      if (edge.target === node.id) edge.target = id
    })
    node.newId = id
  })

  setTimeout(() => {
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
    newNodes.forEach(node => {
      if (node.newId) {
        updateNodeInternals([node.newId])
      }
    })
  }, 100)

  showTemplatePanel.value = false
}

// 节点类型菜单选项
const nodeTypeOptions: WorkflowNodeOption[] = [
  { type: 'text', name: '文本节点', color: '#3b82f6', icon: 'M4 6h16M4 12h8m-8 6h16' },
  { type: 'imageConfig', name: '文生图配置', color: '#22c55e', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { type: 'videoConfig', name: '视频生成配置', color: '#f59e0b', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { type: 'llmConfig', name: 'LLM 文本生成', color: '#a855f7', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z' },
  { type: 'image', name: '图片节点', color: '#8b5cf6', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { type: 'video', name: '视频节点', color: '#ef4444', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
]

// 工具栏按钮
const tools = [
  { id: 'text', name: '文本', icon: 'M4 6h16M4 12h8m-8 6h16', action: () => addNewNode('text') },
  { id: 'imageConfig', name: '文生图', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', action: () => addNewNode('imageConfig') },
  { id: 'videoConfig', name: '视频生成', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', action: () => addNewNode('videoConfig') },
]

// 添加新节点
const addNewNode = (type: WorkflowNodeType) => {
  const cx = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const cy = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  const id = addNode(type, { x: cx - 140, y: cy - 100 })
  const maxZ = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))
  updateNode(id, { zIndex: maxZ + 1 })
  setTimeout(() => updateNodeInternals([id]), 50)
  showNodeMenu.value = false
}

// 处理连接
const onConnect = (params: Connection) => {
  if (!params.source || !params.target) return

  const normalizedParams: WorkflowAddEdgeParams = {
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? undefined,
    targetHandle: params.targetHandle ?? undefined,
  }

  const sourceNode = nodes.value.find(n => n.id === params.source)
  const targetNode = nodes.value.find(n => n.id === params.target)

  if (sourceNode?.type === 'text' && targetNode?.type === 'imageConfig') {
    const existing = edges.value.filter(e => e.target === params.target && e.type === 'promptOrder')
    addEdge({ ...normalizedParams, type: 'promptOrder', data: { promptOrder: existing.length + 1 } })
  } else if (sourceNode?.type === 'image' && targetNode?.type === 'imageConfig') {
    const existing = edges.value.filter(e => e.target === params.target && e.type === 'imageOrder')
    addEdge({ ...normalizedParams, type: 'imageOrder', data: { imageOrder: existing.length + 1 } })
  } else if (sourceNode?.type === 'image' && targetNode?.type === 'videoConfig') {
    addEdge({ ...normalizedParams, type: 'imageRole', data: { imageRole: 'first_frame_image' } })
  } else if (sourceNode?.type === 'text' && targetNode?.type === 'videoConfig') {
    addEdge({ ...normalizedParams, type: 'promptOrder', data: { promptOrder: 1 } })
  } else {
    addEdge(normalizedParams)
  }
}

// 处理视口变化
const handleViewportChange = (v: typeof canvasViewport.value) => updateViewport(v)

// 处理边变化
const onEdgesChange = (changes: Array<{ type?: string }>) => {
  if (changes.some(c => c.type === 'remove')) {
    nextTick(() => manualSaveHistory())
  }
}

// 处理画布点击
const onPaneClick = () => {
  showNodeMenu.value = false
}

// 处理内容生成器发送（使用工作流编排器）
const handlePromptSend = async (
  message: string,
  type: string,
  options?: PromptSendOptions,
) => {
  const cx = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const cy = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  const position = { x: cx - 300, y: cy - 100 }

  if (type === 'agent') {
    try {
      const strategy = buildAgentWorkflowStrategy(options?.skill || 'general', message)
      if (strategy.mode === 'direct') {
        await executeWorkflow(strategy.params as unknown as WorkflowIntentAnalysisResult, position)
      } else {
        const intent = await analyzeIntent(strategy.userInput, {
          systemPromptOverride: strategy.systemPrompt,
        })
        await executeWorkflow(intent, position)
      }
    } catch (err) {
      console.error('工作流执行失败:', err)
    }
  } else if (type === 'image') {
    await executeWorkflow({ workflow_type: 'text_to_image', image_prompt: message }, position)
  } else if (type === 'video') {
    await executeWorkflow({
      workflow_type: 'text_to_image_to_video',
      image_prompt: message,
      video_prompt: message,
    }, position)
  }
}

// 返回首页
const goBack = async () => {
  await flushAutosave()

  const returnTo = String(route.query.returnTo || '').trim()
  if (returnTo) {
    await router.push(returnTo)
    return
  }

  await router.push('/')
}

const handleRefreshWorkflowList = async () => {
  workflowListLoading.value = true

  try {
    await reloadWorkflowList({
      scene: 'WORKFLOW_CANVAS',
      keyword: workflowListKeyword.value || undefined,
    })
  } finally {
    workflowListLoading.value = false
  }
}

const handleLoadWorkflow = async (workflow: WorkflowDefinitionSummary) => {
  const versionId = selectedLibraryWorkflowId.value === workflow.id
    ? selectedWorkflowVersionId.value || selectedLibraryWorkflowDetail.value?.definition.currentVersionId || ''
    : ''
  await tryLoadWorkflowByRoute(workflow.id, { versionId })
  await syncWorkflowRouteQuery(workflow.id)
  showWorkflowLibraryPanel.value = false
  ElMessage.success(`已打开工作流：${workflow.name}`)
}

const handleSelectLibraryWorkflow = async (workflow: WorkflowDefinitionSummary) => {
  selectedLibraryWorkflowId.value = workflow.id
  selectedLibraryWorkflowDetail.value = null
  libraryDetailLoading.value = true

  try {
    selectedLibraryWorkflowDetail.value = await fetchWorkflowDetail(workflow.id)
  } finally {
    libraryDetailLoading.value = false
  }
}

const handleLoadWorkflowVersion = async (workflow: WorkflowDefinitionSummary, versionId: string) => {
  await tryLoadWorkflowByRoute(workflow.id, { versionId })
  await syncWorkflowRouteQuery(workflow.id)
  showWorkflowLibraryPanel.value = false
  ElMessage.success(`已打开 ${workflow.name} 的指定版本`)
}

const performAutosave = async () => {
  autosaveState.value = 'saving'
  autosaveErrorMessage.value = ''

  const detail = await autosaveWorkflow({
    workflowId: currentWorkflowId.value || undefined,
    name: workflowName.value || `未命名工作流 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
    code: workflowCode.value || undefined,
    description: workflowDescription.value || null,
    category: workflowCategory.value || null,
    scene: 'WORKFLOW_CANVAS',
  })

  currentWorkflowDetail.value = detail
  currentWorkflowId.value = detail.definition.id
  selectedWorkflowVersionId.value = detail.definition.currentVersionId || detail.definition.latestVersion?.id || ''
  syncWorkflowFormFromDetail()
  await syncWorkflowRouteQuery(detail.definition.id)
  autosaveState.value = 'saved'
}

const scheduleAutosave = () => {
  if (!autosaveReady.value || workflowLoadingByRoute.value || !isCanvasDirty.value) {
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

// 键盘快捷键
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault()
    e.shiftKey ? redo() : undo()
    return
  }

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault()
    void handleCreateWorkflow()
  }
}

onMounted(() => {
  initSampleData()
  initHistory()
  initialCanvasBaselineSnapshot.value = currentCanvasSnapshot.value
  window.addEventListener('keydown', handleKeydown)

  const initialWorkflowId = String(route.query.workflowId || '').trim()
  const initialVersionId = String(route.query.versionId || '').trim()
  if (initialWorkflowId) {
    void tryLoadWorkflowByRoute(initialWorkflowId, {
      versionId: initialVersionId || undefined,
    })
  }

  autosaveReady.value = true
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  clearAutosaveTimer()
})

watch(() => route.query.workflowId, (workflowId) => {
  const normalizedWorkflowId = String(workflowId || '').trim()
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

onBeforeRouteLeave(async (_to, _from, next) => {
  await flushAutosave()
  next()
})

watch(currentCanvasSnapshot, () => {
  scheduleAutosave()
})
</script>

<template>
  <div class="workflow-container">
    <div class="workflow-workbench">
      <div class="workflow-main">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          v-model:viewport="viewport"
          :node-types="nodeTypes"
          :edge-types="edgeTypes"
          :default-viewport="canvasViewport"
          :min-zoom="0.1"
          :max-zoom="2"
          :snap-to-grid="true"
          :snap-grid="[20, 20]"
          @connect="onConnect"
          @pane-click="onPaneClick"
          @viewport-change="handleViewportChange"
          @edges-change="onEdgesChange"
          class="workflow-canvas"
        >
          <Background :gap="20" :size="1" />
          <MiniMap position="bottom-right" :pannable="true" :zoomable="true" />
        </VueFlow>

        <header class="workflow-header">
          <div class="workflow-header-left">
            <button class="wf-btn wf-btn-sm" @click="goBack" title="返回">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <span style="font-size: 13px; color: var(--text-primary); padding: 0 8px;">工作流</span>
          </div>

          <div class="workflow-header-right">
            <div class="wf-header-meta">
              <span class="wf-header-meta__title">{{ currentWorkflowTitle }}</span>
              <span class="wf-header-meta__status">{{ currentWorkflowStatusText }} · {{ autosaveStatusText }}</span>
            </div>
          </div>
        </header>

        <nav class="workflow-left-toolbar">
          <div class="workflow-left-toolbar-container">
            <button
              class="wf-btn wf-btn-icon"
              :class="{ active: showNodeMenu }"
              @click="showNodeMenu = !showNodeMenu"
              title="添加节点"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>

            <button
              class="wf-btn wf-btn-icon"
              :class="{ active: showTemplatePanel }"
              @click="showTemplatePanel = !showTemplatePanel"
              title="工作流模板"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>

            <div class="wf-divider"></div>

            <button
              v-for="tool in tools"
              :key="tool.id"
              class="wf-btn wf-btn-icon"
              @click="tool.action"
              :title="tool.name"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path :d="tool.icon" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <div class="wf-divider"></div>

            <button class="wf-btn wf-btn-icon" :disabled="!canUndo()" @click="undo()" title="撤销">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M7 14l-4-4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="wf-btn wf-btn-icon" :disabled="!canRedo()" @click="redo()" title="重做">
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

        <div class="workflow-bottom-toolbar">
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
                  <div class="wf-persistence-panel__title">打开工作流</div>
                  <div class="wf-persistence-panel__desc">查看保存过的工作流定义，并把版本快照恢复到当前画布。</div>
                </div>
                <button class="wf-btn wf-btn-sm" @click="showWorkflowLibraryPanel = false">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>

              <div class="wf-persistence-toolbar">
                <input v-model="workflowListKeyword" class="wf-persistence-input" placeholder="按名称、编码、分类搜索" @keyup.enter="handleRefreshWorkflowList" />
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
                      <button
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
                      </button>
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

        <ContentGenerator
          class="workflow-content-generator"
          :collapsible="true"
          :default-expanded="false"
          popup-placement="top"
          @send="handlePromptSend"
        />
      </div>
    </div>
  </div>
</template>

<style>
@import './styles/workflow.css';
</style>
