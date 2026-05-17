import { adminDelete, adminGet, adminPatch, adminPost, adminPut } from './admin-request'

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
  authIdentityCount: number
  verifiedAuthIdentityCount: number
  sessionCount: number
  currentPointBalance: number
  activeSubscription: {
    id: string
    status: string
    startTime: string
    endTime: string
    level?: {
      id: string
      name: string
      level: number
      monthlyBonusPoints?: number
      isEnabled?: boolean
    } | null
  } | null
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

export interface AdminUserSessionItem {
  id: string
  authMethodType: string
  identifierSnapshot: string | null
  ipAddress: string | null
  userAgent: string | null
  expiresAt: string
  revokedAt: string | null
  lastActiveAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminUserPointLogItem {
  id: string
  accountNo: string
  changeType: string
  action: string
  changeAmount: number
  balanceAfter: number
  availableAmount: number
  sourceType: string
  associationNo: string | null
  remark: string | null
  expireAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminUserDetail extends AdminUserItem {
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
  recentSessions: AdminUserSessionItem[]
  recentPointLogs: AdminUserPointLogItem[]
  assetBreakdown: {
    published: number
    draft: number
    hidden: number
    pendingReview: number
    approved: number
    rejected: number
  }
  generationBreakdown: {
    pending: number
    running: number
    completed: number
    failed: number
  }
}

export interface ListAdminUsersOptions {
  keyword?: string
  role?: 'ALL' | 'USER' | 'ADMIN'
  status?: 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED'
  page?: number
  pageSize?: number
}

export interface AdminUserListResult {
  items: AdminUserItem[]
  summary: {
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
  }
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

// 查询后台用户列表。
export const listAdminUsers = async (options: ListAdminUsersOptions = {}) => {
  return adminGet<AdminUserListResult>(ADMIN_USERS_BASE_PATH, {
    query: {
      keyword: String(options.keyword || '').trim(),
      role: options.role || 'ALL',
      status: options.status || 'ALL',
      page: options.page || 1,
      pageSize: options.pageSize || 10,
    },
  })
}

// 查询指定用户详情。
export const getAdminUserDetail = (id: string) => {
  return adminGet<AdminUserDetail>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/detail`)
}

// 创建后台用户。
export const createAdminUser = async (payload: CreateAdminUserPayload) => {
  return adminPost<AdminUserDetail>(ADMIN_USERS_BASE_PATH, payload, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '用户已创建',
  })
}

// 更新指定用户角色。
export const updateAdminUserRole = async (id: string, role: 'USER' | 'ADMIN') => {
  return adminPatch<AdminUserItem>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}`, { role }, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '用户角色已更新',
  })
}

// 更新用户资料。
export const updateAdminUserProfile = async (id: string, payload: {
  name?: string
  email?: string
  phone?: string
  avatarUrl?: string
  status?: 'ANONYMOUS' | 'ACTIVE' | 'DISABLED'
}) => {
  return adminPut<AdminUserDetail>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/profile`, payload, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '用户资料已更新',
  })
}

// 调整用户积分。
export const adjustAdminUserPoints = async (id: string, payload: {
  action: 'INCREASE' | 'DECREASE'
  changeAmount: number
  remark?: string
}) => {
  return adminPost<Record<string, unknown>>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/points-adjustment`, payload, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '用户积分已调整',
  })
}

// 调整用户会员权益。
export const adjustAdminUserMembership = async (id: string, payload: {
  levelId: string
  durationValue: number
  durationUnit: 'DAY' | 'MONTH' | 'YEAR'
  bonusPoints?: number
  remark?: string
}) => {
  return adminPost<Record<string, unknown>>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/membership-adjustment`, payload, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '会员权益已调整',
  })
}

// 查询用户订阅记录。
export const listAdminUserMembershipOrders = async (id: string) => {
  return adminGet<AdminUserMembershipOrderItem[]>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/membership-orders`)
}

// 清空用户当前登录会话。
export const resetAdminUserLoginState = async (id: string) => {
  return adminPost<{ revokedCount: number }>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}/reset-login-state`, {}, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '已清空该用户的登录会话',
  })
}

// 删除用户。
export const deleteAdminUser = async (id: string) => {
  return adminDelete<boolean>(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}`, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '用户已删除',
  })
}
