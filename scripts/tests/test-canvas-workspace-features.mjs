#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const workspacePath = fileURLToPath(new URL('../../src/views/canana/CanvasWorkspaceView.vue', import.meta.url))
const source = await readFile(workspacePath, 'utf8')

for (const feature of [
  'function addArtboard',
  'function addTextNode',
  'function duplicateSelectedNode',
  'function deleteSelectedNode',
  'function startCrop',
  'function applyCrop',
  'function handleImageUpload',
  'function normalizeNode',
  'function normalizeMessages',
  'function submitCanvasPrompt',
  'function submitPanelPrompt',
  'function exportProject',
  'function importProject',
  'function persistLocalState',
]) {
  assert.match(source, new RegExp(feature))
}

assert.match(source, /localStorage\.setItem\(storageKey\.value/)
assert.match(source, /@keydown\.ctrl\.enter\.prevent="finishTextEditing\(node\)"/)
assert.match(source, /@keydown\.meta\.enter\.prevent="finishTextEditing\(node\)"/)
assert.match(source, /type="file" accept="image\/\*"/)
assert.match(source, /MAX_UPLOAD_BYTES/)
assert.match(source, /isSafeLocalImageSrc/)
assert.match(source, /payload\.version !== CANVAS_STORAGE_VERSION/)
assert.match(source, /target\?\.closest\('button, a, \[role="button"\], \[role="menuitem"\]'\)/)
assert.match(source, /未连接 AI 生成服务/)
assert.doesNotMatch(source, /aria-hidden="true"[^>]*>\s*\n\s*<div v-if="selectedNode/)
assert.doesNotMatch(source, /tabindex="-1"[^>]*>复制/)

console.log('[test-canvas-workspace-features] 本地画布核心功能声明通过')
