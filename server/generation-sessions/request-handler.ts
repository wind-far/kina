import { sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { GENERATION_SESSIONS_BASE_PATH } from './constants'
import { createGenerationSession, deleteGenerationSession, listGenerationSessions, updateGenerationSession } from './service'
import { readGenerationSessionBody, sendGenerationSessionError } from './shared'

// 统一输出生成会话接口异常日志，便于定位链路问题。
const logGenerationSessionsRequestError = (detail: Record<string, unknown>) => {
  console.error('[generation-sessions][request-error]', JSON.stringify(detail))
}

// 处理生成会话的列表、创建、更新和删除请求。
export const handleGenerationSessionsRequest = async (req: any, res: any) => {
  const requestUrl = String(req.url || '').split('?')[0]
  const sessionId = requestUrl.startsWith(`${GENERATION_SESSIONS_BASE_PATH}/`)
    ? decodeURIComponent(requestUrl.slice(GENERATION_SESSIONS_BASE_PATH.length + 1))
    : ''
  let currentUser: { id?: string | null } | null = null

  try {
    if (!isPrismaConfigured()) {
      sendGenerationSessionError(res, 500, '缺少 DATABASE_URL，暂时无法使用生成会话存储。')
      return
    }

    currentUser = await requireCurrentSessionUser(req, res)
    if (!currentUser) {
      return
    }

    if (req.method === 'GET' && requestUrl === GENERATION_SESSIONS_BASE_PATH) {
      const data = await listGenerationSessions(String(currentUser.id || ''))
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && requestUrl === GENERATION_SESSIONS_BASE_PATH) {
      const payload = await readGenerationSessionBody(req)
      const data = await createGenerationSession(payload, String(currentUser.id || ''))
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PATCH' && sessionId) {
      const payload = await readGenerationSessionBody(req)
      const data = await updateGenerationSession(sessionId, payload, String(currentUser.id || ''))
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'DELETE' && sessionId) {
      const data = await deleteGenerationSession(sessionId, String(currentUser.id || ''))
      sendJson(res, 200, { data })
      return
    }

    sendGenerationSessionError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    logGenerationSessionsRequestError({
      method: req.method,
      requestUrl,
      sessionId: sessionId || null,
      currentUserId: currentUser?.id || null,
      errorMessage: error?.message || '处理生成会话失败',
      errorStack: error?.stack || null,
    })
    sendGenerationSessionError(res, 500, error?.message || '处理生成会话失败')
  }
}
