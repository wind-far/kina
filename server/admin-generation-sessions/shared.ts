import { readJsonBody, sendJson } from '../ai-gateway/shared'

export type AdminGenerationSessionStatusFilter = 'ALL' | 'HAS_ERROR' | 'RUNNING' | 'COMPLETED' | 'EMPTY'
export type AdminGenerationSessionTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO' | 'AGENT' | 'DIGITAL_HUMAN' | 'MOTION'

export interface AdminGenerationSessionsQuery {
  keyword: string
  userKeyword: string
  status: AdminGenerationSessionStatusFilter
  type: AdminGenerationSessionTypeFilter
  page: number
  pageSize: number
}

export interface AdminGenerationSessionPayload {
  title?: string
}

// 解析后台会话列表筛选参数。
export const readAdminGenerationSessionsQuery = (requestUrl: string): AdminGenerationSessionsQuery => {
  const url = new URL(requestUrl, 'http://localhost')
  const keyword = String(url.searchParams.get('keyword') || '').trim()
  const userKeyword = String(url.searchParams.get('userKeyword') || '').trim()
  const rawStatus = String(url.searchParams.get('status') || 'ALL').trim().toUpperCase()
  const rawType = String(url.searchParams.get('type') || 'ALL').trim().toUpperCase()
  const rawPage = Number(url.searchParams.get('page') || 1)
  const rawPageSize = Number(url.searchParams.get('pageSize') || 12)

  return {
    keyword,
    userKeyword,
    status: rawStatus === 'HAS_ERROR' || rawStatus === 'RUNNING' || rawStatus === 'COMPLETED' || rawStatus === 'EMPTY'
      ? rawStatus
      : 'ALL',
    type: rawType === 'IMAGE' || rawType === 'VIDEO' || rawType === 'AGENT' || rawType === 'DIGITAL_HUMAN' || rawType === 'MOTION'
      ? rawType
      : 'ALL',
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
    pageSize: Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 100) : 12,
  }
}

// 读取后台会话更新请求体。
export const readAdminGenerationSessionBody = async (req: any) => {
  const payload = await readJsonBody(req)
  return payload as AdminGenerationSessionPayload
}

// 返回统一的后台会话管理错误。
export const sendAdminGenerationSessionsError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'admin_generation_sessions_error',
      message,
    },
  })
}
