// 多轮搜索补搜：根据 verifier 输出（unresolvedItems + weakFacts + conflictFacts）调 LLM 生成下一轮 query，
// 并对已搜过的 query 做归一化去重。

import { runResearchStageModel } from '../model-runner'
import {
  buildResearchFollowUpQueriesSystemPrompt,
  buildResearchFollowUpQueriesUserPrompt,
  type ResearchFollowUpQueriesModelResult,
} from '../prompts/follow-up-queries'
import type {
  ResearchQueryPlan,
  ResearchVerificationResult,
} from '../../../src/shared/research/research-types'
import type { ResearchStepContext } from './context'

const normalizeQueryKey = (value: string) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()

export const generateResearchFollowUpQueries = async (input: {
  ctx: ResearchStepContext
  verification: ResearchVerificationResult
  previousQueries: string[]
  round: number
}): Promise<ResearchQueryPlan[]> => {
  const { ctx, verification } = input
  const maxQueries = Math.max(2, Math.min(ctx.config.maxQueriesPerRound, 5))

  const result = await runResearchStageModel<ResearchFollowUpQueriesModelResult>({
    payloadRequestBody: ctx.payload.requestBody,
    modelKey: ctx.modelKey,
    systemPrompt: buildResearchFollowUpQueriesSystemPrompt(),
    userPrompt: buildResearchFollowUpQueriesUserPrompt({
      subject: ctx.subject,
      goal: ctx.goal,
      unresolvedItems: verification.unresolvedItems,
      weakFacts: verification.weakFacts,
      conflictFacts: verification.conflictFacts,
      previousQueries: input.previousQueries,
      round: input.round,
      maxQueries,
    }),
    signal: ctx.task.abortController.signal,
    stage: `follow_up_queries_round_${input.round}`,
    logGenerationTask: ctx.executor.logGenerationTask,
  })

  ctx.usageAccumulator.add(result.usage)

  const rawList = Array.isArray(result.data.followUpQueries) ? result.data.followUpQueries : []
  const seen = new Set(input.previousQueries.map(normalizeQueryKey).filter(Boolean))

  return rawList
    .map((item, index) => {
      const query = String(item?.query || '').trim()
      const intent = String(item?.intent || '补充未解决项').trim()
      const priority = Number.isFinite(Number(item?.priority)) ? Number(item.priority) : index + 1
      if (!query) {
        return null
      }
      const key = normalizeQueryKey(query)
      if (!key || seen.has(key)) {
        return null
      }
      seen.add(key)
      return {
        query,
        intent,
        priority,
      } satisfies ResearchQueryPlan
    })
    .filter((item): item is ResearchQueryPlan => Boolean(item))
    .slice(0, maxQueries)
}
