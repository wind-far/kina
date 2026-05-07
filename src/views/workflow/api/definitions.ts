import { buildApiUrl } from '@/api/http'
import { handleUnauthorizedResponse, readApiData } from '@/api/response'

export interface WorkflowDefinitionSummary {
  id: string
  userId: string | null
  code: string
  name: string
  description: string | null
  category: string | null
  scene: string
  sourceType: string
  status: string
  currentVersionId: string | null
  latestVersionNo: number
  isBuiltIn: boolean
  isEnabled: boolean
  sortOrder: number
  tagsJson: unknown
  createdAt: string
  updatedAt: string
  currentVersion?: WorkflowDefinitionVersionDetail | null
  latestVersion?: WorkflowDefinitionVersionDetail | null
  versionCount: number
}

export interface WorkflowDefinitionVersionDetail {
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
}

export interface WorkflowDefinitionDetailResponse {
  definition: WorkflowDefinitionSummary
  versions: WorkflowDefinitionVersionDetail[]
}

export interface WorkflowDefinitionListQuery {
  scene?: string
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface WorkflowDefinitionListResponse {
  items: WorkflowDefinitionSummary[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface WorkflowDefinitionCreatePayload {
  code?: string
  name?: string
  description?: string | null
  category?: string | null
  scene?: string
  sourceType?: string
  status?: string
  isBuiltIn?: boolean
  isEnabled?: boolean
  sortOrder?: number
  tagsJson?: unknown
  versionName?: string | null
  changeSummary?: string | null
  definitionJson?: unknown
  nodesJson?: unknown
  edgesJson?: unknown
  viewportJson?: unknown
  inputSchemaJson?: unknown
  outputSchemaJson?: unknown
  runtimeConfigJson?: unknown
}

export interface WorkflowDefinitionVersionPayload {
  versionName?: string | null
  changeSummary?: string | null
  status?: string
  definitionJson?: unknown
  nodesJson?: unknown
  edgesJson?: unknown
  viewportJson?: unknown
  inputSchemaJson?: unknown
  outputSchemaJson?: unknown
  runtimeConfigJson?: unknown
}

export interface WorkflowDefinitionUpdatePayload {
  name?: string
  description?: string | null
  category?: string | null
  status?: string
  isEnabled?: boolean
  sortOrder?: number
  tagsJson?: unknown
}

const WORKFLOW_DEFINITIONS_PATH = '/api/workflows'

const buildWorkflowListUrl = (query: WorkflowDefinitionListQuery = {}) => {
  const url = new URL(buildApiUrl(WORKFLOW_DEFINITIONS_PATH), window.location.origin)

  if (query.scene) {
    url.searchParams.set('scene', query.scene)
  }

  if (query.status) {
    url.searchParams.set('status', query.status)
  }

  if (query.keyword) {
    url.searchParams.set('keyword', query.keyword)
  }

  if (query.page) {
    url.searchParams.set('page', String(query.page))
  }

  if (query.pageSize) {
    url.searchParams.set('pageSize', String(query.pageSize))
  }

  return `${url.pathname}${url.search}`
}

const requestWorkflowApi = async <T>(input: {
  url: string
  method?: string
  data?: unknown
  successMessage?: string
}) => {
  const response = await fetch(buildApiUrl(input.url), {
    method: input.method || 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: input.data === undefined ? undefined : JSON.stringify(input.data),
  })

  handleUnauthorizedResponse(response.status, 'workflow-definitions')

  return await readApiData<T>(response, {
    showSuccessMessage: Boolean(input.successMessage),
    successMessage: input.successMessage,
  })
}

export const listWorkflowDefinitions = async (query: WorkflowDefinitionListQuery = {}) => {
  return await requestWorkflowApi<WorkflowDefinitionListResponse>({
    url: buildWorkflowListUrl(query),
  })
}

export const getWorkflowDefinitionDetail = async (workflowId: string) => {
  return await requestWorkflowApi<WorkflowDefinitionDetailResponse>({
    url: `${WORKFLOW_DEFINITIONS_PATH}/${encodeURIComponent(workflowId)}`,
  })
}

export const createWorkflowDefinition = async (payload: WorkflowDefinitionCreatePayload) => {
  return await requestWorkflowApi<WorkflowDefinitionDetailResponse>({
    url: WORKFLOW_DEFINITIONS_PATH,
    method: 'POST',
    data: payload,
    successMessage: '工作流已创建',
  })
}

export const createWorkflowDefinitionVersion = async (
  workflowId: string,
  payload: WorkflowDefinitionVersionPayload,
) => {
  return await requestWorkflowApi<WorkflowDefinitionVersionDetail>({
    url: `${WORKFLOW_DEFINITIONS_PATH}/${encodeURIComponent(workflowId)}/versions`,
    method: 'POST',
    data: payload,
    successMessage: '工作流版本已保存',
  })
}

export const updateWorkflowDefinition = async (
  workflowId: string,
  payload: WorkflowDefinitionUpdatePayload,
) => {
  return await requestWorkflowApi<WorkflowDefinitionDetailResponse>({
    url: `${WORKFLOW_DEFINITIONS_PATH}/${encodeURIComponent(workflowId)}`,
    method: 'PATCH',
    data: payload,
    successMessage: '工作流已更新',
  })
}

export const deleteWorkflowDefinition = async (workflowId: string) => {
  return await requestWorkflowApi<{ id: string; name: string; deleted: boolean }>({
    url: `${WORKFLOW_DEFINITIONS_PATH}/${encodeURIComponent(workflowId)}`,
    method: 'DELETE',
    successMessage: '工作流已删除',
  })
}

export const autosaveWorkflowDefinitionDraft = async (
  workflowId: string,
  payload: WorkflowDefinitionVersionPayload,
) => {
  return await requestWorkflowApi<WorkflowDefinitionVersionDetail>({
    url: `${WORKFLOW_DEFINITIONS_PATH}/${encodeURIComponent(workflowId)}/draft`,
    method: 'PUT',
    data: payload,
  })
}

export const publishWorkflowDefinition = async (workflowId: string, versionId?: string) => {
  return await requestWorkflowApi<WorkflowDefinitionVersionDetail>({
    url: `${WORKFLOW_DEFINITIONS_PATH}/${encodeURIComponent(workflowId)}/publish`,
    method: 'POST',
    data: versionId ? { versionId } : {},
    successMessage: '工作流版本已发布',
  })
}
