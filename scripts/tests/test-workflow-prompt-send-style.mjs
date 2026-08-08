import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = fs.readFileSync(path.join(rootDir, 'src/views/workflow/styles/workflow.css'), 'utf8')

// 黑色只属于实际可发送态，默认与禁用态均保持灰色。
assert.match(source, /\.workflow-canvas-wrap \.workflow-prompt-dock \.canvas-prompt-input__send \{[\s\S]*?background: #9aa1a9;/)
assert.match(source, /\.workflow-canvas-wrap \.workflow-prompt-dock \.canvas-prompt-input__send:not\(:disabled\) \{[\s\S]*?background: #0f1419;/)
assert.match(source, /\.workflow-prompt-dock\.canvas-prompt-input--workflow \.canvas-prompt-input__send \{[\s\S]*?background: rgba\(15, 20, 25, 0\.28\);/)
assert.match(source, /\.workflow-prompt-dock\.canvas-prompt-input--workflow \.canvas-prompt-input__send:not\(:disabled\) \{[\s\S]*?background: #0f1419;/)

console.log('workflow prompt send style regression passed')
