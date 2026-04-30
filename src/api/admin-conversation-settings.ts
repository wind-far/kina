import { buildApiUrl } from './http'
import { readApiData } from './response'
import {
  createDefaultConversationSettings,
  type ConversationSettingsConfig,
} from './system-config'

const ADMIN_CONVERSATION_SETTINGS_API_PATH = '/api/admin/conversation-settings'

// 获取后台会话配置。
export const getAdminConversationSettings = async () => {
  const response = await fetch(buildApiUrl(ADMIN_CONVERSATION_SETTINGS_API_PATH), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<ConversationSettingsConfig>(response)
}

// 保存后台会话配置。
export const saveAdminConversationSettings = async (payload: ConversationSettingsConfig) => {
  const response = await fetch(buildApiUrl(ADMIN_CONVERSATION_SETTINGS_API_PATH), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationSettings: payload,
    }),
  })

  return readApiData<ConversationSettingsConfig>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '会话配置已保存',
  })
}

export {
  createDefaultConversationSettings,
  type ConversationSettingsConfig,
}
