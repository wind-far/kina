import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../../server/generation-records/service.ts', import.meta.url), 'utf8')

assert.doesNotMatch(source, /GENERATED_OUTPUT_ASSET_DOWNLOAD_TIMEOUT_MS|timeoutMs|下载远程资源超时/)
assert.match(source, /: await downloadRemoteAsset\(rawUrl\)/)
assert.match(source, /materialize_output_asset:fallback/)
assert.match(source, /return \{\s*\.\.\.output,/)
assert.match(source, /options\.writeOutputLinksOnly && rawUrl/)
assert.match(source, /URL 或 Data URL/)
assert.match(source, /payload\.referenceImages !== undefined && !payload\.writeOutputLinksOnly/)

console.log('generation output materialization fallback regression passed')
