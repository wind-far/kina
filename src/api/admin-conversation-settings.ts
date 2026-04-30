import { buildApiUrl } from './http'
import { readApiData } from './response'
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
  const response = await fetch(buildApiUrl(ADMIN_CONVERSATION_SETTINGS_API_PATH), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminConversationSettingsBundle>(response)
}

// 保存后台会话配置。
export const saveAdminConversationSettings = async (payload: AdminConversationSettingsBundle) => {
  const response = await fetch(buildApiUrl(ADMIN_CONVERSATION_SETTINGS_API_PATH), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationSettings: payload.conversationSettings,
      generationProgressSettings: payload.generationProgressSettings,
    }),
  })

  return readApiData<AdminConversationSettingsBundle>(response, {
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
