import type { AuthMethodCategory, AuthMethodType, UserRole, VerificationChannel } from '@prisma/client'

// 登录用户资料。
export interface AuthUserProfile {
  id: string
  name: string
  phone: string
  email: string
  maskedPhone: string
  maskedEmail: string
  avatarUrl: string
  role: UserRole
  loginMethodType: AuthMethodType
}

// 前端可见的登录方式结构。
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

// 管理后台使用的登录方式配置结构。
export interface AuthMethodConfigPayload {
  methodType: AuthMethodType
  category: AuthMethodCategory
  displayName: string
  description?: string
  iconType?: string
  iconUrl?: string
  isEnabled?: boolean
  isVisible?: boolean
  sortOrder?: number
  allowAutoFill?: boolean
  allowSignUp?: boolean
  config?: Record<string, any>
}

// 发送验证码时的上下文。
export interface SendCodeContext {
  methodType: AuthMethodType
  target: string
  requesterIp?: string
  userAgent?: string
  methodConfig: PublicAuthMethod
}

// 验证码结果。
export interface SendCodeResult {
  id: string
  target: string
  channel: VerificationChannel
  expiresAt: string
  debugCode?: string
}

// 登录上下文。
export interface LoginContext {
  methodType: AuthMethodType
  target?: string
  code?: string
  requesterIp?: string
  userAgent?: string
  methodConfig: PublicAuthMethod
}

// 登录结果。
export interface LoginResult {
  token: string
  expiresAt: string
  user: AuthUserProfile
}

// OAuth 开始授权的上下文。
export interface OAuthAuthorizeContext {
  methodType: AuthMethodType
  redirectUri?: string
  state?: string
  methodConfig: PublicAuthMethod
}

// OAuth 授权结果。
export interface OAuthAuthorizeResult {
  authUrl: string
}

// 登录策略接口。
export interface AuthStrategy {
  methodType: AuthMethodType
  category: AuthMethodCategory
  canSendCode?: boolean
  canLoginWithCode?: boolean
  canStartOAuth?: boolean
  sendCode?: (context: SendCodeContext) => Promise<SendCodeResult>
  login?: (context: LoginContext) => Promise<LoginResult>
  startOAuth?: (context: OAuthAuthorizeContext) => Promise<OAuthAuthorizeResult>
}
