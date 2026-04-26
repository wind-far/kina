import { isGenerationRecordsPath } from './constants'
import { handleGenerationRecordsRequest } from './request-handler'

// 挂载生成记录接口中间件
const attachGenerationRecordsMiddleware = (server: any) => {
  server.middlewares.use(async (req: any, res: any, next: any) => {
    const requestUrl = String(req.url || '').split('?')[0]
    if (!isGenerationRecordsPath(requestUrl)) {
      next()
      return
    }

    await handleGenerationRecordsRequest(req, res)
  })
}

// Vite 开发/预览阶段的生成记录接口插件
export const createGenerationRecordsPlugin = () => ({
  name: 'generation-records-plugin',
  configureServer(server: any) {
    attachGenerationRecordsMiddleware(server)
  },
  configurePreviewServer(server: any) {
    attachGenerationRecordsMiddleware(server)
  },
})
