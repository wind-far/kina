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

export interface ResearchSourceDialogItem {
  id: string
  referenceLabel: string
  metaLabel: string
  title: string
  siteName: string
  domain: string
  snippet: string
  url: string
}

// 信源 / 阅读 / 证据 / 事实 四类卡片的统一视图模型。
// 用 discriminated union 让模板按 kind 走分支渲染。
export type ResearchDataSonarCard =
  | (ResearchSearchGroupViewItem & { kind?: 'search' })
  | {
      id: string
      kind: 'reader'
      query: string
      title: string
      sources: ResearchSearchSourceViewItem[]
      stage?: string
      time?: string
      pending?: boolean
      order?: number
      url: string
      headline: string
      excerpt: string
      content: string
      siteName: string
      siteIcon: string
      referenceIndex?: number
      contentLength?: number
    }
  | {
      id: string
      kind: 'evidence'
      query: string
      title: string
      sources: ResearchSearchSourceViewItem[]
      stage?: string
      time?: string
      pending?: boolean
      order?: number
      headline: string
      excerpt: string
      siteName: string
      metaLine: string
    }
  | {
      id: string
      kind: 'fact'
      query: string
      title: string
      sources: ResearchSearchSourceViewItem[]
      stage?: string
      time?: string
      pending?: boolean
      order?: number
      statement: string
      metaLine: string
    }

// 引用胶囊 tooltip 中展示的信源预览。
export interface ResearchCitationPreview {
  siteIcon: string
  domain: string
  siteName: string
  title: string
  snippet: string
  url: string
}

// 真正渲染到 DOM 的 tooltip 数据，比 preview 多了跳转目标与首字母兜底。
export interface ResearchCitationTooltipData extends ResearchCitationPreview {
  detailLink: string
  detailLabel: string
  siteInitial: string
}

// 研究流程时间线中"块"的视图模型，按 type 走渲染分支。
export type ResearchFlowBlock =
  | {
      id: string
      type: 'planning'
      title: string
      cardTitle: string
      time: string
      items: ResearchTimelineViewItem[]
    }
  | {
      id: string
      type: 'search'
      title: string
      time: string
      groups: ResearchDataSonarCard[]
      progressText?: string
      items: ResearchTimelineViewItem[]
    }
  | {
      id: string
      type: 'verification' | 'outline' | 'report'
      title: string
      time: string
      items: ResearchTimelineViewItem[]
    }
