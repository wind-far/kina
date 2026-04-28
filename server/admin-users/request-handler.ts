import type { UserRole } from '@prisma/client'
import { sendJson, readRawBody } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { requireAdminSessionUser } from '../auth/session'
import { ADMIN_USERS_BASE_PATH } from './constants'
import { listAdminUsers, updateAdminUserRole, type ListAdminUsersOptions } from './service'

const sendAdminUsersError = (res: any, statusCode: number, message: string) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({
    message,
    error: {
      type: 'admin_users_error',
      message,
    },
  }))
}

// 读取用户角色更新请求体。
const readAdminUserUpdateBody = async (req: any) => {
  const rawBody = await readRawBody(req)
  const payload = rawBody ? JSON.parse(rawBody) as { role?: UserRole } : {}
  const role = payload?.role === 'ADMIN' ? 'ADMIN' : payload?.role === 'USER' ? 'USER' : ''

  if (!role) {
    throw new Error('缺少合法的用户角色')
  }

  return { role }
}

// 从查询参数中提取后台用户筛选条件。
const readAdminUserListQuery = (req: any): ListAdminUsersOptions => {
  const requestUrl = String(req.url || '').trim()
  const url = new URL(requestUrl, 'http://127.0.0.1')
  const keyword = url.searchParams.get('keyword') || ''
  const role = String(url.searchParams.get('role') || 'ALL').toUpperCase()
  const status = String(url.searchParams.get('status') || 'ALL').toUpperCase()

  return {
    keyword,
    role: role === 'ADMIN' || role === 'USER' ? role : 'ALL',
    status: status === 'ANONYMOUS' || status === 'ACTIVE' || status === 'DISABLED' ? status : 'ALL',
  }
}

// 处理后台用户管理请求。
export const handleAdminUsersRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendAdminUsersError(res, 500, '缺少 DATABASE_URL，暂时无法使用后台用户管理。')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    const requestPath = String(req.url || '').split('?')[0]
    const suffix = requestPath.startsWith(`${ADMIN_USERS_BASE_PATH}/`)
      ? decodeURIComponent(requestPath.slice(ADMIN_USERS_BASE_PATH.length + 1))
      : ''

    if (req.method === 'GET' && requestPath === ADMIN_USERS_BASE_PATH) {
      const query = readAdminUserListQuery(req)
      const data = await listAdminUsers(query)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PATCH' && suffix) {
      const payload = await readAdminUserUpdateBody(req)
      const data = await updateAdminUserRole({
        targetUserId: suffix,
        role: payload.role,
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '用户角色已更新' })
      return
    }

    sendAdminUsersError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendAdminUsersError(res, 500, error?.message || '处理后台用户管理请求失败')
  }
}
