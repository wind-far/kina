#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const [videoApi, toolbar, project] = await Promise.all([
  readFile(path.join(rootDir, 'src-infinite-canvas/services/api/video.ts'), 'utf8'),
  readFile(path.join(rootDir, 'src-infinite-canvas/components/canvas/canvas-node-hover-toolbar.tsx'), 'utf8'),
  readFile(path.join(rootDir, 'src-infinite-canvas/pages/canvas/project.tsx'), 'utf8'),
])

assert.match(videoApi, /export async function recoverGeneratedVideoFromUrl/)
assert.match(videoApi, /storeGeneratedVideo\(await videoResultFromUrl\(requestConfig, url, options\)\)/)
assert.match(toolbar, /onRecoverVideo/)
assert.match(toolbar, /恢复预览/)
assert.match(project, /recoverGeneratedVideoFromUrl\(generationConfig, url\)/)
assert.match(project, /sourceUrl: url/)
assert.match(project, /不会重新生成视频/)

console.log('[infinite-canvas-video-url-recovery] 已有 URL 恢复原视频节点检查通过')
