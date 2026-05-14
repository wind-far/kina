// 副作用 import 触发四个策略自注册。
// tools.ts:runWebSearch 在解析 provider 前会先 import 此模块。

import './grok2api'
import './tavily'
import './serper'
import './brave-search'

export { registerSearchStrategy, resolveSearchStrategy, listRegisteredSearchProviders, resolveSearchProviderUpstream } from './registry'
export type { ResearchSearchProvider, ResearchSearchStrategy, ResearchSearchStrategyInput, ResearchSearchUpstream } from './types'
