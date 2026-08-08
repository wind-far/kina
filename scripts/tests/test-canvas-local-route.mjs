#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const routerPath = fileURLToPath(new URL('../../src/router/index.ts', import.meta.url))
const routerSource = await readFile(routerPath, 'utf8')

assert.match(routerSource, /path:\s*['"]\/canvas['"][\s\S]*?component:\s*Workflow/)
assert.match(routerSource, /workspace:\s*['"]workflow['"]/)
assert.match(routerSource, /const skipSystemInit = to\.meta\?\.skipSystemInit === true/)
assert.match(routerSource, /if \(!skipSystemInit\) \{[\s\S]*?systemInitStore\.loadStatus\(\)/)
assert.doesNotMatch(routerSource, /CanvasWorkspaceView\.vue/)

console.log('[test-canvas-local-route] 画布入口已接入工作流通过')
