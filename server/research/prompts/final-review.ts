import type { ResearchFact } from '../../../src/shared/research/research-types'

export const buildResearchFinalReviewSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 final-review 模块。',
    '职责：检查整份研究报告是否存在明显冲突、明显过度推断和主题漂移。',
    '目标是保留成品报告的判断力度，只修正过于离谱、超出证据边界或明显失真的表达。',
    '如果报告把 partial / conflict / unverified 的事实写成绝对化、排他性的结论，才需要降调。',
    '如果报告把单一来源信息写成行业共识，优先改写为“行业判断”“市场信号”“当前信息显示”等自然表述，而不是增加审计式免责声明。',
    '如果报告从原始研究主题漂移到局部子场景，必须改写并在 finalNotes 中指出主题漂移。',
    'finalNotes 保持简洁，不要重复整份核查清单。',
    '必须返回严格 JSON。',
  ].join('\n')
}

export const buildResearchFinalReviewUserPrompt = (input: {
  subject: string
  report: string
  facts: ResearchFact[]
  unresolvedItems: string[]
}) => {
  return [
    `研究主体：${input.subject}`,
    '',
    '事实列表：',
    JSON.stringify(input.facts, null, 2),
    '',
    `未解决项：${JSON.stringify(input.unresolvedItems)}`,
    '',
    '报告正文：',
    input.report,
    '',
    '请返回 JSON：',
    '{',
    '  "issues": ["字符串"],',
    '  "revisedReport": "字符串",',
    '  "finalNotes": ["字符串"]',
    '}',
  ].join('\n')
}
