import { sendJson } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { requireAdminSessionUser } from '../auth/session'
import { getAdminDashboardOverview } from './service'
import { ADMIN_DASHBOARD_OVERVIEW_PATH } from './constants'

const sendAdminDashboardError = (res: any, statusCode: number, message: string) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({
    message,
    error: {
      type: 'admin_dashboard_error',
      message,
    },
  }))
}

// 处理后台仪表盘统计请求。
export const handleAdminDashboardRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendAdminDashboardError(res, 500, '缺少 DATABASE_URL，暂时无法使用后台仪表盘。')
      return
    }

    const requestPath = String(req.url || '').split('?')[0]
    if (req.method !== 'GET' || requestPath !== ADMIN_DASHBOARD_OVERVIEW_PATH) {
      sendAdminDashboardError(res, 405, 'Method Not Allowed')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    const data = await getAdminDashboardOverview(currentUser.id)
    sendJson(res, 200, { data })
  } catch (error: any) {
    sendAdminDashboardError(res, 500, error?.message || '获取后台仪表盘统计失败')
  }
}
