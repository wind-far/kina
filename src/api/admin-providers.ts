import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface AdminProviderItem {
  id: string
  code: string
  name: string
  description: string
  iconUrl: string
  baseUrl: string
  apiKeyHint: string
  chatEndpoint: string
  imageEndpoint: string
  imageEditEndpoint: string
  videoEndpoint: string
  defaultChatModel: string
  supportedTypes: string[]
  isEnabled: boolean
  sortOrder: number
  modelCount: number
  enabledModelCount: number
  modelTypes: string[]
  createdAt: string
  updatedAt: string
}

export interface AdminProviderDetail extends AdminProviderItem {
  apiKey: string
}

export interface AdminProviderPayload {
  code: string
  name: string
  description: string
  iconUrl: string
  baseUrl: string
  apiKey: string
  chatEndpoint: string
  imageEndpoint: string
  imageEditEndpoint: string
  videoEndpoint: string
  defaultChatModel: string
  supportedTypes: string[]
  isEnabled: boolean
  sortOrder: number
}

const PROVIDERS_API_PATH = '/api/provider-config/providers'

// 查询后台厂商列表。
export const listAdminProviders = async () => {
  const response = await fetch(buildApiUrl(PROVIDERS_API_PATH), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminProviderItem[]>(response)
}

// 查询厂商详情，用于编辑和启停切换。
export const getAdminProviderDetail = async (id: string) => {
  const response = await fetch(buildApiUrl(`${PROVIDERS_API_PATH}/${encodeURIComponent(id)}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminProviderDetail>(response)
}

// 创建厂商。
export const createAdminProvider = async (payload: AdminProviderPayload) => {
  const response = await fetch(buildApiUrl(PROVIDERS_API_PATH), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AdminProviderItem>(response, {
    showSuccessMessage: true,
    successMessage: '厂商已创建',
  })
}

// 更新厂商。
export const updateAdminProvider = async (id: string, payload: AdminProviderPayload) => {
  const response = await fetch(buildApiUrl(`${PROVIDERS_API_PATH}/${encodeURIComponent(id)}`), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AdminProviderItem>(response, {
    showSuccessMessage: true,
    successMessage: '厂商已更新',
  })
}

// 删除厂商。
export const deleteAdminProvider = async (id: string) => {
  const response = await fetch(buildApiUrl(`${PROVIDERS_API_PATH}/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
  })

  return readApiData<{ id: string; deletedModelCount: number }>(response, {
    showSuccessMessage: true,
    successMessage: '厂商已删除',
  })
}
