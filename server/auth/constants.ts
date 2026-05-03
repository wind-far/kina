// 认证接口基础路径。
export const AUTH_BASE_PATH = '/api/auth'

// 登录方式列表接口。
export const AUTH_METHODS_PATH = `${AUTH_BASE_PATH}/methods`

// 登录方式配置接口。
export const AUTH_CONFIGS_PATH = `${AUTH_BASE_PATH}/configs`

// 通用验证码下发接口。
export const AUTH_VERIFICATION_CODE_PATH = `${AUTH_BASE_PATH}/verification-code`

// 通用登录接口。
export const AUTH_LOGIN_PATH = `${AUTH_BASE_PATH}/login`

// OAuth 授权地址生成接口。
export const AUTH_OAUTH_AUTHORIZE_PATH = `${AUTH_BASE_PATH}/oauth/authorize`

// 当前登录会话查询接口。
export const AUTH_SESSION_PATH = `${AUTH_BASE_PATH}/session`

// 退出登录接口。
export const AUTH_LOGOUT_PATH = `${AUTH_BASE_PATH}/logout`

// 当前请求路径是否命中认证模块。
export const isAuthPath = (requestPath: string) => {
  return [
    AUTH_METHODS_PATH,
    AUTH_CONFIGS_PATH,
    AUTH_VERIFICATION_CODE_PATH,
    AUTH_LOGIN_PATH,
    AUTH_OAUTH_AUTHORIZE_PATH,
    AUTH_SESSION_PATH,
    AUTH_LOGOUT_PATH,
  ].includes(requestPath)
}
