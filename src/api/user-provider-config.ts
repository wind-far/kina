import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface UserVideoProviderConfig {
  category: 'VIDEO'
  providerId: string
  providerName: string
  providerCode: string
  apiKeyConfigured: boolean
  apiKeyHint: string
  isEnabled: boolean
  updatedAt: string
}

export const listUserVideoProviderConfigs = async () => {
  const response = await fetch(buildApiUrl('/api/user-provider-config'), { credentials: 'include' })
  return await readApiData<UserVideoProviderConfig[]>(response, { showErrorMessage: false })
}

export const saveUserVideoProviderConfig = async (payload: { providerId: string; apiKey?: string }) => {
  const response = await fetch(buildApiUrl('/api/user-provider-config/video'), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return await readApiData<UserVideoProviderConfig>(response, { showSuccessMessage: true })
}

export const deleteUserVideoProviderConfig = async () => {
  const response = await fetch(buildApiUrl('/api/user-provider-config/video'), {
    method: 'DELETE',
    credentials: 'include',
  })
  return await readApiData<{ category: 'VIDEO'; deleted: boolean }>(response, { showSuccessMessage: true })
}
