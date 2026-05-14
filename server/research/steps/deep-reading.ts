// deep_reading：对 ranked 后的目标做并发深读，每页一次 LLM 抽取。
// 支持 resumeFromExisting：第二轮（fact_verification 触发）只读取未出现在 evidenceStore 的 URL。

import { rankReadTargets } from '../read-target-ranker'
import { buildSearchResultLookup } from '../runtime/query-plan'
import { runWebReaderBatch } from '../runtime/reader-batch'
import { processDeepReadBatchResults } from '../runtime/deep-read-processor'
import { RESEARCH_READER_BATCH_SIZE } from '../runtime/batch-utils'
import { shouldContinueDeepReading, summarizeResearchCoverage } from '../runtime/coverage'
import { emitResearchStageEvent } from '../runtime/stage-events'
import { normalizeComparableUrl } from '../read-target-ranker'
import type {
  ResearchStage,
} from '../../../src/shared/research/research-types'
import type { ResearchSearchResultItem } from '../tools'
import type { ResearchStepContext } from '../runtime/context'

export const runDeepReadingStep = async (
  ctx: ResearchStepContext,
  input: {
    initialSearchResults: ResearchSearchResultItem[]
    targetedSearchResults: ResearchSearchResultItem[]
    stage?: Extract<ResearchStage, 'deep_reading' | 'fact_verification'>
    resumeFromExisting?: boolean
    callIdPrefix?: string
  },
) => {
  const stage = input.stage || 'deep_reading'
  const ranked = rankReadTargets(
    ctx.snapshot.seedUrls,
    input.initialSearchResults,
    input.targetedSearchResults,
    ctx.snapshot.subject,
    ctx.snapshot.queryAnchors || [],
    ctx.snapshot.researchMode,
    ctx.snapshot.primaryFrame,
    ctx.config.maxSources,
  )

  // 第二轮可选：剔除已读过的 URL，避免重复消耗 reader/LLM。
  let rankedResults = ranked
  if (input.resumeFromExisting) {
    const visitedUrls = new Set(
      ctx.evidenceStore.listEvidence()
        .map(item => normalizeComparableUrl(item.source?.url || ''))
        .filter(Boolean),
    )
    rankedResults = ranked.filter(item => !visitedUrls.has(normalizeComparableUrl(item.url)))
  }

  if (!rankedResults.length) {
    return
  }

  const rankedResultLookup = buildSearchResultLookup(rankedResults)

  emitResearchStageEvent(ctx.task.recordId, stage, ctx.executor)
  const callIdPrefix = input.callIdPrefix || 'reader'
  const deepReadTargets = rankedResults.map((item, index) => ({
    callId: `${callIdPrefix}-${index + 1}`,
    url: item.url,
    title: item.title,
    stage,
    snippet: item.snippet,
    siteName: item.siteName,
    siteIcon: item.siteIcon,
    query: item.query,
    referenceIndex: item.referenceIndex,
    batchIndex: index + 1,
  }))

  let nextReadTargetIndex = 0
  const initialReadTargetCount = Math.min(deepReadTargets.length, 6)
  while (nextReadTargetIndex < deepReadTargets.length) {
    const isInitialBatch = nextReadTargetIndex === 0
    const nextBatchSize = isInitialBatch
      ? initialReadTargetCount
      : Math.min(RESEARCH_READER_BATCH_SIZE, deepReadTargets.length - nextReadTargetIndex)
    const batchTargets = deepReadTargets.slice(nextReadTargetIndex, nextReadTargetIndex + nextBatchSize)
    if (!batchTargets.length) {
      break
    }

    if (!isInitialBatch) {
      const coverage = summarizeResearchCoverage(ctx.evidenceStore)
      ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
        type: 'stage_changed',
        recordId: ctx.task.recordId,
        done: false,
        stopped: false,
        stage,
        message: `当前证据仍不足，继续补读第 ${batchTargets[0].batchIndex}-${batchTargets[batchTargets.length - 1].batchIndex} 个页面`,
        researchStage: {
          stage,
          message: `已沉淀 ${coverage.externalEvidenceCount} 条外部证据 / ${coverage.factCount} 条事实，继续补齐来源覆盖`,
        },
      })
    }

    const readBatchResults = await runWebReaderBatch({
      recordId: ctx.task.recordId,
      targets: batchTargets,
      signal: ctx.task.abortController.signal,
      context: ctx.executor,
      toolCallMessage: (target) => `正在深度阅读：${target.title}`,
      toolResultMessage: (_target, readResult) => `网页阅读完成：${readResult.title}`,
    })

    await processDeepReadBatchResults({
      ctx,
      readBatchResults,
      rankedResultLookup,
      rankedResults,
    })

    nextReadTargetIndex += batchTargets.length
    if (!shouldContinueDeepReading(ctx.evidenceStore, deepReadTargets.length - nextReadTargetIndex)) {
      break
    }
  }
}
