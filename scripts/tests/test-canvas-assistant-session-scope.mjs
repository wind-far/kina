import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildCanvasAssistantSessionSource } from '../../src/shared/canvas-assistant-session.ts'

assert.equal(buildCanvasAssistantSessionSource(), 'canvas-assistant')
assert.equal(buildCanvasAssistantSessionSource('project-a'), 'canvas-assistant:project-a')
assert.notEqual(buildCanvasAssistantSessionSource('project-a'), buildCanvasAssistantSessionSource('project-b'))

const sessionServiceSource = fs.readFileSync(new URL('../../server/generation-sessions/service.ts', import.meta.url), 'utf8')
assert.match(sessionServiceSource, /目标会话不属于当前创作来源/)

const recordServiceSource = fs.readFileSync(new URL('../../server/generation-records/service.ts', import.meta.url), 'utf8')
assert.match(recordServiceSource, /sourceForSession/)

console.log('canvas assistant session scope regression passed')
