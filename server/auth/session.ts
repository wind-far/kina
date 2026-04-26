import { AUTH_SESSION_COOKIE_NAME } from './service'
import { getUserBySessionToken } from './service'
import { sendAuthError } from './shared'

// 解析请求头中的 Cookie 键值对。
export const parseCookieMap = (cookieHeader: string) => {
  return cookieHeader
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, item) => {
      const splitIndex = item.indexOf('=')
      if (splitIndex <= 0) {
        return result
      }

      const key = item.slice(0, splitIndex).trim()
      const value = item.slice(splitIndex + 1).trim()
      if (key) {
        result[key] = decodeURIComponent(value)
      }
      return result
    }, {})
}

// 从请求中提取当前会话令牌。
export const readSessionTokenFromRequest = (req: any) => {
  const cookieHeader = String(req.headers.cookie || '').trim()
  if (!cookieHeader) {
    return ''
  }

  return parseCookieMap(cookieHeader)[AUTH_SESSION_COOKIE_NAME] || ''
}

// 从请求中识别当前登录用户。
export const readCurrentSessionUser = async (req: any) => {
  const sessionToken = readSessionTokenFromRequest(req)
  if (!sessionToken) {
    return null
  }

  return getUserBySessionToken(sessionToken)
}

// 断言当前请求已登录，否则直接返回 401。
export const requireCurrentSessionUser = async (req: any, res: any) => {
  const currentUser = await readCurrentSessionUser(req)
  if (!currentUser?.id) {
    sendAuthError(res, 401, '当前操作需要先登录')
    return null
  }

  return currentUser
}
