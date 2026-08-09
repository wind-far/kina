import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(
  new URL('../../server/generation-tasks/image-task-executor.ts', import.meta.url),
  'utf8',
)

const resultIndex = source.indexOf("const { upstreamUrl, imageUrls }")
const persistedOutputIndex = source.indexOf('writeOutputLinksOnly: true')
const firstProgressIndex = source.indexOf("stage: 'receiving_upstream_result'")

assert.ok(resultIndex >= 0, 'image executor should receive upstream image results')
assert.ok(persistedOutputIndex > resultIndex, 'upstream image results must be persisted after they return')
assert.ok(firstProgressIndex > persistedOutputIndex, 'persisting raw outputs must precede nonessential progress notifications')
assert.doesNotMatch(source.slice(resultIndex, persistedOutputIndex), /ensureTaskNotAborted\(task\)/)
assert.match(source, /image_task:post_persist_notification_failed/)
assert.match(source, /通知失败不能反向把已保存的结果改成失败或清空/)

console.log('image upstream output checkpoint regression passed')
