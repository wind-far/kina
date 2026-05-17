import { adminGet } from './admin-request'
import type { PersistedGenerationRecord } from './generation-records'

export type AdminGenerationRecordStatusFilter = 'all' | 'completed' | 'failed' | 'running'
export type AdminGenerationRecordTypeFilter = 'all' | PersistedGenerationRecord['type']

export interface AdminGenerationRecordItem extends PersistedGenerationRecord {
  user: {
    id: string
    name: string
    email: string
    phone: string
    avatarUrl: string
  }
}

export interface ListAdminGenerationRecordsOptions {
  keyword?: string
  userKeyword?: string
  modelKeyword?: string
  errorKeyword?: string
  status?: AdminGenerationRecordStatusFilter
  type?: AdminGenerationRecordTypeFilter
  page?: number
  pageSize?: number
}

export interface AdminGenerationRecordListResult {
  items: AdminGenerationRecordItem[]
  summary: {
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
  }
}

const ADMIN_GENERATION_RECORDS_BASE_PATH = '/api/admin/generation-records'

// 查询后台全站生成记录列表。
export const listAdminGenerationRecords = async (options: ListAdminGenerationRecordsOptions = {}) => {
  return adminGet<AdminGenerationRecordListResult>(ADMIN_GENERATION_RECORDS_BASE_PATH, {
    query: {
      keyword: String(options.keyword || '').trim(),
      userKeyword: String(options.userKeyword || '').trim(),
      modelKeyword: String(options.modelKeyword || '').trim(),
      errorKeyword: String(options.errorKeyword || '').trim(),
      status: options.status || 'all',
      type: options.type || 'all',
      page: options.page || 1,
      pageSize: options.pageSize || 10,
    },
  })
}
