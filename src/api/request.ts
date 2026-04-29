/**
 * AI 网关前端请求封装
 * 前端只请求同源网关，由网关再转发到用户配置的第三方厂商地址。
 */

import {
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
import { MARKETING_POINTS_UPDATED_EVENT } from '@/stores/marketing-center'

interface RequestOptions {
  url: string
  method?: string
  data?: unknown
  headers?: Record<string, string>
  providerId?: string
  modelKey?: string
}
const isFormData = (value: unknown): value is FormData => typeof FormData !== 'undefined' && value instanceof FormData


const notifyMarketingPointsUpdated = (response: Response) => {
  if (typeof window === 'undefined') return
  if (response.headers.get('x-marketing-points-updated') !== '1') return
  window.dispatchEvent(new CustomEvent(MARKETING_POINTS_UPDATED_EVENT))
}

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
    const providerId = String(options.providerId || '').trim()
      || resolveRequestProviderId(originalModel, type.toUpperCase() as 'CHAT' | 'IMAGE' | 'VIDEO')
    const modelKey = String(options.modelKey || '').trim()
      || resolveRequestModelKey(originalModel, type.toUpperCase() as 'CHAT' | 'IMAGE' | 'VIDEO')
    if (!providerId) {
      throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
    }
    if (modelKey) {
      formData.set('model', modelKey)
    }
    const response = await fetch(buildApiUrl(AI_GATEWAY_REQUEST_PATH), {
      method: 'POST',
      // AI 网关依赖会话 Cookie 判断登录态，这里必须显式携带凭证。
      credentials: 'include',
      headers: {
        'x-upstream-provider-id': providerId,
        'x-upstream-endpoint-type': type,
        ...(modelKey ? { 'x-upstream-model-key': modelKey } : {}),
        'x-upstream-method': normalizeGatewayMethod(options.method),
      },
      body: formData,
    })

    notifyMarketingPointsUpdated(response)

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
    // AI 网关依赖会话 Cookie 判断登录态，这里必须显式携带凭证。
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(await createGatewayPayload(type, options)),
  })

  notifyMarketingPointsUpdated(response)

  if (!response.ok) {
    handleUnauthorizedResponse(response.status, 'gateway-json-request')
    const err = await response.json().catch(() => ({}))
    const msg = err?.error?.message || err?.message || `请求失败 (${response.status})`
    throw new Error(msg)
  }

  return response.json()
}
