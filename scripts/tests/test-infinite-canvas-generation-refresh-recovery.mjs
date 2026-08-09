#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = async (relativePath) => readFile(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8')
const [types, runtime, helpers, project, store] = await Promise.all([
  read('src-infinite-canvas/types/canvas.ts'),
  read('src-infinite-canvas/services/canvasmind-model-runtime.ts'),
  read('src-infinite-canvas/lib/canvas/canvas-generation-helpers.ts'),
  read('src-infinite-canvas/pages/canvas/project.tsx'),
  read('src-infinite-canvas/stores/canvas/use-canvas-store.ts'),
])

assert.match(types, /generationTaskId\?: string/)
assert.match(runtime, /onTaskCreated\?: \(task: CanvasMindTaskCreated\)/)
assert.match(runtime, /export async function resumeCanvasMindGenerationTask/)
assert.match(runtime, /return waitForTask\(await getTask\(taskId, options\), options\)/)
assert.match(runtime, /await notifyTaskCreated\(task, options\)/)

assert.match(helpers, /export function hasRecoverableGenerationTask/)
assert.match(helpers, /resetInterruptedGeneration\(nodes: CanvasNodeData\[], connections: CanvasConnection\[] = \[]\)/)
assert.match(helpers, /recoverableOriginIds/)

assert.match(project, /rememberGenerationTask/)
assert.match(project, /generationRequestOptions\(rootId, controller, imageId\)/)
assert.match(project, /recoverPersistedCanvasNode/)
assert.match(project, /resumeCanvasMindGenerationTask\(pendingImage\.generationTaskId!/)
assert.match(project, /resetInterruptedGeneration\(project\.nodes, project\.connections\)/)
assert.match(project, /recoverPersistedGenerations\(restoredNodes, project\.connections, recoveryController\.signal\)/)

assert.match(store, /export async function flushCanvasStorePersistence/)
assert.match(project, /await flushCanvasStorePersistence\(\)/)

console.log('[infinite-canvas-generation-refresh-recovery] 后台任务刷新恢复检查通过')
