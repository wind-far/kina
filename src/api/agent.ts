/**
 * Agent 模式配置
 */
import { DEFAULT_CHAT_MODEL } from '@/config/models'
import { getProviderRuntimeConfig, saveProviderRuntimeConfig } from './provider-config'

export const getAgentModel = (): string => {
  return getProviderRuntimeConfig().defaultChatModel || DEFAULT_CHAT_MODEL
}

export const setAgentModel = (model: string) => {
  const currentConfig = getProviderRuntimeConfig()
  void saveProviderRuntimeConfig({
    ...currentConfig,
    defaultChatModel: model,
  })
}
