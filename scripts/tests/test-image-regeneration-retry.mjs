#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../..', import.meta.url)
const generateView = await readFile(new URL('src/views/generate/generate.vue', root), 'utf8')
const lifecycle = await readFile(new URL('server/generation-tasks/task-lifecycle-service.ts', root), 'utf8')
const recordComponent = await readFile(new URL('src/components/generate/common/ImageLoadingRecord.vue', root), 'utf8')
const recordService = await readFile(new URL('server/generation-records/service.ts', root), 'utf8')

assert.match(generateView, /retryKey: `retry-\$\{record\.dbId \|\| record\.id\}-\$\{Date\.now\(\)\.toString\(36\)\}`/)
const imageTaskStart = generateView.slice(
  generateView.indexOf('const startImageGenerationTask = async'),
  generateView.indexOf('const handleStopImageGeneration = async'),
)
assert.match(imageTaskStart, /retryKey: record\.retryKey/)
assert.match(lifecycle, /__retryKey: String\(payload\.retryKey\)/)
assert.match(recordComponent, /<button class="card-bottom-button-view-xY_JqR"/)
assert.match(recordComponent, /v-if="images\.length"/)
assert.match(recordService, /REMOTE_ASSET_DOWNLOAD_TIMEOUT_MS = 30_000/)
assert.match(recordService, /fetch\(url, \{ signal: controller\.signal \}\)/)
assert.match(recordService, /materialize_output_asset:fallback/)

console.log('image regeneration retry regression passed')
