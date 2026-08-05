import { readJsonBody, sendJson } from '../ai-gateway/shared'

export interface WorkflowDefinitionListQuery {
  scene?: string
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
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
  baseVersionId?: string | null
  baseVersionUpdatedAt?: string | null
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

export class WorkflowDefinitionConflictError extends Error {
  readonly status = 409
  readonly type = 'workflow_definition_conflict'

  constructor(message = '工作流内容已在其他页面更新，请重新打开后再保存') {
    super(message)
    this.name = 'WorkflowDefinitionConflictError'
  }
}

export const assertWorkflowAutosaveBaseVersion = (
  currentVersion: { id: string; updatedAt: Date | string } | null,
  payload: Pick<WorkflowDefinitionVersionPayload, 'baseVersionId' | 'baseVersionUpdatedAt'>,
) => {
  if (payload.baseVersionId !== undefined) {
    const expectedId = payload.baseVersionId ? String(payload.baseVersionId) : null
    const currentId = currentVersion?.id || null
    if (expectedId !== currentId) {
      throw new WorkflowDefinitionConflictError()
    }
  }

  if (payload.baseVersionUpdatedAt !== undefined && payload.baseVersionUpdatedAt !== null) {
    const expectedTime = new Date(payload.baseVersionUpdatedAt).getTime()
    const currentTime = currentVersion ? new Date(currentVersion.updatedAt).getTime() : Number.NaN
    if (!Number.isFinite(expectedTime) || expectedTime !== currentTime) {
      throw new WorkflowDefinitionConflictError()
    }
  }
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

export interface WorkflowDefinitionPublishPayload {
  versionId?: string
}

export interface WorkflowDefinitionRollbackPayload {
  versionName?: string | null
  changeSummary?: string | null
}

export const sendWorkflowDefinitionError = (
  res: any,
  status: number,
  message: string,
  type = 'workflow_definition_error',
) => {
  sendJson(res, status, {
    error: {
      type,
      message,
    },
    message,
  })
}

export const readWorkflowDefinitionBody = async <T>(req: any) => {
  return await readJsonBody(req) as T
}
