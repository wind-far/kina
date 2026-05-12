export type ResearchStage =
  | 'intake'
  | 'bootstrap_planning'
  | 'parallel_search'
  | 'initial_analysis'
  | 'disambiguation'
  | 'gap_detection'
  | 'targeted_search'
  | 'deep_reading'
  | 'evidence_merge'
  | 'fact_verification'
  | 'uncertainty_marking'
  | 'report_planning'
  | 'report_writing'
  | 'final_review'
  | 'completed'
  | 'failed'
  | 'stopped'

export type ResearchToolName =
  | 'web-search'
  | 'web-reader'
  | 'gap-analyzer'
  | 'fact-verifier'
  | 'start-report'

export type ResearchOutputType = 'report' | 'answer'
export type ResearchMode = 'open_topic' | 'entity_topic' | 'comparative_topic'
export type ResearchPrimaryFrame = '综合框架' | '文化历史' | '商业营销' | '数据方法'

export type ResearchConfidence = 'high' | 'medium' | 'low'

export type ResearchFactType =
  | 'fact'
  | 'claim'
  | 'number'
  | 'timeline'
  | 'architecture'
  | 'risk'

export type ResearchFactNature = 'hard_fact' | 'soft_claim' | 'framework_claim'

export type ResearchVerificationStatus = 'passed' | 'partial' | 'conflict' | 'unverified'

export interface ResearchSearchSource {
  url: string
  title: string
  type?: string
  snippet?: string
  siteName?: string
  siteIcon?: string
  publishedTime?: string
  datePublished?: string
  referenceIndex?: number
}

export interface ResearchTaskConfig {
  outputType: ResearchOutputType
  maxSearchRounds: number
  maxQueriesPerRound: number
  maxSources: number
  requireVerification: boolean
  enableDisambiguation: boolean
}

export interface ResearchSourceRef {
  title: string
  url?: string
  sourceType: 'official' | 'search-result' | 'article' | 'user-input' | 'internal-plan'
  note?: string
}

export interface ResearchEvidenceDiscovery {
  query?: string
  provider?: string
  rank?: number
  searchSources?: ResearchSearchSource[]
}

export interface ResearchEvidence {
  id: string
  title: string
  summary: string
  source: ResearchSourceRef
  confidence: ResearchConfidence
  tags: string[]
  entityMatched?: boolean
  authorityHints?: string[]
  freshnessSignals?: string[]
  extractedFacts?: string[]
  extractedClaims?: string[]
  extractedNumbers?: string[]
  contradictions?: string[]
  pageRole?: 'framework' | 'evidence' | 'case' | 'opinion' | 'tool_tutorial' | 'noisy'
  topicAlignment?: 'high' | 'medium' | 'low'
  usableFor?: '主论证' | '补充案例' | '风险提示' | '不建议入正文'
  scopeWarning?: string
  discovery?: ResearchEvidenceDiscovery
}

export interface ResearchFact {
  id: string
  statement: string
  confidence: ResearchConfidence
  supportedEvidenceIds: string[]
  factType?: ResearchFactType
  factNature?: ResearchFactNature
  numbers?: string[]
  timeRefs?: string[]
  directSourceDomainCount?: number
  independentSourceDomainCount?: number
  sourceDomainCount?: number
  verificationStatus?: ResearchVerificationStatus
  uncertaintyNote?: string
}

export interface ResearchReasoningSummary {
  stage: ResearchStage
  goal: string
  known: string[]
  ambiguities: string[]
  gaps: string[]
  nextActions: string[]
}

export interface ResearchQueryPlan {
  query: string
  intent: string
  priority: number
}

export interface ResearchToolCallPayload {
  id: string
  toolName: ResearchToolName
  parameters: Record<string, unknown>
}

export interface ResearchToolResultPayload {
  id: string
  toolName: ResearchToolName
  preview: Record<string, unknown>
}

export interface ResearchOutlineSection {
  id: string
  title: string
  objective: string
  keyQuestions?: string[]
}

export interface ResearchSectionDelta {
  sectionId: string
  title: string
  delta: string
  content: string
}

export interface ResearchVerificationResult {
  verdict: 'passed' | 'partial' | 'blocked'
  checkedFacts: number
  passedFacts: ResearchFact[]
  weakFacts: ResearchFact[]
  conflictFacts: ResearchFact[]
  unresolvedItems: string[]
}

export interface ResearchTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ResearchPlanSnapshot {
  subject: string
  goal: string
  outputType: ResearchOutputType
  researchMode?: ResearchMode
  primaryFrame?: ResearchPrimaryFrame
  scopeDecision?: string
  fallbackStrategy?: string
  axes: string[]
  queryAnchors?: string[]
  risks?: string[]
  initialQueries: ResearchQueryPlan[]
  targetQueries: ResearchQueryPlan[]
  seedUrls: string[]
  ambiguities: string[]
  gaps: string[]
  outline: ResearchOutlineSection[]
}
