import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = (relativePath) => readFile(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8')
const [sourceService, requestHandler, view, router, nav, generate, publicCatalog] = await Promise.all([
  read('server/skill-config/source-service.ts'),
  read('server/skill-config/request-handler.ts'),
  read('src/views/admin/skills/AdminSkillSources.vue'),
  read('src/router/index.ts'),
  read('src/components/admin/layout/admin-nav.ts'),
  read('src/views/generate/generate.vue'),
  read('src/shared/agent-skills-core.ts'),
])

assert.match(sourceService, /MINIMAX_H3_ARTIFACT_PATHS/)
assert.match(sourceService, /api\.github\.com\/repos/)
assert.match(sourceService, /raw\.githubusercontent\.com/)
assert.match(sourceService, /syncMiniMaxH3SourceArtifacts/)
assert.match(sourceService, /ensureMiniMaxH3SkillDefinitions/)
assert.match(sourceService, /isEnabled: false/)
assert.match(requestHandler, /matchSkillSourcePath\(requestPath, '\/sync'\)/)
assert.match(requestHandler, /sourceSyncPackageKey !== 'minimax-h3'/)
assert.match(view, /同步 MiniMax H3/)
assert.match(router, /AdminSkillSources/)
assert.match(nav, /\/admin\/skill-sources/)
assert.match(generate, /ensureSkillSourceAccepted/)
assert.match(generate, /acceptSkillSourceTerms/)
assert.match(publicCatalog, /sourcePackageKey: string/)

console.log('admin skill source registry regression passed')
