import { sendJson, readJsonBody } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { requireAdminSessionUser } from '../auth/session'
import { invalidateAdminDashboardOverviewCache } from '../admin-dashboard/service'
import { REDIS_CONFIG, consumeFixedWindowRateLimit, getRedisRuntimeSettings } from '../redis'
import {
  createAdminProvider,
  deleteAdminProvider,
  getAdminProviderDetail,
  getPublicModelCatalog,
  invalidatePublicModelCatalogCache,
  listAdminProviders,
  updateAdminProvider,
} from './service'
import {
  batchUpsertProviderModels,
  createProviderModel,
  deleteProviderModel,
  discoverProviderModels,
  invalidateProviderDiscoverModelsCache,
  listProviderModels,
  updateProviderModel,
} from './model-service'
import { ProviderConfigRequestError, sendProviderRuntimeError } from './shared'
import { PROVIDER_CONFIG_CATALOG_PATH, PROVIDER_CONFIG_PROVIDERS_PATH } from './constants'

const matchProviderDetailPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/provider-config\/providers\/([^/]+)$/)
  if (!matched) {
    return null
  }

  return {
    providerId: decodeURIComponent(matched[1]),
  }
}

const matchProviderModelsPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/provider-config\/providers\/([^/]+)\/models$/)
  if (!matched) {
    return null
  }

  return {
    providerId: decodeURIComponent(matched[1]),
  }
}

const matchProviderModelDetailPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/provider-config\/providers\/([^/]+)\/models\/([^/]+)$/)
  if (!matched) {
    return null
  }

  return {
    providerId: decodeURIComponent(matched[1]),
    modelId: decodeURIComponent(matched[2]),
  }
}

const matchProviderModelDiscoverPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/provider-config\/providers\/([^/]+)\/models\/discover$/)
  if (!matched) {
    return null
  }

  return {
    providerId: decodeURIComponent(matched[1]),
  }
}

const matchProviderModelBatchUpsertPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/provider-config\/providers\/([^/]+)\/models\/batch-upsert$/)
  if (!matched) {
    return null
  }

  return {
    providerId: decodeURIComponent(matched[1]),
  }
}

// 处理厂商配置与模型配置请求。
export const handleProviderConfigRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendProviderRuntimeError(res, 500, '缺少 DATABASE_URL，暂时无法使用后端配置存储。')
      return
    }

    const requestPath = String(req.url || '').split('?')[0]
    const providerDetailMatch = matchProviderDetailPath(requestPath)
    const providerModelsMatch = matchProviderModelsPath(requestPath)
    const providerModelDetailMatch = matchProviderModelDetailPath(requestPath)
    const providerModelDiscoverMatch = matchProviderModelDiscoverPath(requestPath)
    const providerModelBatchUpsertMatch = matchProviderModelBatchUpsertPath(requestPath)

    if (req.method === 'GET' && requestPath === PROVIDER_CONFIG_CATALOG_PATH) {
      const data = await getPublicModelCatalog()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && requestPath === PROVIDER_CONFIG_PROVIDERS_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await listAdminProviders()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && providerDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await getAdminProviderDetail(providerDetailMatch.providerId)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && requestPath === PROVIDER_CONFIG_PROVIDERS_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await createAdminProvider(payload as any)
      await invalidatePublicModelCatalogCache()
      await invalidateAdminDashboardOverviewCache()
      sendJson(res, 200, { data, message: '厂商已创建' })
      return
    }

    if (req.method === 'PUT' && providerDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await updateAdminProvider(providerDetailMatch.providerId, payload as any)
      await invalidatePublicModelCatalogCache()
      await invalidateProviderDiscoverModelsCache(providerDetailMatch.providerId)
      await invalidateAdminDashboardOverviewCache()
      sendJson(res, 200, { data, message: '厂商已更新' })
      return
    }

    if (req.method === 'DELETE' && providerDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await deleteAdminProvider(providerDetailMatch.providerId)
      await invalidatePublicModelCatalogCache()
      await invalidateProviderDiscoverModelsCache(providerDetailMatch.providerId)
      await invalidateAdminDashboardOverviewCache()
      sendJson(res, 200, { data, message: '厂商已删除' })
      return
    }

    if (req.method === 'GET' && providerModelsMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await listProviderModels(providerModelsMatch.providerId)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && providerModelDiscoverMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }
      const runtimeSettings = await getRedisRuntimeSettings()

      const rateLimitResult = await consumeFixedWindowRateLimit({
        scope: 'provider-model-discover',
        identifier: `${String(currentUser.id || '').trim()}:${providerModelDiscoverMatch.providerId}`,
        limit: runtimeSettings.providerModelDiscoverRateLimit || Math.max(REDIS_CONFIG.taskSubmitRateLimit, 3),
        windowSeconds: Math.max(REDIS_CONFIG.rateLimitWindowSeconds, 60),
      })

      if (!rateLimitResult.allowed) {
        throw new ProviderConfigRequestError(
          429,
          `模型发现过于频繁，请在 ${rateLimitResult.retryAfterSeconds || REDIS_CONFIG.rateLimitWindowSeconds} 秒后重试`,
        )
      }

      const data = await discoverProviderModels(providerModelDiscoverMatch.providerId)
      sendJson(res, 200, { data, message: '模型列表已获取' })
      return
    }

    if (req.method === 'POST' && providerModelsMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await createProviderModel(providerModelsMatch.providerId, payload as any)
      await invalidatePublicModelCatalogCache()
      await invalidateProviderDiscoverModelsCache(providerModelsMatch.providerId)
      await invalidateAdminDashboardOverviewCache()
      sendJson(res, 200, { data, message: '模型已创建' })
      return
    }

    if (req.method === 'POST' && providerModelBatchUpsertMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await batchUpsertProviderModels(providerModelBatchUpsertMatch.providerId, payload as any)
      await invalidatePublicModelCatalogCache()
      await invalidateProviderDiscoverModelsCache(providerModelBatchUpsertMatch.providerId)
      await invalidateAdminDashboardOverviewCache()
      sendJson(res, 200, { data, message: '模型已批量导入' })
      return
    }

    if (req.method === 'PUT' && providerModelDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await updateProviderModel(providerModelDetailMatch.providerId, providerModelDetailMatch.modelId, payload as any)
      await invalidatePublicModelCatalogCache()
      await invalidateProviderDiscoverModelsCache(providerModelDetailMatch.providerId)
      await invalidateAdminDashboardOverviewCache()
      sendJson(res, 200, { data, message: '模型已更新' })
      return
    }

    if (req.method === 'DELETE' && providerModelDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await deleteProviderModel(providerModelDetailMatch.providerId, providerModelDetailMatch.modelId)
      await invalidatePublicModelCatalogCache()
      await invalidateProviderDiscoverModelsCache(providerModelDetailMatch.providerId)
      await invalidateAdminDashboardOverviewCache()
      sendJson(res, 200, { data, message: '模型已删除' })
      return
    }

    sendProviderRuntimeError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    const statusCode = error instanceof ProviderConfigRequestError
      ? error.statusCode
      : 500
    sendProviderRuntimeError(res, statusCode, error?.message || '读取配置失败')
  }
}
