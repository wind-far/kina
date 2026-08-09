#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = await readFile(path.join(rootDir, 'src-infinite-canvas/components/video-settings-panel.tsx'), 'utf8')
const sizeOptions = source.slice(source.indexOf('const sizeOptions = ['), source.indexOf('const secondOptions'))

const values = [...sizeOptions.matchAll(/value: "([\d:]+)"/g)].map((match) => match[1])
assert.deepEqual(values, ['16:9', '9:16', '1:1', '21:9', '3:4', '4:3'])
assert.match(source, /onConfigChange\("size", `\$\{key === "width" \? next : dimensions\.width\}:\$\{key === "height" \? next : dimensions\.height\}`\)/)
assert.match(source, /export const videoSizeOptions = sizeOptions\.map\(\(item\) => \(\{ value: item\.value, label: item\.value \}\)\)/)
assert.doesNotMatch(sizeOptions, /1280x720|720x1280|1024x1024|1792x1024|1024x1792|auto/)

console.log('[infinite-canvas-video-ratios] 六种视频比例及提交值检查通过')
