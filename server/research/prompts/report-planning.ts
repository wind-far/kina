import type { ResearchEvidence, ResearchFact } from '../../../src/shared/research/research-types'

export const buildResearchReportPlanningSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 report-planning 模块。',
    '职责：基于事实、证据和未解决项生成最终报告章节结构。',
    '默认目标是生成一篇成品化、强输出的深度研究报告，而不是方法说明或核查说明。',
    '优先采用“强摘要 -> 分主题主体章节 -> 产业/投资/政策影响 -> 结论”的结构。',
    '除非用户明确要求，否则不要单独设置“证据评估”“研究局限”“方法论说明”作为主体章节；这些内容应压缩进摘要、结论或局部提醒。',
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
    '章节规划要求：',
    '- 更像成品研究报告，不像审计记录。',
    '- 优先围绕主题本身展开，而不是围绕研究流程展开。',
    '- 章节名应有明确内容指向，例如“执行摘要”“短期缺芯片”“长期缺能源”“永远缺存储”“产业影响与结论”。',
    '- 如果某个主题证据偏弱，可保留该章节，但在 objective 中要求采用审慎表述，而不是把整章变成“证据不足说明”。',
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
