import assert from 'node:assert/strict'
import fs from 'node:fs'
import { shouldFinalizeInterruptedGenerationTask, resolveInterruptedTaskTerminalStatus } from '../../server/generation-tasks/recovery.ts'

assert.equal(shouldFinalizeInterruptedGenerationTask('inactive'), true)
assert.equal(shouldFinalizeInterruptedGenerationTask('active'), false)
assert.equal(shouldFinalizeInterruptedGenerationTask('unknown'), false)
assert.equal(resolveInterruptedTaskTerminalStatus(true), 'COMPLETED')
assert.equal(resolveInterruptedTaskTerminalStatus(false), 'FAILED')

const recoverySource = fs.readFileSync(new URL('../../server/generation-tasks/recovery.ts', import.meta.url), 'utf8')
assert.match(recoverySource, /createdAt:\s*\{ lt: recoveryStartedAt \}/)
assert.match(recoverySource, /outputs:\s*\{[\s\S]*take: 1/)

console.log('generation task recovery decision regression passed')
