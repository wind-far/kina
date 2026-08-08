#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const readSource = (path) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const [canvas, canvasCss, workflow, zoomControls, legacyToolbar] = await Promise.all([
  readSource('../../src/views/canana/CanvasWorkspaceView.vue'),
  readSource('../../src/views/canana/canvas-workspace.css'),
  readSource('../../src/views/workflow/index.vue'),
  readSource('../../src/components/canvas/CanvasZoomControls.vue'),
  readSource('../../src/components/canana/LeftToolbar.vue'),
])

assert.match(canvas, /data-tooltip="选择 \/ 移动（V）"/)
assert.match(canvas, /data-tooltip-position="right"/)
assert.match(canvasCss, /@media \(hover: hover\) and \(pointer: fine\)/)
assert.match(workflow, /data-tooltip="打开项目库"/)
assert.match(workflow, /:data-tooltip="tool\.name"/)
assert.match(workflow, /aria-label="撤销"/)
assert.match(zoomControls, /data-tooltip="设置画布缩放"/)
assert.match(zoomControls, /transition:opacity \.08s ease-out/)
assert.match(legacyToolbar, /tooltip-fadein-right 0\.08s ease-out/)

console.log('[test-menu-tooltips] 画布与工作流菜单即时提示通过')
