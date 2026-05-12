import type { ResearchEvidence, ResearchFact } from '../../../src/shared/research/research-types'

export const buildResearchReportPlanningSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 report-planning 模块。',
    '职责：基于事实、证据和未解决项生成最终报告章节结构。',
    '必须返回严格 JSON。',
  ].join('\n')
}

export const buildResearchReportPlanningUserPrompt = (input: {
  subject: string
  goal: string
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
  unresolvedItems: string[]
}) => {
  return [
    `研究主体：${input.subject}`,
    `研究目标：${input.goal}`,
    '',
    '证据：',
    JSON.stringify(input.evidences.slice(0, 12), null, 2),
    '',
    '事实：',
    JSON.stringify(input.facts.slice(0, 12), null, 2),
    '',
    `未解决项：${JSON.stringify(input.unresolvedItems)}`,
    '',
    '请返回 JSON：',
    '{',
    '  "sections": [',
    '    {',
    '      "id": "字符串",',
    '      "title": "字符串",',
    '      "objective": "字符串",',
    '      "keyQuestions": ["字符串"]',
    '    }',
    '  ]',
    '}',
  ].join('\n')
}
