/**
 * AI 同源网关前端入口
 * 统一管理网关路径与请求体构造。
 */

import { type AiEndpointType } from './provider-config'
import { resolveEndpointModelCategory } from './provider-config'
import { loadPublicModelCatalog, resolveRequestModelKey, resolveRequestProviderId } from '@/config/models'

export const AI_GATEWAY_REQUEST_PATH = '/api/ai/request'
export const LEGACY_AI_GATEWAY_REQUEST_PATH = '/__workflow_gateway/request'

export interface GatewayRequestPayload {
  upstream: {
    baseUrl?: string
    apiKey?: string
    endpoint?: string
    providerId?: string
    endpointType?: AiEndpointType
    modelKey?: string
  }
  request: {
    method: string
    headers?: Record<string, string>
    body?: unknown
  }
}

export interface GatewayRequestOptions {
  url?: string
  method?: string
  data?: unknown
  headers?: Record<string, string>
  providerId?: string
  modelKey?: string
}

export const normalizeGatewayMethod = (method?: string) => (method || 'GET').toUpperCase()

export const createGatewayPayload = async (
  type: AiEndpointType,
  options: GatewayRequestOptions,
): Promise<GatewayRequestPayload> => {
  const method = normalizeGatewayMethod(options.method)
  const headers = { ...(options.headers || {}) }

  await loadPublicModelCatalog()

  const rawBody = options.data
  const modelValue = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
    ? String((rawBody as Record<string, unknown>).model || '').trim()
    : ''
  const modelCategory = resolveEndpointModelCategory(type)
  const providerId = String(options.providerId || '').trim()
    || resolveRequestProviderId(modelValue, modelCategory)
  const modelKey = String(options.modelKey || '').trim()
    || resolveRequestModelKey(modelValue, modelCategory)
  const upstream = providerId
    ? {
        // 命中后台模型目录时，只把最小识别信息发给同源网关。
        // 真实厂商地址、密钥和具体接口路径统一在后端解析，避免暴露到浏览器请求体。
        providerId,
        endpointType: type,
        modelKey,
      }
    : null

  if (!upstream) {
    throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
  }

  const payload: GatewayRequestPayload = {
    upstream,
    request: {
      method,
    },
  }

  if (Object.keys(headers).length) {
    payload.request.headers = headers
  }

  if (rawBody !== undefined && method !== 'GET') {
    if (providerId && rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)) {
      payload.request.body = {
        ...(rawBody as Record<string, unknown>),
        model: modelKey || modelValue,
      }
    } else if (providerId) {
      payload.request.body = rawBody
    }
  }

  return payload
}
