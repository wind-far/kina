import { sendJson } from '../ai-gateway/shared'
import { readPaginationQuery } from '../shared/pagination'

export type AdminGenerationRecordStatusFilter = 'ALL' | 'COMPLETED' | 'FAILED' | 'RUNNING'
export type AdminGenerationRecordTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO' | 'AGENT' | 'DIGITAL_HUMAN' | 'MOTION' | 'RESEARCH'

export interface AdminGenerationRecordsQuery {
  keyword: string
  userKeyword: string
  modelKeyword: string
  errorKeyword: string
  status: AdminGenerationRecordStatusFilter
  type: AdminGenerationRecordTypeFilter
  page: number
  pageSize: number
}

// 解析后台生成记录列表筛选参数。
export const readAdminGenerationRecordsQuery = (requestUrl: string): AdminGenerationRecordsQuery => {
  const url = new URL(requestUrl, 'http://localhost')
  const rawStatus = String(url.searchParams.get('status') || 'ALL').trim().toUpperCase()
  const rawType = String(url.searchParams.get('type') || 'ALL').trim().replaceAll('-', '_').toUpperCase()
  const pagination = readPaginationQuery(url.searchParams, {
    defaultPageSize: 10,
    maxPageSize: 100,
  })

  return {
    keyword: String(url.searchParams.get('keyword') || '').trim(),
    userKeyword: String(url.searchParams.get('userKeyword') || '').trim(),
    modelKeyword: String(url.searchParams.get('modelKeyword') || '').trim(),
    errorKeyword: String(url.searchParams.get('errorKeyword') || '').trim(),
    status: rawStatus === 'COMPLETED' || rawStatus === 'FAILED' || rawStatus === 'RUNNING'
      ? rawStatus
      : 'ALL',
    type: rawType === 'IMAGE' || rawType === 'VIDEO' || rawType === 'AGENT' || rawType === 'DIGITAL_HUMAN' || rawType === 'MOTION' || rawType === 'RESEARCH'
      ? rawType
      : 'ALL',
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
}

// 返回统一的后台生成记录错误。
export const sendAdminGenerationRecordsError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'admin_generation_records_error',
      message,
    },
  })
}
