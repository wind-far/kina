import { sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { ADMIN_AUDIT_LOGS_BASE_PATH } from './constants'
import { listAdminAuditLogs } from './service'
import { readAdminAuditLogsQuery, sendAdminAuditLogsError } from './shared'

export const handleAdminAuditLogsRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendAdminAuditLogsError(res, 500, '缺少 DATABASE_URL，暂时无法使用后台审计日志。')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    const requestPath = String(req.url || '').split('?')[0]

    if (req.method === 'GET' && requestPath === ADMIN_AUDIT_LOGS_BASE_PATH) {
      const query = readAdminAuditLogsQuery(String(req.url || ''))
      const data = await listAdminAuditLogs(query)
      sendJson(res, 200, { data })
      return
    }

    sendAdminAuditLogsError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendAdminAuditLogsError(res, 500, error?.message || '处理后台审计日志请求失败')
  }
}
