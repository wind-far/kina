import type { AiEndpointType } from '../../src/shared/provider-endpoint-strategy'

const ALLOWED_UPSTREAM_METHODS = new Set(['GET', 'POST'])

export const hasDirectGatewayUpstream = (input: {
  baseUrl?: unknown
  endpoint?: unknown
  apiKey?: unknown
}) => {
  return [input.baseUrl, input.endpoint, input.apiKey]
    .some(value => String(value || '').trim().length > 0)
}

export const isAllowedGatewayUpstreamMethod = (method: unknown) => {
  return ALLOWED_UPSTREAM_METHODS.has(String(method || '').trim().toUpperCase())
}

export const hasCompleteProviderGatewayTarget = (input: {
  providerId?: unknown
  endpointType?: AiEndpointType | unknown
}) => {
  return Boolean(
    String(input.providerId || '').trim()
    && String(input.endpointType || '').trim(),
  )
}
