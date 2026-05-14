// bootstrap_planning：只发一次 tool_result 把规划好的 axes / queries 推到前端，无 LLM 调用。

import { emitResearchStageEvent } from '../runtime/stage-events'
import type { ResearchStepContext } from '../runtime/context'

export const runBootstrapPlanningStep = (ctx: ResearchStepContext) => {
  emitResearchStageEvent(ctx.task.recordId, 'bootstrap_planning', ctx.executor)
  ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
    type: 'tool_result',
    recordId: ctx.task.recordId,
    done: false,
    stopped: false,
    stage: 'bootstrap_planning',
    message: '首轮查询计划已生成',
    toolResult: {
      id: 'plan-search-1',
      toolName: 'web-search',
      preview: {
        subject: ctx.snapshot.subject,
        axes: ctx.snapshot.axes,
        queries: ctx.snapshot.initialQueries,
        targetQueries: ctx.snapshot.targetQueries,
      },
    },
  })
}
