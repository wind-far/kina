import {
  joinUpstreamUrl,
  normalizeGatewayPayload,
  readJsonBody,
  sendJson,
} from './shared'
import { forwardGatewayPayload, forwardMultipartRequest } from './forward'
import { resolveGatewayProviderUpstream } from '../provider-config/service'
import { requireCurrentSessionUser } from '../auth/session'
import { consumeGenerationPoints, refundGenerationPoints, resolveGenerationPointCost } from '../marketing-center/service'

const shouldExposeGatewayDebug = () => String(process.env.AI_GATEWAY_DEBUG_HEADERS || '').trim() === 'true'

const isChargeableGenerationRequest = (input: {
  providerId: string
  endpointType?: 'chat' | 'image' | 'video'
  method: string
}) => {
  return Boolean(input.providerId)
    && input.method === 'POST'
    && (input.endpointType === 'image' || input.endpointType === 'video')
}

const buildGatewayAssociationNo = () => {
  return `GWY${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

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

    const shouldChargeHeaderRequest = isChargeableGenerationRequest({
      providerId: headerProviderId,
      endpointType: headerEndpointType,
      method: headerMethod,
    })

    if (headerProviderId && headerEndpointType) {
      const currentUser = shouldChargeHeaderRequest ? await requireCurrentSessionUser(req, res) : null
      if (shouldChargeHeaderRequest && !currentUser?.id) {
        return
      }

      const upstream = await resolveGatewayProviderUpstream({
        providerId: headerProviderId,
        endpointType: headerEndpointType,
        modelKey: headerModelKey || undefined,
      })
      debugUpstreamUrl = joinUpstreamUrl(upstream.baseUrl, upstream.endpoint)
      debugUpstreamMethod = headerMethod

      const billingDetail = shouldChargeHeaderRequest
        ? await resolveGenerationPointCost({
          providerId: headerProviderId,
          modelKey: headerModelKey,
          endpointType: headerEndpointType,
        })
        : { pointCost: 0, modelId: '', modelName: '' }

      const associationNo = buildGatewayAssociationNo()
      const consumedPointLog = shouldChargeHeaderRequest && billingDetail.pointCost > 0
        ? await consumeGenerationPoints({
          userId: currentUser!.id,
          pointCost: billingDetail.pointCost,
          sourceId: associationNo,
          associationNo,
          endpointType: headerEndpointType,
          providerId: headerProviderId,
          modelKey: headerModelKey,
          modelName: billingDetail.modelName,
          metaJson: {
            gatewayPath: 'multipart-header',
          },
        })
        : null

      let refunded = false
      const refundConsumedPointsIfNeeded = async (reason: string) => {
        if (!consumedPointLog || refunded) return
        refunded = true
        try {
          await refundGenerationPoints({
            userId: currentUser!.id,
            pointCost: billingDetail.pointCost,
            sourceId: associationNo,
            associationNo,
            endpointType: headerEndpointType,
            providerId: headerProviderId,
            modelKey: headerModelKey,
            modelName: billingDetail.modelName,
            metaJson: { refundReason: reason },
          })
        } catch (error) {
          console.error('[ai-gateway][refund-error]', JSON.stringify({
            reason,
            endpointType: headerEndpointType,
            providerId: headerProviderId,
            modelKey: headerModelKey,
            message: error instanceof Error ? error.message : String(error),
          }))
        }
      }

      await forwardMultipartRequest({
        req,
        res,
        baseUrl: upstream.baseUrl,
        endpoint: upstream.endpoint,
        apiKey: upstream.apiKey || undefined,
        method: headerMethod,
        beforeProxy: async ({ upstreamResponse, res: currentRes }) => {
          if (!upstreamResponse.ok) {
            await refundConsumedPointsIfNeeded(`upstream_status_${upstreamResponse.status}`)
            return
          }
          if (consumedPointLog) {
            currentRes.setHeader('x-marketing-points-updated', '1')
            currentRes.setHeader('x-marketing-points-balance', String(consumedPointLog.balanceAfter || consumedPointLog.availableAmount || 0))
          }
        },
        onError: async () => {
          await refundConsumedPointsIfNeeded('gateway_fetch_failed')
        },
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

    const shouldChargeJsonRequest = isChargeableGenerationRequest({
      providerId: normalized.providerId,
      endpointType: normalized.endpointType,
      method: normalized.method,
    })

    const currentUser = shouldChargeJsonRequest ? await requireCurrentSessionUser(req, res) : null
    if (shouldChargeJsonRequest && !currentUser?.id) {
      return
    }

    const billingDetail = shouldChargeJsonRequest
      ? await resolveGenerationPointCost({
        providerId: normalized.providerId,
        modelKey: normalized.modelKey,
        endpointType: normalized.endpointType as 'image' | 'video',
      })
      : { pointCost: 0, modelId: '', modelName: '' }

    const associationNo = buildGatewayAssociationNo()
    const consumedPointLog = shouldChargeJsonRequest && billingDetail.pointCost > 0
      ? await consumeGenerationPoints({
        userId: currentUser!.id,
        pointCost: billingDetail.pointCost,
        sourceId: associationNo,
        associationNo,
        endpointType: normalized.endpointType as 'image' | 'video',
        providerId: normalized.providerId,
        modelKey: normalized.modelKey,
        modelName: billingDetail.modelName,
        metaJson: {
          gatewayPath: 'json-payload',
        },
      })
      : null

    let refunded = false
    const refundConsumedPointsIfNeeded = async (reason: string) => {
      if (!consumedPointLog || refunded) return
      refunded = true
      try {
        await refundGenerationPoints({
          userId: currentUser!.id,
          pointCost: billingDetail.pointCost,
          sourceId: associationNo,
          associationNo,
          endpointType: normalized.endpointType as 'image' | 'video',
          providerId: normalized.providerId,
          modelKey: normalized.modelKey,
          modelName: billingDetail.modelName,
          metaJson: { refundReason: reason },
        })
      } catch (error) {
        console.error('[ai-gateway][refund-error]', JSON.stringify({
          reason,
          endpointType: normalized.endpointType,
          providerId: normalized.providerId,
          modelKey: normalized.modelKey,
          message: error instanceof Error ? error.message : String(error),
        }))
      }
    }

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
      beforeProxy: async ({ upstreamResponse, res: currentRes }) => {
        if (!upstreamResponse.ok) {
          await refundConsumedPointsIfNeeded(`upstream_status_${upstreamResponse.status}`)
          return
        }
        if (consumedPointLog) {
          currentRes.setHeader('x-marketing-points-updated', '1')
          currentRes.setHeader('x-marketing-points-balance', String(consumedPointLog.balanceAfter || consumedPointLog.availableAmount || 0))
        }
      },
      onError: async () => {
        await refundConsumedPointsIfNeeded('gateway_fetch_failed')
      },
    })
  } catch (error: any) {
    if (error?.code === 'INSUFFICIENT_POINTS') {
      sendJson(res, 402, {
        message: error?.message || '积分不足',
        error: {
          type: 'insufficient_points',
          message: error?.message || '积分不足',
          currentBalance: Number(error?.currentBalance || 0),
          requiredPoints: Number(error?.requiredPoints || 0),
        },
      })
      return
    }

    sendJson(res, 500, {
      message: error?.message || 'AI 网关转发失败',
      error: {
        type: 'gateway_error',
        message: error?.message || 'AI 网关转发失败',
      },
      ...(shouldExposeGatewayDebug()
        ? {
            debug: {
              upstreamUrl: debugUpstreamUrl || undefined,
              upstreamMethod: debugUpstreamMethod || undefined,
            },
          }
        : {}),
    })
  }
}
