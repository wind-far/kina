import { sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import {
  createWorkflowRun,
  getLatestWorkflowRun,
  getWorkflowRun,
  stopWorkflowRun,
  retryWorkflowRun,
  updateWorkflowRun,
} from './service'
import { enqueueWorkflowRun, requestWorkflowRunStop } from './executor'
import { stopGenerationTask } from '../generation-tasks/service'
import {
  readWorkflowRunBody,
  sendWorkflowRunError,
  WorkflowRunRequestError,
  type WorkflowRunCreatePayload,
  type WorkflowRunUpdatePayload,
} from './shared'

const matchRunPath = (requestPath: string) => {
  const base = requestPath.match(/^\/api\/workflows\/([^/]+)\/runs$/)
  if (base) return { workflowId: decodeURIComponent(base[1]), runId: '', action: 'base' as const }
  const latest = requestPath.match(/^\/api\/workflows\/([^/]+)\/runs\/latest$/)
  if (latest) return { workflowId: decodeURIComponent(latest[1]), runId: '', action: 'latest' as const }
  const stop = requestPath.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)\/stop$/)
  if (stop) return {
    workflowId: decodeURIComponent(stop[1]),
    runId: decodeURIComponent(stop[2]),
    action: 'stop' as const,
  }
  const retry = requestPath.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)\/retry$/)
  if (retry) return {
    workflowId: decodeURIComponent(retry[1]),
    runId: decodeURIComponent(retry[2]),
    action: 'retry' as const,
  }
  const detail = requestPath.match(/^\/api\/workflows\/([^/]+)\/runs\/([^/]+)$/)
  if (detail) return {
    workflowId: decodeURIComponent(detail[1]),
    runId: decodeURIComponent(detail[2]),
    action: 'detail' as const,
  }
  return null
}

export const handleWorkflowRunsRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendWorkflowRunError(res, 500, '缺少 DATABASE_URL，暂时无法使用工作流运行能力。')
      return
    }
    const currentUser = await requireCurrentSessionUser(req, res)
    if (!currentUser?.id) return
    const requestPath = new URL(String(req.url || ''), 'http://localhost').pathname
    const matched = matchRunPath(requestPath)
    if (!matched) {
      sendWorkflowRunError(res, 404, '工作流运行接口不存在')
      return
    }

    if (req.method === 'POST' && matched.action === 'base') {
      const payload = await readWorkflowRunBody<WorkflowRunCreatePayload>(req)
      const data = await createWorkflowRun(matched.workflowId, payload, currentUser.id)
      sendJson(res, 200, { data })
      if (data.executor === 'SERVER') enqueueWorkflowRun(data.id)
      return
    }
    if (req.method === 'GET' && matched.action === 'latest') {
      const data = await getLatestWorkflowRun(matched.workflowId, currentUser.id)
      sendJson(res, 200, { data })
      return
    }
    if (req.method === 'GET' && matched.action === 'detail') {
      const data = await getWorkflowRun(matched.workflowId, matched.runId, currentUser.id)
      sendJson(res, 200, { data })
      return
    }
    if (req.method === 'PATCH' && matched.action === 'detail') {
      const payload = await readWorkflowRunBody<WorkflowRunUpdatePayload>(req)
      const data = await updateWorkflowRun(matched.workflowId, matched.runId, payload, currentUser.id)
      sendJson(res, 200, { data })
      return
    }
    if (req.method === 'POST' && matched.action === 'stop') {
      const data = await stopWorkflowRun(matched.workflowId, matched.runId, currentUser.id)
      const activeGenerationRecordId = data.nodeRuns.find(item => item.nodeId === data.currentNodeId)?.generationRecordId
        || data.nodeRuns.find(item => item.status === 'CANCELLED' && item.generationRecordId)?.generationRecordId
      if (activeGenerationRecordId) {
        await stopGenerationTask(activeGenerationRecordId, currentUser.id).catch(() => undefined)
      }
      requestWorkflowRunStop(data.id)
      sendJson(res, 200, { data })
      return
    }
    if (req.method === 'POST' && matched.action === 'retry') {
      const data = await retryWorkflowRun(matched.workflowId, matched.runId, currentUser.id)
      sendJson(res, 200, { data })
      enqueueWorkflowRun(data.id)
      return
    }
    sendWorkflowRunError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendWorkflowRunError(
      res,
      error instanceof WorkflowRunRequestError ? error.statusCode : 500,
      error?.message || '处理工作流运行请求失败',
    )
  }
}
