import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { clearRedisCachesByScope, clearRedisRuntimeSettingsCache, getRedisAdminOverview, getRedisTaskDetail, pingRedis } from '../redis'
import { SYSTEM_CONFIG_ADMIN_PATH, SYSTEM_CONFIG_PUBLIC_PATH, SYSTEM_CONFIG_REDIS_ACTIONS_PATH, SYSTEM_CONFIG_REDIS_HEALTH_PATH, SYSTEM_CONFIG_REDIS_OVERVIEW_PATH, SYSTEM_CONFIG_REDIS_SETTINGS_PATH, SYSTEM_CONFIG_REDIS_TASK_DETAIL_PATH } from './constants'
import { getAdminRedisRuntimeSettings, getAdminSystemConfig, getPublicSystemConfig, saveAdminRedisRuntimeSettings, saveAdminSystemConfig } from './service'
import { readSystemConfigBody, sendSystemConfigError } from './shared'

// 处理系统设置请求。
export const handleSystemConfigRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendSystemConfigError(res, 500, '缺少 DATABASE_URL，暂时无法使用系统设置。')
      return
    }

    const requestPath = String(req.url || '').split('?')[0]

    if (req.method === 'GET' && requestPath === SYSTEM_CONFIG_PUBLIC_PATH) {
      const data = await getPublicSystemConfig()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && requestPath === SYSTEM_CONFIG_REDIS_HEALTH_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await pingRedis()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && requestPath === SYSTEM_CONFIG_REDIS_OVERVIEW_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await getRedisAdminOverview()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && requestPath === SYSTEM_CONFIG_REDIS_SETTINGS_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await getAdminRedisRuntimeSettings()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PUT' && requestPath === SYSTEM_CONFIG_REDIS_SETTINGS_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await saveAdminRedisRuntimeSettings(payload as any)
      clearRedisRuntimeSettingsCache()
      sendJson(res, 200, { data, message: 'Redis 运行参数已保存' })
      return
    }

    if (req.method === 'POST' && requestPath === SYSTEM_CONFIG_REDIS_ACTIONS_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req) as { scope?: 'provider-model-catalog' | 'skill-runtime' | 'task-runtime' }
      const scope = payload?.scope
      if (scope !== 'provider-model-catalog' && scope !== 'skill-runtime' && scope !== 'task-runtime') {
        sendSystemConfigError(res, 400, '无效的 Redis 操作范围')
        return
      }

      const data = await clearRedisCachesByScope(scope)
      sendJson(res, 200, { data, message: 'Redis 缓存已清理' })
      return
    }

    if (req.method === 'GET' && requestPath === SYSTEM_CONFIG_REDIS_TASK_DETAIL_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const requestUrl = new URL(String(req.url || ''), 'http://localhost')
      const recordId = String(requestUrl.searchParams.get('recordId') || '').trim()
      if (!recordId) {
        sendSystemConfigError(res, 400, '缺少 recordId')
        return
      }

      const data = await getRedisTaskDetail(recordId)
      sendJson(res, 200, { data })
      return
    }

    if (requestPath !== SYSTEM_CONFIG_ADMIN_PATH) {
      sendSystemConfigError(res, 405, 'Method Not Allowed')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    if (req.method === 'GET') {
      const data = await getAdminSystemConfig()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PUT') {
      const payload = await readSystemConfigBody(req)
      const data = await saveAdminSystemConfig(payload)
      clearRedisRuntimeSettingsCache()
      sendJson(res, 200, { data, message: '系统设置已保存' })
      return
    }

    sendSystemConfigError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendSystemConfigError(res, 500, error?.message || '处理系统设置失败')
  }
}
