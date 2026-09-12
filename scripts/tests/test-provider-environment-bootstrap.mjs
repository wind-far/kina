#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { inferEnvironmentVideoReferenceTransport, readEnvironmentProviderDefinitions } from '../../server/provider-config/env-bootstrap.ts'

const root = new URL('../..', import.meta.url)
const read = (file) => readFile(new URL(file, root), 'utf8')

const bootstrapSource = await read('server/provider-config/env-bootstrap.ts')
const developmentExample = await read('.env.development.example')
const productionExample = await read('.env.production.example')

assert.match(bootstrapSource, /AI_ENV_PROVIDER_BOOTSTRAP/)
assert.match(bootstrapSource, /\$\{prefix\}_PROVIDER_BASE_URL/)
assert.match(bootstrapSource, /suppliedCount !== 3/)
assert.match(bootstrapSource, /!isEnvironmentManagedProvider\(existing\.extraJson\)/)
assert.match(bootstrapSource, /encryptProviderApiKey\(definition\.apiKey\)/)
assert.match(bootstrapSource, /category: definition\.category/)
assert.match(bootstrapSource, /invalidatePublicModelCatalogCache/)
assert.doesNotMatch(bootstrapSource, /VITE_[A-Z_]*API_KEY/)

assert.deepEqual(readEnvironmentProviderDefinitions({}), [])
assert.throws(
  () => readEnvironmentProviderDefinitions({ AI_ENV_PROVIDER_BOOTSTRAP: 'true', IMAGE_PROVIDER_BASE_URL: 'https://images.example.com' }),
  /IMAGE_PROVIDER_API_KEY/,
)
assert.deepEqual(
  readEnvironmentProviderDefinitions({
    AI_ENV_PROVIDER_BOOTSTRAP: 'true',
    TEXT_PROVIDER_BASE_URL: 'https://text.example.com/v1/',
    TEXT_PROVIDER_API_KEY: 'test-text-key',
    TEXT_PROVIDER_DEFAULT_MODEL: 'text-model',
    IMAGE_PROVIDER_BASE_URL: 'https://images.example.com/v1',
    IMAGE_PROVIDER_API_KEY: 'test-image-key',
    IMAGE_PROVIDER_DEFAULT_MODEL: 'image-model',
  }).map(item => [item.category, item.baseUrl, item.modelKey, item.endpoint]),
  [
    ['CHAT', 'https://text.example.com/v1', 'text-model', '/chat/completions'],
    ['IMAGE', 'https://images.example.com/v1', 'image-model', '/images/generations'],
  ],
)

const [defaultVideoProvider] = readEnvironmentProviderDefinitions({
  AI_ENV_PROVIDER_BOOTSTRAP: 'true',
  VIDEO_PROVIDER_BASE_URL: 'https://videos.example.com/v1',
  VIDEO_PROVIDER_API_KEY: 'test-video-key',
  VIDEO_PROVIDER_DEFAULT_MODEL: 'video-model',
})
assert.equal(defaultVideoProvider.videoReferenceTransport, undefined)

const [fileVideoProvider] = readEnvironmentProviderDefinitions({
  AI_ENV_PROVIDER_BOOTSTRAP: 'true',
  VIDEO_PROVIDER_BASE_URL: 'https://videos.example.com/v1',
  VIDEO_PROVIDER_API_KEY: 'test-video-key',
  VIDEO_PROVIDER_DEFAULT_MODEL: 'video-model',
  VIDEO_PROVIDER_REFERENCE_TRANSPORT: 'file',
})
assert.equal(fileVideoProvider.videoReferenceTransport, 'file')
const [openAiVideoProvider] = readEnvironmentProviderDefinitions({
  AI_ENV_PROVIDER_BOOTSTRAP: 'true',
  VIDEO_PROVIDER_BASE_URL: 'https://api.openai.com/v1',
  VIDEO_PROVIDER_API_KEY: 'test-video-key',
  VIDEO_PROVIDER_DEFAULT_MODEL: 'sora-2',
})
assert.equal(openAiVideoProvider.videoReferenceTransport, undefined)
assert.equal(inferEnvironmentVideoReferenceTransport('https://videos.example.com/v1'), 'url')
assert.equal(inferEnvironmentVideoReferenceTransport('https://api.openai.com/v1'), 'file')
assert.throws(
  () => readEnvironmentProviderDefinitions({
    AI_ENV_PROVIDER_BOOTSTRAP: 'true',
    VIDEO_PROVIDER_BASE_URL: 'https://videos.example.com/v1',
    VIDEO_PROVIDER_API_KEY: 'test-video-key',
    VIDEO_PROVIDER_DEFAULT_MODEL: 'video-model',
    VIDEO_PROVIDER_REFERENCE_TRANSPORT: 'base64',
  }),
  /VIDEO_PROVIDER_REFERENCE_TRANSPORT.*url.*file/,
)
assert.match(bootstrapSource, /videoReferenceTransport: definition\.videoReferenceTransport \|\| inferEnvironmentVideoReferenceTransport\(definition\.baseUrl\)/)

for (const example of [developmentExample, productionExample]) {
  assert.match(example, /AI_ENV_PROVIDER_BOOTSTRAP=false/)
  assert.match(example, /TEXT_PROVIDER_API_KEY=/)
  assert.match(example, /IMAGE_PROVIDER_API_KEY=/)
  assert.match(example, /VIDEO_PROVIDER_API_KEY=/)
  assert.match(example, /VIDEO_PROVIDER_REFERENCE_TRANSPORT=url/)
}

console.log('provider environment bootstrap tests passed')
