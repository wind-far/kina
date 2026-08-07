import assert from 'node:assert/strict'
import { resolveWorkflowPromptImageParameters } from '../../src/shared/workflow-prompt-image-parameters.ts'

const seedream2k = [
  { label: '16:9', key: '2560x1440' },
  { label: '4:3', key: '2304x1728' },
]
const seedream4k = [
  { label: '16:9', key: '5404x3040' },
  { label: '4:3', key: '4694x3520' },
]

assert.deepEqual(resolveWorkflowPromptImageParameters({
  ratio: '4x3',
  resolution: '4k',
  defaultSize: '2304x1728',
  baseSizeOptions: seedream2k,
  sizeOptions: seedream4k,
}), { size: '4694x3520', quality: '4k' })

assert.deepEqual(resolveWorkflowPromptImageParameters({
  ratio: 'smart',
  resolution: '4k',
  defaultSize: '2304x1728',
  baseSizeOptions: seedream2k,
  sizeOptions: seedream4k,
}), { size: '4694x3520', quality: '4k' })

assert.deepEqual(resolveWorkflowPromptImageParameters({
  ratio: '16x9',
  resolution: '2k',
}), { size: '16x9', quality: '2k' })

assert.deepEqual(resolveWorkflowPromptImageParameters({
  ratio: 'smart',
  resolution: '2k',
}), { size: undefined, quality: '2k' })

console.log('workflow prompt image parameter regression passed')
