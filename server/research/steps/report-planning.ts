// report_planning：基于核查结果与未决项让 LLM 生成最终章节大纲。
// 失败时回退到内置 6 章模板。

import { buildResearchReportSections } from '../report-writer'
import { runResearchStageModel } from '../model-runner'
import {
  buildResearchReportPlanningSystemPrompt,
  buildResearchReportPlanningUserPrompt,
} from '../prompts/report-planning'
import { buildResearchUnresolvedItems } from '../runtime/coverage'
import { buildEmptyResearchVerificationResult } from '../runtime/seed-evidence'
import { emitResearchStageEvent } from '../runtime/stage-events'
import type {
  ResearchOutlineSection,
  ResearchVerificationResult,
} from '../../../src/shared/research/research-types'
import type { ResearchStepContext } from '../runtime/context'

export interface ResearchReportPlanningOutcome {
  plannedSections: ResearchOutlineSection[]
  fallbackMap: Map<string, string>
  verificationWithPrompt: ResearchVerificationResult
}

export const runReportPlanningStep = async (
  ctx: ResearchStepContext,
  input: { verification?: ResearchVerificationResult | null } = {},
): Promise<ResearchReportPlanningOutcome> => {
  // 主报告 prompt 同时吸收 verifier 真实 unresolved + buildResearchUnresolvedItems 的 coverage 提示。
  const coverageUnresolved = buildResearchUnresolvedItems(ctx.evidenceStore)
  const verifierUnresolved = input.verification?.unresolvedItems || []
  const unresolvedItems = Array.from(new Set([...verifierUnresolved, ...coverageUnresolved]))
  const verificationWithPrompt = input.verification
    ? { ...input.verification, unresolvedItems }
    : Object.assign(buildEmptyResearchVerificationResult(), { unresolvedItems })
  const shouldUseCautiousWritingMode = unresolvedItems.length > 0

  emitResearchStageEvent(ctx.task.recordId, 'report_planning', ctx.executor)
  ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
    type: 'tool_call',
    recordId: ctx.task.recordId,
    done: false,
    stopped: false,
    stage: 'report_planning',
    message: shouldUseCautiousWritingMode
      ? '证据仍有缺口，但已具备成品化写作基础，转入强输出模式'
      : '证据已达到写作阈值，准备启动报告生成',
    toolCall: {
      id: 'start-report',
      toolName: 'start-report',
      parameters: {
        evidenceCount: ctx.evidenceStore.getCoverageSummary().evidenceCount,
        factCount: ctx.evidenceStore.getCoverageSummary().factCount,
        cautiousMode: shouldUseCautiousWritingMode,
      },
    },
  })

  const stageResult = await runResearchStageModel<{
    sections?: ResearchOutlineSection[]
  }>({
    payloadRequestBody: ctx.payload.requestBody,
    modelKey: ctx.modelKey,
    systemPrompt: buildResearchReportPlanningSystemPrompt(),
    userPrompt: buildResearchReportPlanningUserPrompt({
      subject: ctx.subject,
      goal: ctx.goal,
      evidences: ctx.evidenceStore.listEvidence(),
      facts: ctx.evidenceStore.listFacts(),
      unresolvedItems: verificationWithPrompt.unresolvedItems,
    }),
    signal: ctx.task.abortController.signal,
    stage: 'report_planning',
    logGenerationTask: ctx.executor.logGenerationTask,
  })

  ctx.usageAccumulator.add(stageResult.usage)
  const plannedSections = Array.isArray(stageResult.data.sections) && stageResult.data.sections.length
    ? stageResult.data.sections.map((item, index) => ({
      id: String(item.id || `section-${index + 1}`).trim() || `section-${index + 1}`,
      title: String(item.title || `章节 ${index + 1}`).trim() || `章节 ${index + 1}`,
      objective: String(item.objective || '').trim() || '补齐本章节研究内容',
      keyQuestions: Array.isArray(item.keyQuestions)
        ? item.keyQuestions.map(question => String(question || '').trim()).filter(Boolean)
        : [],
    }))
    : buildResearchReportSections({
      snapshot: ctx.snapshot,
      evidences: ctx.evidenceStore.listEvidence(),
      facts: ctx.evidenceStore.listFacts(),
      verification: verificationWithPrompt,
    }).map((item) => item.section)

  ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
    type: 'outline_ready',
    recordId: ctx.task.recordId,
    done: false,
    stopped: false,
    stage: 'report_planning',
    message: '研究报告大纲已生成',
    outline: {
      sections: plannedSections,
    },
  })

  const fallbackSections = buildResearchReportSections({
    snapshot: ctx.snapshot,
    evidences: ctx.evidenceStore.listEvidence(),
    facts: ctx.evidenceStore.listFacts(),
    verification: verificationWithPrompt,
  })
  const fallbackMap = new Map(fallbackSections.map((item) => [item.section.id, item.content]))

  return {
    plannedSections,
    fallbackMap,
    verificationWithPrompt,
  }
}
