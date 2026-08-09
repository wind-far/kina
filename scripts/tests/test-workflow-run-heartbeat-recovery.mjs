import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = async (relativePath) => readFile(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8')
const source = await read('server/workflow-runs/executor.ts')

assert.match(source, /WORKFLOW_RUN_HEARTBEAT_INTERVAL_MS = 10_000/)
assert.match(source, /now - lastHeartbeatAt >= WORKFLOW_RUN_HEARTBEAT_INTERVAL_MS/)
assert.match(source, /data: \{ heartbeatAt: new Date\(now\) \}/)
assert.match(source, /existingGenerationRecordId\?: string \| null/)
assert.match(source, /if \(!recordId\) \{[\s\S]*startGenerationTask/)
assert.match(source, /\['PENDING', 'RUNNING', 'COMPLETED'\]\.includes\(String\(node\.generationRecord\?\.status/)
assert.match(source, /data: \{ status: 'PENDING', errorMessage: null, startedAt: null, finishedAt: null \}/)
assert.match(source, /resumedFromTask/)

console.log('workflow heartbeat and restart recovery regression passed')
