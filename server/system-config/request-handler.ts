import { sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { SYSTEM_CONFIG_ADMIN_PATH, SYSTEM_CONFIG_PUBLIC_PATH } from './constants'
import { getAdminSystemConfig, getPublicSystemConfig, saveAdminSystemConfig } from './service'
import { readSystemConfigBody, sendSystemConfigError } from './shared'

// 处理系统设置请求。
export const handleSystemConfigRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendSystemConfigError(res, 500, '缺少 DATABASE_URL，暂时无法使用系统设置。')
      return
    }

    const requestPath = String(req.url || '').split('?')[0]

    if (req.method === 'GET' && requestPath === SYSTEM_CONFIG_PUBLIC_PATH) {
      const data = await getPublicSystemConfig()
      sendJson(res, 200, { data })
      return
    }

    if (requestPath !== SYSTEM_CONFIG_ADMIN_PATH) {
      sendSystemConfigError(res, 405, 'Method Not Allowed')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    if (req.method === 'GET') {
      const data = await getAdminSystemConfig()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PUT') {
      const payload = await readSystemConfigBody(req)
      const data = await saveAdminSystemConfig(payload)
      sendJson(res, 200, { data, message: '系统设置已保存' })
      return
    }

    sendSystemConfigError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendSystemConfigError(res, 500, error?.message || '处理系统设置失败')
  }
}
