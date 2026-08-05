import assert from 'node:assert/strict'
import {
  hasCompleteProviderGatewayTarget,
  hasDirectGatewayUpstream,
  isAllowedGatewayUpstreamMethod,
} from '../../server/ai-gateway/security.ts'

assert.equal(hasDirectGatewayUpstream({ baseUrl: 'http://127.0.0.1:3306' }), true)
assert.equal(hasDirectGatewayUpstream({ endpoint: 'https://example.com/v1/chat' }), true)
assert.equal(hasDirectGatewayUpstream({ apiKey: 'secret' }), true)
assert.equal(hasDirectGatewayUpstream({}), false)

assert.equal(isAllowedGatewayUpstreamMethod('GET'), true)
assert.equal(isAllowedGatewayUpstreamMethod('post'), true)
assert.equal(isAllowedGatewayUpstreamMethod('DELETE'), false)

assert.equal(hasCompleteProviderGatewayTarget({ providerId: 'provider-1', endpointType: 'chat' }), true)
assert.equal(hasCompleteProviderGatewayTarget({ providerId: 'provider-1' }), false)
assert.equal(hasCompleteProviderGatewayTarget({ endpointType: 'image' }), false)

console.log('ai gateway security regression passed')
