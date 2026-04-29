import { sendJson } from '../ai-gateway/shared'

export const sendProviderRuntimeError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'provider_config_error',
      message,
    },
  })
}
