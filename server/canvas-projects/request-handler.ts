import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { CANVAS_PROJECTS_BASE_PATH } from './constants'
import { exportCanvasProject, exportCanvasProjectSelection, importCanvasProject, importCanvasProjectArchive, previewCanvasAssistantOperation } from './service'
import { handleCanvasPluginsRequest } from '../canvas-plugins/request-handler'
import { handleCanvasPromptsRequest } from '../canvas-prompts/request-handler'

const sendCanvasError = (res: any, status: number, message: string) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ message, error: { type: 'canvas_project_error', message } }))
}

const matchProjectAction = (requestPath: string, action: 'export' | 'export-selection' | 'assistant-preview') => {
  const matched = requestPath.match(new RegExp(`^/api/canvas/projects/([^/]+)/${action}$`))
  return matched ? decodeURIComponent(matched[1]) : ''
}

const MAX_ARCHIVE_REQUEST_BYTES = 50 * 1024 * 1024

const readCanvasArchiveBody = async (req: any) => {
  const declaredLength = Number(req.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ARCHIVE_REQUEST_BYTES) {
    const error = new Error('导入归档超过 50MB 限制。') as Error & { status?: number }
    error.status = 413
    throw error
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.byteLength
    if (total > MAX_ARCHIVE_REQUEST_BYTES) {
      const error = new Error('导入归档超过 50MB 限制。') as Error & { status?: number }
      error.status = 413
      throw error
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
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
    const selectionExportProjectId = matchProjectAction(requestPath, 'export-selection')
    const assistantProjectId = matchProjectAction(requestPath, 'assistant-preview')
    if (req.method === 'POST' && requestPath === `${CANVAS_PROJECTS_BASE_PATH}/projects/import-archive`) {
      const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      if (!['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(contentType)) {
        return sendCanvasError(res, 415, '仅支持 ZIP 格式的目标画布导入文件。')
      }
      const name = decodeURIComponent(String(req.headers['x-canvas-project-name'] || '')).trim()
      const data = await importCanvasProjectArchive(await readCanvasArchiveBody(req), name || undefined, { currentUserId: currentUser.id })
      sendJson(res, 200, { data, message: '无限画布归档已导入' })
      return
    }
    if (req.method === 'POST' && requestPath === `${CANVAS_PROJECTS_BASE_PATH}/projects/import`) {
      const data = await importCanvasProject(await readJsonBody(req), { currentUserId: currentUser.id })
      sendJson(res, 200, { data, message: '无限画布已导入' })
      return
    }
    if (req.method === 'GET' && exportProjectId) {
      sendJson(res, 200, { data: await exportCanvasProject(exportProjectId, { currentUserId: currentUser.id }) })
      return
    }
    if (req.method === 'POST' && selectionExportProjectId) {
      const payload = await readJsonBody(req)
      sendJson(res, 200, { data: await exportCanvasProjectSelection(selectionExportProjectId, payload?.selection, { currentUserId: currentUser.id }) })
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
