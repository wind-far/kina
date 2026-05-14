// 查询计划与搜索结果查找表的归一化工具。

import { normalizeComparableUrl } from '../read-target-ranker'
import type { ResearchQueryPlan } from '../../../src/shared/research/research-types'
import type { ResearchSearchResultItem } from '../tools'

export const normalizeQueryPlanList = (items: unknown, fallback: ResearchQueryPlan[]) => {
  if (!Array.isArray(items)) {
    return fallback
  }

  const normalized = items.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      query: String(record.query || '').trim(),
      intent: String(record.intent || '补充研究信息').trim(),
      priority: Number.isFinite(Number(record.priority)) ? Number(record.priority) : index + 1,
    }
  }).filter((item) => item.query)

  return normalized.length ? normalized : fallback
}

export const buildSearchResultLookup = (results: ResearchSearchResultItem[]) => {
  const map = new Map<string, ResearchSearchResultItem>()
  for (const item of results) {
    const normalizedUrl = normalizeComparableUrl(item.url)
    if (normalizedUrl && !map.has(normalizedUrl)) {
      map.set(normalizedUrl, item)
    }
  }
  return map
}
