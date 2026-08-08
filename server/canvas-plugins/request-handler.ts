import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser, requireCurrentSessionUser } from '../auth/session'
import { installCanvasPlugin, listCanvasPluginsForUser, publishTrustedCanvasPlugin, uninstallCanvasPlugin } from './service'

const sendPluginError = (res: any, status: number, message: string) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ message, error: { type: 'canvas_plugin_error', message } }))
}

export const handleCanvasPluginsRequest = async (req: any, res: any, requestPath: string) => {
  try {
    if (requestPath === '/api/canvas/plugins' && req.method === 'GET') {
      const user = await requireCurrentSessionUser(req, res)
      if (!user) return true
      sendJson(res, 200, { data: await listCanvasPluginsForUser(user.id) })
      return true
    }
    if (requestPath === '/api/canvas/plugins/registry' && req.method === 'POST') {
      const admin = await requireAdminSessionUser(req, res)
      if (!admin) return true
      sendJson(res, 200, { data: await publishTrustedCanvasPlugin(await readJsonBody(req), admin.id), message: '受信插件已发布' })
      return true
    }
    const matched = requestPath.match(/^\/api\/canvas\/plugins\/([^/]+)\/install$/)
    if (matched && req.method === 'PUT') {
      const user = await requireCurrentSessionUser(req, res)
      if (!user) return true
      const payload = await readJsonBody(req) as { enabled?: boolean }
      sendJson(res, 200, { data: await installCanvasPlugin(user.id, decodeURIComponent(matched[1]), payload.enabled !== false) })
      return true
    }
    if (matched && req.method === 'DELETE') {
      const user = await requireCurrentSessionUser(req, res)
      if (!user) return true
      sendJson(res, 200, { data: await uninstallCanvasPlugin(user.id, decodeURIComponent(matched[1])) })
      return true
    }
    return false
  } catch (error: any) {
    sendPluginError(res, 400, error?.message || '处理插件请求失败')
    return true
  }
}
