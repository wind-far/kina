import { ref } from 'vue'
import {
  autosaveWorkflowDefinitionDraft,
  createWorkflowDefinition,
  deleteWorkflowDefinition,
  getWorkflowDefinitionDetail,
  listWorkflowDefinitions,
  updateWorkflowDefinition,
  type WorkflowDefinitionDetailResponse,
  type WorkflowDefinitionSummary,
  type WorkflowDefinitionVersionDetail,
} from '@/views/workflow/api/definitions'
import type { InfiniteCanvasSnapshot } from '@/types/infinite-canvas'
import { normalizeInfiniteCanvasImages } from '@/shared/infinite-canvas-layout'

const EMPTY_SNAPSHOT: InfiniteCanvasSnapshot = {
  schemaVersion: 2,
  images: [],
  viewport: { x: 0, y: 0, scale: 1 },
}

const readCurrentVersion = (detail: WorkflowDefinitionDetailResponse): WorkflowDefinitionVersionDetail | null => (
  detail.definition.currentVersion || detail.definition.latestVersion || detail.versions[0] || null
)

export const normalizeInfiniteCanvasProjectSnapshot = (detail: WorkflowDefinitionDetailResponse): InfiniteCanvasSnapshot => {
  const version = readCurrentVersion(detail)
  const rawNodes = Array.isArray(version?.nodesJson) ? version.nodesJson : []
  const definitionJson = version?.definitionJson && typeof version.definitionJson === 'object'
    ? version.definitionJson as Record<string, unknown>
    : {}
  const usesFreeformPositions = Number(definitionJson.schemaVersion || 1) >= 2
  const images = normalizeInfiniteCanvasImages(rawNodes.map((item) => {
    if (!item || typeof item !== 'object') return item
    const record = item as Record<string, any>
    const data = record.data && typeof record.data === 'object' ? record.data as Record<string, any> : record
    return {
      ...data,
      id: record.id || data.id,
      x: data.x ?? (usesFreeformPositions ? record.position?.x : undefined),
      y: data.y ?? (usesFreeformPositions ? record.position?.y : undefined),
    }
  }))

  const viewport = version?.viewportJson && typeof version.viewportJson === 'object'
    ? version.viewportJson as Record<string, unknown>
    : {}

  return {
    schemaVersion: 2,
    images,
    viewport: {
      x: Number(viewport.x || 0),
      y: Number(viewport.y || 0),
      scale: Math.max(0.01, Number(viewport.zoom || viewport.scale || 1) || 1),
    },
  }
}

export const buildInfiniteCanvasVersionPayload = (
  snapshot: InfiniteCanvasSnapshot,
  baseVersion?: WorkflowDefinitionVersionDetail | null,
) => ({
  baseVersionId: baseVersion?.id || null,
  baseVersionUpdatedAt: baseVersion?.updatedAt || null,
  versionName: '自动保存',
  changeSummary: '无限画布自动保存草稿',
  status: 'DRAFT',
  definitionJson: {
    scene: 'INFINITE_CANVAS',
    schemaVersion: snapshot.schemaVersion,
    nodeCount: snapshot.images.length,
    edgeCount: 0,
  },
  nodesJson: snapshot.images.map(image => ({
    id: String(image.id),
    type: 'image',
    position: { x: image.x, y: image.y },
    data: { ...image },
  })),
  edgesJson: [],
  viewportJson: {
    x: snapshot.viewport.x,
    y: snapshot.viewport.y,
    zoom: snapshot.viewport.scale,
  },
  runtimeConfigJson: {
    savedAt: new Date().toISOString(),
    layout: 'freeform',
  },
})

export const useInfiniteCanvasProject = () => {
  const currentProjectId = ref('')
  const currentProjectDetail = ref<WorkflowDefinitionDetailResponse | null>(null)
  const projects = ref<WorkflowDefinitionSummary[]>([])
  const saving = ref(false)
  const loading = ref(false)

  const listProjects = async (keyword?: string) => {
    const response = await listWorkflowDefinitions({
      scene: 'INFINITE_CANVAS',
      keyword: keyword || undefined,
      pageSize: 50,
    })
    projects.value = response.items
    return projects.value
  }

  const loadProject = async (projectId: string) => {
    loading.value = true
    try {
      const detail = await getWorkflowDefinitionDetail(projectId)
      if (detail.definition.scene !== 'INFINITE_CANVAS') {
        throw new Error('目标项目不是无限画布项目')
      }
      currentProjectId.value = detail.definition.id
      currentProjectDetail.value = detail
      return {
        detail,
      snapshot: normalizeInfiniteCanvasProjectSnapshot(detail),
      }
    } finally {
      loading.value = false
    }
  }

  const autosaveProject = async (input: {
    title: string
    snapshot: InfiniteCanvasSnapshot
    description?: string | null
  }) => {
    saving.value = true
    try {
      const snapshot = input.snapshot || EMPTY_SNAPSHOT
      if (!currentProjectId.value) {
        const detail = await createWorkflowDefinition({
          name: input.title || '未命名创作项目',
          description: input.description || null,
          category: '创作区',
          scene: 'INFINITE_CANVAS',
          sourceType: 'VISUAL',
          ...buildInfiniteCanvasVersionPayload(snapshot),
        })
        currentProjectId.value = detail.definition.id
        currentProjectDetail.value = detail
        return detail
      }

      const baseVersion = currentProjectDetail.value
        ? readCurrentVersion(currentProjectDetail.value)
        : null
      await autosaveWorkflowDefinitionDraft(
        currentProjectId.value,
        buildInfiniteCanvasVersionPayload(snapshot, baseVersion),
      )
      const detail = await getWorkflowDefinitionDetail(currentProjectId.value)
      currentProjectDetail.value = detail
      return detail
    } finally {
      saving.value = false
    }
  }

  const renameProject = async (name: string) => {
    if (!currentProjectId.value) return null
    const detail = await updateWorkflowDefinition(currentProjectId.value, { name })
    currentProjectDetail.value = detail
    return detail
  }

  const removeProject = async (projectId: string) => {
    await deleteWorkflowDefinition(projectId)
    if (currentProjectId.value === projectId) {
      resetProject()
    }
    await listProjects()
  }

  const resetProject = () => {
    currentProjectId.value = ''
    currentProjectDetail.value = null
  }

  return {
    currentProjectId,
    currentProjectDetail,
    projects,
    saving,
    loading,
    listProjects,
    loadProject,
    autosaveProject,
    renameProject,
    removeProject,
    resetProject,
  }
}
