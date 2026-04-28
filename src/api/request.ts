/**
 * AI 网关前端请求封装
 * 前端只请求同源网关，由网关再转发到用户配置的第三方厂商地址。
 */

import {
  getApiKey,
  getBaseUrl,
  getEndpoint,
  setApiKey,
  setBaseUrl,
  setEndpoint,
  type AiEndpointType,
} from './provider-config'
import {
  AI_GATEWAY_REQUEST_PATH,
  createGatewayPayload,
  normalizeGatewayMethod,
} from './ai-gateway'
import { loadPublicModelCatalog, resolveRequestModelKey, resolveRequestProviderId } from '@/config/models'
import { buildApiUrl } from './http'
import { handleUnauthorizedResponse } from './response'

export {
  getApiKey,
  getBaseUrl,
  getEndpoint,
  setApiKey,
  setBaseUrl,
  setEndpoint,
}

interface RequestOptions {
  url: string
  method?: string
  data?: unknown
  headers?: Record<string, string>
}
const isFormData = (value: unknown): value is FormData => typeof FormData !== 'undefined' && value instanceof FormData

/**
 * 通用 JSON/表单请求，统一走同源 AI 网关。
 */
export const request = async (
  options: RequestOptions,
  type: AiEndpointType = 'video',
) => {
  if (isFormData(options.data)) {
    await loadPublicModelCatalog()
    const formData = new FormData()
    options.data.forEach((value, key) => {
      formData.append(key, value)
    })
    const originalModel = String(formData.get('model') || '').trim()
    const providerId = resolveRequestProviderId(originalModel, type.toUpperCase() as 'CHAT' | 'IMAGE' | 'VIDEO')
    const modelKey = resolveRequestModelKey(originalModel, type.toUpperCase() as 'CHAT' | 'IMAGE' | 'VIDEO')
    if (providerId && modelKey) {
      formData.set('model', modelKey)
    }
    const response = await fetch(buildApiUrl(AI_GATEWAY_REQUEST_PATH), {
      method: 'POST',
      headers: {
        ...(providerId ? { 'x-upstream-provider-id': providerId } : { 'x-upstream-base-url': getBaseUrl(), 'x-upstream-endpoint': getEndpoint(type) }),
        ...(providerId ? { 'x-upstream-endpoint-type': type } : {}),
        ...(providerId && modelKey ? { 'x-upstream-model-key': modelKey } : {}),
        'x-upstream-method': normalizeGatewayMethod(options.method),
        ...(!providerId && getApiKey() ? { 'x-upstream-api-key': getApiKey() } : {}),
      },
      body: formData,
    })

    if (!response.ok) {
      handleUnauthorizedResponse(response.status, 'gateway-form-request')
      const err = await response.json().catch(() => ({}))
      const msg = err?.error?.message || err?.message || `请求失败 (${response.status})`
      throw new Error(msg)
    }

    return response.json()
  }

  const response = await fetch(buildApiUrl(AI_GATEWAY_REQUEST_PATH), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(await createGatewayPayload(type, options)),
  })

  if (!response.ok) {
    handleUnauthorizedResponse(response.status, 'gateway-json-request')
    const err = await response.json().catch(() => ({}))
    const msg = err?.error?.message || err?.message || `请求失败 (${response.status})`
    throw new Error(msg)
  }

  return response.json()
}
