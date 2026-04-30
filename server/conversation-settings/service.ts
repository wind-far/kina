import type { SystemConversationSettingsPayload } from '../system-config/shared'
import {
  createDefaultConversationSettings,
  getAdminSystemConfig,
  saveAdminSystemConfig,
} from '../system-config/service'

// 读取后台会话配置。
export const getAdminConversationSettings = async () => {
  const config = await getAdminSystemConfig()
  return config.conversationSettings || createDefaultConversationSettings()
}

// 保存后台会话配置。
export const saveAdminConversationSettings = async (payload: SystemConversationSettingsPayload) => {
  const currentConfig = await getAdminSystemConfig()
  const savedConfig = await saveAdminSystemConfig({
    ...currentConfig,
    conversationSettings: payload,
  })

  return savedConfig.conversationSettings || createDefaultConversationSettings()
}
