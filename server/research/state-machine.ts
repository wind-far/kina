import type { ResearchStage } from '../../src/shared/research/research-types'

const STAGE_ORDER: ResearchStage[] = [
  'intake',
  'bootstrap_planning',
  'parallel_search',
  'initial_analysis',
  'disambiguation',
  'gap_detection',
  'targeted_search',
  'deep_reading',
  'evidence_merge',
  'fact_verification',
  'uncertainty_marking',
  'report_planning',
  'report_writing',
  'final_review',
  'completed',
]

const TERMINAL_STAGES = new Set<ResearchStage>(['completed', 'failed', 'stopped'])

export const isResearchTerminalStage = (stage: ResearchStage) => {
  return TERMINAL_STAGES.has(stage)
}

export const getResearchNextStage = (stage: ResearchStage): ResearchStage => {
  if (isResearchTerminalStage(stage)) {
    return stage
  }

  const currentIndex = STAGE_ORDER.indexOf(stage)
  if (currentIndex < 0 || currentIndex === STAGE_ORDER.length - 1) {
    return 'completed'
  }

  return STAGE_ORDER[currentIndex + 1]
}
