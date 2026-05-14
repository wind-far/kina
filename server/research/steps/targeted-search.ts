// targeted_search：根据上游传入的 queryPlans 执行定向搜索。
// 既被首轮 gap_detection 后调用，也被多轮 fact_verification → follow-up-queries 复用。

import { runSearchQueryBatch } from '../runtime/search-batch'
import { emitResearchStageEvent } from '../runtime/stage-events'
import type {
  ResearchQueryPlan,
  ResearchStage,
} from '../../../src/shared/research/research-types'
import type { ResearchSearchResultItem } from '../tools'
import type { ResearchStepContext } from '../runtime/context'

export const runTargetedSearchStep = async (
  ctx: ResearchStepContext,
  input: {
    queryPlans: ResearchQueryPlan[]
    callIdPrefix: string
    stage?: Extract<ResearchStage, 'targeted_search' | 'fact_verification'>
  },
): Promise<ResearchSearchResultItem[]> => {
  if (!input.queryPlans.length) {
    return []
  }
  const stage = input.stage || 'targeted_search'
  emitResearchStageEvent(ctx.task.recordId, stage, ctx.executor)
  return runSearchQueryBatch({
    ctx,
    stage,
    queryPlans: input.queryPlans,
    callIdPrefix: input.callIdPrefix,
  })
}
