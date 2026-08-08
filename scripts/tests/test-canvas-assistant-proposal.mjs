import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildCanvasAssistantModelMessages, buildCanvasAssistantProposal } from '../../server/canvas-projects/service.ts'
import {
  buildCanvasAssistantProposalInstruction,
  normalizeCanvasAssistantProposal,
  parseCanvasAssistantProposal,
} from '../../src/shared/canvas-assistant-proposal.ts'

const selectedNodes = [{ id: 'text-1', type: 'text', position: { x: 100, y: 200 }, data: { label: '需求' } }]
const textProposal = buildCanvasAssistantProposal({ prompt: '写一段商品介绍', selectedNodes, contextNodes: selectedNodes })
assert.equal(textProposal.operations.length, 1)
assert.equal(textProposal.operations[0].type, 'insert_text_node')

const videoProposal = buildCanvasAssistantProposal({ prompt: '为这个商品设计 15 秒宣传短片分镜', selectedNodes, contextNodes: selectedNodes })
assert.deepEqual(videoProposal.operations.map(item => item.type), ['insert_text_node', 'insert_director_node', 'connect_nodes'])
assert.match(videoProposal.summary, /镜头计划/)

const assistantMessages = buildCanvasAssistantModelMessages({ prompt: '为需求生成分镜', selectedNodes, contextNodes: selectedNodes })
assert.equal(assistantMessages[0].role, 'system')
assert.match(assistantMessages[0].content, /受限画布助手/)
assert.match(assistantMessages[1].content, /允许读取的画布上下文/)

const canvasViewSource = fs.readFileSync(new URL('../../src/views/workflow/index.vue', import.meta.url), 'utf8')
assert.match(canvasViewSource, /pauseHistory\(\)[\s\S]*?for \(const operation of operations[\s\S]*?resumeHistory\(true\)/)
assert.match(canvasViewSource, /@canvas-proposal="handleCloudCanvasProposal"/)
assert.match(canvasViewSource, /subscribeGenerationTaskEvents/)
assert.match(canvasViewSource, /CANVAS_ASSISTANT_PRESETS/)
assert.match(canvasViewSource, /canvasAssistantStreaming/)
assert.match(canvasViewSource, /await flushAutosave\(\)/)

const canvasServiceSource = fs.readFileSync(new URL('../../server/canvas-projects/service.ts', import.meta.url), 'utf8')
assert.match(canvasServiceSource, /startGenerationTask/)
assert.match(canvasServiceSource, /parseCanvasAssistantProposal/)
assert.match(canvasServiceSource, /未配置可用的对话模型/)
assert.match(canvasServiceSource, /startCanvasAssistantPreviewTask/)
assert.match(canvasServiceSource, /recordCanvasAssistantApplication/)
assert.match(canvasServiceSource, /canvas_assistant\.apply/)

const canvasRequestHandlerSource = fs.readFileSync(new URL('../../server/canvas-projects/request-handler.ts', import.meta.url), 'utf8')
assert.match(canvasRequestHandlerSource, /assistant-tasks/)
assert.match(canvasRequestHandlerSource, /assistant-applications/)

const canvasApiSource = fs.readFileSync(new URL('../../src/views/workflow/api/canvas-projects.ts', import.meta.url), 'utf8')
assert.match(canvasApiSource, /startCanvasAssistantTask/)
assert.match(canvasApiSource, /recordCanvasAssistantApplication/)

const parsed = parseCanvasAssistantProposal('我已整理为两步。<canvas-proposal>{"summary":"插入镜头草稿","operations":[{"type":"insert_text_node","clientKey":"copy","position":{"x":120,"y":-30},"data":{"label":"文案","content":"一段合规的文案"}},{"type":"insert_director_node","clientKey":"director","data":{"brief":"15秒视频","mode":"storyboard"}},{"type":"connect_nodes","sourceClientKey":"copy","targetClientKey":"director","edgeType":"promptOrder"}]}</canvas-proposal>')
assert.equal(parsed.displayContent, '我已整理为两步。')
assert.equal(parsed.proposal?.operations.length, 3)
assert.equal(parsed.proposal?.operations[1].type, 'insert_director_node')
assert.equal(parsed.proposal?.operations[1].data?.mode, 'storyboard')

const compatibleParsed = parseCanvasAssistantProposal('<canvas-proposal>{"summary":"兼容模型字段","operations":[{"op":"insert_text_node","clientKey":"flash","position":{"x":0,"y":0},"text":"安全归一化后的文案"}]}</canvas-proposal>')
assert.equal(compatibleParsed.proposal?.operations[0].type, 'insert_text_node')
assert.equal(compatibleParsed.proposal?.operations[0].data?.content, '安全归一化后的文案')

assert.equal(normalizeCanvasAssistantProposal({
  operations: [{ type: 'delete_project', clientKey: 'unsafe' }],
}), null)
assert.equal(normalizeCanvasAssistantProposal({
  operations: [{ type: 'connect_nodes', sourceClientKey: 'same', targetClientKey: 'same' }],
}), null)
assert.equal(normalizeCanvasAssistantProposal({
  operations: [
    { type: 'insert_text_node', clientKey: 'copy' },
    { type: 'insert_text_node', clientKey: 'copy' },
  ],
}), null)
assert.match(buildCanvasAssistantProposalInstruction(), /不得输出脚本/)

const rightPanelSource = fs.readFileSync(new URL('../../src/components/canana/RightPanel.vue', import.meta.url), 'utf8')
assert.match(rightPanelSource, /allowCanvasProposals/)
assert.match(rightPanelSource, /canvas-proposal/)

console.log('canvas assistant proposal regression passed')
