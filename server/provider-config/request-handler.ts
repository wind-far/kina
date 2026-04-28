import { sendJson, readJsonBody } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { requireAdminSessionUser } from '../auth/session'
import {
  createAdminProvider,
  deleteAdminProvider,
  getAdminProviderDetail,
  getProviderRuntimeConfig,
  listAdminProviders,
  saveProviderRuntimeConfig,
  updateAdminProvider,
} from './service'
import { createProviderModel, deleteProviderModel, listProviderModels, updateProviderModel } from './model-service'
import { readProviderRuntimeBody, sendProviderRuntimeError } from './shared'
import { PROVIDER_CONFIG_PROVIDERS_PATH, PROVIDER_CONFIG_RUNTIME_PATH } from './constants'

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

    if (req.method === 'GET' && requestPath === PROVIDER_CONFIG_RUNTIME_PATH) {
      const data = await getProviderRuntimeConfig()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'PUT' && requestPath === PROVIDER_CONFIG_RUNTIME_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readProviderRuntimeBody(req)
      const data = await saveProviderRuntimeConfig(payload)
      sendJson(res, 200, { data, message: '配置已保存' })
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
      sendJson(res, 200, { data, message: '厂商已更新' })
      return
    }

    if (req.method === 'DELETE' && providerDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await deleteAdminProvider(providerDetailMatch.providerId)
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

    if (req.method === 'POST' && providerModelsMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await createProviderModel(providerModelsMatch.providerId, payload as any)
      sendJson(res, 200, { data, message: '模型已创建' })
      return
    }

    if (req.method === 'PUT' && providerModelDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await updateProviderModel(providerModelDetailMatch.providerId, providerModelDetailMatch.modelId, payload as any)
      sendJson(res, 200, { data, message: '模型已更新' })
      return
    }

    if (req.method === 'DELETE' && providerModelDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await deleteProviderModel(providerModelDetailMatch.providerId, providerModelDetailMatch.modelId)
      sendJson(res, 200, { data, message: '模型已删除' })
      return
    }

    sendProviderRuntimeError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendProviderRuntimeError(res, 500, error?.message || '读取配置失败')
  }
}
