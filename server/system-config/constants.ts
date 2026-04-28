// 系统设置公开读取接口。
export const SYSTEM_CONFIG_PUBLIC_PATH = '/api/system-config/public'

// 系统设置后台管理接口。
export const SYSTEM_CONFIG_ADMIN_PATH = '/api/system-config/admin'

// 判断当前请求是否命中系统设置接口。
export const isSystemConfigPath = (requestPath: string) => {
  return requestPath === SYSTEM_CONFIG_PUBLIC_PATH || requestPath === SYSTEM_CONFIG_ADMIN_PATH
}
