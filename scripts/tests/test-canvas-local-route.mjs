#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const routerPath = fileURLToPath(new URL('../../src/router/index.ts', import.meta.url))
const routerSource = await readFile(routerPath, 'utf8')

assert.match(routerSource, /path:\s*['"]\/canvas['"][\s\S]*?skipSystemInit:\s*true/)
assert.match(routerSource, /const skipSystemInit = to\.meta\?\.skipSystemInit === true/)
assert.match(routerSource, /if \(!skipSystemInit\) \{[\s\S]*?systemInitStore\.loadStatus\(\)/)

console.log('[test-canvas-local-route] 本地画布安装检查白名单通过')
