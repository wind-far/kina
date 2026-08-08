import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { requireCurrentSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { USER_PROVIDER_CONFIG_BASE_PATH } from './constants'
import { deleteUserProviderConfig, listUserProviderConfigs, saveUserProviderConfig } from './service'

export const handleUserProviderConfigRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) return sendJson(res, 500, { message: '缺少 DATABASE_URL，暂时无法保存个人 API 配置' })
    const currentUser = await requireCurrentSessionUser(req, res)
    if (!currentUser?.id) return
    const requestPath = String(req.url || '').split('?')[0]
    if (requestPath === USER_PROVIDER_CONFIG_BASE_PATH && req.method === 'GET') {
      return sendJson(res, 200, { data: await listUserProviderConfigs(currentUser.id) })
    }
    const matched = requestPath.match(/^\/api\/user-provider-config\/(video)$/i)
    if (!matched) return sendJson(res, 405, { message: 'Method Not Allowed' })
    const category = matched[1]
    if (req.method === 'PUT') {
      const data = await saveUserProviderConfig(currentUser.id, category, await readJsonBody(req))
      return sendJson(res, 200, { data, message: '个人 API 配置已保存' })
    }
    if (req.method === 'DELETE') {
      return sendJson(res, 200, { data: await deleteUserProviderConfig(currentUser.id, category), message: '个人 API 配置已移除' })
    }
    return sendJson(res, 405, { message: 'Method Not Allowed' })
  } catch (error: any) {
    return sendJson(res, 400, { message: error?.message || '个人 API 配置保存失败' })
  }
}
