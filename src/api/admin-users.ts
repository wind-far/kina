import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface AdminUserItem {
  id: string
  name: string
  email: string
  phone: string
  maskedEmail: string
  maskedPhone: string
  avatarUrl: string
  role: 'USER' | 'ADMIN'
  status: 'ANONYMOUS' | 'ACTIVE' | 'DISABLED' | string
  createdAt: string
  updatedAt: string
  generationRecordCount: number
  assetCount: number
}

export interface AdminUserAuthIdentityItem {
  id: string
  methodType: string
  identifier: string
  providerUserId: string | null
  providerUnionId: string | null
  isVerified: boolean
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminUserMembershipOrderItem {
  id: string
  userId: string
  levelId: string
  planId: string | null
  orderNo: string
  sourceType: string
  status: string
  totalAmount: string
  paidAmount: string
  bonusPoints: number
  startTime: string | null
  endTime: string | null
  paidAt: string | null
  canceledAt: string | null
  refundedAt: string | null
  createdAt: string
  updatedAt: string
  level?: {
    id: string
    name: string
    level: number
  } | null
  plan?: {
    id: string
    name: string
    label: string | null
  } | null
}

export interface AdminUserDetail extends AdminUserItem {
  currentPointBalance: number
  sessionCount: number
  authIdentities: AdminUserAuthIdentityItem[]
  activeSubscription: {
    id: string
    userId: string
    levelId: string
    orderId: string | null
    status: string
    startTime: string
    endTime: string
    createdAt: string
    updatedAt: string
    level?: {
      id: string
      name: string
      level: number
      monthlyBonusPoints: number
      isEnabled: boolean
    } | null
    order?: AdminUserMembershipOrderItem | null
  } | null
  membershipOrders: AdminUserMembershipOrderItem[]
}

export interface ListAdminUsersOptions {
  keyword?: string
  role?: 'ALL' | 'USER' | 'ADMIN'
  status?: 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED'
}

export interface CreateAdminUserPayload {
  name?: string
  email?: string
  phone?: string
  avatarUrl?: string
  role?: 'USER' | 'ADMIN'
  status?: 'ANONYMOUS' | 'ACTIVE' | 'DISABLED'
}

const ADMIN_USERS_BASE_PATH = '/api/admin/users'

const requestAdminUserJson = async <T>(path: string, options: RequestInit = {}, successMessage = '') => {
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  return readApiData<T>(response, {
    showSuccessMessage: Boolean(successMessage),
    showErrorMessage: true,
    successMessage,
  })
}

// 查询后台用户列表。
export const listAdminUsers = async (options: ListAdminUsersOptions = {}) => {
  const query = new URLSearchParams()
  query.set('keyword', String(options.keyword || '').trim())
  query.set('role', options.role || 'ALL')
  query.set('status', options.status || 'ALL')

  return requestAdminUserJson<AdminUserItem[]>(`${ADMIN_USERS_BASE_PATH}?${query.toString()}`, {
    method: 'GET',
    headers: {},
  })
}

// 查询指定用户详情。
export const getAdminUserDetail = (id: string) => {
  return requestAdminUserJson<AdminUserDetail>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/detail`, {
    method: 'GET',
    headers: {},
  })
}

// 创建后台用户。
export const createAdminUser = async (payload: CreateAdminUserPayload) => {
  return requestAdminUserJson<AdminUserDetail>(ADMIN_USERS_BASE_PATH, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, '用户已创建')
}

// 更新指定用户角色。
export const updateAdminUserRole = async (id: string, role: 'USER' | 'ADMIN') => {
  return requestAdminUserJson<AdminUserItem>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }, '用户角色已更新')
}

// 更新用户资料。
export const updateAdminUserProfile = async (id: string, payload: {
  name?: string
  email?: string
  phone?: string
  avatarUrl?: string
  status?: 'ANONYMOUS' | 'ACTIVE' | 'DISABLED'
}) => {
  return requestAdminUserJson<AdminUserDetail>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/profile`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, '用户资料已更新')
}

// 调整用户积分。
export const adjustAdminUserPoints = async (id: string, payload: {
  action: 'INCREASE' | 'DECREASE'
  changeAmount: number
  remark?: string
}) => {
  return requestAdminUserJson<Record<string, unknown>>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/points-adjustment`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, '用户积分已调整')
}

// 调整用户会员权益。
export const adjustAdminUserMembership = async (id: string, payload: {
  levelId: string
  durationValue: number
  durationUnit: 'DAY' | 'MONTH' | 'YEAR'
  bonusPoints?: number
  remark?: string
}) => {
  return requestAdminUserJson<Record<string, unknown>>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/membership-adjustment`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, '会员权益已调整')
}

// 查询用户订阅记录。
export const listAdminUserMembershipOrders = async (id: string) => {
  return requestAdminUserJson<AdminUserMembershipOrderItem[]>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/membership-orders`, {
    method: 'GET',
    headers: {},
  })
}

// 清空用户当前登录会话。
export const resetAdminUserLoginState = async (id: string) => {
  return requestAdminUserJson<{ revokedCount: number }>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/reset-login-state`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, '已清空该用户的登录会话')
}

// 删除用户。
export const deleteAdminUser = async (id: string) => {
  return requestAdminUserJson<boolean>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({}),
  }, '用户已删除')
}
