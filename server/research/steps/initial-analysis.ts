// initial_analysis：首轮搜索后让 LLM 做中场复盘，更新 ambiguities / gaps，提示是否纠偏。

import { runResearchStageModel } from '../model-runner'
import {
  buildResearchInitialAnalysisSystemPrompt,
  buildResearchInitialAnalysisUserPrompt,
} from '../prompts/initial-analysis'
import { emitReasoningSummary, emitResearchStageEvent } from '../runtime/stage-events'
import type { ResearchSearchResultItem } from '../tools'
import type { ResearchStepContext } from '../runtime/context'

export interface ResearchInitialAnalysisOutcome {
  known: string[]
  ambiguities: string[]
  gaps: string[]
  nextActions: string[]
  resultQuality: string
  dominantSourcePattern: string
  needsCourseCorrection: boolean
  courseCorrectionReason: string
  recommendedNextStep: 'targeted_search' | 'deep_reading' | 'gap_detection' | ''
}

export const runInitialAnalysisStep = async (
  ctx: ResearchStepContext,
  input: { initialSearchResults: ResearchSearchResultItem[] },
): Promise<ResearchInitialAnalysisOutcome> => {
  emitResearchStageEvent(ctx.task.recordId, 'initial_analysis', ctx.executor)

  const stageResult = await runResearchStageModel<{
    known?: string[]
    ambiguities?: string[]
    gaps?: string[]
    nextActions?: string[]
    resultQuality?: 'high' | 'medium' | 'low'
    dominantSourcePattern?: string
    needsCourseCorrection?: boolean
    courseCorrectionReason?: string
    recommendedNextStep?: 'targeted_search' | 'deep_reading' | 'gap_detection'
  }>({
    payloadRequestBody: ctx.payload.requestBody,
    modelKey: ctx.modelKey,
    systemPrompt: buildResearchInitialAnalysisSystemPrompt(),
    userPrompt: buildResearchInitialAnalysisUserPrompt({
      snapshot: ctx.snapshot,
      searchPreview: input.initialSearchResults.slice(0, 10).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
      })),
      evidences: ctx.evidenceStore.listEvidence(),
      facts: ctx.evidenceStore.listFacts(),
    }),
    signal: ctx.task.abortController.signal,
    stage: 'initial_analysis',
    logGenerationTask: ctx.executor.logGenerationTask,
  })

  ctx.usageAccumulator.add(stageResult.usage)
  const data = stageResult.data

  const known = Array.isArray(data.known) ? data.known.map(item => String(item || '').trim()).filter(Boolean) : []
  const ambiguities = Array.isArray(data.ambiguities)
    ? data.ambiguities.map(item => String(item || '').trim()).filter(Boolean)
    : ctx.snapshot.ambiguities
  const gaps = Array.isArray(data.gaps)
    ? data.gaps.map(item => String(item || '').trim()).filter(Boolean)
    : ctx.snapshot.gaps
  const nextActions = Array.isArray(data.nextActions)
    ? data.nextActions.map(item => String(item || '').trim()).filter(Boolean)
    : ['执行缺口检测', '判断是否补搜']
  const resultQuality = String(data.resultQuality || '').trim()
  const dominantSourcePattern = String(data.dominantSourcePattern || '').trim()
  const courseCorrectionReason = String(data.courseCorrectionReason || '').trim()

  ctx.snapshot.ambiguities = ambiguities
  ctx.snapshot.gaps = gaps

  emitReasoningSummary(
    ctx.task.recordId,
    'initial_analysis',
    ctx.goal,
    [
      `首轮共收集 ${input.initialSearchResults.length} 条候选结果`,
      resultQuality ? `当前结果质量判断：${resultQuality}` : '',
      dominantSourcePattern ? `结果结构特征：${dominantSourcePattern}` : '',
      ...known,
      data.needsCourseCorrection && courseCorrectionReason ? `需要纠偏：${courseCorrectionReason}` : '',
    ].filter(Boolean),
    ambiguities,
    gaps,
    nextActions,
    ctx.executor,
    '首轮搜索结果已完成中场复盘',
  )

  return {
    known,
    ambiguities,
    gaps,
    nextActions,
    resultQuality,
    dominantSourcePattern,
    needsCourseCorrection: Boolean(data.needsCourseCorrection),
    courseCorrectionReason,
    recommendedNextStep: data.recommendedNextStep || '',
  }
}
