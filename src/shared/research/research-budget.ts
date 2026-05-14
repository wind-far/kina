import type { ResearchTaskConfig } from './research-types'

export const DEFAULT_RESEARCH_TASK_CONFIG: ResearchTaskConfig = {
  outputType: 'report',
  maxSearchRounds: 3,
  maxQueriesPerRound: 5,
  maxSources: 12,
  requireVerification: true,
  enableDisambiguation: true,
}

export const normalizeResearchTaskConfig = (
  input?: Partial<ResearchTaskConfig> | null,
): ResearchTaskConfig => {
  return {
    outputType: input?.outputType === 'answer' ? 'answer' : DEFAULT_RESEARCH_TASK_CONFIG.outputType,
    maxSearchRounds: Number.isFinite(Number(input?.maxSearchRounds))
      ? Math.max(1, Math.min(6, Number(input?.maxSearchRounds)))
      : DEFAULT_RESEARCH_TASK_CONFIG.maxSearchRounds,
    maxQueriesPerRound: Number.isFinite(Number(input?.maxQueriesPerRound))
      ? Math.max(2, Math.min(8, Number(input?.maxQueriesPerRound)))
      : DEFAULT_RESEARCH_TASK_CONFIG.maxQueriesPerRound,
    maxSources: Number.isFinite(Number(input?.maxSources))
      ? Math.max(4, Math.min(24, Number(input?.maxSources)))
      : DEFAULT_RESEARCH_TASK_CONFIG.maxSources,
    requireVerification: input?.requireVerification !== false,
    enableDisambiguation: input?.enableDisambiguation !== false,
  }
}
