import type {
  ResearchEvidence,
  ResearchFact,
  ResearchOutlineSection,
  ResearchReasoningSummary,
  ResearchSectionDelta,
  ResearchStage,
  ResearchTokenUsage,
  ResearchToolCallPayload,
  ResearchToolResultPayload,
  ResearchVerificationResult,
} from './research-types'

export interface ResearchBeginPayload {
  taskId: string
  outputType: 'report' | 'answer'
  title: string
  subject: string
  status: 'running'
}

export interface ResearchStageChangedPayload {
  stage: ResearchStage
  message: string
}

export interface ResearchOutlineReadyPayload {
  sections: ResearchOutlineSection[]
}

export type ResearchEventPayloadMap = {
  begin: ResearchBeginPayload
  stage_changed: ResearchStageChangedPayload
  reasoning_summary: ResearchReasoningSummary
  tool_call: ResearchToolCallPayload
  tool_result: ResearchToolResultPayload
  evidence_added: ResearchEvidence
  fact_update: ResearchFact
  verification: ResearchVerificationResult
  outline_ready: ResearchOutlineReadyPayload
  section_delta: ResearchSectionDelta
  token_usage: ResearchTokenUsage
}
