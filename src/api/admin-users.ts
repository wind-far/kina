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

export interface ListAdminUsersOptions {
  keyword?: string
  role?: 'ALL' | 'USER' | 'ADMIN'
  status?: 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED'
}

const ADMIN_USERS_BASE_PATH = '/api/admin/users'

// 查询后台用户列表。
export const listAdminUsers = async (options: ListAdminUsersOptions = {}) => {
  const query = new URLSearchParams()
  query.set('keyword', String(options.keyword || '').trim())
  query.set('role', options.role || 'ALL')
  query.set('status', options.status || 'ALL')

  const response = await fetch(buildApiUrl(`${ADMIN_USERS_BASE_PATH}?${query.toString()}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminUserItem[]>(response)
}

// 更新指定用户角色。
export const updateAdminUserRole = async (id: string, role: 'USER' | 'ADMIN') => {
  const response = await fetch(buildApiUrl(`${ADMIN_USERS_BASE_PATH}/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  })

  return readApiData<AdminUserItem>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '用户角色已更新',
  })
}
