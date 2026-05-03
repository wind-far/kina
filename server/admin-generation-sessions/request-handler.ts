import { sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { ADMIN_GENERATION_SESSIONS_BASE_PATH } from './constants'
import {
  deleteAdminGenerationSession,
  getAdminGenerationSessionDetail,
  listAdminGenerationSessionRecords,
  listAdminGenerationSessions,
  updateAdminGenerationSession,
} from './service'
import {
  readAdminGenerationSessionBody,
  readAdminGenerationSessionsQuery,
  sendAdminGenerationSessionsError,
} from './shared'

// 处理后台会话管理请求。
export const handleAdminGenerationSessionsRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendAdminGenerationSessionsError(res, 500, '缺少 DATABASE_URL，暂时无法使用后台会话管理。')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    const requestPath = String(req.url || '').split('?')[0]
    const suffix = requestPath.startsWith(`${ADMIN_GENERATION_SESSIONS_BASE_PATH}/`)
      ? decodeURIComponent(requestPath.slice(ADMIN_GENERATION_SESSIONS_BASE_PATH.length + 1))
      : ''
    const suffixParts = suffix.split('/').filter(Boolean)
    const sessionId = suffixParts[0] || ''
    const nestedAction = suffixParts[1] || ''

    if (req.method === 'GET' && requestPath === ADMIN_GENERATION_SESSIONS_BASE_PATH) {
      const query = readAdminGenerationSessionsQuery(String(req.url || ''))
      const data = await listAdminGenerationSessions(query)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && sessionId && !nestedAction) {
      const data = await getAdminGenerationSessionDetail(sessionId)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && sessionId && nestedAction === 'records') {
      const query = readAdminGenerationSessionsQuery(String(req.url || ''))
      const data = await listAdminGenerationSessionRecords(sessionId, query.page, query.pageSize)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PATCH' && sessionId && !nestedAction) {
      const payload = await readAdminGenerationSessionBody(req)
      const data = await updateAdminGenerationSession(sessionId, payload)
      sendJson(res, 200, { data, message: '会话已更新' })
      return
    }

    if (req.method === 'DELETE' && sessionId && !nestedAction) {
      const data = await deleteAdminGenerationSession(sessionId)
      sendJson(res, 200, { data, message: '会话已删除' })
      return
    }

    sendAdminGenerationSessionsError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendAdminGenerationSessionsError(res, 500, error?.message || '处理后台会话管理请求失败')
  }
}
