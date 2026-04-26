import type { AuthMethodCategory, AuthMethodType } from '@prisma/client'
import { readRawBody, sendJson } from '../ai-gateway/shared'
import type { AuthMethodConfigPayload } from './types'

// 通用验证码请求体。
export interface AuthVerificationCodePayload {
  methodType?: AuthMethodType
  target?: string
}

// 通用登录请求体。
export interface AuthLoginPayload {
  methodType?: AuthMethodType
  target?: string
  code?: string
}

// OAuth 授权请求体。
export interface AuthOAuthAuthorizePayload {
  methodType?: AuthMethodType
  redirectUri?: string
  state?: string
}

// 登录方式配置批量保存请求体。
export interface AuthMethodConfigSavePayload {
  methods?: AuthMethodConfigPayload[]
}

// 统一读取认证模块 JSON 请求体。
export const readAuthBody = async <T>(req: any): Promise<T> => {
  const raw = await readRawBody(req)
  if (!raw) {
    return {} as T
  }

  return JSON.parse(raw) as T
}

// 标准化登录方式配置写入列表。
export const normalizeAuthMethodConfigList = (methods: AuthMethodConfigPayload[] | undefined) => {
  if (!Array.isArray(methods)) {
    return []
  }

  return methods
    .map(item => ({
      methodType: item?.methodType as AuthMethodType,
      category: item?.category as AuthMethodCategory,
      displayName: String(item?.displayName || '').trim(),
      description: String(item?.description || '').trim(),
      iconType: String(item?.iconType || '').trim(),
      iconUrl: String(item?.iconUrl || '').trim(),
      isEnabled: item?.isEnabled !== false,
      isVisible: item?.isVisible !== false,
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item?.sortOrder) : 0,
      allowAutoFill: item?.allowAutoFill !== false,
      allowSignUp: item?.allowSignUp !== false,
      config: item?.config && typeof item.config === 'object' ? item.config : {},
    }))
    .filter(item => item.methodType && item.category && item.displayName)
}

// 统一返回认证模块错误响应。
export const sendAuthError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'auth_error',
      message,
    },
  })
}
