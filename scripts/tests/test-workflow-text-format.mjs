import assert from 'node:assert/strict'
import {
  buildWorkflowMarkdownTable,
  formatWorkflowText,
  insertWorkflowTextAtSelection,
} from '../../src/shared/workflow-text-format.ts'

assert.equal(formatWorkflowText('  标题  \r\n\r\n\r\n正文\t\n'), '标题\n\n正文')
assert.equal(buildWorkflowMarkdownTable(2, 2), '| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n| 内容 | 内容 |')
assert.equal(insertWorkflowTextAtSelection('前文后文', '表格', 2, 2), '前文\n\n表格\n\n后文')
assert.equal(insertWorkflowTextAtSelection('', '表格', 99), '表格')

console.log('workflow text format regression passed')
