import type { ResearchEvidence, ResearchFact, ResearchPlanSnapshot } from '../../../src/shared/research/research-types'

export const buildResearchInitialAnalysisSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 initial-analysis 模块。',
    '职责：在首轮并行搜索结束后，对当前结果做一次中场复盘。',
    '你需要判断当前结果质量、是否发生主体混淆、是否已经拿到高价值起点来源，以及下一步更适合补搜还是进入深读。',
    '必须返回严格 JSON。',
    '禁止开始写报告，禁止编造未出现的搜索结果或证据。',
  ].join('\n')
}

export const buildResearchInitialAnalysisUserPrompt = (input: {
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
    '首轮查询：',
    JSON.stringify(input.snapshot.initialQueries, null, 2),
    '',
    '首轮搜索结果预览：',
    JSON.stringify(input.searchPreview, null, 2),
    '',
    '当前证据：',
    JSON.stringify(input.evidences.slice(0, 8), null, 2),
    '',
    '当前事实：',
    JSON.stringify(input.facts.slice(0, 8), null, 2),
    '',
    '请重点判断：',
    '- 当前结果里高价值研究页多不多，还是列表页、壳页、泛资讯页居多。',
    '- 是否发生了同名主体混淆、主题漂移或结果污染。',
    '- 是否已经拿到足够好的定义型、框架型、官方型或学术型起点来源。',
    '- 下一步更适合继续 targeted_search，还是可以准备 deep_reading。',
    '',
    '请返回 JSON：',
    '{',
    '  "known": ["字符串"],',
    '  "ambiguities": ["字符串"],',
    '  "gaps": ["字符串"],',
    '  "nextActions": ["字符串"],',
    '  "resultQuality": "high | medium | low",',
    '  "dominantSourcePattern": "字符串",',
    '  "needsCourseCorrection": true 或 false,',
    '  "courseCorrectionReason": "字符串",',
    '  "recommendedNextStep": "targeted_search | deep_reading | gap_detection"',
    '}',
  ].join('\n')
}
