import type { PointActionType, UserRole, UserStatus } from '@prisma/client'
import { sendJson, readRawBody } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { requireAdminSessionUser } from '../auth/session'
import { ADMIN_USERS_BASE_PATH } from './constants'
import {
  adjustAdminUserMembership,
  adjustAdminUserPoints,
  createAdminUser,
  deleteAdminUser,
  getAdminUserDetail,
  listAdminUserMembershipOrders,
  listAdminUsers,
  resetAdminUserLoginState,
  updateAdminUserProfile,
  updateAdminUserRole,
  type ListAdminUsersOptions,
} from './service'

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

const readRequestPayload = async <T>(req: any) => {
  const rawBody = await readRawBody(req)
  return rawBody ? JSON.parse(rawBody) as T : {} as T
}

const readAdminUserUpdateBody = async (req: any) => {
  const payload = await readRequestPayload<{ role?: UserRole }>(req)
  const role = payload?.role === 'ADMIN' ? 'ADMIN' : payload?.role === 'USER' ? 'USER' : ''

  if (!role) {
    throw new Error('缺少合法的用户角色')
  }

  return { role }
}

const readAdminUserProfileBody = async (req: any) => {
  const payload = await readRequestPayload<{
    name?: string
    email?: string
    phone?: string
    avatarUrl?: string
    status?: UserStatus
  }>(req)

  const status = payload?.status === 'ACTIVE' || payload?.status === 'DISABLED' || payload?.status === 'ANONYMOUS'
    ? payload.status
    : undefined

  return {
    name: payload?.name,
    email: payload?.email,
    phone: payload?.phone,
    avatarUrl: payload?.avatarUrl,
    status,
  }
}

const readAdminUserCreateBody = async (req: any) => {
  const payload = await readRequestPayload<{
    name?: string
    email?: string
    phone?: string
    avatarUrl?: string
    role?: UserRole
    status?: UserStatus
  }>(req)

  const role = payload?.role === 'ADMIN' ? 'ADMIN' : 'USER'
  const status = payload?.status === 'ACTIVE' || payload?.status === 'DISABLED' || payload?.status === 'ANONYMOUS'
    ? payload.status
    : 'ACTIVE'

  return {
    name: payload?.name,
    email: payload?.email,
    phone: payload?.phone,
    avatarUrl: payload?.avatarUrl,
    role,
    status,
  }
}

const readAdminUserPointAdjustmentBody = async (req: any) => {
  const payload = await readRequestPayload<{
    action?: PointActionType
    changeAmount?: number
    remark?: string
  }>(req)

  const action: PointActionType = payload?.action === 'DECREASE' ? 'DECREASE' : 'INCREASE'
  const changeAmount = Math.max(0, Math.round(Number(payload?.changeAmount) || 0))

  if (changeAmount <= 0) {
    throw new Error('调整积分必须大于 0')
  }

  return {
    action,
    changeAmount,
    remark: payload?.remark,
  }
}

const readAdminUserMembershipAdjustmentBody = async (req: any) => {
  const payload = await readRequestPayload<{
    levelId?: string
    durationValue?: number
    durationUnit?: string
    bonusPoints?: number
    remark?: string
  }>(req)

  return {
    levelId: String(payload?.levelId || '').trim(),
    durationValue: Math.max(1, Math.round(Number(payload?.durationValue) || 1)),
    durationUnit: String(payload?.durationUnit || 'MONTH').trim().toUpperCase(),
    bonusPoints: Math.max(0, Math.round(Number(payload?.bonusPoints) || 0)),
    remark: payload?.remark,
  }
}

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

const splitAdminUserPath = (requestPath: string) => {
  const suffix = requestPath.startsWith(`${ADMIN_USERS_BASE_PATH}/`)
    ? decodeURIComponent(requestPath.slice(ADMIN_USERS_BASE_PATH.length + 1))
    : ''
  const segments = suffix.split('/').filter(Boolean)

  return {
    suffix,
    segments,
    targetUserId: String(segments[0] || '').trim(),
    action: String(segments[1] || '').trim(),
  }
}

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
    const { suffix, targetUserId, action } = splitAdminUserPath(requestPath)

    if (req.method === 'GET' && requestPath === ADMIN_USERS_BASE_PATH) {
      const query = readAdminUserListQuery(req)
      const data = await listAdminUsers(query)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && requestPath === ADMIN_USERS_BASE_PATH) {
      const payload = await readAdminUserCreateBody(req)
      const data = await createAdminUser({
        currentUserId: currentUser.id,
        ...payload,
      })
      sendJson(res, 200, { data, message: '用户已创建' })
      return
    }

    if (req.method === 'PATCH' && suffix && !action) {
      const payload = await readAdminUserUpdateBody(req)
      const data = await updateAdminUserRole({
        targetUserId,
        role: payload.role,
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '用户角色已更新' })
      return
    }

    if (req.method === 'GET' && targetUserId && action === 'detail') {
      const data = await getAdminUserDetail(targetUserId)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PUT' && targetUserId && action === 'profile') {
      const payload = await readAdminUserProfileBody(req)
      const data = await updateAdminUserProfile({
        targetUserId,
        currentUserId: currentUser.id,
        ...payload,
      })
      sendJson(res, 200, { data, message: '用户资料已更新' })
      return
    }

    if (req.method === 'POST' && targetUserId && action === 'points-adjustment') {
      const payload = await readAdminUserPointAdjustmentBody(req)
      const data = await adjustAdminUserPoints({
        targetUserId,
        currentUserId: currentUser.id,
        ...payload,
      })
      sendJson(res, 200, { data, message: '用户积分已调整' })
      return
    }

    if (req.method === 'POST' && targetUserId && action === 'membership-adjustment') {
      const payload = await readAdminUserMembershipAdjustmentBody(req)
      const data = await adjustAdminUserMembership({
        targetUserId,
        currentUserId: currentUser.id,
        ...payload,
      })
      sendJson(res, 200, { data, message: '会员权益已调整' })
      return
    }

    if (req.method === 'GET' && targetUserId && action === 'membership-orders') {
      const data = await listAdminUserMembershipOrders(targetUserId)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && targetUserId && action === 'reset-login-state') {
      const data = await resetAdminUserLoginState({
        targetUserId,
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '已清空该用户的登录会话' })
      return
    }

    if (req.method === 'DELETE' && targetUserId && !action) {
      const data = await deleteAdminUser({
        targetUserId,
        currentUserId: currentUser.id,
      })
      sendJson(res, 200, { data, message: '用户已删除' })
      return
    }

    sendAdminUsersError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendAdminUsersError(res, 500, error?.message || '处理后台用户管理请求失败')
  }
}
