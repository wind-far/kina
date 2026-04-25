/**
 * 厂商运行时配置
 * 统一管理前端本地保存的 baseUrl / apiKey / endpoint。
 */

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.chatfire.site/v1'

export type AiEndpointType = 'chat' | 'image' | 'video'

const DEFAULT_ENDPOINTS: Record<AiEndpointType, string> = {
  chat: '/chat/completions',
  image: '/images/generations',
  video: '/videos',
}

const STORAGE_KEYS = {
  baseUrl: 'workflow-api-base-url',
  apiKey: 'workflow-api-key',
}

const isClient = () => typeof window !== 'undefined'

const readStorage = (key: string) => {
  if (!isClient()) return ''
  return window.localStorage.getItem(key) || ''
}

const writeStorage = (key: string, value: string) => {
  if (!isClient()) return
  window.localStorage.setItem(key, value)
}

export const getBaseUrl = () => readStorage(STORAGE_KEYS.baseUrl) || DEFAULT_BASE_URL

export const setBaseUrl = (url: string) => {
  writeStorage(STORAGE_KEYS.baseUrl, url.trim())
}

export const getApiKey = () => readStorage(STORAGE_KEYS.apiKey)

export const setApiKey = (apiKey: string) => {
  writeStorage(STORAGE_KEYS.apiKey, apiKey.trim())
}

export const getEndpoint = (type: AiEndpointType) => {
  return readStorage(`wf-endpoint-${type}`) || DEFAULT_ENDPOINTS[type]
}

export const setEndpoint = (type: AiEndpointType, path: string) => {
  writeStorage(`wf-endpoint-${type}`, path.trim())
}

export interface UpstreamRequestConfig {
  baseUrl: string
  apiKey?: string
  endpoint: string
}

export const getUpstreamRequestConfig = (
  type: AiEndpointType,
  endpointOverride?: string,
): UpstreamRequestConfig => ({
  baseUrl: getBaseUrl(),
  apiKey: getApiKey() || undefined,
  endpoint: endpointOverride || getEndpoint(type),
})

