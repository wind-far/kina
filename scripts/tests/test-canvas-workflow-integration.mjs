#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const readSource = (path) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const [router, main, workflow, projectList] = await Promise.all([
  readSource('../../src/router/index.ts'),
  readSource('../../src/main.ts'),
  readSource('../../src/views/workflow/index.vue'),
  readSource('../../src/views/agentic-assets-canvas/AgenticAssetsCanvasView.vue'),
])

assert.match(router, /path:\s*['"]\/canvas['"][\s\S]*?component:\s*InfiniteCanvasReplicaView/)
assert.match(router, /path:\s*['"]\/workflow['"][\s\S]*?component:\s*Workflow/)
assert.doesNotMatch(router, /const Canana\s*=/)
assert.doesNotMatch(main, /currentRoute\.value\.path === ['"]\/canvas['"]/)
assert.match(workflow, /route\.query\.workflowId \|\| route\.query\.projectId/)
assert.match(workflow, /watch\(\(\) => \[route\.query\.workflowId, route\.query\.projectId\]/)
assert.match(projectList, /workflowId:\s*project\.id/)
assert.match(projectList, /projectName:\s*project\.name/)
assert.match(workflow, /return route\.path === ['"]\/canvas['"] \? ['"]\/asset\?tab=canvas['"] : ['"]\/agentic-assets-workflow['"]/)
assert.match(projectList, /returnTo:\s*route\.fullPath/)

console.log('[test-canvas-workflow-integration] 无限画布入口与原工作流兼容路由检查通过')
