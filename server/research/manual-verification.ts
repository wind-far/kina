// 手动核查通道：用户在已完成报告上点「核查报告」按钮触发的独立任务。
// 与主研究流程完全解耦：跳过 intake/search/reading，直接拿前端传入的 evidences + facts 调 verifier。

import { ResearchEvidenceStore } from './evidence-store'
import { verifyResearchEvidence } from './verifier'
import { emitResearchStageEvent } from './runtime/stage-events'
import type {
  ResearchEvidence,
  ResearchFact,
  ResearchVerificationResult,
} from '../../src/shared/research/research-types'
import type { GenerationTaskStartPayload } from '../generation-tasks/shared'
import type {
  ResearchExecutionTask,
  ResearchTaskExecutorContext,
} from './runtime/context'

export const normalizeManualVerificationPayload = (payload: GenerationTaskStartPayload) => {
  const requestBody = payload.requestBody && typeof payload.requestBody === 'object'
    ? payload.requestBody as Record<string, unknown>
    : null
  const manualVerification = requestBody?.manualVerification && typeof requestBody.manualVerification === 'object'
    ? requestBody.manualVerification as Record<string, unknown>
    : null

  return {
    enabled: Boolean(manualVerification),
    payload: manualVerification,
  }
}

const normalizeManualVerificationEvidences = (input: unknown): ResearchEvidence[] => {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const source = record.source && typeof record.source === 'object' ? record.source as Record<string, unknown> : {}
      const id = String(record.id || `manual-evidence-${index + 1}`).trim() || `manual-evidence-${index + 1}`
      const title = String(record.title || source.title || `核查信源 ${index + 1}`).trim() || `核查信源 ${index + 1}`
      return {
        id,
        title,
        summary: String(record.summary || '').trim(),
        source: {
          title: String(source.title || title).trim() || title,
          url: String(source.url || '').trim() || undefined,
          sourceType: source.sourceType === 'official' || source.sourceType === 'search-result' || source.sourceType === 'article' || source.sourceType === 'user-input' || source.sourceType === 'internal-plan'
            ? source.sourceType
            : 'article',
          note: String(source.note || '').trim() || undefined,
        },
        confidence: record.confidence === 'high' || record.confidence === 'low' ? record.confidence : 'medium',
        tags: Array.isArray(record.tags) ? record.tags.map(tag => String(tag || '').trim()).filter(Boolean) : [],
        entityMatched: record.entityMatched === false ? false : true,
        authorityHints: Array.isArray(record.authorityHints) ? record.authorityHints.map(entry => String(entry || '').trim()).filter(Boolean) : [],
        freshnessSignals: Array.isArray(record.freshnessSignals) ? record.freshnessSignals.map(entry => String(entry || '').trim()).filter(Boolean) : [],
        extractedFacts: Array.isArray(record.extractedFacts) ? record.extractedFacts.map(entry => String(entry || '').trim()).filter(Boolean) : [],
        extractedClaims: Array.isArray(record.extractedClaims) ? record.extractedClaims.map(entry => String(entry || '').trim()).filter(Boolean) : [],
        extractedNumbers: Array.isArray(record.extractedNumbers) ? record.extractedNumbers.map(entry => String(entry || '').trim()).filter(Boolean) : [],
        contradictions: Array.isArray(record.contradictions) ? record.contradictions.map(entry => String(entry || '').trim()).filter(Boolean) : [],
      } satisfies ResearchEvidence
    })
    .filter(item => item.title)
}

const normalizeManualVerificationFacts = (input: unknown): ResearchFact[] => {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const statement = String(record.statement || '').trim()
      if (!statement) {
        return null
      }
      return {
        id: String(record.id || `manual-fact-${index + 1}`).trim() || `manual-fact-${index + 1}`,
        statement,
        confidence: record.confidence === 'high' || record.confidence === 'low' ? record.confidence : 'medium',
        supportedEvidenceIds: Array.isArray(record.supportedEvidenceIds)
          ? record.supportedEvidenceIds.map(id => String(id || '').trim()).filter(Boolean)
          : [],
        factType: typeof record.factType === 'string' ? record.factType as ResearchFact['factType'] : undefined,
        factNature: record.factNature === 'hard_fact' || record.factNature === 'framework_claim' ? record.factNature : 'soft_claim',
        numbers: Array.isArray(record.numbers) ? record.numbers.map(value => String(value || '').trim()).filter(Boolean) : [],
        timeRefs: Array.isArray(record.timeRefs) ? record.timeRefs.map(value => String(value || '').trim()).filter(Boolean) : [],
        directSourceDomainCount: Number.isFinite(Number(record.directSourceDomainCount)) ? Number(record.directSourceDomainCount) : undefined,
        independentSourceDomainCount: Number.isFinite(Number(record.independentSourceDomainCount)) ? Number(record.independentSourceDomainCount) : undefined,
        sourceDomainCount: Number.isFinite(Number(record.sourceDomainCount)) ? Number(record.sourceDomainCount) : undefined,
        verificationStatus: record.verificationStatus === 'passed'
          || record.verificationStatus === 'partial'
          || record.verificationStatus === 'conflict'
          ? record.verificationStatus
          : 'unverified',
        uncertaintyNote: String(record.uncertaintyNote || '').trim() || undefined,
      } satisfies ResearchFact
    })
    .filter((item): item is ResearchFact => Boolean(item))
}

const buildManualVerificationContent = (input: {
  subject: string
  report: string
  verification: ResearchVerificationResult
}) => {
  const unresolvedItems = input.verification.unresolvedItems.slice(0, 8)
  const weakFacts = input.verification.weakFacts.slice(0, 6)
  const conflictFacts = input.verification.conflictFacts.slice(0, 6)
  const passedFacts = input.verification.passedFacts.slice(0, 6)

  return [
    `## 报告核查结果：${input.subject}`,
    '',
    `- 已核查事实：${input.verification.checkedFacts} 条`,
    `- 通过：${input.verification.passedFacts.length} 条`,
    `- 弱证据：${input.verification.weakFacts.length} 条`,
    `- 冲突：${input.verification.conflictFacts.length} 条`,
    '',
    unresolvedItems.length
      ? ['### 主要问题', '', ...unresolvedItems.map(item => `- ${item}`), ''].join('\n')
      : '### 主要问题\n\n- 当前没有新增未解决项。\n',
    weakFacts.length
      ? ['### 需要重点复核的表述', '', ...weakFacts.map(item => `- ${item.statement}`), ''].join('\n')
      : '',
    conflictFacts.length
      ? ['### 存在冲突的表述', '', ...conflictFacts.map(item => `- ${item.statement}`), ''].join('\n')
      : '',
    passedFacts.length
      ? ['### 相对稳固的表述', '', ...passedFacts.map(item => `- ${item.statement}`), ''].join('\n')
      : '',
    '### 说明',
    '',
    '- 这次核查是用户手动触发的独立动作，不再阻断主报告生成。',
    `- 本次核查基于当前报告正文以及已沉淀的 ${input.report ? '报告内容 / ' : ''}证据与事实快照完成。`,
  ].filter(Boolean).join('\n')
}

export const runManualVerificationFlow = async (
  task: ResearchExecutionTask,
  payload: GenerationTaskStartPayload,
  context: ResearchTaskExecutorContext,
  manualPayload: Record<string, unknown>,
) => {
  const evidenceStore = new ResearchEvidenceStore()
  const subject = String(manualPayload.subject || payload.prompt || '当前研究报告').trim() || '当前研究报告'
  const report = String(manualPayload.report || '').trim()
  const evidences = normalizeManualVerificationEvidences(manualPayload.evidences)
  const facts = normalizeManualVerificationFacts(manualPayload.facts)

  evidences.forEach(item => {
    evidenceStore.addEvidence(item)
  })
  facts.forEach(item => {
    evidenceStore.addFact(item)
  })

  context.emitTaskProgressEvent(task.recordId, {
    stage: 'research_verification',
    message: '报告核查任务已启动',
  })

  context.emitTaskStreamEvent(task.recordId, {
    type: 'begin',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'fact_verification',
    message: '报告核查开始',
    researchBegin: {
      taskId: task.recordId,
      outputType: 'report',
      title: `${subject} 报告核查`,
      subject,
      status: 'running',
    },
  })

  emitResearchStageEvent(task.recordId, 'fact_verification', context)
  const verification = verifyResearchEvidence(evidenceStore)
  context.emitTaskStreamEvent(task.recordId, {
    type: 'verification',
    recordId: task.recordId,
    done: false,
    stopped: false,
    stage: 'fact_verification',
    message: '报告核查已完成',
    verification,
  })

  const content = buildManualVerificationContent({
    subject,
    report,
    verification,
  })

  await context.updateGenerationRecord(task.recordId, {
    ...context.buildInitialRecordPayload(payload),
    content,
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
    message: '报告核查完成',
  })
  context.logGenerationTask('research_verification:completed', {
    recordId: task.recordId,
    userId: task.userId,
    evidenceCount: evidences.length,
    factCount: facts.length,
    checkedFacts: verification.checkedFacts,
  })
}
