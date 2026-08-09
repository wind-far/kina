import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const read = async (relativePath) => readFile(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8')
const source = await read('server/index.ts')

const bootstrapIndex = source.indexOf('const result = await bootstrapEnvironmentProviders()')
const taskRecoveryIndex = source.indexOf('const result = await recoverInterruptedGenerationTasks()')
const workflowRecoveryIndex = source.indexOf('const result = await recoverServerWorkflowRuns()')

assert.ok(bootstrapIndex >= 0, '服务启动必须先同步环境模型配置')
assert.ok(taskRecoveryIndex > bootstrapIndex, '生成任务恢复必须等待模型目录同步')
assert.ok(workflowRecoveryIndex > taskRecoveryIndex, '工作流恢复必须在生成任务收口后再入队')
assert.match(source, /void \(async \(\) => \{/)
assert.doesNotMatch(source, /void recoverServerWorkflowRuns\(\)/)

console.log('server startup recovery ordering regression passed')
