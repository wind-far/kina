import { adminGet } from './admin-request'

export interface AdminAuditLogOperator {
  id: string
  username: string
  name: string
  email: string
  phone: string
  avatarUrl: string
  role: string
}

export interface AdminAuditLogItem {
  id: string
  operatorUserId: string
  operator: AdminAuditLogOperator | null
  action: string
  targetType: string
  targetId: string
  beforeJsonPreview: string | null
  afterJsonPreview: string | null
  ipAddress: string
  userAgent: string
  createdAt: string
}

export interface ListAdminAuditLogsOptions {
  action?: string
  targetType?: string
  targetId?: string
  operatorKeyword?: string
  createdFrom?: string
  createdTo?: string
  page?: number
  pageSize?: number
}

export interface AdminAuditLogListResult {
  items: AdminAuditLogItem[]
  summary: {
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
  }
}

const ADMIN_AUDIT_LOGS_BASE_PATH = '/api/admin/audit-logs'

export const listAdminAuditLogs = async (options: ListAdminAuditLogsOptions = {}) => {
  return adminGet<AdminAuditLogListResult>(ADMIN_AUDIT_LOGS_BASE_PATH, {
    query: {
      action: String(options.action || '').trim(),
      targetType: String(options.targetType || '').trim(),
      targetId: String(options.targetId || '').trim(),
      operatorKeyword: String(options.operatorKeyword || '').trim(),
      createdFrom: String(options.createdFrom || '').trim(),
      createdTo: String(options.createdTo || '').trim(),
      page: options.page || 1,
      pageSize: options.pageSize || 20,
    },
  })
}
