import type { ResearchEvidence, ResearchFact, ResearchPlanSnapshot } from '../../../src/shared/research/research-types'

export const buildResearchGapDetectionSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 gap-detection 模块。',
    '职责：基于已有搜索与证据，判断当前研究覆盖度、缺口和下一步动作。',
    '只允许输出严格 JSON。',
    '下一步动作必须是：targeted_search、deep_reading、report_planning 之一。',
    '如果研究主体已经锁定为具体仓库、项目或作者，不允许把 targetQueries 改写成泛主题搜索词。',
    'targetQueries 必须尽量保留当前主体锚点，例如仓库名、作者名、repo path、项目名。',
    '如果研究模式是 open_topic，targetQueries 必须围绕默认研究主线收敛，禁止被单一局部案例带偏。',
  ].join('\n')
}

export const buildResearchGapDetectionUserPrompt = (input: {
  snapshot: ResearchPlanSnapshot
  searchPreview: Array<{
    title: string
    url: string
    snippet: string
  }>
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
}) => {
  return [
    `研究主体：${input.snapshot.subject}`,
    `研究目标：${input.snapshot.goal}`,
    `研究模式：${input.snapshot.researchMode || 'entity_topic'}`,
    `默认主线：${input.snapshot.primaryFrame || '综合框架'}`,
    `范围决策：${input.snapshot.scopeDecision || '无'}`,
    `研究维度：${input.snapshot.axes.join('；')}`,
    `主体锚点：${(input.snapshot.queryAnchors || []).join('；') || '无'}`,
    '',
    '当前首轮查询：',
    JSON.stringify(input.snapshot.initialQueries, null, 2),
    '',
    '当前补搜候选：',
    JSON.stringify(input.snapshot.targetQueries, null, 2),
    '',
    '当前搜索结果预览：',
    JSON.stringify(input.searchPreview, null, 2),
    '',
    '当前证据：',
    JSON.stringify(input.evidences.slice(0, 8), null, 2),
    '',
    '当前事实：',
    JSON.stringify(input.facts.slice(0, 8), null, 2),
    '',
    '约束：',
    '- 如果主体锚点不为空，targetQueries 中至少前 2 条必须显式包含主体锚点里的项目名、作者名或 repo path。',
    '- 不允许把已经锁定的项目研究，改写成泛 Deep Research、泛 AI workflow、泛 architecture 搜索。',
    '- 只有在证据明确显示当前主体错误时，才能输出与主体锚点不同的 targetQueries；否则必须延续主体锚点。',
    '- 如果研究模式是 open_topic，必须优先补齐定义、框架、边界、核心维度与局限，不要默认收缩到营销、教程或单一案例。',
    '',
    '请返回 JSON：',
    '{',
    '  "coverage": {"维度名": 0-1 之间数字},',
    '  "gaps": ["字符串"],',
    '  "targetQueries": [{"query": "字符串", "intent": "字符串", "priority": 数字}],',
    '  "nextAction": "targeted_search | deep_reading | report_planning",',
    '  "known": ["字符串"],',
    '  "ambiguities": ["字符串"],',
    '  "nextActions": ["字符串"]',
    '}',
  ].join('\n')
}
