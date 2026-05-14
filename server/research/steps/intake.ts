// intake 步骤：让 LLM 校正 planner 给的主体/目标/模式，并把结果写回 ctx.snapshot。

import { buildResearchPlanSnapshot, resolveResearchSubject } from '../planner'
import { runResearchStageModel } from '../model-runner'
import { buildResearchIntakeSystemPrompt, buildResearchIntakeUserPrompt } from '../prompts/intake'
import { emitReasoningSummary, emitResearchStageEvent } from '../runtime/stage-events'
import { buildSeedEvidence } from '../runtime/seed-evidence'
import type { ResearchStepContext } from '../runtime/context'

export const runIntakeStep = async (ctx: ResearchStepContext) => {
  emitResearchStageEvent(ctx.task.recordId, 'intake', ctx.executor)

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
    payloadRequestBody: ctx.payload.requestBody,
    modelKey: ctx.modelKey,
    systemPrompt: buildResearchIntakeSystemPrompt(),
    userPrompt: buildResearchIntakeUserPrompt({
      prompt: String(ctx.payload.prompt || ''),
      seedUrls: ctx.snapshot.seedUrls,
    }),
    signal: ctx.task.abortController.signal,
    stage: 'intake',
    logGenerationTask: ctx.executor.logGenerationTask,
  })

  ctx.usageAccumulator.add(intakeResult.usage)

  const intake = intakeResult.data
  const resolvedSubject = resolveResearchSubject(
    String(ctx.payload.prompt || ''),
    String(intake.subject || ctx.snapshot.subject).trim() || ctx.snapshot.subject,
  ) || ctx.snapshot.subject
  const resolvedGoal = String(intake.goal || ctx.snapshot.goal).trim() || ctx.snapshot.goal

  const refreshedSnapshot = buildResearchPlanSnapshot({
    prompt: String(ctx.payload.prompt || ''),
    researchConfig: ctx.payload.researchConfig || null,
    subjectOverride: resolvedSubject,
    goalOverride: resolvedGoal,
    outputTypeOverride: intake.deliverable === 'answer' ? 'answer' : ctx.snapshot.outputType,
  })

  // 字段级 mutation：保持 ctx.snapshot 引用不变。
  ctx.snapshot.subject = refreshedSnapshot.subject
  ctx.snapshot.goal = refreshedSnapshot.goal
  ctx.snapshot.outputType = refreshedSnapshot.outputType
  ctx.snapshot.researchMode = intake.researchMode || refreshedSnapshot.researchMode
  ctx.snapshot.primaryFrame = intake.primaryFrame || refreshedSnapshot.primaryFrame
  ctx.snapshot.scopeDecision = String(intake.scopeDecision || refreshedSnapshot.scopeDecision || '').trim() || refreshedSnapshot.scopeDecision
  ctx.snapshot.fallbackStrategy = String(intake.fallbackStrategy || refreshedSnapshot.fallbackStrategy || '').trim() || refreshedSnapshot.fallbackStrategy
  ctx.snapshot.axes = refreshedSnapshot.axes
  ctx.snapshot.queryAnchors = refreshedSnapshot.queryAnchors
  ctx.snapshot.initialQueries = refreshedSnapshot.initialQueries
  ctx.snapshot.targetQueries = refreshedSnapshot.targetQueries
  ctx.snapshot.seedUrls = refreshedSnapshot.seedUrls
  ctx.snapshot.gaps = refreshedSnapshot.gaps
  ctx.snapshot.outline = refreshedSnapshot.outline
  ctx.snapshot.risks = Array.isArray(intake.risks) ? intake.risks.map(item => String(item || '').trim()).filter(Boolean) : []
  ctx.snapshot.ambiguities = Array.isArray(intake.ambiguities) ? intake.ambiguities.map(item => String(item || '').trim()).filter(Boolean) : ctx.snapshot.ambiguities

  ctx.subject = resolvedSubject
  ctx.goal = resolvedGoal

  emitReasoningSummary(
    ctx.task.recordId,
    'intake',
    resolvedGoal,
    Array.isArray(intake.known)
      ? [
          ...intake.known.map(item => String(item || '').trim()).filter(Boolean),
          ctx.snapshot.scopeDecision ? `默认研究边界：${ctx.snapshot.scopeDecision}` : '',
        ].filter(Boolean)
      : [`研究主体初步识别为 ${ctx.snapshot.subject}`],
    ctx.snapshot.ambiguities,
    ctx.snapshot.risks || [],
    Array.isArray(intake.nextActions) ? intake.nextActions.map(item => String(item || '').trim()).filter(Boolean) : ['生成首轮搜索计划'],
    ctx.executor,
    '已完成任务理解',
  )

  for (const evidence of buildSeedEvidence(String(ctx.payload.prompt || ''), resolvedSubject)) {
    const saved = ctx.evidenceStore.addEvidence(evidence)
    if (saved) {
      ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
        type: 'evidence_added',
        recordId: ctx.task.recordId,
        done: false,
        stopped: false,
        stage: 'intake',
        message: '已采纳基础研究证据',
        evidence: saved,
      })
    }
  }
}
