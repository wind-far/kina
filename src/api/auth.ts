import { buildApiUrl } from './http'
import { readApiData } from './response'

// 登录方式类型。
export type AuthMethodType =
  | 'PHONE_CODE'
  | 'EMAIL_CODE'
  | 'WECHAT_OAUTH'
  | 'GITHUB_OAUTH'
  | 'GOOGLE_OAUTH'
  | 'CUSTOM_OAUTH'

// 登录方式分类。
export type AuthMethodCategory = 'CODE' | 'OAUTH'

// 登录用户信息。
export interface AuthUserProfile {
  id: string
  name: string
  phone: string
  email: string
  maskedPhone: string
  maskedEmail: string
  avatarUrl: string
  role: 'USER' | 'ADMIN'
  loginMethodType: AuthMethodType
}

// 前端可见登录方式配置。
export interface PublicAuthMethod {
  methodType: AuthMethodType
  category: AuthMethodCategory
  displayName: string
  description: string
  iconType: string
  iconUrl: string
  isEnabled: boolean
  isVisible: boolean
  sortOrder: number
  allowAutoFill: boolean
  allowSignUp: boolean
  config: Record<string, any>
}

// 验证码接口返回结构。
export interface AuthVerificationCodeResult {
  id: string
  target: string
  channel: 'PHONE' | 'EMAIL'
  expiresAt: string
  debugCode?: string
}

// 登录会话接口返回结构。
export interface AuthSessionResult {
  user: AuthUserProfile | null
  expiresAt?: string
}

// OAuth 授权地址结构。
export interface AuthOAuthAuthorizeResult {
  authUrl: string
}

// 管理后台登录方式配置结构。
export interface AuthMethodConfigPayload extends PublicAuthMethod {}

// 认证接口基础路径。
const AUTH_BASE_PATH = '/api/auth'

// 获取当前启用的登录方式。
export const listEnabledAuthMethods = async () => {
  const response = await fetch(buildApiUrl(`${AUTH_BASE_PATH}/methods`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<PublicAuthMethod[]>(response)
}

// 获取全部登录方式配置。
export const listAuthMethodConfigs = async () => {
  const response = await fetch(buildApiUrl(`${AUTH_BASE_PATH}/configs`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<PublicAuthMethod[]>(response)
}

// 保存全部登录方式配置。
export const saveAuthMethodConfigs = async (methods: AuthMethodConfigPayload[]) => {
  const response = await fetch(buildApiUrl(`${AUTH_BASE_PATH}/configs`), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      methods,
    }),
  })

  return readApiData<PublicAuthMethod[]>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
  })
}

// 请求验证码。
export const requestAuthVerificationCode = async (payload: { methodType: AuthMethodType; target: string }) => {
  const response = await fetch(buildApiUrl(`${AUTH_BASE_PATH}/verification-code`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AuthVerificationCodeResult>(response)
}

// 提交验证码登录。
export const loginByVerificationCode = async (payload: {
  methodType: AuthMethodType
  target: string
  code: string
}) => {
  const response = await fetch(buildApiUrl(`${AUTH_BASE_PATH}/login`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AuthSessionResult>(response)
}

// 获取 OAuth 跳转地址。
export const createOAuthAuthorizeUrl = async (payload: {
  methodType: AuthMethodType
  redirectUri?: string
  state?: string
}) => {
  const response = await fetch(buildApiUrl(`${AUTH_BASE_PATH}/oauth/authorize`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AuthOAuthAuthorizeResult>(response)
}

// 获取当前登录会话。
export const getAuthSession = async () => {
  const response = await fetch(buildApiUrl(`${AUTH_BASE_PATH}/session`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AuthSessionResult>(response)
}

// 退出当前登录会话。
export const logoutAuthSession = async () => {
  const response = await fetch(buildApiUrl(`${AUTH_BASE_PATH}/logout`), {
    method: 'POST',
    credentials: 'include',
  })

  return readApiData<{ success: boolean }>(response)
}
