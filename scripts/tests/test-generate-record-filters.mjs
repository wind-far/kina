import assert from 'node:assert/strict'
import fs from 'node:fs'

const pageSource = fs.readFileSync(new URL('../../src/views/generate/generate.vue', import.meta.url), 'utf8')
const filterSource = fs.readFileSync(new URL('../../src/views/generate/components/GenerateSessionList.vue', import.meta.url), 'utf8')
const imageRecordSource = fs.readFileSync(new URL('../../src/components/generate/common/ImageLoadingRecord.vue', import.meta.url), 'utf8')
const lifecycleSource = fs.readFileSync(new URL('../../server/generation-tasks/task-lifecycle-service.ts', import.meta.url), 'utf8')

assert.match(filterSource, /timeFilterOptions/)
assert.match(filterSource, /typeFilterOptions/)
assert.match(filterSource, /actionFilterOptions/)
assert.match(filterSource, /time-filter-select/)
assert.match(filterSource, /filter-popup-menu/)
assert.match(pageSource, /matchesRecordTimeFilter\(record, sessionTimeFilter\.value\)/)
assert.match(pageSource, /sessionTypeFilter\.value !== 'all'/)
assert.match(pageSource, /record\.retryKey \? 'regenerate' : 'create'/)
assert.match(lifecycleSource, /retryKey: String\(payload\.retryKey \|\| ''\)\.trim\(\) \|\| undefined/)
assert.match(imageRecordSource, /<span>预览图片<\/span>/)
assert.match(imageRecordSource, /class="card-bottom-button-view-xY_JqR"/)

console.log('generation record filters regression passed')
