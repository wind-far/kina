import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  assertAllowedSourceUrl,
  parseCanvasPromptSourcePayload,
  parseSkillMarkdownEntries,
  sanitizeManagedPromptContent,
} from '../../server/canvas-prompts/service.ts'

const root = (path) => readFile(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

assert.equal(
  sanitizeManagedPromptContent('<script>alert(1)</script>保留提示词\n```rm -rf /```'),
  '保留提示词\n[已移除代码块]',
)
assert.throws(() => assertAllowedSourceUrl('https://example.com/prompts.json'), /raw\.githubusercontent\.com/)
assert.equal(
  assertAllowedSourceUrl('https://raw.githubusercontent.com/MiniMax-AI/MiniMax-H3/main/skills/h3-prompt-writing/SKILL.md'),
  'https://raw.githubusercontent.com/MiniMax-AI/MiniMax-H3/main/skills/h3-prompt-writing/SKILL.md',
)

const jsonEntries = parseCanvasPromptSourcePayload('JSON', JSON.stringify({ prompts: [
  { id: 'image-1', title: '商品主图', prompt: '白底商品图', tags: ['电商'], kind: 'image_config' },
  { id: 'bad', title: 'bad', prompt: '<script>evil()</script>安全内容' },
] }))
assert.equal(jsonEntries.length, 2)
assert.equal(jsonEntries[0].targetNodeType, 'imageConfig')
assert.equal(jsonEntries[1].content, '安全内容')

const skillEntries = parseSkillMarkdownEntries('# MiniMax H3 Product Skill\n使用参考图生成 15 秒视频。\n```javascript\nalert(1)\n```', 'MiniMax H3')
assert.equal(skillEntries[0].kind, 'VIDEO_CONFIG')
assert.equal(skillEntries[0].targetNodeType, 'videoConfig')
assert.match(skillEntries[0].content, /\[已移除代码块\]/)
assert.doesNotMatch(skillEntries[0].content, /alert\(1\)/)

const [schema, promptHandler, workflow, assetService, assetLibrary, canvasDrop] = await Promise.all([
  root('prisma/schema.prisma'),
  root('server/canvas-prompts/request-handler.ts'),
  root('src/views/workflow/index.vue'),
  root('server/asset-items/service.ts'),
  root('src/views/workflow/components/CanvasAssetLibrary.vue'),
  root('src/composables/useCanvasDrop.ts'),
])
assert.match(schema, /model CanvasPromptSourceVersion/)
assert.match(schema, /model CanvasPromptSyncRun/)
assert.match(promptHandler, /rollback/)
assert.match(promptHandler, /sync-runs/)
assert.match(workflow, /CanvasAssetLibrary/)
assert.match(workflow, /insertLibraryAsset/)
assert.match(assetService, /appendAssetLibraryFilters/)
assert.match(assetLibrary, /generationRecordId/)
assert.match(canvasDrop, /uploadAssetItem/)
assert.match(canvasDrop, /addNode\('audio'/)

console.log('canvas managed prompt sources and asset library regression passed')
