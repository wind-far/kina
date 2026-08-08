import assert from 'node:assert/strict'
// 该单元测试仅验证本地回放缓存；禁止继承开发环境 Redis，避免测试触发真实网络连接。
process.env.REDIS_ENABLED = 'false'

const {
  allocateEventId,
  getReplayEventsAfter,
  recordReplayEvent,
} = await import('../../server/generation-tasks/task-event-replay.ts')

const recordId = `replay-test-${Date.now()}`
const firstId = allocateEventId(recordId)
const secondId = allocateEventId(recordId)
assert.equal(firstId, 1)
assert.equal(secondId, 2)

recordReplayEvent(recordId, { id: firstId, event: { type: 'content_delta', recordId, done: false, delta: '第一段' } })
recordReplayEvent(recordId, { id: secondId, event: { type: 'completed', recordId, done: true, content: '完整结果' } })

assert.deepEqual((await getReplayEventsAfter(recordId, 0)).map(item => item.id), [1, 2])
assert.deepEqual((await getReplayEventsAfter(recordId, 1)).map(item => item.id), [2])

console.log('generation task event replay regression passed')
