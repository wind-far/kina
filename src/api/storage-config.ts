import { buildApiUrl } from './http'
import { readApiData } from './response'

// 对象存储配置结构。
export interface StorageConfigItem {
  id: string
  name: string
  code: string
  providerType: string
  accessKeyHint: string
  secretKeyHint: string
  endpoint: string
  bucket: string
  domain: string
  region: string
  sortOrder: number
  description: string
  isEnabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// 创建或更新对象存储时使用的表单结构。
export interface StorageConfigPayload {
  name: string
  code: string
  accessKey: string
  secretKey: string
  endpoint: string
  bucket: string
  domain?: string
  region?: string
  sortOrder?: number
  description?: string
  isEnabled?: boolean
  isDefault?: boolean
}

// 对象存储配置接口基础路径。
const STORAGE_CONFIGS_API_PATH = '/api/storage/configs'

// 查询对象存储配置列表。
export const listStorageConfigs = async () => {
  const response = await fetch(buildApiUrl(STORAGE_CONFIGS_API_PATH), {
    method: 'GET',
    // 后台接口依赖会话 Cookie 鉴权，这里必须显式携带登录态。
    credentials: 'include',
    cache: 'no-store',
  })
  return readApiData<StorageConfigItem[]>(response)
}

// 创建对象存储配置。
export const createStorageConfig = async (payload: StorageConfigPayload) => {
  const response = await fetch(buildApiUrl(STORAGE_CONFIGS_API_PATH), {
    method: 'POST',
    // 管理端创建配置时需要带上当前登录会话。
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return readApiData<StorageConfigItem>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
  })
}

// 更新对象存储配置。
export const updateStorageConfig = async (id: string, payload: Partial<StorageConfigPayload>) => {
  const response = await fetch(buildApiUrl(`${STORAGE_CONFIGS_API_PATH}/${encodeURIComponent(id)}`), {
    method: 'PUT',
    // 更新存储配置同样走后台鉴权。
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return readApiData<StorageConfigItem>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
  })
}

// 启用某一条对象存储配置。
export const activateStorageConfig = async (id: string) => {
  const response = await fetch(buildApiUrl(`${STORAGE_CONFIGS_API_PATH}/${encodeURIComponent(id)}/activate`), {
    method: 'POST',
    // 启用配置会修改服务端状态，必须携带管理员会话。
    credentials: 'include',
  })
  return readApiData<StorageConfigItem>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
  })
}
