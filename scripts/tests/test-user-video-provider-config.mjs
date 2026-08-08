#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../..', import.meta.url)
const read = (file) => readFile(new URL(file, root), 'utf8')

const service = await read('server/user-provider-config/service.ts')
const handler = await read('server/user-provider-config/request-handler.ts')
const gateway = await read('server/ai-gateway/request-handler.ts')
const videoUpstream = await read('server/generation-tasks/video-upstream.ts')
const panel = await read('src/components/account/UserVideoProviderConfig.vue')

assert.match(service, /type UserProviderCategory = 'VIDEO'/)
assert.match(service, /buildScene\('VIDEO'\)/)
assert.match(service, /apiKeyEncrypted: encryptProviderApiKey\(apiKey\)/)
assert.match(service, /getSourceProviderId\(config\.extraJson\) !== input\.providerId/)
assert.match(handler, /\(video\)/i)
assert.doesNotMatch(handler, /chat\|image\|video/i)
assert.match(gateway, /userId: currentUser\.id/)
assert.match(videoUpstream, /userId: input\.userId/)
assert.match(panel, /我的视频 API/)
assert.doesNotMatch(panel, /我的文本 API|我的图片 API/)

console.log('user video provider config regression passed')
