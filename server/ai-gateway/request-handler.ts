import {
  normalizeGatewayPayload,
  readJsonBody,
  sendJson,
} from './shared'
import { forwardGatewayPayload, forwardMultipartRequest } from './forward'

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
    const headerMethod = String(req.headers['x-upstream-method'] || 'POST').trim().toUpperCase()

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
    debugUpstreamUrl = normalized.upstreamUrl
    debugUpstreamMethod = normalized.method

    await forwardGatewayPayload({
      res,
      upstreamUrl: normalized.upstreamUrl,
      apiKey: normalized.apiKey || undefined,
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
