import assert from 'node:assert/strict'
import fs from 'node:fs'

const imageRecordSource = fs.readFileSync(
  new URL('../../src/components/generate/common/ImageLoadingRecord.vue', import.meta.url),
  'utf8',
)
const subscriptionSource = fs.readFileSync(
  new URL('../../server/generation-tasks/task-stream-subscription.ts', import.meta.url),
  'utf8',
)
const pageSource = fs.readFileSync(
  new URL('../../src/views/generate/generate.vue', import.meta.url),
  'utf8',
)

assert.match(imageRecordSource, /resolvePreviewProgressCeiling/)
assert.match(imageRecordSource, /真正完成只能由服务端事件设为 100%/)
assert.doesNotMatch(imageRecordSource, /hasControlledProgress/)
assert.match(imageRecordSource, /currentProgress\.value = Math\.max\(currentProgress\.value, nextProgress\)/)
assert.match(subscriptionSource, /getSharedTaskRecentEvents/)
assert.match(subscriptionSource, /页面切换回来时，数据库快照仍可能是“排队中”/)
assert.match(subscriptionSource, /event: progress/)

const unmountIndex = pageSource.indexOf('onUnmounted(() => {')
const unmountSource = pageSource.slice(unmountIndex, pageSource.indexOf('</script>', unmountIndex))
assert.match(unmountSource, /taskStreamControllers\.forEach\(controller => controller\.abort\(\)\)/)
assert.doesNotMatch(unmountSource, /stopGenerationTask\(/)

console.log('image progress continuity regression passed')
