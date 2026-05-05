/**
 * 厂商上游能力策略
 * 统一维护 endpointType 与模型分类、厂商端点字段、计费类型之间的映射关系，
 * 供前后端共同复用，避免规则散落在多个 if 分支里。
 */

export type AiEndpointType = 'chat' | 'image' | 'image-edit' | 'video'

export type AiModelCategory = 'CHAT' | 'IMAGE' | 'VIDEO'

export type ProviderEndpointField = 'chatEndpoint' | 'imageEndpoint' | 'imageEditEndpoint' | 'videoEndpoint'

export interface ProviderEndpointStrategy {
  key: AiEndpointType
  modelCategory: AiModelCategory
  providerEndpointField: ProviderEndpointField
  chargeableEndpointType: 'chat' | 'image' | 'video'
}

// 厂商上游能力注册表。
export const PROVIDER_ENDPOINT_STRATEGIES: Record<AiEndpointType, ProviderEndpointStrategy> = {
  chat: {
    key: 'chat',
    modelCategory: 'CHAT',
    providerEndpointField: 'chatEndpoint',
    chargeableEndpointType: 'chat',
  },
  image: {
    key: 'image',
    modelCategory: 'IMAGE',
    providerEndpointField: 'imageEndpoint',
    chargeableEndpointType: 'image',
  },
  'image-edit': {
    key: 'image-edit',
    modelCategory: 'IMAGE',
    providerEndpointField: 'imageEditEndpoint',
    chargeableEndpointType: 'image',
  },
  video: {
    key: 'video',
    modelCategory: 'VIDEO',
    providerEndpointField: 'videoEndpoint',
    chargeableEndpointType: 'video',
  },
}

export const isAiEndpointType = (value: unknown): value is AiEndpointType => {
  return typeof value === 'string' && value in PROVIDER_ENDPOINT_STRATEGIES
}

export const getProviderEndpointStrategy = (endpointType: AiEndpointType) => {
  return PROVIDER_ENDPOINT_STRATEGIES[endpointType]
}

export const resolveEndpointModelCategory = (endpointType: AiEndpointType): AiModelCategory => {
  return getProviderEndpointStrategy(endpointType).modelCategory
}

export const resolveProviderEndpointField = (endpointType: AiEndpointType): ProviderEndpointField => {
  return getProviderEndpointStrategy(endpointType).providerEndpointField
}

export const normalizeChargeableEndpointType = (endpointType?: AiEndpointType) => {
  if (!endpointType || !isAiEndpointType(endpointType)) {
    return endpointType
  }

  return getProviderEndpointStrategy(endpointType).chargeableEndpointType
}
