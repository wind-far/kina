import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = fs.readFileSync(path.join(rootDir, 'src/views/workflow/config/workflows.ts'), 'utf8')
const workflowViewSource = fs.readFileSync(path.join(rootDir, 'src/views/workflow/index.vue'), 'utf8')

const start = source.indexOf("id: 'multi-angle-storyboard'")
const end = source.indexOf("// ========== 2.", start)
assert.ok(start >= 0 && end > start, 'multi-angle storyboard template must exist')
const template = source.slice(start, end)

// 对齐参考画布：两个连续的图片框承接角色，再从结果框扇出四个视角结果框。
assert.match(template, /const mainImageId = getId\(\)/)
assert.match(template, /type: 'image',[\s\S]*?label: '主角色图'/)
assert.match(template, /type: 'image',[\s\S]*?label: '角色图结果'/)
assert.match(template, /source: mainImageId, target: imgId/)
assert.match(template, /const imageId = getId\(\)/)
assert.match(template, /label: `\$\{cfg\.label\} \(\$\{cfg\.english\}\)`/)
assert.match(template, /source: tId, target: imageId, type: 'promptOrder'/)
assert.match(template, /source: imgId, target: imageId, type: 'imageOrder'/)
assert.doesNotMatch(template, /const cfgId = getId\(\)/)
assert.doesNotMatch(template, /type: 'imageConfig'/)

// 旧项目载入后也要升级成直接图片节点；选中节点时把上游文本填入生成输入栏。
assert.match(workflowViewSource, /const hydrateWorkflowPromptFromSelectedImage/)
assert.match(workflowViewSource, /if \(node\.type === 'text'\) return String\(data\.content \|\| ''\)/)
assert.match(workflowViewSource, /workflowPrompt\.value = upstreamPrompt \|\| String\(data\.prompt \|\| ''\)\.trim\(\)/)
assert.match(workflowViewSource, /if \(shouldOpenPrompt\) hydrateWorkflowPromptFromSelectedImage\(targetNodeId\)/)

console.log('workflow multi-angle reference layout regression passed')
