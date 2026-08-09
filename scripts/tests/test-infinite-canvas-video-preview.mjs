#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = await readFile(path.join(rootDir, 'src-infinite-canvas/services/api/video.ts'), 'utf8')

assert.match(source, /videoResultFromUrl\(config, url, options\)/)
assert.match(source, /new URL\(url\)\.origin === new URL\(config\.baseUrl\)\.origin/)
assert.match(source, /headers:\s*requiresProviderAuthorization \? aiHeaders\(config\) : undefined/)
assert.match(source, /if \(requiresProviderAuthorization\) throw error/)
assert.doesNotMatch(source, /videoResultFromUrl\(url, options\)/)

console.log('[infinite-canvas-video-preview] 鉴权视频下载与不可播放地址防回退检查通过')
