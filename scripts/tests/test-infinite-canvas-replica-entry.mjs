#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (file) => readFile(path.join(rootDir, file), 'utf8')

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? collectSourceFiles(target) : [target]
  }))
  return nested.flat()
}

const [router, wrapper, vite, entryHtml, replicaRouter, projectPage, canvasStore, providers, canvasTheme, modelRuntime, configStore, imageApi, videoApi, notice] = await Promise.all([
  read('src/router/index.ts'),
  read('src/views/infinite-canvas-replica/InfiniteCanvasReplicaView.vue'),
  read('vite.config.ts'),
  read('infinite-canvas.html'),
  read('src-infinite-canvas/router.tsx'),
  read('src-infinite-canvas/pages/canvas/project.tsx'),
  read('src-infinite-canvas/stores/canvas/use-canvas-store.ts'),
  read('src-infinite-canvas/components/layout/app-providers.tsx'),
  read('src-infinite-canvas/lib/canvas-theme.ts'),
  read('src-infinite-canvas/services/canvasmind-model-runtime.ts'),
  read('src-infinite-canvas/stores/use-config-store.ts'),
  read('src-infinite-canvas/services/api/image.ts'),
  read('src-infinite-canvas/services/api/video.ts'),
  read('third_party/infinite-canvas/NOTICE.md'),
])

assert.match(router, /path:\s*'\/canvas'[\s\S]*?component:\s*InfiniteCanvasReplicaView/)
assert.match(router, /path:\s*'\/infinite-canvas-workbench'[\s\S]*?redirect:\s*\(to\)\s*=>\s*\(\{\s*path:\s*'\/canvas'/)
assert.match(wrapper, /route\.query\.workflowId/)
assert.match(wrapper, /source:\s*'canvasmind'/)
assert.match(wrapper, /return '\/canvas\?mode=recent'/)
assert.match(wrapper, /class="infinite-canvas-replica__nav"/)
assert.match(wrapper, /草稿 · 已自动保存/)
assert.match(wrapper, /authStore\.currentUser\.value/)
assert.match(wrapper, /themeStore\.currentTheme\.value/)
assert.match(wrapper, /type:\s*'canvasmind:theme'/)
assert.match(wrapper, /tokens:\s*collectReplicaTokens\(\)/)
assert.match(wrapper, /--canvas-float-block-hover/)
assert.match(wrapper, /color:\s*var\(--text-primary\)/)
assert.doesNotMatch(wrapper, /--replica-nav-text/)
assert.match(wrapper, /infinite-canvas-replica--\$\{resolvedTheme\}/)
assert.match(vite, /infiniteCanvas:\s*path\.resolve\(__dirname, 'infinite-canvas\.html'\)/)
assert.match(vite, /'@infinite':\s*path\.resolve\(__dirname, 'src-infinite-canvas'\)/)
assert.match(entryHtml, /src="\/src-infinite-canvas\/main\.tsx"/)
assert.match(replicaRouter, /createHashRouter/)
assert.doesNotMatch(projectPage, /<CanvasSidePanel\b/)
assert.doesNotMatch(projectPage, /<CanvasTopBar\b/)
assert.match(projectPage, /searchParams\.get\("source"\) === "canvasmind"/)
assert.match(projectPage, /type:\s*"canvasmind:project-meta"/)
assert.match(canvasStore, /createProject:\s*\(title\?: string, requestedId\?: string\)/)
assert.match(providers, /event\.data\?\.type !== "canvasmind:theme"/)
assert.match(providers, /canvasMindThemeTokenNames\.has\(name\)/)
assert.match(providers, /style\.setProperty\(name, value\)/)
assert.match(canvasTheme, /var\(--canvas-node-bg/)
assert.match(canvasTheme, /var\(--text-primary/)
assert.match(canvasTheme, /var\(--canvas-float-block-hover/)
assert.match(modelRuntime, /\/api\/provider-config\/catalog/)
assert.match(modelRuntime, /\/api\/generation-tasks/)
assert.match(modelRuntime, /credentials:\s*"include"/)
assert.match(modelRuntime, /canvasmind:\/\/local-environment/)
assert.doesNotMatch(modelRuntime, /Authorization/)
assert.match(configStore, /runtimeConfig:\s*AiConfig \| null/)
assert.match(imageApi, /requestCanvasMindImages/)
assert.match(imageApi, /requestCanvasMindText/)
assert.match(videoApi, /requestCanvasMindVideo/)
assert.match(notice, /a2576d559ad765ba83e9563894adfbcd4e63405a/)

const sourceFiles = await collectSourceFiles(path.join(rootDir, 'src-infinite-canvas'))
assert.ok(sourceFiles.length >= 160, `expected complete upstream source tree, received ${sourceFiles.length} files`)

for (const requiredFile of [
  'components/canvas/infinite-canvas.tsx',
  'components/canvas/canvas-plugin-manager-modal.tsx',
  'pages/canvas/project.tsx',
  'pages/assets/index.tsx',
  'pages/prompts/index.tsx',
  'pages/config/index.tsx',
  'stores/canvas/use-canvas-store.ts',
]) {
  assert.ok(sourceFiles.includes(path.join(rootDir, 'src-infinite-canvas', requiredFile)), `missing ${requiredFile}`)
}

console.log('[infinite-canvas-replica] 独立入口、完整源码树与关键工作台模块检查通过')
