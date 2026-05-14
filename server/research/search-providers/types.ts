// 研究搜索供应商策略接口。
// 当前内置 4 个 provider：grok2api / tavily / serper / brave-search；后续扩展只需新增策略文件并自注册。

import type { ResearchSearchResultItem } from '../tools'
import type { ResearchModelUsage } from '../runtime/usage-accumulator'

export type ResearchSearchProvider = 'grok2api' | 'tavily' | 'serper' | 'brave-search'

export interface ResearchSearchUpstream {
  baseUrl: string
  apiKey: string
  endpoint: string
  model?: string
}

export interface ResearchSearchStrategyInput {
  query: string
  count: number
  signal: AbortSignal
  upstream: ResearchSearchUpstream
  userAgent: string
  timeoutMs: number
  onUsage?: (usage: ResearchModelUsage) => void
}

export interface ResearchSearchStrategy {
  provider: ResearchSearchProvider
  // grok2api 走 chat 接口，需要 modelKey；其他策略不需要 model。
  requiresModel: boolean
  runSearch(input: ResearchSearchStrategyInput): Promise<ResearchSearchResultItem[]>
}
