// intake 阶段为研究任务播种的最小证据集合，以及证据 URL → sourceType 的归一化。

import { isWorkspaceProjectResearchPrompt } from '../planner'
import type {
  ResearchEvidence,
  ResearchVerificationResult,
} from '../../../src/shared/research/research-types'

export const buildSeedEvidence = (prompt: string, subject: string): ResearchEvidence[] => {
  const evidences: ResearchEvidence[] = [
    {
      id: 'evidence-user-goal',
      title: '用户目标输入',
      summary: '已明确当前任务属于深度研究任务，需要结构化搜索、阅读、核查与报告输出。',
      source: {
        title: '用户输入',
        sourceType: 'user-input',
        note: `研究主题围绕 ${subject}`,
      },
      confidence: 'high',
      tags: ['任务定义', '需求边界'],
      entityMatched: true,
      authorityHints: ['用户直接提出的研究需求'],
      freshnessSignals: [],
      extractedFacts: ['任务目标是输出接近 http_raw5.txt 的研究工作流结果'],
      extractedClaims: [],
      extractedNumbers: [],
      contradictions: [],
    },
  ]

  if (isWorkspaceProjectResearchPrompt(prompt)) {
    evidences.push({
      id: 'evidence-architecture',
      title: '项目任务系统基础设施',
      summary: '当前项目已具备 generation-tasks、SSE 订阅、记录持久化与任务停止机制，适合直接扩展研究策略。',
      source: {
        title: '当前仓库结构',
        sourceType: 'internal-plan',
      },
      confidence: 'high',
      tags: ['落地环境', '接入路径'],
      entityMatched: true,
      authorityHints: ['仓库现状可验证'],
      freshnessSignals: [],
      extractedFacts: ['研究任务可复用现有生成任务基础设施'],
      extractedClaims: [],
      extractedNumbers: [],
      contradictions: [],
    })
  }

  return evidences
}

export const resolveSourceType = (url: string) => {
  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./i, '')
    } catch {
      return ''
    }
  })()

  if (!hostname) {
    return 'article' as const
  }
  if (
    hostname.includes('github.com')
    || hostname.includes('gitlab.com')
    || hostname.endsWith('.gov')
    || hostname.endsWith('.edu')
    || hostname.includes('docs.')
  ) {
    return 'official' as const
  }
  return 'search-result' as const
}

export const buildEmptyResearchVerificationResult = (): ResearchVerificationResult => ({
  verdict: 'partial',
  checkedFacts: 0,
  passedFacts: [],
  weakFacts: [],
  conflictFacts: [],
  unresolvedItems: [],
})
