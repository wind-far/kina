import { readRawBody, sendJson } from '../ai-gateway/shared'

export interface SystemInitPayload {
  username?: string
  password?: string
  confirmPassword?: string
  name?: string
  email?: string
  siteName?: string
  siteDescription?: string
  siteLogoUrl?: string
  siteIconUrl?: string
}

// 读取初始化模块请求体。
export const readSystemInitBody = async <T>(req: any): Promise<T> => {
  const raw = await readRawBody(req)
  if (!raw) {
    return {} as T
  }

  return JSON.parse(raw) as T
}

// 统一返回初始化模块错误。
export const sendSystemInitError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'system_init_error',
      message,
    },
  })
}
