#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const readSource = (path) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const [assetPage, canvasTab, projectPayload] = await Promise.all([
  readSource('../../src/views/asset/AssetManagement.vue'),
  readSource('../../src/views/asset/components/AssetCanvasTab.vue'),
  readSource('../../src/views/agentic-assets-canvas/new-agentic-project.ts'),
])

assert.match(assetPage, /listWorkflowDefinitions\(\{[\s\S]*scene:\s*'INFINITE_CANVAS'/)
assert.match(assetPage, /createWorkflowDefinition\(buildBlankCanvasProjectPayload\(\)\)/)
assert.match(assetPage, /updateWorkflowDefinition\(project\.id, \{ name \}\)/)
assert.match(assetPage, /deleteWorkflowDefinition\(project\.id\)/)
assert.match(assetPage, /path:\s*'\/canvas'/)
assert.match(assetPage, /@create-project="handleCreateCanvasProject"/)
assert.match(assetPage, /@open-project="handleOpenCanvasProject"/)
assert.match(assetPage, /@rename-project="handleRenameCanvasProject"/)
assert.match(assetPage, /@delete-project="handleDeleteCanvasProject"/)
assert.match(assetPage, /@search="handleCanvasProjectSearch"/)
assert.match(assetPage, /@load-more="loadMoreCanvasProjects"/)
assert.match(canvasTab, /extractWorkflowPreviewImages/)
assert.doesNotMatch(canvasTab, /42b6674b5ee448c7a0a0381f024d0886/)
assert.match(projectPayload, /buildUntitledName\('项目', now\)/)

console.log('[test-asset-canvas-projects] 画布项目接口接入通过')
