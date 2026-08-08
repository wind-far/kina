import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import {
  createCanvasPrompt,
  createCanvasPromptSource,
  listCanvasPrompts,
  listCanvasPromptSources,
  listCanvasPromptSourceVersions,
  listCanvasPromptSyncRuns,
  rollbackCanvasPromptSource,
  syncCanvasPromptSource,
} from './service'

export const handleCanvasPromptsRequest = async (req: any, res: any, requestPath: string) => {
  try {
    const user = await requireCurrentSessionUser(req, res)
    if (!user) return true
    const context = { currentUserId: user.id, role: user.role }
    const url = new URL(String(req.url || ''), 'http://localhost')
    if (requestPath === '/api/canvas/prompts' && req.method === 'GET') {
      sendJson(res, 200, { data: await listCanvasPrompts(context, {
        keyword: url.searchParams.get('keyword') || '',
        tag: url.searchParams.get('tag') || '',
        sourceId: url.searchParams.get('sourceId') || '',
        kind: url.searchParams.get('kind') || '',
      }) })
      return true
    }
    if (requestPath === '/api/canvas/prompts' && req.method === 'POST') {
      sendJson(res, 200, { data: await createCanvasPrompt(context, await readJsonBody(req)), message: '提示词已保存' })
      return true
    }
    if (requestPath === '/api/canvas/prompt-sources' && req.method === 'GET') {
      sendJson(res, 200, { data: await listCanvasPromptSources(context) })
      return true
    }
    if (requestPath === '/api/canvas/prompt-sources' && req.method === 'POST') {
      sendJson(res, 200, { data: await createCanvasPromptSource(context, await readJsonBody(req)), message: '提示词源已创建' })
      return true
    }
    const matched = requestPath.match(/^\/api\/canvas\/prompt-sources\/([^/]+)\/sync$/)
    if (matched && req.method === 'POST') {
      sendJson(res, 200, { data: await syncCanvasPromptSource(context, decodeURIComponent(matched[1])), message: '提示词源已同步' })
      return true
    }
    const versionsMatched = requestPath.match(/^\/api\/canvas\/prompt-sources\/([^/]+)\/versions$/)
    if (versionsMatched && req.method === 'GET') {
      sendJson(res, 200, { data: await listCanvasPromptSourceVersions(context, decodeURIComponent(versionsMatched[1])) })
      return true
    }
    const runsMatched = requestPath.match(/^\/api\/canvas\/prompt-sources\/([^/]+)\/sync-runs$/)
    if (runsMatched && req.method === 'GET') {
      sendJson(res, 200, { data: await listCanvasPromptSyncRuns(context, decodeURIComponent(runsMatched[1])) })
      return true
    }
    const rollbackMatched = requestPath.match(/^\/api\/canvas\/prompt-sources\/([^/]+)\/rollback$/)
    if (rollbackMatched && req.method === 'POST') {
      const payload = await readJsonBody(req)
      sendJson(res, 200, { data: await rollbackCanvasPromptSource(context, decodeURIComponent(rollbackMatched[1]), Number(payload?.versionNo)), message: '提示词源已回滚' })
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
