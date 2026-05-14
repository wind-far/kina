// 章节级证据与事实匹配。
// 在 report_writing 阶段为每个章节挑出最相关的证据/事实子集，避免把全部喂给模型。

import type {
  ResearchEvidence,
  ResearchFact,
  ResearchOutlineSection,
} from '../../../src/shared/research/research-types'

export const collectSectionEvidence = (section: ResearchOutlineSection, evidences: ResearchEvidence[]) => {
  const sectionKey = `${section.title} ${section.objective} ${(section.keyQuestions || []).join(' ')}`
  const keywords = sectionKey
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  const matched = evidences.filter((item) => {
    const haystack = `${item.title} ${item.summary} ${(item.tags || []).join(' ')}`.toLowerCase()
    return keywords.some((keyword) => haystack.includes(keyword))
  })

  return matched.length ? matched : evidences.slice(0, 4)
}

export const collectSectionFacts = (section: ResearchOutlineSection, facts: ResearchFact[]) => {
  const keywords = `${section.title} ${section.objective} ${(section.keyQuestions || []).join(' ')}`
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  const matched = facts.filter((item) => {
    const haystack = `${item.statement} ${(item.numbers || []).join(' ')} ${(item.timeRefs || []).join(' ')}`.toLowerCase()
    return keywords.some((keyword) => haystack.includes(keyword))
  })

  return matched.length ? matched : facts.slice(0, 6)
}
