import { readJsonBody, sendJson } from '../ai-gateway/shared'

export interface GenerationTaskStartPayload {
  type: string
  prompt: string
  model?: string
  modelKey?: string
  ratio?: string
  resolution?: string
  duration?: string
  feature?: string
  skill?: string
  requestBody?: Record<string, unknown> | null
}

export interface GenerationTaskStreamEvent {
  type: 'connected' | 'snapshot' | 'progress' | 'content_delta' | 'completed' | 'failed' | 'stopped'
  recordId: string
  done: boolean
  stopped?: boolean
  record?: Record<string, unknown> | null
  stage?: string
  message?: string
  delta?: string
  content?: string
}

// 读取生成任务请求体。
export const readGenerationTaskBody = async (req: any) => {
  const payload = await readJsonBody(req)
  return payload as GenerationTaskStartPayload
}

// 返回统一的生成任务接口错误。
export const sendGenerationTaskError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'generation_task_error',
      message,
    },
  })
}
