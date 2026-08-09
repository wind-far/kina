#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (file) => readFile(path.join(rootDir, file), 'utf8')

const [configStore, runtime, imageApi, videoApi, audioApi] = await Promise.all([
  read('src-infinite-canvas/stores/use-config-store.ts'),
  read('src-infinite-canvas/services/canvasmind-model-runtime.ts'),
  read('src-infinite-canvas/services/api/image.ts'),
  read('src-infinite-canvas/services/api/video.ts'),
  read('src-infinite-canvas/services/api/audio.ts'),
])

// 有 runtimeConfig 时也必须保留用户已经配置且可调用的渠道。
assert.match(configStore, /mergeEffectiveConfig\(config, runtimeConfig\)/)
assert.match(configStore, /const userChannels = config\.channels\.filter/)
assert.doesNotMatch(configStore, /userChannels[\s\S]{0,240}channel\.apiKey\.trim\(\)/)
assert.match(configStore, /const channels = \[\.\.\.runtimeConfig\.channels, \.\.\.userChannels\]/)
assert.match(configStore, /modelOptionsFromChannels\(channels\)/)
assert.match(configStore, /pickModel\("image", config\.imageModel, runtimeConfig\.imageModel\)/)
assert.match(configStore, /options\.includes\(normalized\) && isAiConfigReady\(merged, normalized\)/)
assert.match(configStore, /normalizedRuntimeDefault/)
assert.match(configStore, /options\.find\(\(model\) => isAiConfigReady\(merged, model\)\)/)

// 服务端目录使用独立命名空间，不能覆盖用户同名渠道。
assert.match(runtime, /RUNTIME_CHANNEL_PREFIX = "canvasmind:"/)
assert.match(runtime, /shouldUseCanvasMindModelRuntime/)
assert.match(runtime, /resolveModelChannel\(config, selected\)/)

// 只有选中服务端目录模型时才走 CanvasMind 任务接口；用户渠道继续直连其配置端点。
for (const source of [imageApi, videoApi, audioApi]) {
  assert.match(source, /shouldUseCanvasMindModelRuntime/)
  assert.doesNotMatch(source, /if \(isCanvasMindModelRuntime\(\)\)/)
}

console.log('[infinite-canvas-models] 用户渠道与 CanvasMind 目录合并检查通过')
