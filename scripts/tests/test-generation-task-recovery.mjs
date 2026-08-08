import assert from 'node:assert/strict'
import fs from 'node:fs'
import { shouldFinalizeInterruptedGenerationTask } from '../../server/generation-tasks/recovery.ts'

assert.equal(shouldFinalizeInterruptedGenerationTask('inactive'), true)
assert.equal(shouldFinalizeInterruptedGenerationTask('active'), false)
assert.equal(shouldFinalizeInterruptedGenerationTask('unknown'), false)

const recoverySource = fs.readFileSync(new URL('../../server/generation-tasks/recovery.ts', import.meta.url), 'utf8')
assert.match(recoverySource, /createdAt:\s*\{ lt: recoveryStartedAt \}/)

console.log('generation task recovery decision regression passed')
