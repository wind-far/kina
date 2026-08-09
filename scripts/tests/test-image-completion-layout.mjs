import assert from 'node:assert/strict'
import fs from 'node:fs'

const loadingRecord = fs.readFileSync(new URL('../../src/components/generate/common/ImageLoadingRecord.vue', import.meta.url), 'utf8')
const promptHeader = fs.readFileSync(new URL('../../src/components/generate/common/RecordPromptReferenceHeader.vue', import.meta.url), 'utf8')
const generateCss = fs.readFileSync(new URL('../../src/views/generate/generate.css', import.meta.url), 'utf8')

assert.match(loadingRecord, /v-if="!done && renderedConversationEntries\.length"/)
assert.match(loadingRecord, /responsive-image-grid--single': images\.length === 1/)
assert.match(generateCss, /\.responsive-image-grid\.responsive-image-grid--single/)
assert.match(promptHeader, /flex-direction: column;/)
assert.match(promptHeader, /\.labels-b517mw[\s\S]*display: flex;/)
assert.match(promptHeader, /text-overflow: ellipsis/)

console.log('image completion layout regression passed')
