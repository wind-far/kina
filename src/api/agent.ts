/**
 * Agent 模式配置
 * 模型列表来自后台目录，当前用户选择仅保存在本地。
 */

import { getDefaultChatModelKey } from '@/config/models'

const AGENT_MODEL_STORAGE_KEY = 'canana:agent:model'

export const getAgentModel = (): string => {
  if (typeof window === 'undefined') {
    return getDefaultChatModelKey()
  }

  return window.localStorage.getItem(AGENT_MODEL_STORAGE_KEY) || getDefaultChatModelKey()
}

export const setAgentModel = (model: string) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(AGENT_MODEL_STORAGE_KEY, model)
}
