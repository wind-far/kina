import { buildApiUrl } from '@/api/http'
import { handleUnauthorizedResponse, readApiData } from '@/api/response'

export type WorkflowRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED'
export type WorkflowNodeRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface WorkflowNodeRunDetail {
  id: string
  workflowRunId: string
  generationRecordId: string | null
  nodeId: string
  nodeType: string
  label: string | null
  status: WorkflowNodeRunStatus
  sortOrder: number
  outputJson: unknown
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowRunDetail {
  id: string
  workflowId: string
  workflowVersionId: string
  userId: string
  status: WorkflowRunStatus
  executor: string
  totalNodes: number
  completedNodes: number
  currentNodeId: string | null
  errorMessage: string | null
  resultJson: unknown
  heartbeatAt: string | null
  stopRequestedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
  nodeRuns: WorkflowNodeRunDetail[]
  workflowVersion: {
    id: string
    versionNo: number
    versionName: string | null
  }
}

export interface WorkflowRunNodeInput {
  id: string
  type: string
  label?: string | null
}

export type WorkflowRunUpdatePayload =
  | { action: 'NODE_STARTED'; nodeId: string }
  | { action: 'NODE_COMPLETED'; nodeId: string; generationRecordId?: string | null; outputJson?: unknown }
  | { action: 'COMPLETED'; resultJson?: unknown }
  | { action: 'FAILED'; nodeId?: string | null; errorMessage?: string | null }
  | { action: 'HEARTBEAT'; nodeId?: string | null }

const requestRunApi = async <T>(url: string, method = 'GET', data?: unknown) => {
  const response = await fetch(buildApiUrl(url), {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  handleUnauthorizedResponse(response.status, 'workflow-runs')
  return await readApiData<T>(response)
}

const runBasePath = (workflowId: string) => `/api/workflows/${encodeURIComponent(workflowId)}/runs`

export const createWorkflowRun = async (
  workflowId: string,
  payload: { versionId?: string | null; nodes: WorkflowRunNodeInput[]; executor?: 'BROWSER' | 'SERVER' },
) => await requestRunApi<WorkflowRunDetail>(runBasePath(workflowId), 'POST', payload)

export const getLatestWorkflowRun = async (workflowId: string) => (
  await requestRunApi<WorkflowRunDetail | null>(`${runBasePath(workflowId)}/latest`)
)

export const updateWorkflowRun = async (
  workflowId: string,
  runId: string,
  payload: WorkflowRunUpdatePayload,
) => await requestRunApi<WorkflowRunDetail>(
  `${runBasePath(workflowId)}/${encodeURIComponent(runId)}`,
  'PATCH',
  payload,
)

export const stopWorkflowRun = async (workflowId: string, runId: string) => (
  await requestRunApi<WorkflowRunDetail>(
    `${runBasePath(workflowId)}/${encodeURIComponent(runId)}/stop`,
    'POST',
  )
)

export const retryWorkflowRun = async (workflowId: string, runId: string) => (
  await requestRunApi<WorkflowRunDetail>(
    `${runBasePath(workflowId)}/${encodeURIComponent(runId)}/retry`,
    'POST',
  )
)
