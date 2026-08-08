import assert from 'node:assert/strict'
import { formatCanvasImportMigrationReport } from '../../src/shared/canvas-import-report.ts'

assert.equal(formatCanvasImportMigrationReport([]), '')
const report = formatCanvasImportMigrationReport(['未知插件节点已作为占位节点保留。', '未知插件节点已作为占位节点保留。', '连线已忽略。'])
assert.match(report, /1\. 未知插件节点/)
assert.match(report, /2\. 连线已忽略/)
assert.doesNotMatch(report, /3\./)

console.log('canvas import migration report regression passed')
