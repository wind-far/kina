import type { GenerationRecordPayload } from '../generation-records/shared'
import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from '../generation-tasks/shared'
import { ResearchEvidenceStore } from './evidence-store'
import {
  buildResearchPlan,
  buildResearchPlanSnapshot,
  isWorkspaceProjectResearchPrompt,
  resolveResearchSubject,
} from './planner'
import {
  buildResearchReportSections,
  finalReviewResearchReport,
  writeResearchSectionWithModel,
} from './report-writer'
import { buildResearchSectionDelta } from './report-section-format'
import { RESEARCH_STAGE_LABELS } from './constants'
import {
  runWebReader,
  runWebSearch,
  waitResearchToolGap,
  type ResearchSearchResultItem,
} from './tools'
import { dedupeSearchResults, normalizeComparableUrl, rankReadTargets } from './read-target-ranker'
import { verifyResearchEvidence } from './verifier'
import { runResearchStageModel } from './model-runner'
import { buildResearchIntakeSystemPrompt, buildResearchIntakeUserPrompt } from './prompts/intake'
import {
  buildResearchInitialAnalysisSystemPrompt,
  buildResearchInitialAnalysisUserPrompt,
} from './prompts/initial-analysis'
import {
  buildResearchGapDetectionSystemPrompt,
  buildResearchGapDetectionUserPrompt,
} from './prompts/gap-detection'
import { buildResearchDeepReadingSystemPrompt, buildResearchDeepReadingUserPrompt } from './prompts/deep-reading'
import { buildResearchVerificationSystemPrompt, buildResearchVerificationUserPrompt } from './prompts/verification'
import {
  buildResearchReportPlanningSystemPrompt,
  buildResearchReportPlanningUserPrompt,
} from './prompts/report-planning'
import {
  buildResearchPreWritingGateSystemPrompt,
  buildResearchPreWritingGateUserPrompt,
} from './prompts/pre-writing-gate'
import type {
  ResearchEvidence,
  ResearchFact,
  ResearchFactNature,
  ResearchOutlineSection,
  ResearchQueryPlan,
  ResearchStage,
  ResearchVerificationResult,
} from '../../src/shared/research/research-types'

type ResearchExecutionTask = {
  recordId: string
  userId: string
  abortController: AbortController
}

interface ResearchTaskExecutorContext {
  syncSharedTaskRuntime: (task: ResearchExecutionTask, status: 'running' | 'completed') => Promise<void>
  ensureTaskNotAborted: (task: ResearchExecutionTask) => Promise<void>
  buildInitialRecordPayload: (payload: GenerationTaskStartPayload) => GenerationRecordPayload
  updateGenerationRecord: (recordId: string, payload: GenerationRecordPayload, currentUserId: string) => Promise<void>
  getGenerationRecordById: (recordId: string, currentUserId: string) => Promise<Record<string, unknown>>
  emitTaskStreamEvent: (recordId: string, event: GenerationTaskStreamEvent) => void
  emitTaskProgressEvent: (recordId: string, input: {
    stage: string
    stopped?: boolean
    message?: string
  }) => void
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
}

const buildSeedEvidence = (prompt: string, subject: string): ResearchEvidence[] => {
  const evidences: ResearchEvidence[] = [
    {
      id: 'evidence-user-goal',
      title: '用户目标输入',
      summary: '已明确当前任务属于深度研究任务，需要结构化搜索、阅读、核查与报告输出。',
      source: {
        title: '用户输入',
        sourceType: 'user-input',
        note: `研究主题围绕 ${subject}`,
      },
      confidence: 'high',
      tags: ['任务定义', '需求边界'],
      entityMatched: true,
      authorityHints: ['用户直接提出的研究需求'],
      freshnessSignals: [],
      extractedFacts: ['任务目标是输出接近 http_raw5.txt 的研究工作流结果'],
      extractedClaims: [],
      extractedNumbers: [],
      contradictions: [],
    },
  ]

  if (isWorkspaceProjectResearchPrompt(prompt)) {
    evidences.push({
      id: 'evidence-architecture',
      title: '项目任务系统基础设施',
      summary: '当前项目已具备 generation-tasks、SSE 订阅、记录持久化与任务停止机制，适合直接扩展研究策略。',
      source: {
        title: '当前仓库结构',
        sourceType: 'internal-plan',
      },
      confidence: 'high',
      tags: ['落地环境', '接入路径'],
      entityMatched: true,
      authorityHints: ['仓库现状可验证'],
      freshnessSignals: [],
      extractedFacts: ['研究任务可复用现有生成任务基础设施'],
      extractedClaims: [],
      extractedNumbers: [],
      contradictions: [],
    })
  }

  return evidences
}

const resolveSourceType = (url: string) => {
  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./i, '')
    } catch {
      return ''
    }
  })()

  if (!hostname) {
    return 'article' as const
  }
  if (
    hostname.includes('github.com')
    || hostname.includes('gitlab.com')
    || hostname.endsWith('.gov')
    || hostname.endsWith('.edu')
    || hostname.includes('docs.')
  ) {
    return 'official' as const
  }
  return 'search-result' as const
}

const VERIFICATION_QUERY_STOPWORDS = new Set([
  '当前',
  '项目',
  '支持',
  '采用',
  '使用',
  '提供',
  '包含',
  '基于',
  '具备',
  '已经',
  '实现',
  '用于',
  '以及',
  '相关',
  '能力',
  '模块',
  '功能',
  '系统',
  '平台',
  '工作流',
])

const normalizeSearchPhrase = (value: string) => {
  return String(value || '')
    .replace(/[“”"'`]/g, ' ')
    .replace(/[^\p{L}\p{N}\s@./:_+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const buildVerificationQueryFocus = (statement: string) => {
  const normalized = normalizeSearchPhrase(statement)
  if (!normalized) {
    return ''
  }

  const priorityTokens = Array.from(new Set(
    normalized.match(/[A-Za-z@][A-Za-z0-9./:_+-]*/g) || [],
  ))

  const tokens = normalized
    .split(/\s+/)
    .map(item => item.trim())
    .filter((item) => {
      if (!item || item.length < 2) {
        return false
      }
      if (VERIFICATION_QUERY_STOPWORDS.has(item)) {
        return false
      }
      return true
    })

  const merged = Array.from(new Set([...priorityTokens, ...tokens]))
  return merged.slice(0, 8).join(' ')
}

const emitResearchStageEvent = (
  recordId: string,
  stage: ResearchStage,
  context: ResearchTaskExecutorContext,
) => {
  context.emitTaskStreamEvent(recordId, {
    type: 'stage_changed',
    recordId,
    done: false,
    stopped: false,
    stage,
    message: RESEARCH_STAGE_LABELS[stage],
    researchStage: {
      stage,
      message: RESEARCH_STAGE_LABELS[stage],
    },
  })
}

const buildBlockedResearchContent = (input: {
  title: string
  intro: string
  searchResultCount: number
  externalEvidenceCount: number
  factCount: number
  readyFactCount: number
  unresolvedItems: string[]
  recommendations: string[]
}) => {
  const unresolvedSection = input.unresolvedItems.length
    ? [
        '### 当前未解决项',
        '',
        ...input.unresolvedItems.slice(0, 8).map(item => `- ${item}`),
        '',
      ]
    : []

  return [
    `## ${input.title}`,
    '',
    input.intro,
    '',
    '### 当前状态',
    '',
    `- 搜索结果：${input.searchResultCount} 条`,
    `- 外部可用信源：${input.externalEvidenceCount} 条`,
    `- 已抽取事实：${input.factCount} 条`,
    `- 可直接支撑写作的事实：${input.readyFactCount} 条`,
    '',
    ...unresolvedSection,
    '### 建议',
    '',
    ...input.recommendations.map(item => `- ${item}`),
  ].join('\n')
}

const emitReasoningSummary = (
  recordId: string,
  stage: ResearchStage,
  goal: string,
  known: string[],
  ambiguities: string[],
  gaps: string[],
  nextActions: string[],
  context: ResearchTaskExecutorContext,
  message: string,
) => {
  context.emitTaskStreamEvent(recordId, {
    type: 'reasoning_summary',
    recordId,
    done: false,
    stopped: false,
    stage,
    message,
    reasoningSummary: {
      stage,
      goal,
      known,
      ambiguities,
      gaps,
      nextActions,
    },
  })
}

const normalizeQueryPlanList = (items: unknown, fallback: ResearchQueryPlan[]) => {
  if (!Array.isArray(items)) {
    return fallback
  }

  const normalized = items.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      query: String(record.query || '').trim(),
      intent: String(record.intent || '补充研究信息').trim(),
      priority: Number.isFinite(Number(record.priority)) ? Number(record.priority) : index + 1,
    }
  }).filter((item) => item.query)

  return normalized.length ? normalized : fallback
}

const buildVerificationRepairQueries = (
  facts: ResearchFact[],
  evidenceStore: ResearchEvidenceStore,
  subject: string,
) => {
  const queries: ResearchQueryPlan[] = []
  const seen = new Set<string>()

  for (const fact of facts) {
    const statement = String(fact.statement || '').trim()
    if (!statement) {
      continue
    }
    const queryFocus = buildVerificationQueryFocus(statement) || normalizeSearchPhrase(statement).slice(0, 48)

    const evidences = evidenceStore.getEvidenceByIds(fact.supportedEvidenceIds)
    const sourceHints = Array.from(new Set(
      evidences
        .map((item) => item.source.sourceType === 'official' ? '' : item.source.title)
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    )).slice(0, 2)

    const subjectPrefix = subject.includes('/') ? '' : `${subject} `

    const queryCandidates = [
      `${subjectPrefix}${queryFocus} 官方`,
      `${subjectPrefix}${queryFocus} 文档`,
      `${subjectPrefix}${queryFocus} report`,
      `${subjectPrefix}${queryFocus} site:gov`,
      `${subjectPrefix}${queryFocus} site:edu`,
      sourceHints.length ? `${sourceHints.join(' ')} ${queryFocus}` : '',
    ]

    for (const candidate of queryCandidates) {
      const query = String(candidate || '').replace(/\s+/g, ' ').trim()
      if (!query || seen.has(query)) {
        continue
      }
      seen.add(query)
      queries.push({
        query,
        intent: `为弱事实补齐独立来源：${statement.slice(0, 48)}`,
        priority: queries.length + 1,
      })
      if (queries.length >= 4) {
        return queries
      }
    }
  }

  return queries
}

const buildSearchResultLookup = (results: ResearchSearchResultItem[]) => {
  const map = new Map<string, ResearchSearchResultItem>()
  for (const item of results) {
    const normalizedUrl = normalizeComparableUrl(item.url)
    if (normalizedUrl && !map.has(normalizedUrl)) {
      map.set(normalizedUrl, item)
    }
  }
  return map
}

const hasRepairEvidenceForUrl = (evidenceStore: ResearchEvidenceStore, url: string) => {
  const normalizedUrl = normalizeComparableUrl(url)
  if (!normalizedUrl) {
    return false
  }

  return evidenceStore.listEvidence().some((item) => normalizeComparableUrl(item.source.url || '') === normalizedUrl)
}

const looksLikeBlockedOrEmptyReadResult = (input: {
  title: string
  content: string
  contentLength?: number
}) => {
  const title = String(input.title || '').trim().toLowerCase()
  const content = String(input.content || '').trim()
  const normalizedContent = content.replace(/\s+/g, ' ').trim()
  const contentLength = typeof input.contentLength === 'number' ? input.contentLength : normalizedContent.length

  if (!normalizedContent || contentLength < 120) {
    return true
  }

  if (/^\{"_waf_/u.test(normalizedContent)) {
    return true
  }

  if (/^\{\{article\./u.test(normalizedContent) || normalizedContent.includes('{{custom_')) {
    return true
  }

  if (title === 'xueqiu.com' || title === 'www.binance.com') {
    return true
  }

  return false
}

const shouldKeepExtractedResearchFact = (statement: string, evidence?: ResearchEvidence) => {
  const normalized = String(statement || '').replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.length < 8) {
    return false
  }

  if (evidence?.topicAlignment === 'low' || evidence?.usableFor === '不建议入正文' || evidence?.pageRole === 'noisy') {
    return false
  }

  if (/第[一二三四五六七八九十\d]+篇|本文|下文|上文|关注公众号|点赞|收藏|转发|欢迎|教程|函数|公式|操作步骤/u.test(normalized)) {
    return false
  }

  if (/发布日期|发布时间|作者简介|来源链接|阅读原文/u.test(normalized)) {
    return false
  }

  return true
}

const inferResearchFactNature = (
  statement: string,
  sourceKind: 'fact' | 'claim',
  evidence?: ResearchEvidence,
): ResearchFactNature => {
  const normalized = String(statement || '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 'soft_claim'
  }

  if (sourceKind === 'claim') {
    return /载体|机制|逻辑|本质|视角|框架|体现|反映|表征|意味着|可视为|可以看作/u.test(normalized)
      ? 'framework_claim'
      : 'soft_claim'
  }

  if (
    (evidence?.extractedNumbers || []).length
    || (evidence?.freshnessSignals || []).length
    || /\d/.test(normalized)
    || /位于|发布于|成立于|共有|包括|增设|恢复|实施|达到|入选|公布|发布|上线/u.test(normalized)
  ) {
    return 'hard_fact'
  }

  if (/载体|机制|逻辑|本质|视角|框架|体现|反映|表征|象征|可概括为|可分为/u.test(normalized)) {
    return 'framework_claim'
  }

  return 'soft_claim'
}

const buildSearchPreviewSources = (results: ResearchSearchResultItem[], limit = 12) => {
  const sourceMap = new Map<string, {
    title: string
    url: string
    snippet: string
    siteName: string
    siteIcon?: string
    publishedTime?: string
    datePublished?: string
    referenceIndex?: number
  }>()

  const addSource = (source: Partial<ResearchSearchResultItem> & {
    title?: string
    url?: string
    snippet?: string
    siteName?: string
    siteIcon?: string
    publishedTime?: string
    datePublished?: string
    referenceIndex?: number
  }) => {
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
    addSource(item)
    for (const source of item.searchSources || []) {
      addSource(source)
    }
  }

  return Array.from(sourceMap.values()).slice(0, limit)
}

const buildSearchToolPreview = (
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

const readResearchSearchRuntimeConfig = (requestBody?: Record<string, unknown>) => {
  const body = requestBody && typeof requestBody === 'object' ? requestBody : {}
  return {
    provider: String(body.researchSearchProvider || 'grok2api').trim(),
    providerId: String(body.researchSearchProviderId || '').trim(),
    model: String(body.researchSearchModel || '').trim(),
  }
}

const buildEmptySearchDiagnostics = (requestBody?: Record<string, unknown>) => {
  const searchRuntime = readResearchSearchRuntimeConfig(requestBody)
  return {
    reason: '搜索上游未返回可用链接，无法进入深度阅读',
    provider: searchRuntime.provider || 'auto',
    providerIdConfigured: Boolean(searchRuntime.providerId),
    modelConfigured: Boolean(searchRuntime.model),
  }
}

const createSearchProviderErrorLogger = (
  recordId: string,
  query: string,
  context: ResearchTaskExecutorContext,
) => {
  const reportedProviders = new Set<string>()
  return (input: { provider: string, error: unknown }) => {
    const provider = String(input.provider || 'auto').trim() || 'auto'
    if (reportedProviders.has(provider)) {
      return
    }
    reportedProviders.add(provider)
    context.logGenerationTask('research_search:provider_error', {
      recordId,
      query,
      provider,
      errorMessage: input.error instanceof Error ? input.error.message : String(input.error || ''),
    })
  }
}

const RESEARCH_SEARCH_BATCH_SIZE = 4
const RESEARCH_READER_BATCH_SIZE = 4

const chunkQueryPlans = <T,>(items: T[], chunkSize: number) => {
  const result: T[][] = []
  const size = Math.max(1, chunkSize)
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

type ResearchReaderBatchTarget = {
  callId: string
  url: string
  title: string
  stage: ResearchStage
  snippet?: string
  siteName?: string
  siteIcon?: string
  query?: string
  referenceIndex?: number
  batchIndex?: number
  provider?: string
  searchSources?: ResearchSearchResultItem[]
}

type ResearchReaderBatchResult = {
  target: ResearchReaderBatchTarget
  readResult?: Awaited<ReturnType<typeof runWebReader>>
  error?: unknown
}

const runWebReaderBatch = async (input: {
  recordId: string
  targets: ResearchReaderBatchTarget[]
  signal: AbortSignal
  context: ResearchTaskExecutorContext
  toolCallMessage: (target: ResearchReaderBatchTarget) => string
  toolResultMessage: (target: ResearchReaderBatchTarget, readResult: Awaited<ReturnType<typeof runWebReader>>) => string
}) => {
  const targetChunks = chunkQueryPlans(input.targets, RESEARCH_READER_BATCH_SIZE)
  const settledResults: ResearchReaderBatchResult[] = []

  for (const chunk of targetChunks) {
    for (const target of chunk) {
      input.context.emitTaskStreamEvent(input.recordId, {
        type: 'tool_call',
        recordId: input.recordId,
        done: false,
        stopped: false,
        stage: target.stage,
        message: input.toolCallMessage(target),
        toolCall: {
          id: target.callId,
          toolName: 'web-reader',
          parameters: {
            url: target.url,
          },
        },
      })
    }

    const settledChunk = await Promise.all(chunk.map(async (target) => {
      try {
        const readResult = await runWebReader({
          url: target.url,
          signal: input.signal,
        })
        return {
          target,
          readResult,
        } satisfies ResearchReaderBatchResult
      } catch (error) {
        return {
          target,
          error,
        } satisfies ResearchReaderBatchResult
      }
    }))

    for (const item of settledChunk) {
      settledResults.push(item)
      if (!item.readResult) {
        input.context.logGenerationTask('research_reader:skip', {
          recordId: input.recordId,
          url: item.target.url,
          errorMessage: item.error instanceof Error ? item.error.message : String(item.error || ''),
        })
        continue
      }

      input.context.emitTaskStreamEvent(input.recordId, {
        type: 'tool_result',
        recordId: input.recordId,
        done: false,
        stopped: false,
        stage: item.target.stage,
        message: input.toolResultMessage(item.target, item.readResult),
        toolResult: {
          id: item.target.callId,
          toolName: 'web-reader',
          preview: {
            url: item.readResult.url,
            title: item.readResult.title,
            excerpt: item.readResult.excerpt,
            content: item.readResult.content.slice(0, 8000),
            siteName: item.target.siteName || (() => {
              try {
                return new URL(item.readResult.url).hostname.replace(/^www\./i, '')
              } catch {
                return ''
              }
            })(),
            siteIcon: item.target.siteIcon || '',
            query: item.target.query || '',
            referenceIndex: item.target.referenceIndex,
            contentLength: item.readResult.contentLength,
            redirected: item.readResult.redirected,
            contentType: item.readResult.contentType,
          },
        },
      })
    }

    await waitResearchToolGap(input.signal)
  }

  return settledResults
}

const runSearchQueryBatch = async (input: {
  recordId: string
  stage: 'parallel_search' | 'targeted_search' | 'fact_verification'
  queryPlans: ResearchQueryPlan[]
  callIdPrefix: string
  requestBody?: Record<string, unknown>
  config: {
    maxSources: number
  }
  signal: AbortSignal
  context: ResearchTaskExecutorContext
}) => {
  const searchRuntime = readResearchSearchRuntimeConfig(input.requestBody)
  const queryPlanChunks = chunkQueryPlans(input.queryPlans, RESEARCH_SEARCH_BATCH_SIZE)
  const resultItems: ResearchSearchResultItem[] = []

  for (const [chunkIndex, chunk] of queryPlanChunks.entries()) {
    for (const [index, queryPlan] of chunk.entries()) {
      const callId = `${input.callIdPrefix}-${chunkIndex * RESEARCH_SEARCH_BATCH_SIZE + index + 1}`
      input.context.emitTaskStreamEvent(input.recordId, {
        type: 'tool_call',
        recordId: input.recordId,
        done: false,
        stopped: false,
        stage: input.stage,
        message: `正在执行搜索：${queryPlan.query}`,
        toolCall: {
          id: callId,
          toolName: 'web-search',
          parameters: {
            query: queryPlan.query,
            count: input.config.maxSources,
          },
        },
      })
    }

    const settled = await Promise.all(chunk.map(async (queryPlan, index) => {
      const callId = `${input.callIdPrefix}-${chunkIndex * RESEARCH_SEARCH_BATCH_SIZE + index + 1}`
      const results = (await runWebSearch({
        query: queryPlan.query,
        count: Math.min(input.config.maxSources, 8),
        signal: input.signal,
        providerId: searchRuntime.providerId,
        model: searchRuntime.model,
        onProviderError: createSearchProviderErrorLogger(input.recordId, queryPlan.query, input.context),
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
        input.context.logGenerationTask('research_search:no_results', {
          recordId: input.recordId,
          query: item.queryPlan.query,
          ...buildEmptySearchDiagnostics(input.requestBody),
        })
      }

      resultItems.push(...item.results)
      input.context.emitTaskStreamEvent(input.recordId, {
        type: 'tool_result',
        recordId: input.recordId,
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
            item.results.length ? undefined : buildEmptySearchDiagnostics(input.requestBody),
          ),
        },
      })
    }

    await waitResearchToolGap(input.signal)
  }

  return dedupeSearchResults(resultItems)
}

const isExternalResearchEvidence = (evidence: ResearchEvidence) => {
  const sourceType = String(evidence.source?.sourceType || '').trim()
  return Boolean(evidence.source?.url)
    && sourceType !== 'user-input'
    && sourceType !== 'internal-plan'
    && evidence.entityMatched !== false
}

const collectSectionEvidence = (section: ResearchOutlineSection, evidences: ResearchEvidence[]) => {
  const sectionKey = `${section.title} ${section.objective} ${(section.keyQuestions || []).join(' ')}`
  const keywords = sectionKey
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  const matched = evidences.filter((item) => {
    const haystack = `${item.title} ${item.summary} ${(item.tags || []).join(' ')}`.toLowerCase()
    return keywords.some((keyword) => haystack.includes(keyword))
  })

  return matched.length ? matched : evidences.slice(0, 4)
}

const collectSectionFacts = (section: ResearchOutlineSection, facts: ResearchFact[]) => {
  const keywords = `${section.title} ${section.objective} ${(section.keyQuestions || []).join(' ')}`
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  const matched = facts.filter((item) => {
    const haystack = `${item.statement} ${(item.numbers || []).join(' ')} ${(item.timeRefs || []).join(' ')}`.toLowerCase()
    return keywords.some((keyword) => haystack.includes(keyword))
  })

  return matched.length ? matched : facts.slice(0, 6)
}

type VerificationPromptResult = {
  facts?: Array<{
    factId: string
    verificationStatus: 'passed' | 'partial' | 'conflict' | 'unverified'
    sourceDomainCount?: number
    numbers?: string[]
    timeRefs?: string[]
    uncertaintyNote?: string
  }>
  passedFactIds?: string[]
  weakFactIds?: string[]
  conflictFactIds?: string[]
  unresolvedItems?: string[]
}

export const executeResearchTaskFlow = async (
  task: ResearchExecutionTask,
  payload: GenerationTaskStartPayload,
  context: ResearchTaskExecutorContext,
) => {
  await context.syncSharedTaskRuntime(task, 'running')
  await context.ensureTaskNotAborted(task)

  const { config, snapshot } = buildResearchPlan({
    prompt: String(payload.prompt || ''),
    researchConfig: payload.researchConfig || null,
  })
  const modelKey = String(payload.modelKey || '').trim()
  const evidenceStore = new ResearchEvidenceStore()

  context.emitTaskProgressEvent(task.recordId, {
    stage: 'research_bootstrap',
    message: '研究任务已启动，正在构建初始研究框架',
  })

  context.emitTaskStreamEvent(task.recordId, {
    type: 'begin',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'intake',
    message: '研究任务开始',
    researchBegin: {
      taskId: task.recordId,
      outputType: config.outputType,
      title: `${snapshot.subject} 研究任务`,
      subject: snapshot.subject,
      status: 'running',
    },
  })

  emitResearchStageEvent(task.recordId, 'intake', context)
  const intakeResult = await runResearchStageModel<{
    subject?: string
    goal?: string
    deliverable?: 'report' | 'answer'
    researchMode?: 'open_topic' | 'entity_topic' | 'comparative_topic'
    primaryFrame?: '综合框架' | '文化历史' | '商业营销' | '数据方法'
    scopeDecision?: string
    fallbackStrategy?: string
    needsClarification?: boolean
    risks?: string[]
    ambiguities?: string[]
    known?: string[]
    nextActions?: string[]
  }>({
    payloadRequestBody: payload.requestBody,
    modelKey,
    systemPrompt: buildResearchIntakeSystemPrompt(),
    userPrompt: buildResearchIntakeUserPrompt({
      prompt: String(payload.prompt || ''),
      seedUrls: snapshot.seedUrls,
    }),
    signal: task.abortController.signal,
    stage: 'intake',
    logGenerationTask: context.logGenerationTask,
  })

  const resolvedSubject = resolveResearchSubject(
    String(payload.prompt || ''),
    String(intakeResult.subject || snapshot.subject).trim() || snapshot.subject,
  ) || snapshot.subject
  const resolvedGoal = String(intakeResult.goal || snapshot.goal).trim() || snapshot.goal
  const refreshedSnapshot = buildResearchPlanSnapshot({
    prompt: String(payload.prompt || ''),
    researchConfig: payload.researchConfig || null,
    subjectOverride: resolvedSubject,
    goalOverride: resolvedGoal,
    outputTypeOverride: intakeResult.deliverable === 'answer' ? 'answer' : snapshot.outputType,
  })
  snapshot.subject = refreshedSnapshot.subject
  snapshot.goal = refreshedSnapshot.goal
  snapshot.outputType = refreshedSnapshot.outputType
  snapshot.researchMode = intakeResult.researchMode || refreshedSnapshot.researchMode
  snapshot.primaryFrame = intakeResult.primaryFrame || refreshedSnapshot.primaryFrame
  snapshot.scopeDecision = String(intakeResult.scopeDecision || refreshedSnapshot.scopeDecision || '').trim() || refreshedSnapshot.scopeDecision
  snapshot.fallbackStrategy = String(intakeResult.fallbackStrategy || refreshedSnapshot.fallbackStrategy || '').trim() || refreshedSnapshot.fallbackStrategy
  snapshot.axes = refreshedSnapshot.axes
  snapshot.queryAnchors = refreshedSnapshot.queryAnchors
  snapshot.initialQueries = refreshedSnapshot.initialQueries
  snapshot.targetQueries = refreshedSnapshot.targetQueries
  snapshot.seedUrls = refreshedSnapshot.seedUrls
  snapshot.gaps = refreshedSnapshot.gaps
  snapshot.outline = refreshedSnapshot.outline
  snapshot.risks = Array.isArray(intakeResult.risks) ? intakeResult.risks.map(item => String(item || '').trim()).filter(Boolean) : []
  snapshot.ambiguities = Array.isArray(intakeResult.ambiguities) ? intakeResult.ambiguities.map(item => String(item || '').trim()).filter(Boolean) : snapshot.ambiguities

  emitReasoningSummary(
    task.recordId,
    'intake',
    resolvedGoal,
    Array.isArray(intakeResult.known)
      ? [
          ...intakeResult.known.map(item => String(item || '').trim()).filter(Boolean),
          snapshot.scopeDecision ? `默认研究边界：${snapshot.scopeDecision}` : '',
        ].filter(Boolean)
      : [`研究主体初步识别为 ${snapshot.subject}`],
    snapshot.ambiguities,
    snapshot.risks || [],
    Array.isArray(intakeResult.nextActions) ? intakeResult.nextActions.map(item => String(item || '').trim()).filter(Boolean) : ['生成首轮搜索计划'],
    context,
    '已完成任务理解',
  )

  for (const evidence of buildSeedEvidence(String(payload.prompt || ''), resolvedSubject)) {
    const saved = evidenceStore.addEvidence(evidence)
    if (saved) {
      context.emitTaskStreamEvent(task.recordId, {
        type: 'evidence_added',
        recordId: task.recordId,
        done: false,
        stopped: false,
        stage: 'intake',
        message: '已采纳基础研究证据',
        evidence: saved,
      })
    }
  }

  emitResearchStageEvent(task.recordId, 'bootstrap_planning', context)
  context.emitTaskStreamEvent(task.recordId, {
    type: 'tool_result',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'bootstrap_planning',
    message: '首轮查询计划已生成',
    toolResult: {
      id: 'plan-search-1',
      toolName: 'web-search',
      preview: {
        subject: snapshot.subject,
        axes: snapshot.axes,
        queries: snapshot.initialQueries,
        targetQueries: snapshot.targetQueries,
      },
    },
  })

  emitResearchStageEvent(task.recordId, 'parallel_search', context)
  const initialSearchQueries = snapshot.initialQueries.slice(0, config.maxQueriesPerRound)
  const initialSearchResults = await runSearchQueryBatch({
    recordId: task.recordId,
    stage: 'parallel_search',
    queryPlans: initialSearchQueries,
    callIdPrefix: 'search-initial',
    requestBody: payload.requestBody,
    config: {
      maxSources: config.maxSources,
    },
    signal: task.abortController.signal,
    context,
  })

  emitResearchStageEvent(task.recordId, 'initial_analysis', context)
  const initialAnalysisResult = await runResearchStageModel<{
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
    payloadRequestBody: payload.requestBody,
    modelKey,
    systemPrompt: buildResearchInitialAnalysisSystemPrompt(),
    userPrompt: buildResearchInitialAnalysisUserPrompt({
      snapshot,
      searchPreview: initialSearchResults.slice(0, 10).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
      })),
      evidences: evidenceStore.listEvidence(),
      facts: evidenceStore.listFacts(),
    }),
    signal: task.abortController.signal,
    stage: 'initial_analysis',
    logGenerationTask: context.logGenerationTask,
  })

  const initialAnalysisKnown = Array.isArray(initialAnalysisResult.known)
    ? initialAnalysisResult.known.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const initialAnalysisAmbiguities = Array.isArray(initialAnalysisResult.ambiguities)
    ? initialAnalysisResult.ambiguities.map(item => String(item || '').trim()).filter(Boolean)
    : snapshot.ambiguities
  const initialAnalysisGaps = Array.isArray(initialAnalysisResult.gaps)
    ? initialAnalysisResult.gaps.map(item => String(item || '').trim()).filter(Boolean)
    : snapshot.gaps
  const initialAnalysisNextActions = Array.isArray(initialAnalysisResult.nextActions)
    ? initialAnalysisResult.nextActions.map(item => String(item || '').trim()).filter(Boolean)
    : ['执行缺口检测', '判断是否补搜']
  const resultQuality = String(initialAnalysisResult.resultQuality || '').trim()
  const dominantSourcePattern = String(initialAnalysisResult.dominantSourcePattern || '').trim()
  const courseCorrectionReason = String(initialAnalysisResult.courseCorrectionReason || '').trim()

  snapshot.ambiguities = initialAnalysisAmbiguities
  snapshot.gaps = initialAnalysisGaps

  emitReasoningSummary(
    task.recordId,
    'initial_analysis',
    resolvedGoal,
    [
      `首轮共收集 ${initialSearchResults.length} 条候选结果`,
      resultQuality ? `当前结果质量判断：${resultQuality}` : '',
      dominantSourcePattern ? `结果结构特征：${dominantSourcePattern}` : '',
      ...initialAnalysisKnown,
      initialAnalysisResult.needsCourseCorrection && courseCorrectionReason
        ? `需要纠偏：${courseCorrectionReason}`
        : '',
    ].filter(Boolean),
    initialAnalysisAmbiguities,
    initialAnalysisGaps,
    initialAnalysisNextActions,
    context,
    '首轮搜索结果已完成中场复盘',
  )

  emitResearchStageEvent(task.recordId, 'gap_detection', context)
  const gapResult = await runResearchStageModel<{
    coverage?: Record<string, number>
    gaps?: string[]
    targetQueries?: ResearchQueryPlan[]
    nextAction?: 'targeted_search' | 'deep_reading' | 'report_planning'
    known?: string[]
    ambiguities?: string[]
    nextActions?: string[]
  }>({
    payloadRequestBody: payload.requestBody,
    modelKey,
    systemPrompt: buildResearchGapDetectionSystemPrompt(),
    userPrompt: buildResearchGapDetectionUserPrompt({
      snapshot,
      searchPreview: initialSearchResults.slice(0, 8).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
      })),
      evidences: evidenceStore.listEvidence(),
      facts: evidenceStore.listFacts(),
    }),
    signal: task.abortController.signal,
    stage: 'gap_detection',
    logGenerationTask: context.logGenerationTask,
  })

  const targetedSearchQueries = normalizeQueryPlanList(gapResult.targetQueries, snapshot.targetQueries)
    .slice(0, Math.max(2, config.maxQueriesPerRound - 1))
  const gapItems = Array.isArray(gapResult.gaps) ? gapResult.gaps.map(item => String(item || '').trim()).filter(Boolean) : snapshot.gaps

  emitReasoningSummary(
    task.recordId,
    'gap_detection',
    resolvedGoal,
    Array.isArray(gapResult.known) ? gapResult.known.map(item => String(item || '').trim()).filter(Boolean) : [`当前已沉淀 ${evidenceStore.getCoverageSummary().evidenceCount} 条证据`],
    Array.isArray(gapResult.ambiguities) ? gapResult.ambiguities.map(item => String(item || '').trim()).filter(Boolean) : snapshot.ambiguities,
    gapItems,
    Array.isArray(gapResult.nextActions) ? gapResult.nextActions.map(item => String(item || '').trim()).filter(Boolean) : ['执行定向补搜'],
    context,
    '已识别当前研究缺口',
  )

  let targetedSearchResults: ResearchSearchResultItem[] = []
  if (gapResult.nextAction !== 'report_planning') {
    emitResearchStageEvent(task.recordId, 'targeted_search', context)
    targetedSearchResults = await runSearchQueryBatch({
      recordId: task.recordId,
      stage: 'targeted_search',
      queryPlans: targetedSearchQueries,
      callIdPrefix: 'search-targeted',
      requestBody: payload.requestBody,
      config: {
        maxSources: config.maxSources,
      },
      signal: task.abortController.signal,
      context,
    })
  }

  const rankedResults = rankReadTargets(
    snapshot.seedUrls,
    initialSearchResults,
    targetedSearchResults,
    snapshot.subject,
    snapshot.queryAnchors || [],
    snapshot.researchMode,
    snapshot.primaryFrame,
    config.maxSources,
  )
  const rankedResultLookup = buildSearchResultLookup(rankedResults)

  emitResearchStageEvent(task.recordId, 'deep_reading', context)
  const readTargets = rankedResults.slice(0, Math.min(rankedResults.length, 6))
  const readBatchResults = await runWebReaderBatch({
    recordId: task.recordId,
    targets: readTargets.map((item, index) => ({
      callId: `reader-${index + 1}`,
      url: item.url,
      title: item.title,
      stage: 'deep_reading',
      snippet: item.snippet,
      siteName: item.siteName,
      siteIcon: item.siteIcon,
      query: item.query,
      referenceIndex: item.referenceIndex,
      batchIndex: index + 1,
    })),
    signal: task.abortController.signal,
    context,
    toolCallMessage: (target) => `正在深度阅读：${target.title}`,
    toolResultMessage: (_target, readResult) => `网页阅读完成：${readResult.title}`,
  })

  for (const item of readBatchResults) {
    await context.ensureTaskNotAborted(task)
    if (!item.readResult) {
      continue
    }
    const readResult = item.readResult
    const target = item.target
    const currentIndex = target.batchIndex || 1

    context.emitTaskStreamEvent(task.recordId, {
      type: 'stage_changed',
      recordId: task.recordId,
      done: false,
      stopped: false,
      stage: 'deep_reading',
      message: `正在分析第 ${currentIndex}/${readBatchResults.length} 个页面`,
      researchStage: {
        stage: 'deep_reading',
        message: `正在分析第 ${currentIndex}/${readBatchResults.length} 个页面`,
      },
    })

    try {
      const deepReadResult = await runResearchStageModel<{
        entityMatched?: boolean
        pageRole?: 'framework' | 'evidence' | 'case' | 'opinion' | 'tool_tutorial' | 'noisy'
        topicAlignment?: 'high' | 'medium' | 'low'
        usableFor?: '主论证' | '补充案例' | '风险提示' | '不建议入正文'
        scopeWarning?: string
        summary?: string
        extractedFacts?: string[]
        extractedClaims?: string[]
        extractedNumbers?: string[]
        contradictions?: string[]
        freshnessSignals?: string[]
        authorityHints?: string[]
      }>({
        payloadRequestBody: payload.requestBody,
        modelKey,
        systemPrompt: buildResearchDeepReadingSystemPrompt(),
        userPrompt: buildResearchDeepReadingUserPrompt({
          subject: resolvedSubject,
          goal: resolvedGoal,
          url: readResult.url,
          title: readResult.title,
          content: readResult.content,
        }),
        signal: task.abortController.signal,
        stage: `deep_reading_${target.batchIndex || 1}`,
        logGenerationTask: context.logGenerationTask,
      })

      const evidence = evidenceStore.addEvidence({
        id: `evidence-read-${target.batchIndex || 1}`,
        title: readResult.title,
        summary: String(deepReadResult.summary || readResult.excerpt || target.snippet || '已完成网页阅读').trim(),
        source: {
          title: readResult.title,
          url: readResult.url,
          sourceType: resolveSourceType(readResult.url),
          note: target.siteName || undefined,
        },
        tags: ['网页深读', resolvedSubject],
        entityMatched: deepReadResult.entityMatched !== false,
        pageRole: deepReadResult.pageRole,
        topicAlignment: deepReadResult.topicAlignment,
        usableFor: deepReadResult.usableFor,
        scopeWarning: String(deepReadResult.scopeWarning || '').trim() || undefined,
        authorityHints: Array.isArray(deepReadResult.authorityHints) ? deepReadResult.authorityHints.map(item => String(item || '').trim()).filter(Boolean) : [],
        freshnessSignals: Array.isArray(deepReadResult.freshnessSignals) ? deepReadResult.freshnessSignals.map(item => String(item || '').trim()).filter(Boolean) : [],
        extractedFacts: Array.isArray(deepReadResult.extractedFacts) ? deepReadResult.extractedFacts.map(item => String(item || '').trim()).filter(Boolean) : [],
        extractedClaims: Array.isArray(deepReadResult.extractedClaims) ? deepReadResult.extractedClaims.map(item => String(item || '').trim()).filter(Boolean) : [],
        extractedNumbers: Array.isArray(deepReadResult.extractedNumbers) ? deepReadResult.extractedNumbers.map(item => String(item || '').trim()).filter(Boolean) : [],
        contradictions: Array.isArray(deepReadResult.contradictions) ? deepReadResult.contradictions.map(item => String(item || '').trim()).filter(Boolean) : [],
        discovery: (() => {
          const matchedSearchResult = rankedResultLookup.get(normalizeComparableUrl(readResult.url))
            || rankedResultLookup.get(normalizeComparableUrl(target.url))
          return matchedSearchResult
            ? {
              query: matchedSearchResult.query || '',
              provider: matchedSearchResult.provider || String((payload.requestBody || {}).researchSearchProvider || '').trim() || 'auto',
              rank: rankedResults.findIndex(result => normalizeComparableUrl(result.url) === normalizeComparableUrl(matchedSearchResult.url)) + 1,
              searchSources: matchedSearchResult.searchSources || [],
            }
            : undefined
        })(),
      })

      if (!evidence || evidence.entityMatched === false) {
        continue
      }

      context.emitTaskStreamEvent(task.recordId, {
        type: 'evidence_added',
        recordId: task.recordId,
        done: false,
        stopped: false,
        stage: 'evidence_merge',
        message: '已采纳新的网页证据',
        evidence,
      })

      const factCandidates = [
        ...(evidence.extractedFacts || []).map(statement => ({
          statement,
          sourceKind: 'fact' as const,
        })),
        ...(evidence.extractedClaims || []).map(statement => ({
          statement,
          sourceKind: 'claim' as const,
        })),
      ].filter(item => shouldKeepExtractedResearchFact(item.statement, evidence)).slice(0, 3)

      for (const [factIndex, item] of factCandidates.entries()) {
        const statement = String(item.statement || '').trim()
        const fact = evidenceStore.addFact({
          id: `fact-read-${target.batchIndex || 1}-${factIndex + 1}`,
          statement,
          confidence: evidence.confidence,
          supportedEvidenceIds: [evidence.id],
          factType: item.sourceKind === 'fact' ? 'fact' : 'claim',
          factNature: inferResearchFactNature(statement, item.sourceKind, evidence),
          numbers: evidence.extractedNumbers || [],
          timeRefs: evidence.freshnessSignals || [],
          verificationStatus: 'unverified',
        })
        context.emitTaskStreamEvent(task.recordId, {
          type: 'fact_update',
          recordId: task.recordId,
          done: false,
          stopped: false,
          stage: 'evidence_merge',
          message: '已更新研究事实',
          fact,
        })
      }
    } catch (error) {
      context.logGenerationTask('research_reader:skip', {
        recordId: task.recordId,
        url: target.url,
        errorMessage: error instanceof Error ? error.message : String(error || ''),
      })
    }
  }

  emitResearchStageEvent(task.recordId, 'fact_verification', context)
  let verificationPromptResult: VerificationPromptResult = {}
  try {
    verificationPromptResult = await runResearchStageModel<VerificationPromptResult>({
      payloadRequestBody: payload.requestBody,
      modelKey,
      systemPrompt: buildResearchVerificationSystemPrompt(),
      userPrompt: buildResearchVerificationUserPrompt({
        subject: resolvedSubject,
        evidences: evidenceStore.listEvidence(),
        facts: evidenceStore.listFacts(),
      }),
      signal: task.abortController.signal,
      stage: 'fact_verification',
      logGenerationTask: context.logGenerationTask,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error || '')
    context.logGenerationTask('research_verification:model_fallback', {
      recordId: task.recordId,
      errorMessage,
    })
    verificationPromptResult = {
      unresolvedItems: [
        `模型核查阶段暂时不可用，已降级为本地证据规则核查：${errorMessage}`,
      ],
    }
  }

  if (Array.isArray(verificationPromptResult.facts)) {
    for (const item of verificationPromptResult.facts) {
      evidenceStore.updateFact(String(item.factId || '').trim(), (current) => ({
        ...current,
        verificationStatus: item.verificationStatus || current.verificationStatus,
        sourceDomainCount: Number.isFinite(Number(item.sourceDomainCount)) ? Number(item.sourceDomainCount) : current.sourceDomainCount,
        numbers: Array.isArray(item.numbers) ? item.numbers.map(value => String(value || '').trim()).filter(Boolean) : current.numbers,
        timeRefs: Array.isArray(item.timeRefs) ? item.timeRefs.map(value => String(value || '').trim()).filter(Boolean) : current.timeRefs,
        uncertaintyNote: String(item.uncertaintyNote || '').trim() || current.uncertaintyNote,
      }))
    }
  }

  const verification = verifyResearchEvidence(evidenceStore)
  const verificationWithPrompt: ResearchVerificationResult = {
    ...verification,
    unresolvedItems: Array.from(new Set([
      ...verification.unresolvedItems,
      ...(Array.isArray(verificationPromptResult.unresolvedItems)
        ? verificationPromptResult.unresolvedItems.map(item => String(item || '').trim()).filter(Boolean)
        : []),
      ])),
  }

  const attemptedRepairQueries = new Set<string>()
  if (verificationWithPrompt.weakFacts.length >= 2 || verificationWithPrompt.verdict === 'blocked') {
    for (let repairRound = 0; repairRound < config.maxSearchRounds; repairRound += 1) {
      const candidateRepairQueries = buildVerificationRepairQueries(
        verificationWithPrompt.weakFacts.slice(0, Math.max(3, config.maxQueriesPerRound)),
        evidenceStore,
        resolvedSubject,
      )
      const repairQueries = candidateRepairQueries
        .filter((item) => !attemptedRepairQueries.has(item.query))
        .slice(0, config.maxQueriesPerRound)

      if (!repairQueries.length) {
        break
      }
      for (const queryPlan of repairQueries) {
        attemptedRepairQueries.add(queryPlan.query)
      }

      emitResearchStageEvent(task.recordId, 'targeted_search', context)
      emitReasoningSummary(
        task.recordId,
        'targeted_search',
        resolvedGoal,
        [
          `当前已完成第 ${repairRound + 1} 轮补证搜索`,
          `仍有 ${verificationWithPrompt.weakFacts.length} 条弱事实待补强`,
        ],
        [],
        verificationWithPrompt.unresolvedItems.slice(0, 4),
        repairQueries.map(item => item.query),
        context,
        '证据仍不足，继续补搜',
      )

      const repairSearchResults = await runSearchQueryBatch({
        recordId: task.recordId,
        stage: 'fact_verification',
        queryPlans: repairQueries,
        callIdPrefix: `search-verify-r${repairRound + 1}`,
        requestBody: payload.requestBody,
        config: {
          maxSources: Math.min(config.maxSources, 6),
        },
        signal: task.abortController.signal,
        context,
      })

      const repairReadTargets = repairQueries.flatMap((queryPlan, index) => {
        const repairResults = repairSearchResults.filter((item) => item.query === queryPlan.query)
        const topRepairMatches = repairResults
          .filter((item) => item.url && !hasRepairEvidenceForUrl(evidenceStore, item.url))
          .slice(0, 2)

        return topRepairMatches.map((matched, matchIndex) => ({
          callId: `reader-verify-r${repairRound + 1}-${index + 1}-${matchIndex + 1}`,
          url: matched.url,
          title: matched.title,
          stage: 'deep_reading' as const,
          snippet: matched.snippet,
          siteName: matched.siteName,
          siteIcon: matched.siteIcon,
          query: queryPlan.query,
          referenceIndex: matched.referenceIndex,
          batchIndex: index + 1,
          provider: matched.provider || String((payload.requestBody || {}).researchSearchProvider || '').trim() || 'auto',
          searchSources: matched.searchSources || [],
        }))
      })

      const repairReadResults = await runWebReaderBatch({
        recordId: task.recordId,
        targets: repairReadTargets,
        signal: task.abortController.signal,
        context,
        toolCallMessage: (target) => `正在深度阅读补充信源：${target.title}`,
        toolResultMessage: (_target, readResult) => `网页阅读完成：${readResult.title}`,
      })

      for (const item of repairReadResults) {
        await context.ensureTaskNotAborted(task)
        if (!item.readResult) {
          continue
        }

        const readResult = item.readResult
        const target = item.target
        const matchTokens = String(target.callId).match(/reader-verify-r(\d+)-(\d+)-(\d+)$/)
        const queryIndex = matchTokens ? Number(matchTokens[2]) : (target.batchIndex || 1)
        const matchIndex = matchTokens ? Number(matchTokens[3]) : 1

        context.emitTaskStreamEvent(task.recordId, {
          type: 'stage_changed',
          recordId: task.recordId,
          done: false,
          stopped: false,
          stage: 'fact_verification',
          message: `正在分析补证页面 ${matchIndex}/${repairReadResults.length}（第 ${repairRound + 1} 轮）`,
          researchStage: {
            stage: 'fact_verification',
            message: `正在分析补证页面 ${matchIndex}/${repairReadResults.length}（第 ${repairRound + 1} 轮）`,
          },
        })

        try {
            if (looksLikeBlockedOrEmptyReadResult({
              title: readResult.title,
              content: readResult.content,
              contentLength: readResult.contentLength,
            })) {
              continue
            }

            const deepReadResult = await runResearchStageModel<{
              entityMatched?: boolean
              pageRole?: 'framework' | 'evidence' | 'case' | 'opinion' | 'tool_tutorial' | 'noisy'
              topicAlignment?: 'high' | 'medium' | 'low'
              usableFor?: '主论证' | '补充案例' | '风险提示' | '不建议入正文'
              scopeWarning?: string
              summary?: string
              extractedFacts?: string[]
              extractedClaims?: string[]
              extractedNumbers?: string[]
              contradictions?: string[]
              freshnessSignals?: string[]
              authorityHints?: string[]
            }>({
              payloadRequestBody: payload.requestBody,
              modelKey,
              systemPrompt: buildResearchDeepReadingSystemPrompt(),
              userPrompt: buildResearchDeepReadingUserPrompt({
                subject: resolvedSubject,
                goal: resolvedGoal,
                url: readResult.url,
                title: readResult.title,
                content: readResult.content,
              }),
              signal: task.abortController.signal,
              stage: `deep_reading_verify_${repairRound + 1}_${queryIndex}_${matchIndex}`,
              logGenerationTask: context.logGenerationTask,
            })

            const evidence = evidenceStore.addEvidence({
              id: `evidence-verify-read-${repairRound + 1}-${queryIndex}-${matchIndex}`,
              title: readResult.title,
              summary: String(deepReadResult.summary || readResult.excerpt || target.snippet || '已完成核查信源深读').trim(),
              source: {
                title: readResult.title,
                url: readResult.url,
                sourceType: resolveSourceType(readResult.url),
                note: target.siteName || undefined,
              },
              tags: ['核查深读', resolvedSubject],
              entityMatched: deepReadResult.entityMatched !== false,
              pageRole: deepReadResult.pageRole,
              topicAlignment: deepReadResult.topicAlignment,
              usableFor: deepReadResult.usableFor,
              scopeWarning: String(deepReadResult.scopeWarning || '').trim() || undefined,
              authorityHints: Array.isArray(deepReadResult.authorityHints) ? deepReadResult.authorityHints.map(item => String(item || '').trim()).filter(Boolean) : [],
              freshnessSignals: Array.isArray(deepReadResult.freshnessSignals) ? deepReadResult.freshnessSignals.map(item => String(item || '').trim()).filter(Boolean) : [],
              extractedFacts: Array.isArray(deepReadResult.extractedFacts) ? deepReadResult.extractedFacts.map(item => String(item || '').trim()).filter(Boolean) : [],
              extractedClaims: Array.isArray(deepReadResult.extractedClaims) ? deepReadResult.extractedClaims.map(item => String(item || '').trim()).filter(Boolean) : [],
              extractedNumbers: Array.isArray(deepReadResult.extractedNumbers) ? deepReadResult.extractedNumbers.map(item => String(item || '').trim()).filter(Boolean) : [],
              contradictions: Array.isArray(deepReadResult.contradictions) ? deepReadResult.contradictions.map(item => String(item || '').trim()).filter(Boolean) : [],
              discovery: {
                query: target.query || '',
                provider: target.provider || String((payload.requestBody || {}).researchSearchProvider || '').trim() || 'auto',
                rank: matchIndex,
                searchSources: target.searchSources || [],
              },
            })

            if (!evidence || evidence.entityMatched === false || evidence.pageRole === 'noisy' || evidence.usableFor === '不建议入正文') {
              continue
            }

            context.emitTaskStreamEvent(task.recordId, {
              type: 'evidence_added',
              recordId: task.recordId,
              done: false,
              stopped: false,
              stage: 'evidence_merge',
              message: '已补充并深读新的核查信源',
              evidence,
            })

            const factCandidates = [
              ...(evidence.extractedFacts || []).map(statement => ({
                statement,
                sourceKind: 'fact' as const,
              })),
              ...(evidence.extractedClaims || []).map(statement => ({
                statement,
                sourceKind: 'claim' as const,
              })),
            ].filter(item => shouldKeepExtractedResearchFact(item.statement, evidence)).slice(0, 3)

            for (const [factIndex, factItem] of factCandidates.entries()) {
              const statement = String(factItem.statement || '').trim()
              const fact = evidenceStore.addFact({
                id: `fact-verify-read-${repairRound + 1}-${queryIndex}-${matchIndex}-${factIndex + 1}`,
                statement,
                confidence: evidence.confidence,
                supportedEvidenceIds: [evidence.id],
                factType: factItem.sourceKind === 'fact' ? 'fact' : 'claim',
                factNature: inferResearchFactNature(statement, factItem.sourceKind, evidence),
                numbers: evidence.extractedNumbers || [],
                timeRefs: evidence.freshnessSignals || [],
                verificationStatus: 'unverified',
              })
              context.emitTaskStreamEvent(task.recordId, {
                type: 'fact_update',
                recordId: task.recordId,
                done: false,
                stopped: false,
                stage: 'evidence_merge',
                message: '已更新研究事实',
                fact,
              })
            }
          } catch (error) {
            context.logGenerationTask('research_reader:skip', {
              recordId: task.recordId,
              url: target.url,
              errorMessage: error instanceof Error ? error.message : String(error || ''),
            })
          }
      }

      const repairedVerification = verifyResearchEvidence(evidenceStore)
      verificationWithPrompt.verdict = repairedVerification.verdict
      verificationWithPrompt.checkedFacts = repairedVerification.checkedFacts
      verificationWithPrompt.passedFacts = repairedVerification.passedFacts
      verificationWithPrompt.weakFacts = repairedVerification.weakFacts
      verificationWithPrompt.conflictFacts = repairedVerification.conflictFacts
      verificationWithPrompt.unresolvedItems = Array.from(new Set([
        ...verificationWithPrompt.unresolvedItems,
        ...repairedVerification.unresolvedItems,
      ]))

      if (verificationWithPrompt.passedFacts.length >= 2 && verificationWithPrompt.weakFacts.length <= 1) {
        break
      }
    }
  }

  const verifiedAfterRepair = verifyResearchEvidence(evidenceStore)
  verificationWithPrompt.verdict = verifiedAfterRepair.verdict
  verificationWithPrompt.checkedFacts = verifiedAfterRepair.checkedFacts
  verificationWithPrompt.passedFacts = verifiedAfterRepair.passedFacts
  verificationWithPrompt.weakFacts = verifiedAfterRepair.weakFacts
  verificationWithPrompt.conflictFacts = verifiedAfterRepair.conflictFacts
  verificationWithPrompt.unresolvedItems = Array.from(new Set([
    ...verificationWithPrompt.unresolvedItems,
    ...verifiedAfterRepair.unresolvedItems,
  ]))

  const externalEvidenceCount = evidenceStore.listEvidence().filter(isExternalResearchEvidence).length
  const passedFactCount = verificationWithPrompt.passedFacts.length
  const readyFactCount = evidenceStore.listFacts().filter((fact) => (
    (
      fact.factNature === 'hard_fact'
      && fact.verificationStatus === 'passed'
    )
      || (
        fact.factNature === 'hard_fact'
        && (
        fact.verificationStatus === 'partial'
        && fact.sourceDomainCount !== undefined
        && fact.sourceDomainCount >= 2
        && !fact.uncertaintyNote
        )
      )
  )).length

  let preWritingGateResult: {
    allowReportWriting?: boolean
    confidence?: 'high' | 'medium' | 'low'
    reason?: string
    blockingIssues?: string[]
    readySignals?: string[]
    recommendedOutputMode?: 'full_report' | 'bounded_summary'
  } = {}
  try {
    preWritingGateResult = await runResearchStageModel<{
      allowReportWriting?: boolean
      confidence?: 'high' | 'medium' | 'low'
      reason?: string
      blockingIssues?: string[]
      readySignals?: string[]
      recommendedOutputMode?: 'full_report' | 'bounded_summary'
    }>({
      payloadRequestBody: payload.requestBody,
      modelKey,
      systemPrompt: buildResearchPreWritingGateSystemPrompt(),
      userPrompt: buildResearchPreWritingGateUserPrompt({
        subject: resolvedSubject,
        goal: resolvedGoal,
        evidences: evidenceStore.listEvidence(),
        facts: evidenceStore.listFacts(),
        verification: verificationWithPrompt,
      }),
      signal: task.abortController.signal,
      stage: 'report_planning',
      logGenerationTask: context.logGenerationTask,
    })
  } catch (error) {
    context.logGenerationTask('research_pre_writing_gate:fallback', {
      recordId: task.recordId,
      errorMessage: error instanceof Error ? error.message : String(error || ''),
    })
  }

  const gateReason = String(preWritingGateResult.reason || '').trim()
  const gateBlockingIssues = Array.isArray(preWritingGateResult.blockingIssues)
    ? preWritingGateResult.blockingIssues.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const gateReadySignals = Array.isArray(preWritingGateResult.readySignals)
    ? preWritingGateResult.readySignals.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const hasAnyUsableResearchMaterial = externalEvidenceCount > 0 && evidenceStore.listFacts().length > 0
  const shouldBlockReportWriting = !hasAnyUsableResearchMaterial
  const shouldUseCautiousWritingMode = (
    hasAnyUsableResearchMaterial
    && (
      passedFactCount <= 0
      || readyFactCount <= 0
      || preWritingGateResult.allowReportWriting === false
    )
  )

  verificationWithPrompt.unresolvedItems = Array.from(new Set([
    ...verificationWithPrompt.unresolvedItems,
    ...(gateReason ? [gateReason] : []),
    ...gateBlockingIssues,
  ]))

  if (shouldBlockReportWriting) {
    verificationWithPrompt.verdict = 'blocked'
    verificationWithPrompt.checkedFacts = evidenceStore.listFacts().length
    verificationWithPrompt.unresolvedItems = Array.from(new Set([
      ...verificationWithPrompt.unresolvedItems,
      `外部可用信源数为 ${externalEvidenceCount}，当前仍不足以启动正式写作`,
      `通过核查的事实数为 ${passedFactCount}，当前仍不足以启动正式写作`,
      `可直接支撑写作的事实数为 ${readyFactCount}，当前仍不足以启动正式写作`,
    ]))

    emitResearchStageEvent(task.recordId, 'final_review', context)
    context.emitTaskStreamEvent(task.recordId, {
      type: 'verification',
      recordId: task.recordId,
      done: false,
      stopped: false,
      stage: 'final_review',
      message: '外部证据不足，已停止报告生成',
      verification: verificationWithPrompt,
    })

    const blockedContent = buildBlockedResearchContent({
      title: preWritingGateResult.recommendedOutputMode === 'bounded_summary'
        ? '证据边界过强，已降级为边界化输出'
        : '证据不足，已停止报告生成',
      intro: preWritingGateResult.recommendedOutputMode === 'bounded_summary'
        ? '本次研究已形成初步框架，但核心判断仍主要依赖弱证据、单一来源或未充分核查内容，因此没有继续生成正式长报告。'
        : '本次研究没有获得足以支撑正式长报告的稳定证据，因此已停止报告生成。',
      searchResultCount: initialSearchResults.length + targetedSearchResults.length,
      externalEvidenceCount,
      factCount: evidenceStore.listFacts().length,
      readyFactCount,
      unresolvedItems: verificationWithPrompt.unresolvedItems,
      recommendations: [
        ...gateReadySignals.slice(0, 2).map(item => `保留已形成的有效认识：${item}`),
        '优先补充能直接支撑核心结论的独立来源，而不是继续堆积同类软判断',
        '检查 research-report 技能的 researchSearch 配置，确认已选择搜索供应商和模型',
        '确认搜索结果中的高价值候选页已进入深读，而不是停留在摘要页、列表页或壳页面',
        '在核心结论拿到更多 passed facts 后，再重新运行正式研究报告',
      ],
    })

    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      content: blockedContent,
      done: true,
      stopped: false,
      error: '',
    }, task.userId)

    const completedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.syncSharedTaskRuntime(task, 'completed')
    context.emitTaskStreamEvent(task.recordId, {
      type: 'completed',
      recordId: task.recordId,
      done: true,
      stopped: false,
      record: completedRecord,
      stage: 'completed',
      message: '研究证据不足，任务已结束',
    })
    context.logGenerationTask('research_task:blocked_insufficient_evidence', {
      recordId: task.recordId,
      userId: task.userId,
      externalEvidenceCount,
      factCount: evidenceStore.listFacts().length,
      passedFactCount,
      readyFactCount,
    })
    return
  }

  emitResearchStageEvent(task.recordId, 'report_planning', context)
  context.emitTaskStreamEvent(task.recordId, {
    type: 'tool_call',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'report_planning',
    message: shouldUseCautiousWritingMode
      ? '证据未达理想阈值，转入审慎写作模式并继续生成正式报告'
      : '证据已达到写作阈值，准备启动报告生成',
    toolCall: {
      id: 'start-report',
      toolName: 'start-report',
      parameters: {
        evidenceCount: evidenceStore.getCoverageSummary().evidenceCount,
        factCount: evidenceStore.getCoverageSummary().factCount,
        cautiousMode: shouldUseCautiousWritingMode,
      },
    },
  })

  const reportPlanningResult = await runResearchStageModel<{
    sections?: ResearchOutlineSection[]
  }>({
    payloadRequestBody: payload.requestBody,
    modelKey,
    systemPrompt: buildResearchReportPlanningSystemPrompt(),
    userPrompt: buildResearchReportPlanningUserPrompt({
      subject: resolvedSubject,
      goal: resolvedGoal,
      evidences: evidenceStore.listEvidence(),
      facts: evidenceStore.listFacts(),
      unresolvedItems: verificationWithPrompt.unresolvedItems,
    }),
    signal: task.abortController.signal,
    stage: 'report_planning',
    logGenerationTask: context.logGenerationTask,
  })

  const plannedSections = Array.isArray(reportPlanningResult.sections) && reportPlanningResult.sections.length
    ? reportPlanningResult.sections.map((item, index) => ({
      id: String(item.id || `section-${index + 1}`).trim() || `section-${index + 1}`,
      title: String(item.title || `章节 ${index + 1}`).trim() || `章节 ${index + 1}`,
      objective: String(item.objective || '').trim() || '补齐本章节研究内容',
      keyQuestions: Array.isArray(item.keyQuestions)
        ? item.keyQuestions.map(question => String(question || '').trim()).filter(Boolean)
        : [],
    }))
    : buildResearchReportSections({
      snapshot,
      evidences: evidenceStore.listEvidence(),
      facts: evidenceStore.listFacts(),
      verification: verificationWithPrompt,
    }).map((item) => item.section)

  context.emitTaskStreamEvent(task.recordId, {
    type: 'outline_ready',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'report_planning',
    message: '研究报告大纲已生成',
    outline: {
      sections: plannedSections,
    },
  })

  emitResearchStageEvent(task.recordId, 'report_writing', context)
  const fallbackSections = buildResearchReportSections({
    snapshot,
    evidences: evidenceStore.listEvidence(),
    facts: evidenceStore.listFacts(),
    verification: verificationWithPrompt,
  })
  const fallbackMap = new Map(fallbackSections.map((item) => [item.section.id, item.content]))

  let fullContent = ''
  for (const section of plannedSections) {
    await context.ensureTaskNotAborted(task)
    const sectionEvidences = collectSectionEvidence(section, evidenceStore.listEvidence())
    const sectionFacts = collectSectionFacts(section, evidenceStore.listFacts())
    let sectionBody = ''

    try {
      sectionBody = await writeResearchSectionWithModel({
        payloadRequestBody: payload.requestBody,
        modelKey,
        subject: resolvedSubject,
        goal: resolvedGoal,
        section,
        evidences: sectionEvidences,
        facts: sectionFacts,
        unresolvedItems: verificationWithPrompt.unresolvedItems,
        signal: task.abortController.signal,
        logGenerationTask: context.logGenerationTask,
      })
    } catch (error) {
      context.logGenerationTask('research_report:section_fallback', {
        recordId: task.recordId,
        sectionId: section.id,
        errorMessage: error instanceof Error ? error.message : String(error || ''),
      })
      sectionBody = fallbackMap.get(section.id) || section.objective
    }

    const delta = buildResearchSectionDelta(section, sectionBody)
    fullContent += delta

    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      content: fullContent,
      done: false,
      stopped: false,
      error: '',
    }, task.userId)

    context.emitTaskStreamEvent(task.recordId, {
      type: 'section_delta',
      recordId: task.recordId,
      done: false,
      stopped: false,
      stage: 'report_writing',
      message: `已生成章节：${section.title}`,
      sectionDelta: {
        sectionId: section.id,
        title: section.title,
        delta,
        content: delta,
      },
      content: delta,
    })
  }

  emitResearchStageEvent(task.recordId, 'final_review', context)
  let finalReport = fullContent
  let finalNotes: string[] = []
  try {
    const finalReviewResult = await finalReviewResearchReport({
      payloadRequestBody: payload.requestBody,
      modelKey,
      subject: resolvedSubject,
      report: fullContent,
      facts: evidenceStore.listFacts(),
      unresolvedItems: verificationWithPrompt.unresolvedItems,
      signal: task.abortController.signal,
      logGenerationTask: context.logGenerationTask,
    })
    finalReport = String(finalReviewResult.revisedReport || fullContent).trim() || fullContent
    finalNotes = Array.isArray(finalReviewResult.finalNotes)
      ? finalReviewResult.finalNotes.map(item => String(item || '').trim()).filter(Boolean)
      : []
    if (Array.isArray(finalReviewResult.issues) && finalReviewResult.issues.length) {
      verificationWithPrompt.unresolvedItems = Array.from(new Set([
        ...verificationWithPrompt.unresolvedItems,
        ...finalReviewResult.issues.map(item => String(item || '').trim()).filter(Boolean),
      ]))
    }
  } catch (error) {
    context.logGenerationTask('research_final_review:fallback', {
      recordId: task.recordId,
      errorMessage: error instanceof Error ? error.message : String(error || ''),
    })
  }

  context.emitTaskStreamEvent(task.recordId, {
    type: 'verification',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'final_review',
    message: '研究报告已完成最终核查',
    verification: verificationWithPrompt,
  })

  const tokenUsage = {
    inputTokens: Math.ceil(String(payload.prompt || '').length / 2),
    outputTokens: Math.ceil(finalReport.length / 2),
    totalTokens: Math.ceil((String(payload.prompt || '').length + finalReport.length) / 2),
  }
  context.emitTaskStreamEvent(task.recordId, {
    type: 'token_usage',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'final_review',
    message: '研究任务 token 统计已生成',
    tokenUsage,
  })

  const completedContent = finalReport.trim()

  await context.updateGenerationRecord(task.recordId, {
    ...context.buildInitialRecordPayload(payload),
    content: completedContent,
    done: true,
    stopped: false,
    error: '',
  }, task.userId)

  const completedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
  await context.syncSharedTaskRuntime(task, 'completed')
  context.emitTaskStreamEvent(task.recordId, {
    type: 'completed',
    recordId: task.recordId,
    done: true,
    stopped: false,
    record: completedRecord,
    stage: 'completed',
    message: '研究报告生成完成',
  })
  context.logGenerationTask('research_task:completed', {
    recordId: task.recordId,
    userId: task.userId,
    outputLength: completedContent.length,
  })
}
