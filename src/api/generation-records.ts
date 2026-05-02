import type { AgentRunState } from '@/types/agent'
import type { CreationType } from '@/components/generate/selectors'
import { buildApiUrl } from './http'
import { readApiData } from './response'

// 后端返回的持久化生成记录结构
export interface PersistedGenerationRecord {
  id: string
  sessionId: string
  sessionTitle?: string
  type: CreationType
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
  referenceImages?: string[]
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
  }>
  agentRun?: AgentRunState
}

// 前端提交给后端的生成记录写入结构
export interface GenerationRecordUpsertPayload {
  sessionId?: string
  type: CreationType
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
  referenceImages?: string[]
  done: boolean
  stopped?: boolean
  agentTaskId?: string
  images: string[]
  agentRun?: AgentRunState
}

const GENERATION_RECORDS_API_PATH = '/api/generation-records'

// 获取已持久化的生成记录
export const listGenerationRecords = async () => {
  const response = await fetch(buildApiUrl(GENERATION_RECORDS_API_PATH), {
    method: 'GET',
    credentials: 'include',
  })
  return readApiData<PersistedGenerationRecord[]>(response)
}

// 创建生成记录
export const createGenerationRecord = async (payload: GenerationRecordUpsertPayload) => {
  const response = await fetch(buildApiUrl(GENERATION_RECORDS_API_PATH), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return readApiData<PersistedGenerationRecord>(response, {
    showErrorMessage: true,
  })
}

// 更新生成记录
export const updateGenerationRecord = async (id: string, payload: GenerationRecordUpsertPayload) => {
  const response = await fetch(buildApiUrl(`${GENERATION_RECORDS_API_PATH}/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return readApiData<PersistedGenerationRecord>(response, {
    showErrorMessage: true,
  })
}
