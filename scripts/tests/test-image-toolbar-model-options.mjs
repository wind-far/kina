import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = fs.readFileSync(path.join(rootDir, 'src/components/generate/toolbars/ImageToolbar.vue'), 'utf8')

assert.match(source, /const seenLabels = new Set<string>()/)
assert.match(source, /const normalizedLabel = label\.toLocaleLowerCase\('zh-CN'\)/)
assert.match(source, /if \(!label \|\| seenLabels\.has\(normalizedLabel\)\) return \[\]/)
assert.match(source, /seenLabels\.add\(normalizedLabel\)/)

console.log('image toolbar model option de-duplication regression passed')
