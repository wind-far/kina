import { computed, ref } from 'vue'
import {
  autosaveWorkflowDefinitionDraft,
  createWorkflowDefinition,
  createWorkflowDefinitionVersion,
  getWorkflowDefinitionDetail,
  listWorkflowDefinitions,
  publishWorkflowDefinition,
  type WorkflowDefinitionCreatePayload,
  type WorkflowDefinitionDetailResponse,
  type WorkflowDefinitionListQuery,
  type WorkflowDefinitionSummary,
  type WorkflowDefinitionVersionPayload,
} from '../api/definitions'
import {
  applyCanvasSnapshot,
  canvasViewport,
  edges,
  nodes,
  type WorkflowCanvasEdge,
  type WorkflowCanvasNode,
} from './useWorkflowCanvas'

export interface WorkflowPersistenceSnapshot {
  definitionJson: {
    scene: string
    nodeCount: number
    edgeCount: number
  }
  nodesJson: WorkflowCanvasNode[]
  edgesJson: WorkflowCanvasEdge[]
  viewportJson: {
    x: number
    y: number
    zoom: number
  }
  runtimeConfigJson: {
    savedAt: string
  }
}

export interface SaveWorkflowOptions {
  workflowId?: string
  name?: string
  code?: string
  description?: string | null
  category?: string | null
  scene?: string
  versionName?: string | null
  changeSummary?: string | null
  publish?: boolean
}

export interface AutosaveWorkflowOptions {
  workflowId?: string
  name?: string
  code?: string
  description?: string | null
  category?: string | null
  scene?: string
}

// 工作流持久化层，负责把画布快照转换成接口需要的定义结构。
export const useWorkflowPersistence = () => {
  const saving = ref(false)
  const loading = ref(false)
  const currentWorkflowId = ref('')
  const currentWorkflowDetail = ref<WorkflowDefinitionDetailResponse | null>(null)
  const workflowList = ref<WorkflowDefinitionSummary[]>([])

  const hasWorkflow = computed(() => Boolean(currentWorkflowId.value))

  const buildWorkflowSnapshot = (): WorkflowPersistenceSnapshot => {
    return {
      definitionJson: {
        scene: 'WORKFLOW_CANVAS',
        nodeCount: nodes.value.length,
        edgeCount: edges.value.length,
      },
      nodesJson: JSON.parse(JSON.stringify(nodes.value)) as WorkflowCanvasNode[],
      edgesJson: JSON.parse(JSON.stringify(edges.value)) as WorkflowCanvasEdge[],
      viewportJson: {
        x: canvasViewport.value.x,
        y: canvasViewport.value.y,
        zoom: canvasViewport.value.zoom,
      },
      runtimeConfigJson: {
        savedAt: new Date().toISOString(),
      },
    }
  }

  const reloadWorkflowList = async (query: WorkflowDefinitionListQuery = {}) => {
    const response = await listWorkflowDefinitions(query)
    workflowList.value = response.items
    return workflowList.value
  }

  const loadWorkflowDetail = async (workflowId: string) => {
    loading.value = true
    try {
      const detail = await getWorkflowDefinitionDetail(workflowId)
      currentWorkflowId.value = workflowId
      currentWorkflowDetail.value = detail
      return detail
    } finally {
      loading.value = false
    }
  }

  const fetchWorkflowDetail = async (workflowId: string) => {
    return await getWorkflowDefinitionDetail(workflowId)
  }

  const applyWorkflowDetailToCanvas = (detail: WorkflowDefinitionDetailResponse) => {
    const currentVersion = detail.definition.currentVersion
      || detail.definition.latestVersion
      || detail.versions[0]

    if (!currentVersion) {
      applyCanvasSnapshot({
        nodes: [],
        edges: [],
      }, {
        x: 0,
        y: 0,
        zoom: 1,
      })
      return
    }

    const canvasNodes = Array.isArray(currentVersion?.nodesJson)
      ? currentVersion.nodesJson as WorkflowCanvasNode[]
      : []
    const canvasEdges = Array.isArray(currentVersion?.edgesJson)
      ? currentVersion.edgesJson as WorkflowCanvasEdge[]
      : []
    const viewportJson = currentVersion?.viewportJson
      && typeof currentVersion.viewportJson === 'object'
      ? {
        x: Number((currentVersion.viewportJson as { x?: number }).x || 0),
        y: Number((currentVersion.viewportJson as { y?: number }).y || 0),
        zoom: Number((currentVersion.viewportJson as { zoom?: number }).zoom || 1) || 1,
      }
      : null

    applyCanvasSnapshot({
      nodes: canvasNodes,
      edges: canvasEdges,
    }, viewportJson)
  }

  const applyWorkflowVersionToCanvas = (
    detail: WorkflowDefinitionDetailResponse,
    versionId?: string | null,
  ) => {
    const normalizedVersionId = String(versionId || '').trim()
    const matchedVersion = normalizedVersionId
      ? detail.versions.find(item => item.id === normalizedVersionId)
      : null

    const targetVersion = matchedVersion
      || detail.definition.currentVersion
      || detail.definition.latestVersion
      || detail.versions[0]

    if (!targetVersion) {
      applyCanvasSnapshot({
        nodes: [],
        edges: [],
      }, {
        x: 0,
        y: 0,
        zoom: 1,
      })
      return
    }

    const canvasNodes = Array.isArray(targetVersion.nodesJson)
      ? targetVersion.nodesJson as WorkflowCanvasNode[]
      : []
    const canvasEdges = Array.isArray(targetVersion.edgesJson)
      ? targetVersion.edgesJson as WorkflowCanvasEdge[]
      : []
    const viewportJson = targetVersion.viewportJson
      && typeof targetVersion.viewportJson === 'object'
      ? {
        x: Number((targetVersion.viewportJson as { x?: number }).x || 0),
        y: Number((targetVersion.viewportJson as { y?: number }).y || 0),
        zoom: Number((targetVersion.viewportJson as { zoom?: number }).zoom || 1) || 1,
      }
      : null

    applyCanvasSnapshot({
      nodes: canvasNodes,
      edges: canvasEdges,
    }, viewportJson)
  }

  const resetCurrentWorkflowState = () => {
    currentWorkflowId.value = ''
    currentWorkflowDetail.value = null
  }

  const saveWorkflow = async (options: SaveWorkflowOptions) => {
    saving.value = true
    try {
      const snapshot = buildWorkflowSnapshot()

      if (!options.workflowId && !currentWorkflowId.value) {
        const payload: WorkflowDefinitionCreatePayload = {
          code: options.code,
          name: options.name || '未命名工作流',
          description: options.description || null,
          category: options.category || null,
          scene: options.scene || 'WORKFLOW_CANVAS',
          sourceType: 'VISUAL',
          status: options.publish ? 'ACTIVE' : 'DRAFT',
          versionName: options.versionName || null,
          changeSummary: options.changeSummary || null,
          ...snapshot,
        }

        const detail = await createWorkflowDefinition(payload)
        currentWorkflowId.value = detail.definition.id
        currentWorkflowDetail.value = detail
        return detail
      }

      const targetWorkflowId = options.workflowId || currentWorkflowId.value
      const versionPayload: WorkflowDefinitionVersionPayload = {
        versionName: options.versionName || null,
        changeSummary: options.changeSummary || null,
        status: options.publish ? 'PUBLISHED' : 'DRAFT',
        ...snapshot,
      }

      const savedVersion = await createWorkflowDefinitionVersion(targetWorkflowId, versionPayload)
      if (options.publish) {
        await publishWorkflowDefinition(targetWorkflowId, savedVersion.id)
      }

      const detail = await getWorkflowDefinitionDetail(targetWorkflowId)
      currentWorkflowId.value = targetWorkflowId
      currentWorkflowDetail.value = detail
      return detail
    } finally {
      saving.value = false
    }
  }

  const autosaveWorkflow = async (options: AutosaveWorkflowOptions) => {
    saving.value = true
    try {
      const snapshot = buildWorkflowSnapshot()

      if (!options.workflowId && !currentWorkflowId.value) {
        const detail = await createWorkflowDefinition({
          code: options.code,
          name: options.name || '未命名工作流',
          description: options.description || null,
          category: options.category || null,
          scene: options.scene || 'WORKFLOW_CANVAS',
          sourceType: 'VISUAL',
          status: 'DRAFT',
          versionName: '自动保存',
          changeSummary: '系统自动保存草稿',
          ...snapshot,
        })
        currentWorkflowId.value = detail.definition.id
        currentWorkflowDetail.value = detail
        return detail
      }

      const targetWorkflowId = options.workflowId || currentWorkflowId.value
      await autosaveWorkflowDefinitionDraft(targetWorkflowId, {
        versionName: '自动保存',
        changeSummary: '系统自动保存草稿',
        status: 'DRAFT',
        ...snapshot,
      })

      const detail = await getWorkflowDefinitionDetail(targetWorkflowId)
      currentWorkflowId.value = targetWorkflowId
      currentWorkflowDetail.value = detail
      return detail
    } finally {
      saving.value = false
    }
  }

  return {
    saving,
    loading,
    hasWorkflow,
    currentWorkflowId,
    currentWorkflowDetail,
    workflowList,
    buildWorkflowSnapshot,
    reloadWorkflowList,
    fetchWorkflowDetail,
    loadWorkflowDetail,
    applyWorkflowDetailToCanvas,
    applyWorkflowVersionToCanvas,
    resetCurrentWorkflowState,
    saveWorkflow,
    autosaveWorkflow,
  }
}
