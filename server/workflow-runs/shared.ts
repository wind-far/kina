import { readJsonBody, sendJson } from '../ai-gateway/shared'

export interface WorkflowRunNodeInput {
  id: string
  type: string
  label?: string | null
}

export interface WorkflowRunCreatePayload {
  versionId?: string | null
  nodes?: WorkflowRunNodeInput[]
  executor?: 'BROWSER' | 'SERVER'
}

export type WorkflowRunUpdatePayload =
  | { action: 'NODE_STARTED'; nodeId: string }
  | { action: 'NODE_COMPLETED'; nodeId: string; generationRecordId?: string | null; outputJson?: unknown }
  | { action: 'COMPLETED'; resultJson?: unknown }
  | { action: 'FAILED'; nodeId?: string | null; errorMessage?: string | null }
  | { action: 'HEARTBEAT'; nodeId?: string | null }

export class WorkflowRunRequestError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'WorkflowRunRequestError'
    this.statusCode = statusCode
  }
}

export const TERMINAL_WORKFLOW_RUN_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'INTERRUPTED',
])

export const assertWorkflowRunTransition = (currentStatus: string, action: WorkflowRunUpdatePayload['action']) => {
  if (TERMINAL_WORKFLOW_RUN_STATUSES.has(currentStatus)) {
    throw new WorkflowRunRequestError(409, `运行已结束，当前状态为 ${currentStatus}`)
  }
  if (currentStatus !== 'RUNNING') {
    throw new WorkflowRunRequestError(409, `运行尚未开始，当前状态为 ${currentStatus}`)
  }
  if (!['NODE_STARTED', 'NODE_COMPLETED', 'COMPLETED', 'FAILED', 'HEARTBEAT'].includes(action)) {
    throw new WorkflowRunRequestError(400, '不支持的运行状态操作')
  }
}

export const readWorkflowRunBody = async <T>(req: any) => await readJsonBody(req) as T

export const sendWorkflowRunError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'workflow_run_error',
      message,
    },
  })
}
