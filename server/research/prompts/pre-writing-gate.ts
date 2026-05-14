import type { ResearchEvidence, ResearchFact, ResearchVerificationResult } from '../../../src/shared/research/research-types'

export const buildResearchPreWritingGateSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 pre-writing-gate 模块。',
    '职责：在正式写报告前，判断当前证据质量是否足以支持成品化输出。',
    '你要特别区分：完全没有材料、材料不足但可写成审慎成品、以及材料充分可写成强成品。',
    '除非核心主题几乎没有任何可用外部材料，否则不要阻止写作；应优先建议采用 full_report 或 strong_report with caveats。',
    '必须返回严格 JSON。',
    '禁止直接写报告正文。',
  ].join('\n')
}

export const buildResearchPreWritingGateUserPrompt = (input: {
  subject: string
  goal: string
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
  verification: ResearchVerificationResult
}) => {
  return [
    `研究主体：${input.subject}`,
    `研究目标：${input.goal}`,
    '',
    '当前证据：',
    JSON.stringify(input.evidences.slice(0, 12), null, 2),
    '',
    '当前事实：',
    JSON.stringify(input.facts.slice(0, 12), null, 2),
    '',
    '当前核查结果：',
    JSON.stringify(input.verification, null, 2),
    '',
    '请重点判断：',
    '- 当前材料是否已经足以支撑一篇有明确判断、但会在局部保持审慎措辞的成品报告。',
    '- 是否存在完全缺失材料、导致整篇报告无法成立的核心主题。',
    '- 对于仍偏弱的结论，是否可以通过语气控制、结构安排和风险边注来处理，而不是阻止写作。',
    '',
    '请返回 JSON：',
    '{',
    '  "allowReportWriting": true 或 false,',
    '  "confidence": "high | medium | low",',
    '  "reason": "字符串",',
    '  "blockingIssues": ["字符串"],',
    '  "readySignals": ["字符串"],',
    '  "recommendedOutputMode": "full_report | bounded_summary | strong_report_with_caveats"',
    '}',
  ].join('\n')
}
