import {
  joinUpstreamUrl,
  normalizeGatewayPayload,
  readJsonBody,
  sendJson,
} from './shared'
import { forwardGatewayPayload, forwardMultipartRequest } from './forward'
import {
  hasCompleteProviderGatewayTarget,
  hasDirectGatewayUpstream,
  isAllowedGatewayUpstreamMethod,
} from './security'
import { resolveGatewayProviderUpstream } from '../provider-config/service'
import { requireCurrentSessionUser } from '../auth/session'
import { consumeGenerationPoints, refundGenerationPoints, resolveGenerationPointCost } from '../marketing-center/service'
import { normalizeChargeableEndpointType, type AiEndpointType } from '../../src/shared/provider-endpoint-strategy'

const shouldExposeGatewayDebug = () => String(process.env.AI_GATEWAY_DEBUG_HEADERS || '').trim() === 'true'

const isChargeableGenerationRequest = (input: {
  providerId: string
  endpointType?: AiEndpointType
  method: string
}) => {
  const chargeableEndpointType = normalizeChargeableEndpointType(input.endpointType)
  return Boolean(input.providerId)
    && input.method === 'POST'
    && (chargeableEndpointType === 'image' || chargeableEndpointType === 'video')
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
    // AI 网关会使用服务端保存的厂商密钥，所有转发请求必须先绑定真实登录用户。
    const currentUser = await requireCurrentSessionUser(req, res)
    if (!currentUser?.id) {
      return
    }

    const headerBaseUrl = String(req.headers['x-upstream-base-url'] || '').trim()
    const headerEndpoint = String(req.headers['x-upstream-endpoint'] || '').trim()
    const headerApiKey = String(req.headers['x-upstream-api-key'] || '').trim()
    const headerProviderId = String(req.headers['x-upstream-provider-id'] || '').trim()
    const headerEndpointType = String(req.headers['x-upstream-endpoint-type'] || '').trim() as AiEndpointType
    const headerModelKey = String(req.headers['x-upstream-model-key'] || '').trim()
    const headerMethod = String(req.headers['x-upstream-method'] || 'POST').trim().toUpperCase()
    const billedHeaderEndpointType = normalizeChargeableEndpointType(headerEndpointType)

    // 关闭旧版客户端直传 URL / API Key 的开放代理能力。
    if (hasDirectGatewayUpstream({
      baseUrl: headerBaseUrl,
      endpoint: headerEndpoint,
      apiKey: headerApiKey,
    })) {
      sendJson(res, 400, {
        message: '不支持客户端直传上游地址或 API Key，请使用后台厂商配置',
      })
      return
    }

    if (!isAllowedGatewayUpstreamMethod(headerMethod)) {
      sendJson(res, 400, { message: 'AI 网关仅支持 GET 或 POST 上游请求' })
      return
    }

    const shouldChargeHeaderRequest = isChargeableGenerationRequest({
      providerId: headerProviderId,
      endpointType: headerEndpointType,
      method: headerMethod,
    })

    if (hasCompleteProviderGatewayTarget({
      providerId: headerProviderId,
      endpointType: headerEndpointType,
    })) {
      const upstream = await resolveGatewayProviderUpstream({
        providerId: headerProviderId,
        endpointType: headerEndpointType,
        modelKey: headerModelKey || undefined,
        userId: currentUser.id,
      })
      debugUpstreamUrl = joinUpstreamUrl(upstream.baseUrl, upstream.endpoint)
      debugUpstreamMethod = headerMethod

      const billingDetail = shouldChargeHeaderRequest
        ? await resolveGenerationPointCost({
          providerId: headerProviderId,
          modelKey: headerModelKey,
          endpointType: billedHeaderEndpointType as 'image' | 'video',
        })
        : { pointCost: 0, modelId: '', modelName: '' }

      const associationNo = buildGatewayAssociationNo()
      const consumedPointLog = shouldChargeHeaderRequest && billingDetail.pointCost > 0
        ? await consumeGenerationPoints({
          userId: currentUser.id,
          pointCost: billingDetail.pointCost,
          sourceId: associationNo,
          associationNo,
          endpointType: billedHeaderEndpointType as 'image' | 'video',
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
            userId: currentUser.id,
            pointCost: billingDetail.pointCost,
            sourceId: associationNo,
            associationNo,
            endpointType: billedHeaderEndpointType as 'image' | 'video',
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

    if (headerProviderId || headerEndpointType || headerModelKey) {
      sendJson(res, 400, { message: '缺少完整的厂商或端点类型配置' })
      return
    }

    const payload = await readJsonBody(req)
    const normalized = normalizeGatewayPayload(payload)

    if (hasDirectGatewayUpstream({
      baseUrl: payload.upstream?.baseUrl,
      endpoint: payload.upstream?.endpoint,
      apiKey: payload.upstream?.apiKey,
    })) {
      sendJson(res, 400, {
        message: '不支持客户端直传上游地址或 API Key，请使用后台厂商配置',
      })
      return
    }

    if (!hasCompleteProviderGatewayTarget({
      providerId: normalized.providerId,
      endpointType: normalized.endpointType,
    })) {
      sendJson(res, 400, { message: '缺少完整的厂商或端点类型配置' })
      return
    }

    if (!isAllowedGatewayUpstreamMethod(normalized.method)) {
      sendJson(res, 400, { message: 'AI 网关仅支持 GET 或 POST 上游请求' })
      return
    }

    const upstream = await resolveGatewayProviderUpstream({
      providerId: normalized.providerId,
      endpointType: normalized.endpointType,
      modelKey: normalized.modelKey || undefined,
      userId: currentUser.id,
    })

    debugUpstreamUrl = joinUpstreamUrl(upstream.baseUrl, upstream.endpoint)
    debugUpstreamMethod = normalized.method

    const shouldChargeJsonRequest = isChargeableGenerationRequest({
      providerId: normalized.providerId,
      endpointType: normalized.endpointType,
      method: normalized.method,
    })
    const billedJsonEndpointType = normalizeChargeableEndpointType(normalized.endpointType)

    const billingDetail = shouldChargeJsonRequest
      ? await resolveGenerationPointCost({
        providerId: normalized.providerId,
        modelKey: normalized.modelKey,
        endpointType: billedJsonEndpointType as 'image' | 'video',
      })
      : { pointCost: 0, modelId: '', modelName: '' }

    const associationNo = buildGatewayAssociationNo()
    const consumedPointLog = shouldChargeJsonRequest && billingDetail.pointCost > 0
      ? await consumeGenerationPoints({
        userId: currentUser.id,
        pointCost: billingDetail.pointCost,
        sourceId: associationNo,
        associationNo,
        endpointType: billedJsonEndpointType as 'image' | 'video',
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
          userId: currentUser.id,
          pointCost: billingDetail.pointCost,
          sourceId: associationNo,
          associationNo,
          endpointType: billedJsonEndpointType as 'image' | 'video',
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
      upstreamUrl: joinUpstreamUrl(upstream.baseUrl, upstream.endpoint),
      apiKey: upstream.apiKey || undefined,
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
