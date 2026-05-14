// report_writing：逐章节调 LLM 生成正文，失败回退到内置模板，每章增量入库 + SSE 推送。

import {
  appendResearchReferenceAppendix,
  writeResearchSectionWithModel,
} from '../report-writer'
import { buildResearchSectionDelta } from '../report-section-format'
import { collectSectionEvidence, collectSectionFacts } from '../runtime/section-matchers'
import { emitResearchStageEvent } from '../runtime/stage-events'
import type {
  ResearchOutlineSection,
  ResearchVerificationResult,
} from '../../../src/shared/research/research-types'
import type { ResearchStepContext } from '../runtime/context'

export const runReportWritingStep = async (
  ctx: ResearchStepContext,
  input: {
    plannedSections: ResearchOutlineSection[]
    fallbackMap: Map<string, string>
    verificationWithPrompt: ResearchVerificationResult
  },
) => {
  emitResearchStageEvent(ctx.task.recordId, 'report_writing', ctx.executor)

  let fullContent = ''
  for (const section of input.plannedSections) {
    await ctx.executor.ensureTaskNotAborted(ctx.task)
    const sectionEvidences = collectSectionEvidence(section, ctx.evidenceStore.listEvidence())
    const sectionFacts = collectSectionFacts(section, ctx.evidenceStore.listFacts())
    let sectionBody = ''

    try {
      const writeResult = await writeResearchSectionWithModel({
        payloadRequestBody: ctx.payload.requestBody,
        modelKey: ctx.modelKey,
        subject: ctx.subject,
        goal: ctx.goal,
        section,
        evidences: sectionEvidences,
        facts: sectionFacts,
        unresolvedItems: input.verificationWithPrompt.unresolvedItems,
        signal: ctx.task.abortController.signal,
        logGenerationTask: ctx.executor.logGenerationTask,
      })
      ctx.usageAccumulator.add(writeResult.usage)
      sectionBody = writeResult.content
    } catch (error) {
      ctx.executor.logGenerationTask('research_report:section_fallback', {
        recordId: ctx.task.recordId,
        sectionId: section.id,
        errorMessage: error instanceof Error ? error.message : String(error || ''),
      })
      sectionBody = input.fallbackMap.get(section.id) || section.objective
    }

    const delta = buildResearchSectionDelta(section, sectionBody)
    fullContent += delta

    await ctx.executor.updateGenerationRecord(ctx.task.recordId, {
      ...ctx.executor.buildInitialRecordPayload(ctx.payload),
      content: fullContent,
      done: false,
      stopped: false,
      error: '',
    }, ctx.task.userId)

    ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
      type: 'section_delta',
      recordId: ctx.task.recordId,
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

  return appendResearchReferenceAppendix(fullContent, ctx.evidenceStore.listEvidence())
}
