/**
 * AI 同源网关前端入口
 * 统一管理网关路径与请求体构造。
 */

import { getUpstreamRequestConfig, type AiEndpointType, type UpstreamRequestConfig } from './provider-config'

export const AI_GATEWAY_REQUEST_PATH = '/api/ai/request'
export const LEGACY_AI_GATEWAY_REQUEST_PATH = '/__workflow_gateway/request'

export interface GatewayRequestPayload {
  upstream: UpstreamRequestConfig
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

export const createGatewayPayload = (
  type: AiEndpointType,
  options: GatewayRequestOptions,
): GatewayRequestPayload => {
  const method = normalizeGatewayMethod(options.method)
  const headers = { ...(options.headers || {}) }
  const upstream = getUpstreamRequestConfig(type, options.url)

  const payload: GatewayRequestPayload = {
    upstream,
    request: {
      method,
    },
  }

  if (Object.keys(headers).length) {
    payload.request.headers = headers
  }

  if (options.data !== undefined && method !== 'GET') {
    payload.request.body = options.data
  }

  return payload
}

