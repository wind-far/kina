import { isAssetItemsPath } from './constants'
import { handleAssetItemsRequest } from './request-handler'

// 挂载资源接口中间件。
const attachAssetItemsMiddleware = (server: any) => {
  server.middlewares.use(async (req: any, res: any, next: any) => {
    const requestUrl = String(req.url || '').split('?')[0]
    if (!isAssetItemsPath(requestUrl)) {
      next()
      return
    }

    await handleAssetItemsRequest(req, res)
  })
}

// Vite 开发/预览阶段资源接口插件。
export const createAssetItemsPlugin = () => ({
  name: 'asset-items-plugin',
  configureServer(server: any) {
    attachAssetItemsMiddleware(server)
  },
  configurePreviewServer(server: any) {
    attachAssetItemsMiddleware(server)
  },
})
