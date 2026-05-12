import type { ResearchEvidence, ResearchFact } from '../../../src/shared/research/research-types'

const trimList = (items: unknown, maxItems: number, maxLength = 120) => {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map(item => item.length > maxLength ? `${item.slice(0, maxLength).trim()}...` : item)
}

const compactEvidence = (item: ResearchEvidence) => ({
  id: item.id,
  title: String(item.title || '').trim(),
  url: String(item.source.url || '').trim(),
  sourceType: item.source.sourceType,
  entityMatched: item.entityMatched !== false,
  confidence: item.confidence,
  summary: String(item.summary || '').trim().slice(0, 280),
  authorityHints: trimList(item.authorityHints, 3),
  freshnessSignals: trimList(item.freshnessSignals, 3),
  extractedNumbers: trimList(item.extractedNumbers, 8, 60),
  contradictions: trimList(item.contradictions, 3),
  discovery: item.discovery
    ? {
        query: String(item.discovery.query || '').trim(),
        provider: String(item.discovery.provider || '').trim(),
        rank: item.discovery.rank,
        searchSources: (item.discovery.searchSources || []).slice(0, 5).map(source => ({
          title: String(source.title || '').trim().slice(0, 120),
          url: String(source.url || '').trim(),
          siteName: String(source.siteName || '').trim(),
          publishedTime: String(source.publishedTime || '').trim(),
          type: String(source.type || '').trim(),
        })),
      }
    : null,
})

const compactFact = (item: ResearchFact) => ({
  id: item.id,
  statement: String(item.statement || '').trim(),
  confidence: item.confidence,
  supportedEvidenceIds: item.supportedEvidenceIds,
  factType: item.factType || 'fact',
  factNature: item.factNature || 'soft_claim',
  numbers: trimList(item.numbers, 8, 60),
  timeRefs: trimList(item.timeRefs, 6, 80),
  verificationStatus: item.verificationStatus || 'unverified',
  uncertaintyNote: String(item.uncertaintyNote || '').trim().slice(0, 180),
})

export const buildResearchVerificationSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 verification 模块。',
    '职责：判断候选事实的验证状态、冲突与不确定性。',
    '必须优先依据证据中的 discovery/searchSources、域名独立性、数字一致性、时间版本一致性做判断。',
    '必须区分 hard_fact、soft_claim、framework_claim 三类事实语义：hard_fact 更适合做交叉验证；soft_claim 与 framework_claim 更容易停留在 partial/unverified。',
    '如果某个事实只有单一来源链、单一低权威域名、或缺少结构化来源链，应降低为 partial 或 unverified，而不是轻易判定 passed。',
    '如果数字、时间、版本、或证据中的 contradictions 与事实存在明显冲突，应标为 conflict。',
    '必须返回严格 JSON，不允许输出自然语言解释段落。',
  ].join('\n')
}

export const buildResearchVerificationUserPrompt = (input: {
  subject: string
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
}) => {
  const compactEvidences = input.evidences.map(compactEvidence)
  const compactFacts = input.facts.map(compactFact)

  return [
    `研究主体：${input.subject}`,
    '',
    '证据列表：',
    JSON.stringify(compactEvidences, null, 2),
    '',
    '候选事实列表：',
    JSON.stringify(compactFacts, null, 2),
    '',
    '请返回 JSON：',
    '{',
    '  "facts": [',
    '    {',
    '      "factId": "字符串",',
    '      "verificationStatus": "passed | partial | conflict | unverified",',
    '      "sourceDomainCount": 数字,',
    '      "numbers": ["字符串"],',
    '      "timeRefs": ["字符串"],',
    '      "uncertaintyNote": "字符串或空字符串"',
    '    }',
    '  ],',
    '  "passedFactIds": ["字符串"],',
    '  "weakFactIds": ["字符串"],',
    '  "conflictFactIds": ["字符串"],',
    '  "unresolvedItems": ["字符串"]',
    '}',
  ].join('\n')
}
