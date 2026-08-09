import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../../src/views/generate/generate.vue', import.meta.url), 'utf8')

assert.match(source, /createdAt: string/)
assert.match(source, /if \(diff === 0\) return '今天'/)
assert.match(source, /if \(diff === 1\) return '昨天'/)
assert.match(source, /Date\.UTC\(value\.getFullYear\(\), value\.getMonth\(\), value\.getDate\(\)\)/)
assert.match(source, /return `\$\{date\.getMonth\(\) \+ 1\}月\$\{date\.getDate\(\)\}日`/)
assert.match(source, /return `\$\{date\.getFullYear\(\)\}年\$\{date\.getMonth\(\) \+ 1\}月\$\{date\.getDate\(\)\}日`/)
assert.match(source, /groupLabelRefreshTimer = setInterval\(refreshRecordGroupLabels, 60_000\)/)
assert.match(source, /refreshRecordGroupLabels\(\)/)

console.log('generation record date grouping regression passed')
