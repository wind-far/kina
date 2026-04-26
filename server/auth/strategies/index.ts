import type { AuthMethodType } from '@prisma/client'
import { emailCodeStrategy } from './email-code'
import { createOAuthStrategy } from './oauth'
import { phoneCodeStrategy } from './phone-code'
import type { AuthStrategy } from '../types'

// 所有认证策略注册表。
const AUTH_STRATEGIES: Record<AuthMethodType, AuthStrategy> = {
  PHONE_CODE: phoneCodeStrategy,
  EMAIL_CODE: emailCodeStrategy,
  WECHAT_OAUTH: createOAuthStrategy('WECHAT_OAUTH'),
  GITHUB_OAUTH: createOAuthStrategy('GITHUB_OAUTH'),
  GOOGLE_OAUTH: createOAuthStrategy('GOOGLE_OAUTH'),
  CUSTOM_OAUTH: createOAuthStrategy('CUSTOM_OAUTH'),
}

// 按类型读取认证策略。
export const getAuthStrategy = (methodType: AuthMethodType) => {
  const strategy = AUTH_STRATEGIES[methodType]
  if (!strategy) {
    throw new Error('未找到对应的登录策略')
  }

  return strategy
}
