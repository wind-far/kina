#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const readSource = (path) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const [html, systemSettings, canvasWorkspace, infiniteProviders, policyDetail] = await Promise.all([
  readSource('../../index.html'),
  readSource('../../src/stores/system-settings.ts'),
  readSource('../../src/views/canana/CanvasWorkspaceView.vue'),
  readSource('../../src-infinite-canvas/components/layout/app-providers.tsx'),
  readSource('../../src/views/policies/PolicyDetail.vue'),
])

assert.match(html, /<title>kina<\/title>/)
assert.match(html, /<link rel="icon" href="data:," \/>/)
assert.match(systemSettings, /const BROWSER_TAB_TITLE = 'kina'/)
assert.match(systemSettings, /const EMPTY_FAVICON_HREF = 'data:,'/)
assert.match(systemSettings, /document\.title = BROWSER_TAB_TITLE/)
assert.match(systemSettings, /favicon\.href = EMPTY_FAVICON_HREF/)
assert.doesNotMatch(systemSettings, /favicon\.href = iconUrl/)
assert.doesNotMatch(canvasWorkspace, /faviconElement|\/vite\.svg/)
assert.match(infiniteProviders, /document\.title = "kina"/)
assert.match(policyDetail, /document\.title = 'kina'/)

console.log('[test-browser-tab-branding] 浏览器标签标题与空图标策略通过')
