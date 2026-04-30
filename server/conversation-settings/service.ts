import type {
  SystemConversationSettingsPayload,
  SystemGenerationProgressSettingsPayload,
} from '../system-config/shared'
import {
  createDefaultConversationSettings,
  getDefaultGenerationProgressSettings,
  getAdminSystemConfig,
  saveAdminSystemConfig,
} from '../system-config/service'

export interface AdminConversationSettingsBundle {
  conversationSettings: Awaited<ReturnType<typeof createDefaultConversationSettings>>
  generationProgressSettings: ReturnType<typeof getDefaultGenerationProgressSettings>
}

// 读取后台会话配置。
export const getAdminConversationSettings = async () => {
  const config = await getAdminSystemConfig()
  return {
    conversationSettings: config.conversationSettings || createDefaultConversationSettings(),
    generationProgressSettings: config.generationProgressSettings || getDefaultGenerationProgressSettings(),
  }
}

// 保存后台会话配置。
export const saveAdminConversationSettings = async (payload: {
  conversationSettings?: SystemConversationSettingsPayload
  generationProgressSettings?: SystemGenerationProgressSettingsPayload
}) => {
  const currentConfig = await getAdminSystemConfig()
  const savedConfig = await saveAdminSystemConfig({
    ...currentConfig,
    conversationSettings: payload.conversationSettings || currentConfig.conversationSettings,
    generationProgressSettings: payload.generationProgressSettings || currentConfig.generationProgressSettings,
  })

  return {
    conversationSettings: savedConfig.conversationSettings || createDefaultConversationSettings(),
    generationProgressSettings: savedConfig.generationProgressSettings || getDefaultGenerationProgressSettings(),
  }
}
