import { buildApiUrl } from './http'
import { readApiData } from './response'
import type { AdminProviderItem } from './admin-providers'

export type AdminModelCategory = 'CHAT' | 'IMAGE' | 'VIDEO'

export interface AdminProviderModelItem {
  id: string
  providerId: string
  category: AdminModelCategory
  label: string
  modelKey: string
  description: string
  sortOrder: number
  isEnabled: boolean
  capabilityJson: Record<string, any> | null
  defaultParamsJson: Record<string, any> | null
  createdAt: string
  updatedAt: string
}

export interface AdminProviderModelListResult {
  provider: AdminProviderItem
  models: AdminProviderModelItem[]
}

export interface AdminProviderModelPayload {
  category: AdminModelCategory
  label: string
  modelKey: string
  description: string
  sortOrder: number
  isEnabled: boolean
  capabilityJson: Record<string, any> | null
  defaultParamsJson: Record<string, any> | null
}

export interface DiscoveredProviderModelItem {
  modelKey: string
  label: string
  description: string
  category: AdminModelCategory
  sortOrder: number
  raw: Record<string, any>
}

export interface DiscoverProviderModelsResult {
  provider: AdminProviderItem
  requestUrl: string
  models: DiscoveredProviderModelItem[]
}

export interface BatchUpsertProviderModelsPayload {
  items: AdminProviderModelPayload[]
}

const buildProviderModelsApiPath = (providerId: string) => `/api/provider-config/providers/${encodeURIComponent(providerId)}/models`

// 查询指定厂商下的模型列表。
export const listAdminProviderModels = async (providerId: string) => {
  const response = await fetch(buildApiUrl(buildProviderModelsApiPath(providerId)), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminProviderModelListResult>(response)
}

// 调用厂商上游 /v1/models 拉取模型目录。
export const discoverAdminProviderModels = async (providerId: string) => {
  const response = await fetch(buildApiUrl(`${buildProviderModelsApiPath(providerId)}/discover`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<DiscoverProviderModelsResult>(response, {
    showSuccessMessage: true,
    successMessage: '已获取上游模型列表',
  })
}

// 批量导入所选模型配置。
export const batchUpsertAdminProviderModels = async (providerId: string, payload: BatchUpsertProviderModelsPayload) => {
  const response = await fetch(buildApiUrl(`${buildProviderModelsApiPath(providerId)}/batch-upsert`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AdminProviderModelListResult>(response, {
    showSuccessMessage: true,
    successMessage: '模型已批量导入',
  })
}

// 创建模型配置。
export const createAdminProviderModel = async (providerId: string, payload: AdminProviderModelPayload) => {
  const response = await fetch(buildApiUrl(buildProviderModelsApiPath(providerId)), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AdminProviderModelItem>(response, {
    showSuccessMessage: true,
    successMessage: '模型已创建',
  })
}

// 更新模型配置。
export const updateAdminProviderModel = async (providerId: string, id: string, payload: AdminProviderModelPayload) => {
  const response = await fetch(buildApiUrl(`${buildProviderModelsApiPath(providerId)}/${encodeURIComponent(id)}`), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AdminProviderModelItem>(response, {
    showSuccessMessage: true,
    successMessage: '模型已更新',
  })
}

// 删除模型配置。
export const deleteAdminProviderModel = async (providerId: string, id: string) => {
  const response = await fetch(buildApiUrl(`${buildProviderModelsApiPath(providerId)}/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
  })

  return readApiData<{ id: string }>(response, {
    showSuccessMessage: true,
    successMessage: '模型已删除',
  })
}
