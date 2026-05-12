import { readJsonBody, sendJson } from '../ai-gateway/shared'
import type { GenerationTaskStreamEventBase } from '../../src/shared/generation-task-stream'
import type { ResearchTaskConfig } from '../../src/shared/research/research-types'

// 重新导出共享协议中的类型与失败码，让服务端代码继续按原路径引用
export type {
  GenerationTaskStreamEventType,
  GenerationTaskFailureCode,
  GenerationTaskStreamEventBase,
} from '../../src/shared/generation-task-stream'

export interface GenerationTaskStartPayload {
  sessionId?: string
  source?: string
  type: string
  requestMode?: 'image-generation' | 'image-edit'
  prompt: string
  model?: string
  modelKey?: string
  ratio?: string
  resolution?: string
  duration?: string
  feature?: string
  skill?: string
  referenceImages?: string[]
  researchConfig?: Partial<ResearchTaskConfig> | null
  requestBody?: Record<string, unknown> | null
}

// 服务端 record 是数据库行的通用对象表示
export type GenerationTaskStreamEvent = GenerationTaskStreamEventBase<Record<string, unknown>>

export class GenerationTaskRequestError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'GenerationTaskRequestError'
    this.statusCode = statusCode
  }
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
