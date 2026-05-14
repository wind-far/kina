// parallel_search：按 maxQueriesPerRound 切首轮查询，并发执行搜索。

import { runSearchQueryBatch } from '../runtime/search-batch'
import { emitResearchStageEvent } from '../runtime/stage-events'
import type { ResearchSearchResultItem } from '../tools'
import type { ResearchStepContext } from '../runtime/context'

export const runParallelSearchStep = async (
  ctx: ResearchStepContext,
): Promise<ResearchSearchResultItem[]> => {
  emitResearchStageEvent(ctx.task.recordId, 'parallel_search', ctx.executor)
  const initialSearchQueries = ctx.snapshot.initialQueries.slice(0, ctx.config.maxQueriesPerRound)
  return runSearchQueryBatch({
    ctx,
    stage: 'parallel_search',
    queryPlans: initialSearchQueries,
    callIdPrefix: 'search-initial',
  })
}
