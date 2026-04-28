/**
 * AI 同源网关前端入口
 * 统一管理网关路径与请求体构造。
 */

import { getUpstreamRequestConfig, type AiEndpointType, type UpstreamRequestConfig } from './provider-config'
import { loadPublicModelCatalog, resolveRequestModelKey, resolveRequestProviderId } from '@/config/models'

export const AI_GATEWAY_REQUEST_PATH = '/api/ai/request'
export const LEGACY_AI_GATEWAY_REQUEST_PATH = '/__workflow_gateway/request'

export interface GatewayRequestPayload {
  upstream: UpstreamRequestConfig & {
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
  const providerId = resolveRequestProviderId(modelValue, type.toUpperCase() as 'CHAT' | 'IMAGE' | 'VIDEO')
  const modelKey = resolveRequestModelKey(modelValue, type.toUpperCase() as 'CHAT' | 'IMAGE' | 'VIDEO')
  const upstream = providerId
    ? {
        ...getUpstreamRequestConfig(type, options.url),
        providerId,
        endpointType: type,
        modelKey,
      }
    : getUpstreamRequestConfig(type, options.url)

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
    } else {
      payload.request.body = rawBody
    }
  }

  return payload
}

