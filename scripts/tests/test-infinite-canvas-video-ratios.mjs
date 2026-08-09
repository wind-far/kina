#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const [source, ratioSource, runtimeSource, videoApiSource] = await Promise.all([
  readFile(path.join(rootDir, 'src-infinite-canvas/components/video-settings-panel.tsx'), 'utf8'),
  readFile(path.join(rootDir, 'src-infinite-canvas/lib/video-aspect-ratio.ts'), 'utf8'),
  readFile(path.join(rootDir, 'src-infinite-canvas/services/canvasmind-model-runtime.ts'), 'utf8'),
  readFile(path.join(rootDir, 'src-infinite-canvas/services/api/video.ts'), 'utf8'),
])
const sizeOptions = ratioSource.slice(ratioSource.indexOf('VIDEO_ASPECT_RATIO_OPTIONS = ['), ratioSource.indexOf('] as const'))

const values = [...sizeOptions.matchAll(/value: "([\d:]+)"/g)].map((match) => match[1])
assert.deepEqual(values, ['16:9', '9:16', '1:1', '21:9', '3:4', '4:3'])
assert.match(source, /onConfigChange\("size", `\$\{key === "width" \? next : dimensions\.width\}:\$\{key === "height" \? next : dimensions\.height\}`\)/)
assert.match(source, /export const videoSizeOptions = sizeOptions\.map\(\(item\) => \(\{ value: item\.value, label: item\.value \}\)\)/)
assert.doesNotMatch(sizeOptions, /1280x720|720x1280|1024x1024|1792x1024|1024x1792|auto/)
assert.match(runtimeSource, /const ratio = normalizeVideoAspectRatio\(config\.size\)/)
assert.match(runtimeSource, /requestMode: "video-generation",[\s\S]*?ratio,[\s\S]*?requestBody: \{[\s\S]*?ratio,/)
assert.match(videoApiSource, /const ratio = normalizeVideoAspectRatio\(config\.size\)[\s\S]*?params: \{[\s\S]*?size: ratio,[\s\S]*?ratio,/)

console.log('[infinite-canvas-video-ratios] 六种视频比例及提交值检查通过')
