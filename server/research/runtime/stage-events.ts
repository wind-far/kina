// 研究阶段 SSE 事件发送辅助。
// 统一封装 stage_changed 与 reasoning_summary 两种事件，避免 step 文件重复样板。

import { RESEARCH_STAGE_LABELS } from '../constants'
import type { ResearchStage } from '../../../src/shared/research/research-types'
import type { ResearchTaskExecutorContext } from './context'

export const emitResearchStageEvent = (
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

export const emitReasoningSummary = (
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
