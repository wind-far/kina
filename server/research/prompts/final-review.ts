import type { ResearchFact } from '../../../src/shared/research/research-types'

export const buildResearchFinalReviewSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 final-review 模块。',
    '职责：检查整份研究报告是否存在冲突、过度推断和不确定性遗漏。',
    '如果报告把 partial / conflict / unverified 的事实写成确定结论，必须改写为保守表达。',
    '如果报告把单一来源信息写成行业共识，必须改写并在 finalNotes 中指出原因。',
    '如果报告从原始研究主题漂移到局部子场景，必须改写并在 finalNotes 中指出主题漂移。',
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
