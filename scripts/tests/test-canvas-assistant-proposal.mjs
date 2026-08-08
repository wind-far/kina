import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildCanvasAssistantProposal } from '../../server/canvas-projects/service.ts'

const selectedNodes = [{ id: 'text-1', type: 'text', position: { x: 100, y: 200 }, data: { label: '需求' } }]
const textProposal = buildCanvasAssistantProposal({ prompt: '写一段商品介绍', selectedNodes, contextNodes: selectedNodes })
assert.equal(textProposal.operations.length, 1)
assert.equal(textProposal.operations[0].type, 'insert_text_node')

const videoProposal = buildCanvasAssistantProposal({ prompt: '为这个商品设计 15 秒宣传短片分镜', selectedNodes, contextNodes: selectedNodes })
assert.deepEqual(videoProposal.operations.map(item => item.type), ['insert_text_node', 'insert_director_node', 'connect_nodes'])
assert.match(videoProposal.summary, /镜头计划/)

const canvasViewSource = fs.readFileSync(new URL('../../src/views/workflow/index.vue', import.meta.url), 'utf8')
assert.match(canvasViewSource, /pauseHistory\(\)[\s\S]*?for \(const operation of operations[\s\S]*?resumeHistory\(true\)/)

console.log('canvas assistant proposal regression passed')
