import type { ResearchFact, ResearchVerificationResult } from '../../src/shared/research/research-types'
import type { ResearchEvidenceStore } from './evidence-store'

const resolveDomain = (value?: string) => {
  try {
    return new URL(String(value || '').trim()).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

const normalizeText = (value?: string) => String(value || '').trim().toLowerCase()

const collectEvidenceDomains = (fact: ResearchFact, store: ResearchEvidenceStore) => {
  const evidences = store.getEvidenceByIds(fact.supportedEvidenceIds)
  const evidenceDomains = new Set<string>()
  const discoveryDomains = new Set<string>()
  const providerSet = new Set<string>()

  for (const evidence of evidences) {
    const sourceDomain = resolveDomain(evidence.source.url)
    if (sourceDomain) {
      evidenceDomains.add(sourceDomain)
    }

    if (evidence.discovery?.provider) {
      providerSet.add(String(evidence.discovery.provider || '').trim())
    }

    for (const source of evidence.discovery?.searchSources || []) {
      const discoveryDomain = resolveDomain(source.url)
      if (discoveryDomain) {
        discoveryDomains.add(discoveryDomain)
      }
    }
  }

  return {
    evidences,
    evidenceDomains,
    discoveryDomains,
    providerSet,
    independentDomains: new Set(
      [...discoveryDomains].filter((domain) => !evidenceDomains.has(domain)),
    ),
    allDomains: new Set([...evidenceDomains, ...discoveryDomains]),
  }
}

const hasLowAuthorityRisk = (domains: Set<string>, evidences: Array<ReturnType<ResearchEvidenceStore['listEvidence']>[number]>) => {
  if (!evidences.length) {
    return true
  }

  const hasOfficialHint = evidences.some((item) => item.source.sourceType === 'official')
    || Array.from(domains).some((domain) => domain.endsWith('.gov') || domain.endsWith('.edu'))
    || evidences.some((item) => (item.authorityHints || []).some((hint) => /官方|权威|文档|github/i.test(hint)))

  return !hasOfficialHint
}

const hasNumberConflict = (fact: ResearchFact, evidences: Array<ReturnType<ResearchEvidenceStore['listEvidence']>[number]>) => {
  const factNumbers = new Set((fact.numbers || []).map(item => normalizeText(item)).filter(Boolean))
  if (!factNumbers.size) {
    return false
  }

  const evidenceNumbers = new Set(
    evidences
      .flatMap((item) => item.extractedNumbers || [])
      .map((item) => normalizeText(item))
      .filter(Boolean),
  )

  if (!evidenceNumbers.size) {
    return false
  }

  return Array.from(factNumbers).some((item) => !evidenceNumbers.has(item))
}

const hasTimeConflict = (fact: ResearchFact, evidences: Array<ReturnType<ResearchEvidenceStore['listEvidence']>[number]>) => {
  const factTimes = new Set((fact.timeRefs || []).map(item => normalizeText(item)).filter(Boolean))
  if (!factTimes.size) {
    return false
  }

  const evidenceTimes = new Set(
    evidences
      .flatMap((item) => item.freshnessSignals || [])
      .map((item) => normalizeText(item))
      .filter(Boolean),
  )

  if (!evidenceTimes.size) {
    return false
  }

  return Array.from(factTimes).some((item) => !evidenceTimes.has(item))
}

const hasExplicitContradiction = (fact: ResearchFact, evidences: Array<ReturnType<ResearchEvidenceStore['listEvidence']>[number]>) => {
  const statement = normalizeText(fact.statement)
  return evidences.some((item) =>
    (item.contradictions || []).some((entry) => {
      const normalizedEntry = normalizeText(entry)
      return normalizedEntry && (normalizedEntry.includes(statement) || statement.includes(normalizedEntry))
    }),
  )
}

const verifyFact = (fact: ResearchFact, store: ResearchEvidenceStore) => {
  const {
    evidences,
    evidenceDomains,
    discoveryDomains,
    independentDomains,
    providerSet,
    allDomains,
  } = collectEvidenceDomains(fact, store)
  const domainCount = allDomains.size
  const directDomainCount = evidenceDomains.size
  const independentDomainCount = independentDomains.size
  const lowAuthorityRisk = hasLowAuthorityRisk(allDomains, evidences)
  const numberConflict = hasNumberConflict(fact, evidences)
  const timeConflict = hasTimeConflict(fact, evidences)
  const explicitContradiction = hasExplicitContradiction(fact, evidences)
  const factNature = fact.factNature || 'soft_claim'
  const weakReasonParts: string[] = []

  if (!evidences.length) {
    return {
      fact: {
        ...fact,
        directSourceDomainCount: directDomainCount,
        independentSourceDomainCount: independentDomainCount,
        sourceDomainCount: domainCount,
        verificationStatus: 'unverified',
        uncertaintyNote: fact.uncertaintyNote || '缺少可引用证据',
      },
      passed: false,
      reason: `事实“${fact.statement}”缺少可引用证据`,
      category: 'weak' as const,
    }
  }

  if (fact.verificationStatus === 'conflict' || explicitContradiction || numberConflict || timeConflict) {
    const conflictReasons = [
      fact.uncertaintyNote,
      explicitContradiction ? '存在显式矛盾证据' : '',
      numberConflict ? '数字信息与证据提取结果不一致' : '',
      timeConflict ? '时间或版本信息与证据提取结果不一致' : '',
    ].filter(Boolean)

    return {
      fact: {
        ...fact,
        directSourceDomainCount: directDomainCount,
        independentSourceDomainCount: independentDomainCount,
        sourceDomainCount: domainCount,
        verificationStatus: 'conflict',
        uncertaintyNote: conflictReasons.join('；') || `事实“${fact.statement}”存在冲突`,
      },
      passed: false,
      reason: conflictReasons.join('；') || `事实“${fact.statement}”存在冲突`,
      category: 'conflict' as const,
    }
  }

  if (evidences.length < 2) {
    weakReasonParts.push(`仅有 ${evidences.length} 条直接证据`)
  }
  if (directDomainCount < 1) {
    weakReasonParts.push('缺少直接落地证据域名')
  }
  if (domainCount < 2) {
    weakReasonParts.push(`仅有 ${domainCount} 个来源域名`)
  }
  if (independentDomainCount < 1) {
    weakReasonParts.push('缺少与直接证据不同的独立来源域名')
  }
  if (providerSet.size < 1) {
    weakReasonParts.push('缺少搜索 provider 发现链')
  }
  if (!discoveryDomains.size) {
    weakReasonParts.push('缺少结构化 search_sources 来源链')
  }
  if (lowAuthorityRisk) {
    weakReasonParts.push('当前证据缺少明显高权威来源')
  }
  if (factNature === 'soft_claim') {
    weakReasonParts.push('该条目属于软判断，默认需要更强交叉支撑')
  }
  if (factNature === 'framework_claim') {
    weakReasonParts.push('该条目属于框架性概括，不宜直接视为可证实硬事实')
  }

  if (
    factNature === 'hard_fact'
    && !weakReasonParts.length
    && fact.verificationStatus !== 'partial'
    && fact.verificationStatus !== 'unverified'
  ) {
    return {
      fact: {
        ...fact,
        directSourceDomainCount: directDomainCount,
        independentSourceDomainCount: independentDomainCount,
        sourceDomainCount: domainCount,
        verificationStatus: 'passed',
        uncertaintyNote: '',
      },
      passed: true,
      reason: '',
      category: 'passed' as const,
    }
  }

  const uncertaintyNote = fact.uncertaintyNote || weakReasonParts.join('；')
  return {
    fact: {
      ...fact,
      directSourceDomainCount: directDomainCount,
      independentSourceDomainCount: independentDomainCount,
      sourceDomainCount: domainCount,
      verificationStatus: 'partial',
      uncertaintyNote,
    },
    passed: false,
    reason: uncertaintyNote || `事实“${fact.statement}”当前支持度不足`,
    category: 'weak' as const,
  }
}

export const verifyResearchEvidence = (store: ResearchEvidenceStore): ResearchVerificationResult => {
  const facts = store.listFacts()
  if (!facts.length) {
    return {
      verdict: 'blocked',
      checkedFacts: 0,
      passedFacts: [],
      weakFacts: [],
      conflictFacts: [],
      unresolvedItems: ['当前尚未沉淀出稳定事实，无法执行交叉验证'],
    }
  }

  const results = facts.map((fact) => verifyFact(fact, store))
  const unresolvedItems = results.filter((item) => !item.passed).map((item) => item.reason)
  const passedCount = results.length - unresolvedItems.length
  const passedFacts = results.filter((item) => item.category === 'passed').map((item) => item.fact)
  const weakFacts = results.filter((item) => item.category === 'weak').map((item) => item.fact)
  const conflictFacts = results.filter((item) => item.category === 'conflict').map((item) => item.fact)

  if (!unresolvedItems.length) {
    return {
      verdict: 'passed',
      checkedFacts: results.length,
      passedFacts,
      weakFacts: [],
      conflictFacts: [],
      unresolvedItems: [],
    }
  }

  return {
    verdict: passedCount > 0 ? 'partial' : 'blocked',
    checkedFacts: results.length,
    passedFacts,
    weakFacts,
    conflictFacts,
    unresolvedItems,
  }
}
