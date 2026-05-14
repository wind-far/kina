// fact_verification：把已沉淀证据/事实交给 verifier 做交叉核查，并把结果发到前端。
// verdict='blocked' 时由主编排触发新一轮 follow-up search。

import { verifyResearchEvidence } from '../verifier'
import { emitResearchStageEvent } from '../runtime/stage-events'
import type { ResearchVerificationResult } from '../../../src/shared/research/research-types'
import type { ResearchStepContext } from '../runtime/context'

export const runFactVerificationStep = (ctx: ResearchStepContext): ResearchVerificationResult => {
  emitResearchStageEvent(ctx.task.recordId, 'fact_verification', ctx.executor)
  const verification = verifyResearchEvidence(ctx.evidenceStore)

  ctx.executor.emitTaskStreamEvent(ctx.task.recordId, {
    type: 'verification',
    recordId: ctx.task.recordId,
    done: false,
    stopped: false,
    stage: 'fact_verification',
    message: `事实核查完成：${verification.verdict}`,
    verification,
  })

  return verification
}
