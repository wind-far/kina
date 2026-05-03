import type { AuthStrategy } from '../types'

// 读取 OAuth 配置中的字符串。
const readOAuthConfigString = (config: Record<string, any>, key: string) => {
  return String(config?.[key] || '').trim()
}

// 构造通用 OAuth 授权地址。
const buildAuthorizeUrl = (config: Record<string, any>, input: {
  defaultState: string
  redirectUri?: string
}) => {
  const authorizeUrl = readOAuthConfigString(config, 'authorizeUrl')
  const clientId = readOAuthConfigString(config, 'clientId')
  const responseType = readOAuthConfigString(config, 'responseType') || 'code'
  const scope = readOAuthConfigString(config, 'scope')
  const redirectUri = String(input.redirectUri || readOAuthConfigString(config, 'redirectUri')).trim()
  const state = input.defaultState

  if (!authorizeUrl || !clientId || !redirectUri) {
    throw new Error('第三方登录配置不完整，请先在后台补充 authorizeUrl、clientId、redirectUri')
  }

  const url = new URL(authorizeUrl)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', responseType)
  if (scope) {
    url.searchParams.set('scope', scope)
  }
  url.searchParams.set('state', state)

  return url.toString()
}

// 通用 OAuth 策略工厂。
export const createOAuthStrategy = (methodType: AuthStrategy['methodType']): AuthStrategy => ({
  methodType,
  category: 'OAUTH',
  canStartOAuth: true,
  async startOAuth(context) {
    const state = String(context.state || `${methodType.toLowerCase()}_${Date.now()}`).trim()
    return {
      authUrl: buildAuthorizeUrl(context.methodConfig.config || {}, {
        defaultState: state,
        redirectUri: context.redirectUri,
      }),
    }
  },
})
