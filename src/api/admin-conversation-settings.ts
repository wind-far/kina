import { adminGet, adminPut } from './admin-request'
import {
  createDefaultGenerationProgressSettings,
  createDefaultConversationSettings,
  type ConversationSettingsConfig,
  type SystemGenerationProgressSettingsConfig,
} from './system-config'

const ADMIN_CONVERSATION_SETTINGS_API_PATH = '/api/admin/conversation-settings'

export interface AdminConversationSettingsBundle {
  conversationSettings: ConversationSettingsConfig
  generationProgressSettings: SystemGenerationProgressSettingsConfig
}

// 获取后台会话配置。
export const getAdminConversationSettings = async () => {
  return adminGet<AdminConversationSettingsBundle>(ADMIN_CONVERSATION_SETTINGS_API_PATH)
}

// 保存后台会话配置。
export const saveAdminConversationSettings = async (payload: AdminConversationSettingsBundle) => {
  return adminPut<AdminConversationSettingsBundle>(ADMIN_CONVERSATION_SETTINGS_API_PATH, {
    conversationSettings: payload.conversationSettings,
    generationProgressSettings: payload.generationProgressSettings,
  }, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '会话配置已保存',
  })
}

export {
  createDefaultGenerationProgressSettings,
  createDefaultConversationSettings,
  type ConversationSettingsConfig,
  type SystemGenerationProgressSettingsConfig,
}
