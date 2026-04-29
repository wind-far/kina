import { readJsonBody, sendJson } from '../ai-gateway/shared'

export interface GenerationOutputPayload {
  outputType: 'image' | 'video' | 'text' | 'file'
  url?: string
  textContent?: string
  mimeType?: string
  width?: number
  height?: number
  durationSeconds?: number
  sortOrder?: number
  metaJson?: Record<string, unknown> | null
}

export interface GenerationRecordPayload {
  type: string
  prompt: string
  content?: string
  error?: string
  model?: string
  modelKey?: string
  ratio?: string
  resolution?: string
  duration?: string
  feature?: string
  skill?: string
  done?: boolean
  stopped?: boolean
  agentTaskId?: string
  images?: string[]
  outputs?: GenerationOutputPayload[]
  agentRun?: Record<string, unknown> | null
}

// 读取生成记录请求体
export const readGenerationRecordBody = async (req: any) => {
  const payload = await readJsonBody(req)
  return payload as GenerationRecordPayload
}

// 返回统一的生成记录接口错误
export const sendGenerationRecordError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'generation_record_error',
      message,
    },
  })
}
