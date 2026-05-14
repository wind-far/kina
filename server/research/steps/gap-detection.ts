// gap_detection：识别覆盖率缺口，决定下一步走 targeted_search / deep_reading / report_planning。

import { runResearchStageModel } from '../model-runner'
import {
  buildResearchGapDetectionSystemPrompt,
  buildResearchGapDetectionUserPrompt,
} from '../prompts/gap-detection'
import { normalizeQueryPlanList } from '../runtime/query-plan'
import { emitReasoningSummary, emitResearchStageEvent } from '../runtime/stage-events'
import type {
  ResearchQueryPlan,
} from '../../../src/shared/research/research-types'
import type { ResearchSearchResultItem } from '../tools'
import type { ResearchStepContext } from '../runtime/context'

export interface ResearchGapDetectionOutcome {
  targetedQueries: ResearchQueryPlan[]
  gapItems: string[]
  nextAction: 'targeted_search' | 'deep_reading' | 'report_planning' | ''
}

export const runGapDetectionStep = async (
  ctx: ResearchStepContext,
  input: { initialSearchResults: ResearchSearchResultItem[] },
): Promise<ResearchGapDetectionOutcome> => {
  emitResearchStageEvent(ctx.task.recordId, 'gap_detection', ctx.executor)

  const stageResult = await runResearchStageModel<{
    coverage?: Record<string, number>
    gaps?: string[]
    targetQueries?: ResearchQueryPlan[]
    nextAction?: 'targeted_search' | 'deep_reading' | 'report_planning'
    known?: string[]
    ambiguities?: string[]
    nextActions?: string[]
  }>({
    payloadRequestBody: ctx.payload.requestBody,
    modelKey: ctx.modelKey,
    systemPrompt: buildResearchGapDetectionSystemPrompt(),
    userPrompt: buildResearchGapDetectionUserPrompt({
      snapshot: ctx.snapshot,
      searchPreview: input.initialSearchResults.slice(0, 8).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
      })),
      evidences: ctx.evidenceStore.listEvidence(),
      facts: ctx.evidenceStore.listFacts(),
    }),
    signal: ctx.task.abortController.signal,
    stage: 'gap_detection',
    logGenerationTask: ctx.executor.logGenerationTask,
  })

  ctx.usageAccumulator.add(stageResult.usage)
  const data = stageResult.data

  const targetedQueries = normalizeQueryPlanList(data.targetQueries, ctx.snapshot.targetQueries)
    .slice(0, Math.max(2, ctx.config.maxQueriesPerRound - 1))
  const gapItems = Array.isArray(data.gaps)
    ? data.gaps.map(item => String(item || '').trim()).filter(Boolean)
    : ctx.snapshot.gaps

  emitReasoningSummary(
    ctx.task.recordId,
    'gap_detection',
    ctx.goal,
    Array.isArray(data.known)
      ? data.known.map(item => String(item || '').trim()).filter(Boolean)
      : [`当前已沉淀 ${ctx.evidenceStore.getCoverageSummary().evidenceCount} 条证据`],
    Array.isArray(data.ambiguities)
      ? data.ambiguities.map(item => String(item || '').trim()).filter(Boolean)
      : ctx.snapshot.ambiguities,
    gapItems,
    Array.isArray(data.nextActions)
      ? data.nextActions.map(item => String(item || '').trim()).filter(Boolean)
      : ['执行定向补搜'],
    ctx.executor,
    '已识别当前研究缺口',
  )

  return {
    targetedQueries,
    gapItems,
    nextAction: data.nextAction || '',
  }
}
