import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const generateView = await readFile(`${projectRoot}/src/views/generate/generate.vue`, 'utf8')

assert.match(
  generateView,
  /\.main-content-G632JF\.new-conversation\s+\.dimension-layout-FUl4Nj\.default-layout-eH8Zi1\s*\{[\s\S]*?background:\s*#fefeff;[\s\S]*?height:\s*176px;/,
  '空白创作态应保留参考页的输入器背景和 176px 内容高度',
)

console.log('generate empty workbench clone checks passed')
