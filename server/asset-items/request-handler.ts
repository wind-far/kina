import { sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser, requireCurrentSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { readAssetActionBody, readAssetListQuery, sendAssetItemsError } from './shared'
import { applyAssetAction, listAllAssetItems, listMineAssetItems, listPublicAssetItems } from './service'
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
      if (query.scope === 'mine') {
        const currentUser = await requireCurrentSessionUser(req, res)
        if (!currentUser) {
          return
        }

        const data = await listMineAssetItems(query, currentUser.id)
        sendJson(res, 200, { data })
        return
      }

      if (query.scope === 'all') {
        const currentUser = await requireAdminSessionUser(req, res)
        if (!currentUser) {
          return
        }

        const data = await listAllAssetItems(query)
        sendJson(res, 200, { data })
        return
      }

      const data = await listPublicAssetItems(query)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && pathname === `${ASSET_ITEMS_BASE_PATH}/actions`) {
      const currentUser = await requireCurrentSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readAssetActionBody(req)
      if (payload.scope === 'feed') {
        sendAssetItemsError(res, 400, '公开资源不支持直接执行后台动作')
        return
      }

      if (payload.scope === 'all' && currentUser.role !== 'ADMIN') {
        sendAssetItemsError(res, 403, '只有管理员可以操作全站资源')
        return
      }

      const data = await applyAssetAction(payload, currentUser.id, currentUser.role === 'ADMIN')
      sendJson(res, 200, { data })
      return
    }

    sendAssetItemsError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendAssetItemsError(res, 500, error?.message || '处理资源请求失败')
  }
}
