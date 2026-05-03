import { buildApiUrl } from './http'
import { readApiData } from './response'

export type AdminGenerationSessionStatus = 'ALL' | 'HAS_ERROR' | 'RUNNING' | 'COMPLETED' | 'EMPTY'
export type AdminGenerationSessionType = 'ALL' | 'IMAGE' | 'VIDEO' | 'AGENT' | 'DIGITAL_HUMAN' | 'MOTION'

export interface AdminGenerationSessionItem {
  id: string
  title: string
  isDefault: boolean
  sortOrder: number
  coverImageUrl: string
  lastRecordAt?: string
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string
  }
  latestRecord: null | {
    id: string
    type: string
    status: string
    prompt: string
    error: string
    createdAt: string
    skill: string
    model: string
  }
  recordCount: number
  failedRecordCount: number
  runningRecordCount: number
  completedRecordCount: number
}

export interface AdminGenerationSessionListResult {
  items: AdminGenerationSessionItem[]
  summary: {
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
  }
}

export interface AdminSessionRecordItem {
  id: string
  sessionId: string
  sessionTitle?: string
  type: string
  prompt: string
  content: string
  error: string
  model: string
  modelKey: string
  ratio: string
  resolution: string
  duration: string
  feature: string
  skill: string
  done: boolean
  stopped?: boolean
  agentTaskId?: string
  createdAt: string
  images: string[]
  outputs: Array<{
    outputType: string
    url?: string
    textContent?: string
    sortOrder?: number
    metaJson?: Record<string, unknown> | null
  }>
  agentRun?: Record<string, unknown>
}

export interface AdminSessionRecordListResult {
  items: AdminSessionRecordItem[]
  summary: {
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
  }
}

export interface ListAdminGenerationSessionsOptions {
  keyword?: string
  userKeyword?: string
  status?: AdminGenerationSessionStatus
  type?: AdminGenerationSessionType
  page?: number
  pageSize?: number
}

const ADMIN_GENERATION_SESSIONS_BASE_PATH = '/api/admin/generation-sessions'

const buildSessionQuery = (options: ListAdminGenerationSessionsOptions = {}) => {
  const query = new URLSearchParams()
  query.set('keyword', String(options.keyword || '').trim())
  query.set('userKeyword', String(options.userKeyword || '').trim())
  query.set('status', options.status || 'ALL')
  query.set('type', options.type || 'ALL')
  query.set('page', String(options.page || 1))
  query.set('pageSize', String(options.pageSize || 12))
  return query
}

// 查询后台会话列表。
export const listAdminGenerationSessions = async (options: ListAdminGenerationSessionsOptions = {}) => {
  const query = buildSessionQuery(options)
  const response = await fetch(buildApiUrl(`${ADMIN_GENERATION_SESSIONS_BASE_PATH}?${query.toString()}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminGenerationSessionListResult>(response)
}

// 查询后台会话详情。
export const getAdminGenerationSessionDetail = async (id: string) => {
  const response = await fetch(buildApiUrl(`${ADMIN_GENERATION_SESSIONS_BASE_PATH}/${encodeURIComponent(id)}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminGenerationSessionItem>(response)
}

// 查询指定会话下的生成记录。
export const listAdminGenerationSessionRecords = async (id: string, page = 1, pageSize = 10) => {
  const query = new URLSearchParams()
  query.set('page', String(page))
  query.set('pageSize', String(pageSize))
  const response = await fetch(buildApiUrl(`${ADMIN_GENERATION_SESSIONS_BASE_PATH}/${encodeURIComponent(id)}/records?${query.toString()}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminSessionRecordListResult>(response)
}

// 后台重命名会话。
export const updateAdminGenerationSession = async (id: string, title: string) => {
  const response = await fetch(buildApiUrl(`${ADMIN_GENERATION_SESSIONS_BASE_PATH}/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })

  return readApiData<AdminGenerationSessionItem>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '会话已更新',
  })
}

// 后台删除会话。
export const deleteAdminGenerationSession = async (id: string) => {
  const response = await fetch(buildApiUrl(`${ADMIN_GENERATION_SESSIONS_BASE_PATH}/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
  })

  return readApiData<{ id: string }>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
    successMessage: '会话已删除',
  })
}
