import { sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { ADMIN_GENERATION_RECORDS_BASE_PATH } from './constants'
import { listAdminGenerationRecords } from './service'
import { readAdminGenerationRecordsQuery, sendAdminGenerationRecordsError } from './shared'

// 处理后台生成记录管理请求。
export const handleAdminGenerationRecordsRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendAdminGenerationRecordsError(res, 500, '缺少 DATABASE_URL，暂时无法使用后台生成记录管理。')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    const requestPath = String(req.url || '').split('?')[0]

    if (req.method === 'GET' && requestPath === ADMIN_GENERATION_RECORDS_BASE_PATH) {
      const query = readAdminGenerationRecordsQuery(String(req.url || ''))
      const data = await listAdminGenerationRecords(query)
      sendJson(res, 200, { data })
      return
    }

    sendAdminGenerationRecordsError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendAdminGenerationRecordsError(res, 500, error?.message || '处理后台生成记录管理请求失败')
  }
}
