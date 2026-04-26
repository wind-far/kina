import { sendJson } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { readAssetActionBody, readAssetListQuery, sendAssetItemsError } from './shared'
import { applyAssetAction, listMineAssetItems, listPublicAssetItems } from './service'
import { ASSET_ITEMS_BASE_PATH } from './constants'

// 处理资源列表请求。
export const handleAssetItemsRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendAssetItemsError(res, 500, '缺少 DATABASE_URL，暂时无法使用资源存储。')
      return
    }

    const requestUrl = String(req.url || '')
    const pathname = requestUrl.split('?')[0]

    if (req.method === 'GET' && pathname === ASSET_ITEMS_BASE_PATH) {
      const query = readAssetListQuery(requestUrl)
      const data = query.scope === 'mine'
        ? await listMineAssetItems(query)
        : await listPublicAssetItems(query)

      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && pathname === `${ASSET_ITEMS_BASE_PATH}/actions`) {
      const payload = await readAssetActionBody(req)
      const data = await applyAssetAction(payload)
      sendJson(res, 200, { data })
      return
    }

    sendAssetItemsError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendAssetItemsError(res, 500, error?.message || '处理资源请求失败')
  }
}
