import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import { createCanvasPrompt, createCanvasPromptSource, listCanvasPrompts, listCanvasPromptSources, syncCanvasPromptSource } from './service'

export const handleCanvasPromptsRequest = async (req: any, res: any, requestPath: string) => {
  try {
    const user = await requireCurrentSessionUser(req, res)
    if (!user) return true
    const url = new URL(String(req.url || ''), 'http://localhost')
    if (requestPath === '/api/canvas/prompts' && req.method === 'GET') {
      sendJson(res, 200, { data: await listCanvasPrompts(user.id, url.searchParams.get('keyword') || '') })
      return true
    }
    if (requestPath === '/api/canvas/prompts' && req.method === 'POST') {
      sendJson(res, 200, { data: await createCanvasPrompt(user.id, await readJsonBody(req)), message: '提示词已保存' })
      return true
    }
    if (requestPath === '/api/canvas/prompt-sources' && req.method === 'GET') {
      sendJson(res, 200, { data: await listCanvasPromptSources(user.id) })
      return true
    }
    if (requestPath === '/api/canvas/prompt-sources' && req.method === 'POST') {
      sendJson(res, 200, { data: await createCanvasPromptSource(user.id, await readJsonBody(req)), message: '提示词源已创建' })
      return true
    }
    const matched = requestPath.match(/^\/api\/canvas\/prompt-sources\/([^/]+)\/sync$/)
    if (matched && req.method === 'POST') {
      sendJson(res, 200, { data: await syncCanvasPromptSource(user.id, decodeURIComponent(matched[1])), message: '提示词源已同步' })
      return true
    }
    return false
  } catch (error: any) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ message: error?.message || '处理提示词请求失败' }))
    return true
  }
}
