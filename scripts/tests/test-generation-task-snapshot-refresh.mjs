import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../../server/generation-tasks/task-stream-subscription.ts', import.meta.url), 'utf8')
const snapshotSource = source.slice(
  source.indexOf('export const resolveTaskRecordSnapshot'),
  source.indexOf('// 统一封装任务 SSE 订阅入口'),
)

assert.match(snapshotSource, /return getGenerationRecordById\(recordId, currentUserId\)/)
assert.doesNotMatch(snapshotSource, /updateGenerationRecord|hasLocalRunningTask|getSharedTaskRuntime/)
assert.match(source, /读取快照必须是无副作用的/)

console.log('generation task snapshot refresh regression passed')
