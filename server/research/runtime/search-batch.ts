// 搜索 query 并发批处理。
// 每个 query 通过 tools.ts:runWebSearch（内部按 provider 路由到对应策略）执行，
// 把 search_sources 也写入 tool_result preview 给前端展示。

import { runWebSearch, waitResearchToolGap, type ResearchSearchResultItem } from '../tools'
import { dedupeSearchResults } from '../read-target-ranker'
import { RESEARCH_SEARCH_BATCH_SIZE, chunkQueryPlans } from './batch-utils'
import type {
  ResearchQueryPlan,
  ResearchStage,
} from '../../../src/shared/research/research-types'
import type { ResearchStepContext, ResearchSearchRuntimeConfig } from './context'

type SearchPreviewSource = {
  title: string
  url: string
  snippet: string
  siteName: string
  siteIcon?: string
  publishedTime?: string
  datePublished?: string
  referenceIndex?: number
}

const buildSearchPreviewSources = (results: ResearchSearchResultItem[], limit = 12) => {
  const sourceMap = new Map<string, SearchPreviewSource>()

  const addSource = (source: Partial<ResearchSearchResultItem> & SearchPreviewSource) => {
    const url = String(source.url || '').trim()
    const title = String(source.title || url || '').trim()
    if (!url || !title || sourceMap.has(url)) {
      return
    }

    sourceMap.set(url, {
      title,
      url,
      snippet: String(source.snippet || '').trim(),
      siteName: String(source.siteName || '').trim(),
      siteIcon: String(source.siteIcon || '').trim(),
      publishedTime: String(source.publishedTime || source.datePublished || '').trim(),
      datePublished: String(source.datePublished || source.publishedTime || '').trim(),
      referenceIndex: typeof source.referenceIndex === 'number' ? source.referenceIndex : undefined,
    })
  }

  for (const item of results) {
    addSource(item as SearchPreviewSource)
    for (const source of item.searchSources || []) {
      addSource(source as SearchPreviewSource)
    }
  }

  return Array.from(sourceMap.values()).slice(0, limit)
}

export const buildSearchToolPreview = (
  query: string,
  provider: string,
  results: ResearchSearchResultItem[],
  diagnostics?: Record<string, unknown>,
) => ({
  query,
  provider: provider || 'auto',
  resultCount: results.length,
  topResults: buildSearchPreviewSources(results, 3),
  searchSourcesPreview: buildSearchPreviewSources(results, 12),
  ...(diagnostics ? { diagnostics } : {}),
})

export const readResearchSearchRuntimeConfig = (
  requestBody?: Record<string, unknown> | null,
): ResearchSearchRuntimeConfig => {
  const body = requestBody && typeof requestBody === 'object' ? requestBody : {}
  return {
    provider: String(body.researchSearchProvider || 'grok2api').trim() || 'grok2api',
    providerId: String(body.researchSearchProviderId || '').trim(),
    model: String(body.researchSearchModel || '').trim(),
  }
}

const buildEmptySearchDiagnostics = (runtime: ResearchSearchRuntimeConfig) => {
  return {
    reason: '搜索上游未返回可用链接，无法进入深度阅读',
    provider: runtime.provider || 'auto',
    providerIdConfigured: Boolean(runtime.providerId),
    modelConfigured: Boolean(runtime.model),
  }
}

const createSearchProviderErrorLogger = (
  ctx: ResearchStepContext,
  query: string,
) => {
  const reportedProviders = new Set<string>()
  return (input: { provider: string, error: unknown }) => {
    const provider = String(input.provider || 'auto').trim() || 'auto'
    if (reportedProviders.has(provider)) {
      return
    }
    reportedProviders.add(provider)
    ctx.executor.logGenerationTask('research_search:provider_error', {
      recordId: ctx.task.recordId,
      query,
      provider,
      errorMessage: input.error instanceof Error ? input.error.message : String(input.error || ''),
    })
  }
}

export const runSearchQueryBatch = async (input: {
  ctx: ResearchStepContext
  stage: Extract<ResearchStage, 'parallel_search' | 'targeted_search' | 'fact_verification'>
  queryPlans: ResearchQueryPlan[]
  callIdPrefix: string
}) => {
  const { ctx } = input
  const queryPlanChunks = chunkQueryPlans(input.queryPlans, RESEARCH_SEARCH_BATCH_SIZE)
  const resultItems: ResearchSearchResultItem[] = []
  const searchRuntime = ctx.searchRuntime

  for (const [chunkIndex, chunk] of queryPlanChunks.entries()) {
    for (const [index, queryPlan] of chunk.entries()) {
      const callId = `${input.callIdPrefix}-${chunkIndex * RESEARCH_SEARCH_BATCH_SIZE + index + 1}`
      ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
        type: 'tool_call',
        recordId: ctx.task.recordId,
        done: false,
        stopped: false,
        stage: input.stage,
        message: `正在执行搜索：${queryPlan.query}`,
        toolCall: {
          id: callId,
          toolName: 'web-search',
          parameters: {
            query: queryPlan.query,
            count: ctx.config.maxSources,
          },
        },
      })
    }

    const settled = await Promise.all(chunk.map(async (queryPlan, index) => {
      const callId = `${input.callIdPrefix}-${chunkIndex * RESEARCH_SEARCH_BATCH_SIZE + index + 1}`
      const results = (await runWebSearch({
        query: queryPlan.query,
        count: Math.min(ctx.config.maxSources, 8),
        signal: ctx.task.abortController.signal,
        provider: searchRuntime.provider,
        providerId: searchRuntime.providerId,
        model: searchRuntime.model,
        onProviderError: createSearchProviderErrorLogger(ctx, queryPlan.query),
        onUsage: (usage) => ctx.usageAccumulator.add(usage),
      })).map(item => ({
        ...item,
        query: queryPlan.query,
      }))

      return {
        callId,
        queryPlan,
        results,
      }
    }))

    for (const item of settled) {
      if (!item.results.length) {
        ctx.executor.logGenerationTask('research_search:no_results', {
          recordId: ctx.task.recordId,
          query: item.queryPlan.query,
          ...buildEmptySearchDiagnostics(searchRuntime),
        })
      }

      resultItems.push(...item.results)
      ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
        type: 'tool_result',
        recordId: ctx.task.recordId,
        done: false,
        stopped: false,
        stage: input.stage,
        message: `搜索完成：${item.queryPlan.query}`,
        toolResult: {
          id: item.callId,
          toolName: 'web-search',
          preview: buildSearchToolPreview(
            item.queryPlan.query,
            searchRuntime.provider,
            item.results,
            item.results.length ? undefined : buildEmptySearchDiagnostics(searchRuntime),
          ),
        },
      })
    }

    await waitResearchToolGap(ctx.task.abortController.signal)
  }

  return dedupeSearchResults(resultItems)
}
