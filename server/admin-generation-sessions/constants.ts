export const ADMIN_GENERATION_SESSIONS_BASE_PATH = '/api/admin/generation-sessions'

// 判断当前路径是否命中后台会话管理接口。
export const isAdminGenerationSessionsPath = (requestPath: string) => {
  return requestPath === ADMIN_GENERATION_SESSIONS_BASE_PATH || requestPath.startsWith(`${ADMIN_GENERATION_SESSIONS_BASE_PATH}/`)
}
