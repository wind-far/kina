#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = await readFile(path.join(rootDir, 'src-infinite-canvas/services/api/video.ts'), 'utf8')

const openAiRequest = source.slice(source.indexOf('async function createOpenAIVideoTask'), source.indexOf('async function pollOpenAIVideoTask'))
const seedanceRequest = source.slice(source.indexOf('async function createSeedanceTask'), source.indexOf('async function pollSeedanceTask'))

assert.doesNotMatch(openAiRequest, /generate_audio|watermark|resolution_name|preset/)
assert.match(seedanceRequest, /generate_audio: boolConfig\(config\.videoGenerateAudio, true\)/)
assert.match(seedanceRequest, /watermark: boolConfig\(config\.videoWatermark, false\)/)

console.log('[infinite-canvas-video-audio-request] OpenAI 文档字段与 Seedance 布尔参数检查通过')
