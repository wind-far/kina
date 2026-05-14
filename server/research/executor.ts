// Deep Research 主编排：所有步骤都搬到 server/research/steps/ 下，本文件只做：
// 1. 短路 manualVerification 通道
// 2. 初始化 ctx（snapshot / evidenceStore / usageAccumulator / searchRuntime）
// 3. 按顺序调用 9 个 step
// 4. 在 deep_reading 之后做多轮 fact_verification → follow-up-queries → targeted_search → deep_reading 循环
// 5. finalize：发真实 token_usage、写库、发 completed

import { buildResearchPlan } from './planner'
import { ResearchEvidenceStore } from './evidence-store'
import {
  ResearchUsageAccumulator,
} from './runtime/usage-accumulator'
import { readResearchSearchRuntimeConfig } from './runtime/search-batch'
import {
  normalizeManualVerificationPayload,
  runManualVerificationFlow,
} from './manual-verification'
import { generateResearchFollowUpQueries } from './runtime/follow-up-queries'
import { runIntakeStep } from './steps/intake'
import { runBootstrapPlanningStep } from './steps/bootstrap-planning'
import { runParallelSearchStep } from './steps/parallel-search'
import { runInitialAnalysisStep } from './steps/initial-analysis'
import { runGapDetectionStep } from './steps/gap-detection'
import { runTargetedSearchStep } from './steps/targeted-search'
import { runDeepReadingStep } from './steps/deep-reading'
import { runFactVerificationStep } from './steps/fact-verification'
import { runReportPlanningStep } from './steps/report-planning'
import { runReportWritingStep } from './steps/report-writing'
import type {
  ResearchExecutionTask,
  ResearchStepContext,
  ResearchTaskExecutorContext,
} from './runtime/context'
import type { GenerationTaskStartPayload } from '../generation-tasks/shared'
import type { ResearchVerificationResult } from '../../src/shared/research/research-types'

export type { ResearchExecutionTask, ResearchTaskExecutorContext } from './runtime/context'

const MIN_FOLLOW_UP_ROUNDS = 1
const MAX_FOLLOW_UP_ROUNDS = 3

const collectExecutedQueries = (ctx: ResearchStepContext, initialQueries: string[], extraRounds: string[][]) => {
  return [
    ...initialQueries,
    ...ctx.snapshot.initialQueries.map(item => item.query),
    ...ctx.snapshot.targetQueries.map(item => item.query),
    ...extraRounds.flat(),
  ]
}

export const executeResearchTaskFlow = async (
  task: ResearchExecutionTask,
  payload: GenerationTaskStartPayload,
  context: ResearchTaskExecutorContext,
) => {
  await context.syncSharedTaskRuntime(task, 'running')
  await context.ensureTaskNotAborted(task)

  // 0. 手动核查通道——独立短路径，跳过研究主流程。
  const manualVerificationRequest = normalizeManualVerificationPayload(payload)
  if (manualVerificationRequest.enabled && manualVerificationRequest.payload) {
    await runManualVerificationFlow(task, payload, context, manualVerificationRequest.payload)
    return
  }

  // 1. 初始化执行上下文。
  const { config, snapshot } = buildResearchPlan({
    prompt: String(payload.prompt || ''),
    researchConfig: payload.researchConfig || null,
  })
  const modelKey = String(payload.modelKey || '').trim()
  const evidenceStore = new ResearchEvidenceStore()
  const usageAccumulator = new ResearchUsageAccumulator()
  const searchRuntime = readResearchSearchRuntimeConfig(payload.requestBody)

  const ctx: ResearchStepContext = {
    task,
    payload,
    executor: context,
    config,
    snapshot,
    evidenceStore,
    modelKey,
    subject: snapshot.subject,
    goal: snapshot.goal,
    searchRuntime,
    usageAccumulator,
  }

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

  // 2. 主步骤顺序执行。
  await runIntakeStep(ctx)
  runBootstrapPlanningStep(ctx)

  const initialSearchResults = await runParallelSearchStep(ctx)
  await runInitialAnalysisStep(ctx, { initialSearchResults })
  const gapOutcome = await runGapDetectionStep(ctx, { initialSearchResults })

  const targetedSearchResults = gapOutcome.nextAction === 'report_planning'
    ? []
    : await runTargetedSearchStep(ctx, {
        queryPlans: gapOutcome.targetedQueries,
        callIdPrefix: 'search-targeted',
        stage: 'targeted_search',
      })

  await runDeepReadingStep(ctx, {
    initialSearchResults,
    targetedSearchResults,
    stage: 'deep_reading',
    callIdPrefix: 'reader',
  })

  // 3. 多轮事实核查循环：verifier 判定 verdict='blocked' → follow-up-queries → targeted_search → deep_reading。
  const allInitialResults = initialSearchResults
  let cumulativeTargetedResults = targetedSearchResults
  let lastVerification: ResearchVerificationResult | null = null
  const followUpQueryHistory: string[][] = []
  const baseExecutedQueries = collectExecutedQueries(ctx, [], [])
  const maxRounds = Math.max(MIN_FOLLOW_UP_ROUNDS, Math.min(MAX_FOLLOW_UP_ROUNDS, ctx.config.maxSearchRounds))

  for (let round = 1; round <= maxRounds; round++) {
    await context.ensureTaskNotAborted(task)
    lastVerification = runFactVerificationStep(ctx)

    if (lastVerification.verdict !== 'blocked' || round === maxRounds) {
      break
    }

    const previousQueries = collectExecutedQueries(ctx, baseExecutedQueries, followUpQueryHistory)
    const followUpQueries = await generateResearchFollowUpQueries({
      ctx,
      verification: lastVerification,
      previousQueries,
      round,
    })

    if (!followUpQueries.length) {
      break
    }

    followUpQueryHistory.push(followUpQueries.map(item => item.query))

    const roundResults = await runTargetedSearchStep(ctx, {
      queryPlans: followUpQueries,
      callIdPrefix: `search-followup-r${round}`,
      stage: 'fact_verification',
    })

    if (!roundResults.length) {
      continue
    }

    cumulativeTargetedResults = [...cumulativeTargetedResults, ...roundResults]
    await runDeepReadingStep(ctx, {
      initialSearchResults: allInitialResults,
      targetedSearchResults: cumulativeTargetedResults,
      stage: 'fact_verification',
      resumeFromExisting: true,
      callIdPrefix: `reader-followup-r${round}`,
    })
  }

  // 4. 大纲规划 + 章节写作。
  const planningOutcome = await runReportPlanningStep(ctx, {
    verification: lastVerification,
  })

  const finalReport = await runReportWritingStep(ctx, {
    plannedSections: planningOutcome.plannedSections,
    fallbackMap: planningOutcome.fallbackMap,
    verificationWithPrompt: planningOutcome.verificationWithPrompt,
  })

  // 5. finalize：发真实 token_usage，写库，发 completed。
  const usageSnapshot = ctx.usageAccumulator.snapshot()
  const tokenUsage = ctx.usageAccumulator.hasRealUsage()
    ? {
        inputTokens: usageSnapshot.promptTokens,
        outputTokens: usageSnapshot.completionTokens,
        totalTokens: usageSnapshot.totalTokens,
      }
    : {
        // 上游全部不回 usage 时兜底用字符数 ÷ 2。
        inputTokens: Math.ceil(String(payload.prompt || '').length / 2),
        outputTokens: Math.ceil(finalReport.length / 2),
        totalTokens: Math.ceil((String(payload.prompt || '').length + finalReport.length) / 2),
      }

  context.emitTaskStreamEvent(task.recordId, {
    type: 'token_usage',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'report_writing',
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
    usageCalls: usageSnapshot.calls,
    totalTokens: usageSnapshot.totalTokens,
    followUpRounds: followUpQueryHistory.length,
    verificationVerdict: lastVerification?.verdict || 'unverified',
  })
}
