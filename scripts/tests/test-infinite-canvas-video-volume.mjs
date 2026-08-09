#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = await readFile(path.join(rootDir, 'src-infinite-canvas/components/canvas/canvas-node.tsx'), 'utf8')

assert.match(source, /video\.defaultMuted = false/)
assert.match(source, /video\.muted = false/)
assert.match(source, /video\.volume = 1/)
assert.match(source, /\bcontrols\b/)
assert.match(source, /onLoadedMetadata=\{\(event\) => initializeVideoAudio\(event\.currentTarget\)\}/)
assert.doesNotMatch(source, /onVolumeChange=\{[^}]*initializeVideoAudio/)

console.log('[infinite-canvas-video-volume] 视频默认 100% 音量与手动调节检查通过')
