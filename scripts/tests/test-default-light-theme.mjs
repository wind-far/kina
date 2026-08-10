#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const readSource = (path) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const [html, infiniteHtml, publicConfig, serverConfig, appStore, infiniteThemeStore] = await Promise.all([
  readSource('../../index.html'),
  readSource('../../infinite-canvas.html'),
  readSource('../../src/api/system-config.ts'),
  readSource('../../server/system-config/service.ts'),
  readSource('../../src/stores/app.ts'),
  readSource('../../src-infinite-canvas/stores/use-theme-store.ts'),
])

assert.match(html, /<body lv-theme="light"/)
assert.match(infiniteHtml, /s\.state\.theme === 'dark' \? 'dark' : 'light'/)
assert.match(publicConfig, /createDefaultGlobalThemeSettings[\s\S]*?defaultMode: 'light'/)
assert.match(serverConfig, /globalThemeSettings:[\s\S]*?defaultMode: 'light'/)
assert.match(appStore, /const theme = ref\('light'\)/)
assert.match(infiniteThemeStore, /theme: "light"/)

console.log('[test-default-light-theme] 首次访问与配置兜底默认浅色通过')
