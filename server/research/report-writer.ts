import type {
  ResearchEvidence,
  ResearchFact,
  ResearchOutlineSection,
  ResearchPlanSnapshot,
  ResearchVerificationResult,
} from '../../src/shared/research/research-types'
import { runResearchStageModel } from './model-runner'
import { buildResearchReportWritingSystemPrompt, buildResearchReportWritingUserPrompt } from './prompts/report-writing'

type ReferenceAppendixItem = {
  index?: number
  title: string
  url: string
}

const buildEvidenceLines = (evidences: ResearchEvidence[]) => {
  if (!evidences.length) {
    return '- 当前轮次尚无外部证据，后续需接入真实搜索与网页阅读结果。\n'
  }

  return evidences.map((item) => (
    `- ${item.title}：${item.summary}（置信度：${item.confidence}${item.discovery?.provider ? `，发现来源：${item.discovery.provider}` : ''}${item.discovery?.searchSources?.length ? `，候选信源：${item.discovery.searchSources.length}` : ''}）`
  )).join('\n') + '\n'
}

const buildFactLines = (facts: ResearchFact[]) => {
  if (!facts.length) {
    return '- 当前尚未沉淀出稳定事实，需继续补齐独立来源与交叉验证。\n'
  }

  return facts.map((item) => (
    `- ${item.statement}（语义：${item.factNature || 'soft_claim'}，置信度：${item.confidence}，核查状态：${item.verificationStatus || 'unverified'}${item.sourceDomainCount ? `，来源域名：${item.sourceDomainCount}` : ''}${item.independentSourceDomainCount !== undefined ? `，独立补充域名：${item.independentSourceDomainCount}` : ''}${item.uncertaintyNote ? `，备注：${item.uncertaintyNote}` : ''}）`
  )).join('\n') + '\n'
}

const extractReferencedIndexes = (report: string) => {
  return Array.from(new Set(
    Array.from(String(report || '').matchAll(/\[(\d+)\]/g))
      .map(match => Number(match[1]))
      .filter(index => Number.isFinite(index) && index > 0),
  )).sort((left, right) => left - right)
}

const buildReferenceAppendixItems = (report: string, evidences: ResearchEvidence[]) => {
  const citedIndexes = extractReferencedIndexes(report)
  const byReferenceIndex = new Map<number, ReferenceAppendixItem>()
  const byUrl = new Map<string, ReferenceAppendixItem>()

  for (const evidence of evidences) {
    const searchSources = Array.isArray(evidence.discovery?.searchSources) ? evidence.discovery?.searchSources || [] : []
    for (const source of searchSources) {
      const url = String(source.url || '').trim()
      const index = Number(source.referenceIndex)
      if (!url || !Number.isFinite(index) || index <= 0 || byReferenceIndex.has(index)) {
        continue
      }

      const item = {
        index,
        title: String(source.title || evidence.source?.title || evidence.title || `参考资料 ${index}`).trim() || `参考资料 ${index}`,
        url,
      } satisfies ReferenceAppendixItem
      byReferenceIndex.set(index, item)
      if (!byUrl.has(url)) {
        byUrl.set(url, item)
      }
    }
  }

  const orderedItems: ReferenceAppendixItem[] = []
  const usedUrls = new Set<string>()
  for (const index of citedIndexes) {
    const matched = byReferenceIndex.get(index)
    if (!matched || usedUrls.has(matched.url)) {
      continue
    }
    orderedItems.push(matched)
    usedUrls.add(matched.url)
  }

  for (const evidence of evidences) {
    const url = String(evidence.source?.url || '').trim()
    if (!url || usedUrls.has(url)) {
      continue
    }

    const existing = byUrl.get(url)
    const item = existing || {
      title: String(evidence.source?.title || evidence.title || '参考资料').trim() || '参考资料',
      url,
    }
    orderedItems.push(item)
    usedUrls.add(url)

    if (orderedItems.length >= 24) {
      break
    }
  }

  return orderedItems.slice(0, 24)
}

const buildReferenceAppendix = (report: string, evidences: ResearchEvidence[]) => {
  const lines = buildReferenceAppendixItems(report, evidences)
    .map((item, index) => `${item.index || index + 1}. [${item.title}](${item.url})`)

  if (!lines.length) {
    return ''
  }

  return [
    '## 参考资料',
    '',
    ...lines,
  ].join('\n')
}

const writeSectionContent = (
  section: ResearchOutlineSection,
  snapshot: ResearchPlanSnapshot,
  evidences: ResearchEvidence[],
  facts: ResearchFact[],
  verification: ResearchVerificationResult,
) => {
  switch (section.id) {
    case 'overview':
      return [
        `本次研究对象为“${snapshot.subject}”，目标是围绕“${snapshot.goal}”构建一套可执行的深度研究工作流。`,
        '',
        '当前版本先复刻工作流骨架，不直接声称已完成真实外部事实研究。',
      ].join('\n')
    case 'workflow':
      return [
        '推荐采用“动态规划 + 边搜边推”的执行范式：',
        '',
        '- 先生成初始研究维度，而不是一次性写死完整计划。',
        '- 首轮并行搜索后立即复盘，识别信息缺口与主体歧义。',
        '- 根据缺口进入补搜、深读、核查和报告写作的闭环。',
      ].join('\n')
    case 'tools':
      return [
        '核心工具建议拆分为以下几类：',
        '',
        '- `web-search`：宽覆盖搜索，负责发现候选来源。',
        '- `web-reader`：对高价值页面进行深读与结构化提取。',
        '- `gap-analyzer`：根据当前证据识别缺口与下一步查询。',
        '- `fact-verifier`：对关键事实做交叉验证与冲突标注。',
        '- `start-report`：在证据达到阈值后启动报告写作。',
      ].join('\n')
    case 'state':
      return [
        '建议使用显式状态机管理研究任务：',
        '',
        `- 当前规划包含 ${snapshot.outline.length} 个核心报告章节。`,
        `- 首轮查询数：${snapshot.initialQueries.length}。`,
        `- 定向补搜查询数：${snapshot.targetQueries.length}。`,
      ].join('\n')
    case 'risks':
      return [
        '核查与止损机制建议如下：',
        '',
        buildEvidenceLines(evidences).trimEnd(),
        '',
        `当前核查结果：${verification.verdict}，已检查 ${verification.checkedFacts} 条关键事实。`,
        verification.unresolvedItems.length
          ? `未解决项：${verification.unresolvedItems.join('；')}`
          : '当前未发现新增未解决项。',
      ].join('\n')
    case 'landing':
      return [
        '基于当前项目，建议优先完成三件事：',
        '',
        buildFactLines(facts).trimEnd(),
        '',
        '- 当前后端已具备真实搜索、网页阅读、证据核查和研究报告输出闭环。',
        '- 下一步可以补前端研究轨迹视图，展示阶段、工具调用、证据和报告增量。',
      ].join('\n')
    default:
      return `${section.objective}\n\n需要根据实际研究结果补齐该章节内容。`
  }
}

export const buildResearchReportSections = (input: {
  snapshot: ResearchPlanSnapshot
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
  verification: ResearchVerificationResult
}) => {
  return input.snapshot.outline.map((section) => ({
    section,
    content: writeSectionContent(section, input.snapshot, input.evidences, input.facts, input.verification),
  }))
}

export const writeResearchSectionWithModel = async (input: {
  payloadRequestBody: Record<string, unknown> | null | undefined
  modelKey: string
  subject: string
  goal: string
  section: ResearchOutlineSection
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
  unresolvedItems: string[]
  signal: AbortSignal
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
}) => {
  const result = await runResearchStageModel<{
    content?: string
  }>({
    payloadRequestBody: input.payloadRequestBody,
    modelKey: input.modelKey,
    systemPrompt: buildResearchReportWritingSystemPrompt(),
    userPrompt: buildResearchReportWritingUserPrompt({
      subject: input.subject,
      goal: input.goal,
      section: input.section,
      evidences: input.evidences,
      facts: input.facts,
      unresolvedItems: input.unresolvedItems,
    }),
    signal: input.signal,
    stage: `report_writing_${input.section.id}`,
    logGenerationTask: input.logGenerationTask,
  })
  return {
    content: String(result.data.content || '').trim(),
    usage: result.usage,
  }
}

export const appendResearchReferenceAppendix = (report: string, evidences: ResearchEvidence[]) => {
  const appendix = buildReferenceAppendix(report, evidences)
  if (!appendix) {
    return report.trim()
  }

  const normalizedReport = report.trim()
  if (normalizedReport.includes('## 参考资料')) {
    return normalizedReport
  }

  return `${normalizedReport}\n\n${appendix}`.trim()
}
