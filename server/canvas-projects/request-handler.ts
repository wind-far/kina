import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { CANVAS_PROJECTS_BASE_PATH } from './constants'
import { exportCanvasProject, importCanvasProject, previewCanvasAssistantOperation } from './service'
import { handleCanvasPluginsRequest } from '../canvas-plugins/request-handler'
import { handleCanvasPromptsRequest } from '../canvas-prompts/request-handler'

const sendCanvasError = (res: any, status: number, message: string) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ message, error: { type: 'canvas_project_error', message } }))
}

const matchProjectAction = (requestPath: string, action: 'export' | 'assistant-preview') => {
  const matched = requestPath.match(new RegExp(`^/api/canvas/projects/([^/]+)/${action}$`))
  return matched ? decodeURIComponent(matched[1]) : ''
}

export const handleCanvasProjectsRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) return sendCanvasError(res, 500, '缺少 DATABASE_URL，暂时无法使用无限画布项目。')
    const currentUser = await requireCurrentSessionUser(req, res)
    if (!currentUser) return
    const requestPath = new URL(String(req.url || ''), 'http://localhost').pathname
    if (await handleCanvasPluginsRequest(req, res, requestPath)) return
    if (await handleCanvasPromptsRequest(req, res, requestPath)) return
    const exportProjectId = matchProjectAction(requestPath, 'export')
    const assistantProjectId = matchProjectAction(requestPath, 'assistant-preview')
    if (req.method === 'POST' && requestPath === `${CANVAS_PROJECTS_BASE_PATH}/projects/import`) {
      const data = await importCanvasProject(await readJsonBody(req), { currentUserId: currentUser.id })
      sendJson(res, 200, { data, message: '无限画布已导入' })
      return
    }
    if (req.method === 'GET' && exportProjectId) {
      sendJson(res, 200, { data: await exportCanvasProject(exportProjectId, { currentUserId: currentUser.id }) })
      return
    }
    if (req.method === 'POST' && assistantProjectId) {
      sendJson(res, 200, { data: await previewCanvasAssistantOperation(assistantProjectId, await readJsonBody(req), { currentUserId: currentUser.id }) })
      return
    }
    sendCanvasError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendCanvasError(res, Number(error?.status || 500), error?.message || '处理无限画布请求失败')
  }
}
