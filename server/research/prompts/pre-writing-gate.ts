import type { ResearchEvidence, ResearchFact, ResearchVerificationResult } from '../../../src/shared/research/research-types'

export const buildResearchPreWritingGateSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 pre-writing-gate 模块。',
    '职责：在正式写报告前，判断当前证据质量是否足以支持正文写作。',
    '你要特别区分：可交叉验证的硬事实、来自单一来源的软判断、以及仅适合作为分析框架的概括性主张。',
    '如果核心结论仍主要依赖单一来源、软判断或未充分核查的框架性表述，必须阻止进入正式报告写作。',
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
    '- 是否已经有足够多的核心结论得到独立来源支撑。',
    '- 当前事实里是否有大量内容其实只是 soft claim 或 framework claim，而不适合作为确定性结论入正文。',
    '- 如果现在开写，是否大概率会把 partial / unverified / 单一来源判断写成确定结论。',
    '',
    '请返回 JSON：',
    '{',
    '  "allowReportWriting": true 或 false,',
    '  "confidence": "high | medium | low",',
    '  "reason": "字符串",',
    '  "blockingIssues": ["字符串"],',
    '  "readySignals": ["字符串"],',
    '  "recommendedOutputMode": "full_report | bounded_summary"',
    '}',
  ].join('\n')
}
