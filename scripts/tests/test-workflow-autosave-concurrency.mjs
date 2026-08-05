import assert from 'node:assert/strict'
import {
  assertWorkflowAutosaveBaseVersion,
  WorkflowDefinitionConflictError,
} from '../../server/workflow-definitions/shared.ts'

const updatedAt = new Date('2026-08-05T05:00:00.000Z')
const currentVersion = { id: 'version-2', updatedAt }

assert.doesNotThrow(() => assertWorkflowAutosaveBaseVersion(currentVersion, {
  baseVersionId: 'version-2',
  baseVersionUpdatedAt: updatedAt.toISOString(),
}))

assert.throws(
  () => assertWorkflowAutosaveBaseVersion(currentVersion, {
    baseVersionId: 'version-1',
    baseVersionUpdatedAt: updatedAt.toISOString(),
  }),
  WorkflowDefinitionConflictError,
)

assert.throws(
  () => assertWorkflowAutosaveBaseVersion(currentVersion, {
    baseVersionId: 'version-2',
    baseVersionUpdatedAt: '2026-08-05T04:59:59.000Z',
  }),
  (error) => error instanceof WorkflowDefinitionConflictError && error.status === 409,
)

assert.doesNotThrow(() => assertWorkflowAutosaveBaseVersion(currentVersion, {}))

console.log('workflow autosave concurrency regression passed')
