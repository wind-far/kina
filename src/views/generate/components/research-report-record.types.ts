import type { ResearchConfidence, ResearchStage } from '@/shared/research/research-types'

export type ResearchTimelineItemKind =
  | 'begin'
  | 'stage'
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'evidence'
  | 'fact'
  | 'outline'
  | 'verification'
  | 'section'
  | 'usage'
  | 'completed'
  | 'failed'
  | 'stopped'

export interface ResearchTimelineViewItem {
  id: string
  kind: ResearchTimelineItemKind
  title: string
  description?: string
  stage?: ResearchStage | string
  confidence?: ResearchConfidence
  meta?: Record<string, unknown>
  time: string
}

export interface ResearchSearchSourceViewItem {
  title: string
  url?: string
  siteName?: string
  snippet?: string
  siteIcon?: string
  publishedTime?: string
  referenceIndex?: number
}

export interface ResearchSearchGroupViewItem {
  id: string
  query: string
  title: string
  sources: ResearchSearchSourceViewItem[]
  stage?: ResearchStage | string
  time?: string
  pending?: boolean
  order?: number
  diagnostics?: string
}
