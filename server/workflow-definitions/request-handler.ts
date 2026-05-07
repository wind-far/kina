import { sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { WORKFLOW_DEFINITIONS_BASE_PATH } from './constants'
import {
  autosaveWorkflowDefinitionDraft,
  createWorkflowDefinition,
  createWorkflowDefinitionVersion,
  deleteWorkflowDefinition,
  getWorkflowDefinitionDetail,
  listWorkflowDefinitions,
  publishWorkflowDefinition,
  updateWorkflowDefinition,
} from './service'
import {
  readWorkflowDefinitionBody,
  sendWorkflowDefinitionError,
  type WorkflowDefinitionCreatePayload,
  type WorkflowDefinitionPublishPayload,
  type WorkflowDefinitionUpdatePayload,
  type WorkflowDefinitionVersionPayload,
} from './shared'

const matchWorkflowDetailPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/workflows\/([^/]+)$/)
  if (!matched) {
    return null
  }

  return {
    workflowId: decodeURIComponent(matched[1]),
  }
}

const matchWorkflowVersionsPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/workflows\/([^/]+)\/versions$/)
  if (!matched) {
    return null
  }

  return {
    workflowId: decodeURIComponent(matched[1]),
  }
}

const matchWorkflowPublishPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/workflows\/([^/]+)\/publish$/)
  if (!matched) {
    return null
  }

  return {
    workflowId: decodeURIComponent(matched[1]),
  }
}

const matchWorkflowDraftPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/workflows\/([^/]+)\/draft$/)
  if (!matched) {
    return null
  }

  return {
    workflowId: decodeURIComponent(matched[1]),
  }
}

// 处理工作流定义与版本相关请求。
export const handleWorkflowDefinitionsRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendWorkflowDefinitionError(res, 500, '缺少 DATABASE_URL，暂时无法使用工作流定义能力。')
      return
    }

    const currentUser = await requireCurrentSessionUser(req, res)
    if (!currentUser) {
      return
    }

    const requestUrl = new URL(String(req.url || ''), 'http://localhost')
    const requestPath = requestUrl.pathname
    const workflowDetailMatch = matchWorkflowDetailPath(requestPath)
    const workflowVersionsMatch = matchWorkflowVersionsPath(requestPath)
    const workflowPublishMatch = matchWorkflowPublishPath(requestPath)
    const workflowDraftMatch = matchWorkflowDraftPath(requestPath)

    if (req.method === 'GET' && requestPath === WORKFLOW_DEFINITIONS_BASE_PATH) {
      const data = await listWorkflowDefinitions({
        scene: requestUrl.searchParams.get('scene') || undefined,
        status: requestUrl.searchParams.get('status') || undefined,
        keyword: requestUrl.searchParams.get('keyword') || undefined,
        page: Number(requestUrl.searchParams.get('page') || 1),
        pageSize: Number(requestUrl.searchParams.get('pageSize') || 12),
      }, {
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && requestPath === WORKFLOW_DEFINITIONS_BASE_PATH) {
      const payload = await readWorkflowDefinitionBody<WorkflowDefinitionCreatePayload>(req)
      const data = await createWorkflowDefinition(payload, {
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '工作流已创建' })
      return
    }

    if (req.method === 'GET' && workflowDetailMatch) {
      const data = await getWorkflowDefinitionDetail(workflowDetailMatch.workflowId, {
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PATCH' && workflowDetailMatch) {
      const payload = await readWorkflowDefinitionBody<WorkflowDefinitionUpdatePayload>(req)
      const data = await updateWorkflowDefinition(workflowDetailMatch.workflowId, payload, {
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '工作流已更新' })
      return
    }

    if (req.method === 'DELETE' && workflowDetailMatch) {
      const data = await deleteWorkflowDefinition(workflowDetailMatch.workflowId, {
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '工作流已删除' })
      return
    }

    if (req.method === 'POST' && workflowVersionsMatch) {
      const payload = await readWorkflowDefinitionBody<WorkflowDefinitionVersionPayload>(req)
      const data = await createWorkflowDefinitionVersion(workflowVersionsMatch.workflowId, payload, {
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '工作流版本已保存' })
      return
    }

    if (req.method === 'PUT' && workflowDraftMatch) {
      const payload = await readWorkflowDefinitionBody<WorkflowDefinitionVersionPayload>(req)
      const data = await autosaveWorkflowDefinitionDraft(workflowDraftMatch.workflowId, payload, {
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '工作流草稿已自动保存' })
      return
    }

    if (req.method === 'POST' && workflowPublishMatch) {
      const payload = await readWorkflowDefinitionBody<WorkflowDefinitionPublishPayload>(req)
      const data = await publishWorkflowDefinition(workflowPublishMatch.workflowId, payload, {
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '工作流版本已发布' })
      return
    }

    sendWorkflowDefinitionError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendWorkflowDefinitionError(res, 500, error?.message || '处理工作流请求失败')
  }
}
