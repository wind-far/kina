export const ADMIN_USERS_BASE_PATH = '/api/admin/users'

// 判断当前路径是否命中后台用户管理接口。
export const isAdminUsersPath = (requestPath: string) => {
  return requestPath === ADMIN_USERS_BASE_PATH || requestPath.startsWith(`${ADMIN_USERS_BASE_PATH}/`)
}
