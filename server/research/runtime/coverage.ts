// 研究证据覆盖率统计与决策助手。
// 用于判断深读循环是否继续、生成未解决项提示词。

import type { ResearchEvidence } from '../../../src/shared/research/research-types'
import type { ResearchEvidenceStore } from '../evidence-store'

export const isExternalResearchEvidence = (evidence: ResearchEvidence) => {
  const sourceType = String(evidence.source?.sourceType || '').trim()
  return Boolean(evidence.source?.url)
    && sourceType !== 'user-input'
    && sourceType !== 'internal-plan'
    && evidence.entityMatched !== false
}

export const summarizeResearchCoverage = (evidenceStore: ResearchEvidenceStore) => {
  const coverage = evidenceStore.getCoverageSummary()
  const externalEvidenceCount = evidenceStore.listEvidence().filter(isExternalResearchEvidence).length
  return {
    evidenceCount: coverage.evidenceCount,
    factCount: coverage.factCount,
    domainCount: coverage.domainCount,
    externalEvidenceCount,
  }
}

export const shouldContinueDeepReading = (
  evidenceStore: ResearchEvidenceStore,
  remainingTargets: number,
) => {
  if (remainingTargets <= 0) {
    return false
  }

  const coverage = summarizeResearchCoverage(evidenceStore)
  if (coverage.externalEvidenceCount < 4) {
    return true
  }
  if (coverage.factCount < 8) {
    return true
  }
  if (coverage.domainCount < 3) {
    return true
  }

  return false
}

export const buildResearchUnresolvedItems = (evidenceStore: ResearchEvidenceStore) => {
  const coverage = summarizeResearchCoverage(evidenceStore)
  return Array.from(new Set([
    ...(coverage.externalEvidenceCount <= 0 ? ['当前未读取到稳定的外部深读信源，报告将更多依赖搜索结果与行业常识展开。'] : []),
    ...(coverage.externalEvidenceCount > 0 && coverage.externalEvidenceCount < 3 ? ['当前外部深读信源仍然偏少，部分判断更多来自有限样本。'] : []),
    ...(coverage.factCount <= 0 ? ['当前尚未沉淀出稳定事实条目，正文将以框架分析和趋势判断为主。'] : []),
    ...(coverage.factCount > 0 && coverage.factCount < 6 ? ['当前已沉淀的稳定事实仍然有限，部分章节会偏向趋势判断而非高密度事实陈列。'] : []),
    ...(coverage.domainCount > 0 && coverage.domainCount < 3 ? ['当前独立来源域名覆盖仍然偏窄，交叉印证强度有限。'] : []),
  ]))
}
