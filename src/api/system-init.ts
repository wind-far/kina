import { buildApiUrl } from './http'
import { readApiData } from './response'
import type { AuthUserProfile } from './auth'

export interface SystemInitStatus {
  isInitialized: boolean
  initializedAt: string
  adminUserId: string
  adminUsername: string
  siteName: string
}

export interface SystemInitPayload {
  username: string
  password: string
  confirmPassword: string
  name: string
  email: string
  siteName: string
  siteDescription: string
  siteLogoUrl: string
  siteIconUrl: string
}

export interface SystemInitResult {
  token: string
  expiresAt: string
  user: AuthUserProfile
  isInitialized: boolean
}

const SYSTEM_INIT_BASE_PATH = '/api/system-init'

// 查询系统是否已完成首次初始化。
export const getSystemInitStatus = async () => {
  const response = await fetch(buildApiUrl(`${SYSTEM_INIT_BASE_PATH}/status`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<SystemInitStatus>(response, {
    showErrorMessage: false,
  })
}

// 执行首次安装初始化。
export const initializeSystem = async (payload: SystemInitPayload) => {
  const response = await fetch(buildApiUrl(`${SYSTEM_INIT_BASE_PATH}/initialize`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<SystemInitResult>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
  })
}
