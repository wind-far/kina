#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const videoSource = await readFile(path.join(rootDir, 'src-infinite-canvas/services/api/video.ts'), 'utf8')
const imageUtilsSource = await readFile(path.join(rootDir, 'src-infinite-canvas/lib/image-utils.ts'), 'utf8')

assert.match(videoSource, /body\.append\("input_reference", referenceFile\)/)
assert.doesNotMatch(videoSource, /input_reference\[\]/)
assert.match(videoSource, /referenceImagesToSingleFile/)
assert.match(videoSource, /输入参考图是一张由/)
assert.match(imageUtilsSource, /new File\(\[blob\], "reference-board\.png"/)
assert.match(imageUtilsSource, /context\.fillText\(`参考图 \$\{index \+ 1\}`/)

console.log('[infinite-canvas-video-reference-request] 视频角色参考图字段与参考板检查通过')
