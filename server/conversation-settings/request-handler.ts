import { sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { readSystemConfigBody, sendSystemConfigError } from '../system-config/shared'
import { ADMIN_CONVERSATION_SETTINGS_PATH } from './constants'
import { getAdminConversationSettings, saveAdminConversationSettings } from './service'

// 处理后台会话配置请求。
export const handleAdminConversationSettingsRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendSystemConfigError(res, 500, '缺少 DATABASE_URL，暂时无法使用会话配置。')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    const requestPath = String(req.url || '').split('?')[0]
    if (requestPath !== ADMIN_CONVERSATION_SETTINGS_PATH) {
      sendSystemConfigError(res, 405, 'Method Not Allowed')
      return
    }

    if (req.method === 'GET') {
      const data = await getAdminConversationSettings()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PUT') {
      const payload = await readSystemConfigBody(req)
      const data = await saveAdminConversationSettings({
        conversationSettings: payload.conversationSettings || {},
        generationProgressSettings: payload.generationProgressSettings,
      })
      sendJson(res, 200, { data, message: '会话配置已保存' })
      return
    }

    sendSystemConfigError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendSystemConfigError(res, 500, error?.message || '处理会话配置失败')
  }
}
