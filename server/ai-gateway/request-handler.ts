import {
  joinUpstreamUrl,
  normalizeGatewayPayload,
  readJsonBody,
  sendJson,
} from './shared'
import { forwardGatewayPayload, forwardMultipartRequest } from './forward'
import { resolveGatewayProviderUpstream } from '../provider-config/service'

export const handleAiGatewayRequest = async (req: any, res: any) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { message: 'Method Not Allowed' })
    return
  }

  let debugUpstreamUrl = ''
  let debugUpstreamMethod = 'POST'

  try {
    const headerBaseUrl = String(req.headers['x-upstream-base-url'] || '').trim()
    const headerEndpoint = String(req.headers['x-upstream-endpoint'] || '').trim()
    const headerApiKey = String(req.headers['x-upstream-api-key'] || '').trim()
    const headerProviderId = String(req.headers['x-upstream-provider-id'] || '').trim()
    const headerEndpointType = String(req.headers['x-upstream-endpoint-type'] || '').trim() as 'chat' | 'image' | 'video'
    const headerModelKey = String(req.headers['x-upstream-model-key'] || '').trim()
    const headerMethod = String(req.headers['x-upstream-method'] || 'POST').trim().toUpperCase()

    if (headerProviderId && headerEndpointType) {
      const upstream = await resolveGatewayProviderUpstream({
        providerId: headerProviderId,
        endpointType: headerEndpointType,
        modelKey: headerModelKey || undefined,
      })
      debugUpstreamUrl = joinUpstreamUrl(upstream.baseUrl, upstream.endpoint)
      debugUpstreamMethod = headerMethod
      await forwardMultipartRequest({
        req,
        res,
        baseUrl: upstream.baseUrl,
        endpoint: upstream.endpoint,
        apiKey: upstream.apiKey || undefined,
        method: headerMethod,
      })
      return
    }

    if (headerBaseUrl && headerEndpoint) {
      debugUpstreamUrl = `${headerBaseUrl.replace(/\/+$/, '')}/${headerEndpoint.replace(/^\/+/, '')}`
      debugUpstreamMethod = headerMethod
      await forwardMultipartRequest({
        req,
        res,
        baseUrl: headerBaseUrl,
        endpoint: headerEndpoint,
        apiKey: headerApiKey || undefined,
        method: headerMethod,
      })
      return
    }

    const payload = await readJsonBody(req)
    const normalized = normalizeGatewayPayload(payload)
    const upstream = normalized.providerId && normalized.endpointType
      ? await resolveGatewayProviderUpstream({
        providerId: normalized.providerId,
        endpointType: normalized.endpointType,
        modelKey: normalized.modelKey || undefined,
      })
      : null

    debugUpstreamUrl = upstream
      ? joinUpstreamUrl(upstream.baseUrl, upstream.endpoint)
      : normalized.upstreamUrl
    debugUpstreamMethod = normalized.method

    await forwardGatewayPayload({
      res,
      upstreamUrl: upstream
        ? joinUpstreamUrl(upstream.baseUrl, upstream.endpoint)
        : normalized.upstreamUrl,
      apiKey: upstream
        ? (upstream.apiKey || undefined)
        : (normalized.apiKey || undefined),
      method: normalized.method,
      headers: normalized.headers,
      body: normalized.body,
    })
  } catch (error: any) {
    sendJson(res, 500, {
      message: error?.message || 'AI 网关转发失败',
      error: {
        type: 'gateway_error',
        message: error?.message || 'AI 网关转发失败',
      },
      debug: {
        upstreamUrl: debugUpstreamUrl || undefined,
        upstreamMethod: debugUpstreamMethod || undefined,
      },
    })
  }
}
