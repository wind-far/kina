import { AI_GATEWAY_MATCH_PATHS } from './constants'
import { handleAiGatewayRequest } from './request-handler'

const attachAiGatewayMiddleware = (server: any) => {
  server.middlewares.use(async (req: any, res: any, next: any) => {
    const requestUrl = String(req.url || '').split('?')[0]
    if (!AI_GATEWAY_MATCH_PATHS.includes(requestUrl as any)) {
      next()
      return
    }

    await handleAiGatewayRequest(req, res)
  })
}

export const createAiGatewayPlugin = () => ({
  name: 'ai-gateway-plugin',
  configureServer(server: any) {
    attachAiGatewayMiddleware(server)
  },
  configurePreviewServer(server: any) {
    attachAiGatewayMiddleware(server)
  },
})
