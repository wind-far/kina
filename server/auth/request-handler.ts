import type { AuthMethodType } from '@prisma/client'
import { sendJson } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import {
  AUTH_CONFIGS_PATH,
  AUTH_LOGIN_PATH,
  AUTH_LOGOUT_PATH,
  AUTH_METHODS_PATH,
  AUTH_OAUTH_AUTHORIZE_PATH,
  AUTH_SESSION_PATH,
  AUTH_VERIFICATION_CODE_PATH,
} from './constants'
import { readSessionTokenFromRequest } from './session'
import { getAuthStrategy } from './strategies'
import { getAuthMethodConfig, getSessionCookieMaxAge, getUserBySessionToken, listAuthMethodConfigs, listEnabledAuthMethods, revokeSessionToken, saveAuthMethodConfigs, AUTH_SESSION_COOKIE_NAME } from './service'
import { type AuthLoginPayload, type AuthMethodConfigSavePayload, type AuthOAuthAuthorizePayload, type AuthVerificationCodePayload, normalizeAuthMethodConfigList, readAuthBody, sendAuthError } from './shared'

// 推导请求来源 IP。
const readRequesterIp = (req: any) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').trim()
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return String(req.socket?.remoteAddress || '').trim()
}

// 写入登录成功后的会话 Cookie。
const applySessionCookie = (res: any, sessionToken: string) => {
  const maxAge = getSessionCookieMaxAge()
  const cookieParts = [
    `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure')
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '))
}

// 清理当前会话 Cookie。
const clearSessionCookie = (res: any) => {
  const cookieParts = [
    `${AUTH_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure')
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '))
}

// 读取并校验登录方式。
const readMethodType = (methodType: AuthMethodType | undefined) => {
  const normalizedMethodType = String(methodType || '').trim() as AuthMethodType
  if (!normalizedMethodType) {
    throw new Error('缺少登录方式类型')
  }

  return normalizedMethodType
}

// 处理认证模块请求。
export const handleAuthRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendAuthError(res, 500, '缺少 DATABASE_URL，暂时无法使用登录能力。')
      return
    }

    const requestUrl = String(req.url || '').split('?')[0]

    if (req.method === 'GET' && requestUrl === AUTH_METHODS_PATH) {
      const data = await listEnabledAuthMethods()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && requestUrl === AUTH_CONFIGS_PATH) {
      const data = await listAuthMethodConfigs()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PUT' && requestUrl === AUTH_CONFIGS_PATH) {
      const payload = await readAuthBody<AuthMethodConfigSavePayload>(req)
      const data = await saveAuthMethodConfigs(normalizeAuthMethodConfigList(payload.methods))
      sendJson(res, 200, { data, message: '登录方式配置已保存' })
      return
    }

    if (req.method === 'POST' && requestUrl === AUTH_VERIFICATION_CODE_PATH) {
      const payload = await readAuthBody<AuthVerificationCodePayload>(req)
      const methodType = readMethodType(payload.methodType)
      const methodConfig = await getAuthMethodConfig(methodType)

      if (!methodConfig.isEnabled) {
        throw new Error('当前登录方式未启用')
      }

      const strategy = getAuthStrategy(methodType)
      if (!strategy.canSendCode || !strategy.sendCode) {
        throw new Error('当前登录方式不支持验证码')
      }

      const data = await strategy.sendCode({
        methodType,
        target: String(payload.target || '').trim(),
        requesterIp: readRequesterIp(req),
        userAgent: String(req.headers['user-agent'] || '').trim(),
        methodConfig,
      })

      sendJson(res, 200, { data, message: '验证码已生成' })
      return
    }

    if (req.method === 'POST' && requestUrl === AUTH_LOGIN_PATH) {
      const payload = await readAuthBody<AuthLoginPayload>(req)
      const methodType = readMethodType(payload.methodType)
      const methodConfig = await getAuthMethodConfig(methodType)

      if (!methodConfig.isEnabled) {
        throw new Error('当前登录方式未启用')
      }

      const strategy = getAuthStrategy(methodType)
      if (!strategy.canLoginWithCode || !strategy.login) {
        throw new Error('当前登录方式暂不支持当前登录流程')
      }

      const data = await strategy.login({
        methodType,
        target: String(payload.target || '').trim(),
        code: String(payload.code || '').trim(),
        requesterIp: readRequesterIp(req),
        userAgent: String(req.headers['user-agent'] || '').trim(),
        methodConfig,
      })

      applySessionCookie(res, data.token)
      sendJson(res, 200, {
        data: {
          user: data.user,
          expiresAt: data.expiresAt,
        },
        message: '登录成功',
      })
      return
    }

    if (req.method === 'POST' && requestUrl === AUTH_OAUTH_AUTHORIZE_PATH) {
      const payload = await readAuthBody<AuthOAuthAuthorizePayload>(req)
      const methodType = readMethodType(payload.methodType)
      const methodConfig = await getAuthMethodConfig(methodType)

      if (!methodConfig.isEnabled) {
        throw new Error('当前登录方式未启用')
      }

      const strategy = getAuthStrategy(methodType)
      if (!strategy.canStartOAuth || !strategy.startOAuth) {
        throw new Error('当前登录方式不支持第三方授权')
      }

      const data = await strategy.startOAuth({
        methodType,
        redirectUri: String(payload.redirectUri || '').trim(),
        state: String(payload.state || '').trim(),
        methodConfig,
      })

      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && requestUrl === AUTH_SESSION_PATH) {
      const sessionToken = readSessionTokenFromRequest(req)
      const user = sessionToken ? await getUserBySessionToken(sessionToken) : null
      sendJson(res, 200, {
        data: {
          user,
        },
      })
      return
    }

    if (req.method === 'POST' && requestUrl === AUTH_LOGOUT_PATH) {
      const sessionToken = readSessionTokenFromRequest(req)
      if (sessionToken) {
        await revokeSessionToken(sessionToken)
      }
      clearSessionCookie(res)
      sendJson(res, 200, {
        data: {
          success: true,
        },
        message: '已退出登录',
      })
      return
    }

    sendAuthError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendAuthError(res, 500, error?.message || '处理登录请求失败')
  }
}
