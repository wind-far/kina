// 多轮搜索补充查询的 prompt 模块。
// 在 verifier verdict='blocked' 时被调用：把 unresolvedItems / weakFacts / conflictFacts / 已搜过 query
// 喂给 LLM，让其输出精准的下一轮查询计划。

import type {
  ResearchFact,
  ResearchQueryPlan,
} from '../../../src/shared/research/research-types'

export const buildResearchFollowUpQueriesSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 follow-up-queries 模块。',
    '职责：在事实核查发现证据缺口或冲突时，根据具体未解决项生成下一轮精准搜索查询。',
    '必须返回严格 JSON，不要输出 Markdown，不要补充解释。',
    '禁止重复已经搜过的查询；禁止输出泛主题查询；优先覆盖核查未通过的具体事实。',
  ].join('\n')
}

export const buildResearchFollowUpQueriesUserPrompt = (input: {
  subject: string
  goal: string
  unresolvedItems: string[]
  weakFacts: ResearchFact[]
  conflictFacts: ResearchFact[]
  previousQueries: string[]
  round: number
  maxQueries: number
}) => {
  return [
    `研究主体：${input.subject}`,
    `研究目标：${input.goal}`,
    `当前补搜轮次：第 ${input.round} 轮`,
    `允许的查询数量上限：${input.maxQueries}`,
    '',
    `未解决项（最多 8 条）：`,
    JSON.stringify(input.unresolvedItems.slice(0, 8)),
    '',
    `弱证据事实（最多 6 条）：`,
    JSON.stringify(input.weakFacts.slice(0, 6).map(item => ({
      statement: item.statement,
      uncertaintyNote: item.uncertaintyNote || '',
    }))),
    '',
    `冲突事实（最多 6 条）：`,
    JSON.stringify(input.conflictFacts.slice(0, 6).map(item => ({
      statement: item.statement,
      uncertaintyNote: item.uncertaintyNote || '',
    }))),
    '',
    `已搜过的查询（必须避开同义复用）：`,
    JSON.stringify(input.previousQueries.slice(0, 30)),
    '',
    '请返回 JSON：',
    '{',
    '  "followUpQueries": [',
    '    {',
    '      "query": "字符串",',
    '      "intent": "字符串：本查询要解决哪个未解决项",',
    '      "priority": 1',
    '    }',
    '  ]',
    '}',
    '',
    '注意：',
    '- 每条 query 必须能直接喂给搜索引擎，不要写「请帮我搜索...」之类的口语化包装。',
    '- 必须围绕「研究主体 + 未解决项关键词」组合，不要变成泛主题搜索。',
    `- 总数不超过 ${input.maxQueries} 条；如果实在没有新查询要补，返回空数组。`,
  ].join('\n')
}

export type ResearchFollowUpQueriesModelResult = {
  followUpQueries?: ResearchQueryPlan[]
}
