import type { ResearchConfidence, ResearchEvidence, ResearchFact } from '../../src/shared/research/research-types'

const normalizeUrl = (value?: string) => {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return ''
  }

  try {
    const url = new URL(rawValue)
    url.hash = ''
    return url.toString()
  } catch {
    return rawValue
  }
}

const resolveDomain = (value?: string) => {
  try {
    return new URL(String(value || '').trim()).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

const pickConfidence = (scores: number): ResearchConfidence => {
  if (scores >= 3) {
    return 'high'
  }
  if (scores >= 2) {
    return 'medium'
  }
  return 'low'
}

export class ResearchEvidenceStore {
  private readonly evidences = new Map<string, ResearchEvidence>()

  private readonly evidenceByUrl = new Map<string, string>()

  private readonly facts = new Map<string, ResearchFact>()

  addEvidence(input: Omit<ResearchEvidence, 'confidence'> & { confidence?: ResearchConfidence }) {
    const normalizedUrl = normalizeUrl(input.source.url)
    const existedId = normalizedUrl ? this.evidenceByUrl.get(normalizedUrl) : ''
    if (existedId) {
      return this.evidences.get(existedId) || null
    }

    const confidenceScore = (
      (input.source.sourceType === 'official' ? 2 : 0)
      + (normalizedUrl ? 1 : 0)
      + (Array.isArray(input.tags) && input.tags.length ? 1 : 0)
    )

    const evidence: ResearchEvidence = {
      ...input,
      confidence: input.confidence || pickConfidence(confidenceScore),
      source: {
        ...input.source,
        url: normalizedUrl || input.source.url,
      },
    }

    this.evidences.set(evidence.id, evidence)
    if (normalizedUrl) {
      this.evidenceByUrl.set(normalizedUrl, evidence.id)
    }

    return evidence
  }

  addFact(input: ResearchFact) {
    const normalizedStatement = String(input.statement || '').trim()
    const factId = input.id || `fact-${this.facts.size + 1}`
    const supportedEvidenceIds = Array.from(new Set(input.supportedEvidenceIds.filter(Boolean)))
    const domainSet = new Set(
      supportedEvidenceIds
        .map((evidenceId) => this.evidences.get(evidenceId))
        .map((evidence) => resolveDomain(evidence?.source.url))
        .filter(Boolean),
    )
    const confidence = input.confidence || pickConfidence(domainSet.size + Math.min(supportedEvidenceIds.length, 2))

    const fact: ResearchFact = {
      ...input,
      id: factId,
      statement: normalizedStatement,
      confidence,
      factNature: input.factNature || 'soft_claim',
      supportedEvidenceIds,
      directSourceDomainCount: typeof input.directSourceDomainCount === 'number' ? input.directSourceDomainCount : domainSet.size,
      independentSourceDomainCount: typeof input.independentSourceDomainCount === 'number' ? input.independentSourceDomainCount : domainSet.size,
      sourceDomainCount: typeof input.sourceDomainCount === 'number' ? input.sourceDomainCount : domainSet.size,
    }

    this.facts.set(fact.id, fact)
    return fact
  }

  listEvidence() {
    return Array.from(this.evidences.values())
  }

  listFacts() {
    return Array.from(this.facts.values())
  }

  updateFact(factId: string, updater: (current: ResearchFact) => ResearchFact) {
    const current = this.facts.get(factId)
    if (!current) {
      return null
    }

    const next = updater(current)
    this.facts.set(factId, next)
    return next
  }

  getEvidenceByIds(ids: string[]) {
    const idSet = new Set(ids)
    return this.listEvidence().filter((item) => idSet.has(item.id))
  }

  getCoverageSummary() {
    const evidences = this.listEvidence()
    const facts = this.listFacts()
    return {
      evidenceCount: evidences.length,
      factCount: facts.length,
      domainCount: new Set(
        evidences
          .map((item) => resolveDomain(item.source.url))
          .filter(Boolean),
      ).size,
    }
  }
}
