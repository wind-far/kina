import fs from 'node:fs'
import { normalizeResearchTaskConfig } from '../../src/shared/research/research-budget'
import type {
  ResearchOutlineSection,
  ResearchPrimaryFrame,
  ResearchPlanSnapshot,
  ResearchQueryPlan,
  ResearchTaskConfig,
  ResearchMode,
} from '../../src/shared/research/research-types'
import { RESEARCH_DEFAULT_AXES } from './constants'

const STOPWORDS = new Set([
  '请', '帮我', '帮忙', '深度', '研究', '当前', '项目', '输出', '实现', '现状', '主要', '风险', '下一步',
  '改造', '重点', '分析', '一下', '一个', '一些', '以及', '需要', '关于', '基于', '完整', '工作流',
  '后端', '前端', '这个', '那个', '进行', '相关', '报告', '总结', '什么', '如何', '设计', '方案',
  '目前', '现在', '请你', '给我', '帮我做', '基于以上', '以上', '当前项目', '当前项目的', '完整的', '推理框架',
  '深度调研', '深度调研当前项目的',
  '明确', '用户', '意图', '可能', '包括', '作为', '进行分析', '产品', '特性', '你怎么看', '怎么看',
])

type WorkspaceResearchIdentity = {
  repoName: string
  displayName: string
  repoPath: string
  owner: string
  aliases: string[]
}

export const isWorkspaceProjectResearchPrompt = (prompt: string) => {
  return /(当前项目|本项目|这个项目|当前仓库|本仓库|这个仓库|当前代码库|本代码库)/u.test(prompt)
}

const cleanSegment = (value: string) => {
  return String(value || '')
    .replace(/[“”"'`]/g, ' ')
    .replace(/[^\p{L}\p{N}\s/_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const normalizeKeyword = (value: string) => cleanSegment(value).toLowerCase()

const splitTokens = (value: string) => cleanSegment(value)
  .split(/\s+/)
  .map(item => item.trim())
  .filter(Boolean)

const stripPromptQuestionTail = (value: string) => {
  return String(value || '')
    .replace(/[?？!！。]+$/gu, '')
    .replace(/(你怎么看|怎么看|如何看待|如何理解|怎么理解|是否成立|意味着什么|说明什么|对吗|吗)\s*$/u, '')
    .trim()
}

const isStopword = (value: string) => STOPWORDS.has(normalizeKeyword(value))

const isUsefulKeyword = (value: string) => {
  const keyword = cleanSegment(value)
  if (!keyword || keyword.length < 2) {
    return false
  }

  if (isStopword(keyword)) {
    return false
  }

  if (/^\d+$/u.test(keyword)) {
    return false
  }

  return true
}

const stripPromptShell = (value: string) => {
  return cleanSegment(value)
    .replace(/^(请深度研究|请深度调研|请研究|深度研究|深度调研|研究|分析|拆解|复刻|实现)\s*/u, '')
    .replace(/^当前项目的\s*/u, '')
    .replace(/^当前项目\s*/u, '')
    .replace(/^本项目的\s*/u, '')
    .replace(/^本项目\s*/u, '')
    .replace(/\s*(输出|并输出|给出|整理|总结)(.*)$/u, '')
    .replace(/\s*(实现现状|主要风险|下一步改造重点|改造重点|落地方案|完整方案|完整框架).*$/u, '')
    .trim()
}

const hasCjkText = (value: string) => /[\u3400-\u9fff]/u.test(value)

const OPEN_TOPIC_HINTS = [
  '节日', '教育', '旅游', '消费', '文化', '历史', '医疗', '农业', '零售', '品牌', '电影', '音乐',
  '体育', '城市', '能源', '环保', '就业', '人口', '治理', '金融', '安全', '创新', '社区',
]

const PARALLEL_PROPOSITION_PREFIXES = [
  '短期', '中期', '长期', '近期', '当下', '眼下', '未来', '永远', '始终', '一直',
]

const looksLikeModelExpandedSubject = (value: string) => {
  const normalized = cleanSegment(value)
  if (!normalized) {
    return false
  }

  return normalized.length > 18
      || /(可能|包括|作为|明确|用户意图|食材|解剖结构|产品特性|进行分析)/u.test(normalized)
}

const resolvePromptSubjectCandidate = (prompt: string, keywords: string[]) => {
  const strippedPrompt = stripPromptShell(prompt)
  if (strippedPrompt && strippedPrompt.length <= 18) {
    return strippedPrompt
  }

  const usefulKeywords = keywords.filter(isUsefulKeyword)
  const cjkKeyword = usefulKeywords.find(item => hasCjkText(item) && item.length <= 12)
  return cjkKeyword || usefulKeywords[0] || strippedPrompt || '当前研究对象'
}

const extractParallelPropositionClauses = (prompt: string) => {
  const strippedPrompt = stripPromptQuestionTail(String(prompt || '')
    .replace(/^(请深度研究|请深度调研|请研究|深度研究|深度调研|研究|分析|拆解|复刻|实现)\s*/u, '')
    .replace(/^关于/u, '')
    .trim())
  if (!strippedPrompt) {
    return []
  }

  const rawClauses = strippedPrompt
    .split(/[，,；;、]\s*/u)
    .map(item => cleanSegment(item))
    .filter(Boolean)

  if (rawClauses.length < 2) {
    return []
  }

  const clauses = rawClauses
    .map(item => item.replace(/^(以及|还有|并且|而|但|那么)\s*/u, '').trim())
    .filter(item => item.length >= 3 && item.length <= 18)

  if (clauses.length < 2) {
    return []
  }

  const temporalLeadCount = clauses.filter(
    item => PARALLEL_PROPOSITION_PREFIXES.some(prefix => item.startsWith(prefix)),
  ).length

  if (temporalLeadCount >= 2) {
    return Array.from(new Set(clauses))
  }

  const conciseClauseCount = clauses.filter(item => item.length <= 10).length
  if (conciseClauseCount >= 2 && clauses.length === rawClauses.length) {
    return Array.from(new Set(clauses))
  }

  return []
}

const formatParallelSubject = (clauses: string[]) => Array.from(new Set(clauses)).join(' / ')

const getComparativeSubjects = (prompt: string, subject: string) => {
  const promptClauses = extractParallelPropositionClauses(prompt)
  if (promptClauses.length >= 2) {
    return promptClauses
  }

  return cleanSegment(subject)
    .split(/\s*\/\s*/u)
    .map(item => cleanSegment(item))
    .filter(Boolean)
}

let workspaceIdentityCache: WorkspaceResearchIdentity | null | undefined

const readWorkspaceIdentity = (): WorkspaceResearchIdentity | null => {
  if (workspaceIdentityCache !== undefined) {
    return workspaceIdentityCache
  }

  try {
    const packageJsonPath = new URL('../../package.json', import.meta.url)
    const readmePath = new URL('../../README.md', import.meta.url)
    const gitConfigPath = new URL('../../.git/config', import.meta.url)
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      name?: string
      description?: string
    }
    const readmeText = fs.readFileSync(readmePath, 'utf8')
    const gitConfigText = fs.readFileSync(gitConfigPath, 'utf8')
    const displayName = readmeText.match(/^#\s+(.+)$/m)?.[1]?.trim() || ''
    const repoName = String(packageJson.name || '').trim()
    const repoPathMatch = gitConfigText.match(/github\.com[:/]([^/\s]+\/[^.\s]+)(?:\.git)?/i)
    const repoPath = cleanSegment(repoPathMatch?.[1] || '')
    const owner = cleanSegment(repoPath.split('/')[0] || '')
    const aliases = [displayName, repoName, repoName.replace(/-/g, ' '), repoPath, owner]
      .map(item => cleanSegment(item))
      .filter(Boolean)

    workspaceIdentityCache = aliases.length
      ? {
          repoName,
          displayName: cleanSegment(displayName) || cleanSegment(repoName),
          repoPath,
          owner,
          aliases: Array.from(new Set(aliases)),
        }
      : null
  } catch {
    workspaceIdentityCache = null
  }

  return workspaceIdentityCache
}

const inferProjectSubject = (prompt: string, subjectCandidate: string) => {
  if (!isWorkspaceProjectResearchPrompt(prompt)) {
    return stripPromptShell(subjectCandidate)
  }

  const workspaceIdentity = readWorkspaceIdentity()
  if (!workspaceIdentity) {
    return stripPromptShell(subjectCandidate)
  }

  const cleanedCandidate = stripPromptShell(subjectCandidate)
  let tail = cleanedCandidate
    .replace(/^(Deep Research|AI|CanvasMind|canana-vue)\s*/iu, '')
    .trim()
  for (const alias of workspaceIdentity.aliases) {
    if (!alias) {
      continue
    }
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    tail = tail.replace(new RegExp(escapedAlias, 'igu'), ' ').replace(/\s+/g, ' ').trim()
  }
  tail = tail.replace(/^[/\s_-]+|[/\s_-]+$/g, '').trim()
  const subjectParts = [
    workspaceIdentity.repoPath,
    workspaceIdentity.displayName,
    workspaceIdentity.repoName && workspaceIdentity.repoName !== workspaceIdentity.displayName
      ? workspaceIdentity.repoName
      : '',
    workspaceIdentity.owner,
    tail,
  ].map(item => cleanSegment(item)).filter(Boolean)

  return Array.from(new Set(subjectParts)).join(' ')
}

const collectWorkspaceAnchors = () => {
  const workspaceIdentity = readWorkspaceIdentity()
  if (!workspaceIdentity) {
    return []
  }

  return Array.from(new Set([
    workspaceIdentity.displayName,
    workspaceIdentity.repoName,
    workspaceIdentity.owner,
    workspaceIdentity.repoPath,
  ].map(item => cleanSegment(item)).filter(Boolean)))
}

export const resolveResearchSubject = (prompt: string, subjectCandidate?: string) => {
  const parallelClauses = extractParallelPropositionClauses(prompt)
  if (parallelClauses.length >= 2) {
    return formatParallelSubject(parallelClauses)
  }

  const promptKeywords = pickPromptKeywords(prompt)
  const promptSubject = resolvePromptSubjectCandidate(prompt, promptKeywords)
  const candidate = stripPromptShell(String(subjectCandidate || '').trim())
  const fallback = !isWorkspaceProjectResearchPrompt(prompt) && looksLikeModelExpandedSubject(candidate)
    ? promptSubject
    : candidate || promptSubject
  return inferProjectSubject(prompt, fallback)
}

export const collectResearchQueryAnchors = (prompt: string, subject: string) => {
  const anchors = [
    ...(isWorkspaceProjectResearchPrompt(prompt) ? collectWorkspaceAnchors() : []),
    ...getComparativeSubjects(prompt, subject),
    ...splitTokens(resolveResearchSubject(prompt, subject)).filter(isUsefulKeyword),
  ]

  return Array.from(new Set(anchors.map(item => cleanSegment(item)).filter(Boolean))).slice(0, 6)
}

const buildQuerySubject = (prompt: string, subject: string, goal: string, keywords: string[]) => {
  const workspaceIdentity = readWorkspaceIdentity()
  const baseSubject = buildSubjectVariants(subject, goal, keywords)[0] || subject
  if (!isWorkspaceProjectResearchPrompt(prompt) || !workspaceIdentity?.repoPath) {
    return baseSubject
  }

  const parts = [
    workspaceIdentity.displayName,
    workspaceIdentity.owner,
    workspaceIdentity.repoPath,
  ].map(item => cleanSegment(item)).filter(Boolean)

  return Array.from(new Set(parts)).join(' ') || baseSubject
}

const pickPromptKeywords = (prompt: string) => {
  const strippedPrompt = stripPromptQuestionTail(stripPromptShell(prompt))
  const seen = new Set<string>()
  const result: string[] = []
  const englishPhraseWords = new Set<string>()

  for (const matched of (strippedPrompt || prompt).match(/[A-Za-z][A-Za-z0-9_-]*(?:\s+[A-Za-z][A-Za-z0-9_-]*)+/g) || []) {
    const phrase = cleanSegment(matched)
    const normalized = normalizeKeyword(phrase)
    if (!isUsefulKeyword(phrase) || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(phrase)
    for (const token of splitTokens(phrase)) {
      englishPhraseWords.add(normalizeKeyword(token))
    }
  }

  for (const token of splitTokens(strippedPrompt || prompt)) {
    const normalized = normalizeKeyword(token)
    if (englishPhraseWords.has(normalized)) {
      continue
    }
    if (!isUsefulKeyword(token) || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(cleanSegment(token))
  }

  return result.slice(0, 8)
}

const extractSubject = (prompt: string, keywords: string[]) => {
  const cleanedPrompt = cleanSegment(prompt)
  const byPattern = [
    /(?:研究|分析|拆解|复刻|实现|评估)(.+?)(?:的|其)?(?:后端工作流|工作流|方案|架构|实现现状|主要风险|下一步改造重点)/u,
    /(?:关于|围绕)(.+?)(?:的|其)?(?:后端工作流|工作流|方案|架构)/u,
  ]

  for (const pattern of byPattern) {
    const matched = cleanedPrompt.match(pattern)
    const candidate = inferProjectSubject(prompt, matched?.[1] || '')
    if (candidate && candidate.length >= 2) {
      return candidate
    }
  }

  return inferProjectSubject(prompt, resolvePromptSubjectCandidate(prompt, keywords))
}

const extractUrls = (prompt: string) => {
  return Array.from(prompt.matchAll(/https?:\/\/[^\s]+/g)).map(item => item[0])
}

const inferResearchMode = (prompt: string, subject: string, urls: string[]): ResearchMode => {
  if (urls.length > 0 || isWorkspaceProjectResearchPrompt(prompt)) {
    return 'entity_topic'
  }

  if (/(对比|比较|差异|vs|VS)/u.test(prompt) || extractParallelPropositionClauses(prompt).length >= 2) {
    return 'comparative_topic'
  }

  const normalizedSubject = cleanSegment(subject)
  if (OPEN_TOPIC_HINTS.some(item => normalizedSubject.includes(item))) {
    return 'open_topic'
  }

  if (normalizedSubject.length <= 12 && hasCjkText(normalizedSubject) && !/\//.test(normalizedSubject)) {
    return 'open_topic'
  }

  return 'entity_topic'
}

const inferPrimaryFrame = (prompt: string, subject: string): ResearchPrimaryFrame => {
  const normalized = `${prompt} ${subject}`
  if (/(营销|转化|品牌|电商|消费|用户增长|ROI|促销)/u.test(normalized)) {
    return '商业营销'
  }
  if (/(数据|统计|时间序列|预测|指标|分析方法|方法论|测量)/u.test(normalized)) {
    return '数据方法'
  }
  if (/(文化|历史|传统|社会|民俗|宗教|认同|仪式)/u.test(normalized)) {
    return '文化历史'
  }
  return '综合框架'
}

const buildAxesByMode = (
  researchMode: ResearchMode,
  primaryFrame: ResearchPrimaryFrame,
  comparativeSubjects: string[] = [],
) => {
  if (researchMode === 'entity_topic') {
    return RESEARCH_DEFAULT_AXES.map(axis => axis)
  }

  if (researchMode === 'comparative_topic') {
    const propositionAxes = comparativeSubjects
      .slice(0, 3)
      .map((item, index) => `命题 ${index + 1}：${item}`)
    return [
      ...propositionAxes,
      '研究对象与比较范围',
      '核心约束与驱动因素',
      '三者之间的联动关系',
      '方法与证据口径',
      '应用场景与影响',
      '争议与限制',
    ]
  }

  if (primaryFrame === '文化历史') {
    return [
      '定义与研究边界',
      '历史来源与演变',
      '文化意义与社会功能',
      '当代应用场景',
      '争议与局限',
    ]
  }

  if (primaryFrame === '商业营销') {
    return [
      '研究对象与边界',
      '消费与用户场景',
      '营销与商业应用',
      '数据指标与评估方法',
      '风险与改进建议',
    ]
  }

  if (primaryFrame === '数据方法') {
    return [
      '定义与分析目标',
      '指标体系与数据口径',
      '分析方法与工具',
      '应用案例与解释边界',
      '风险与局限',
    ]
  }

  return [
    '定义与研究边界',
    '历史与背景',
    '核心维度与分析框架',
    '应用场景与现实影响',
    '争议与局限',
  ]
}

const buildOpenTopicScopeDecision = (subject: string, primaryFrame: ResearchPrimaryFrame) => {
  if (primaryFrame === '文化历史') {
    return `当前主题“${subject}”缺少明确场景限定，默认按文化历史与社会功能主线展开，商业案例仅作补充。`
  }

  if (primaryFrame === '商业营销') {
    return `当前主题“${subject}”缺少明确行业限定，默认按商业应用主线展开，但不会把局部营销案例扩写成主题全貌。`
  }

  if (primaryFrame === '数据方法') {
    return `当前主题“${subject}”缺少明确业务背景，默认按数据分析框架与方法主线展开，案例仅用于说明方法适用范围。`
  }

  return `当前主题“${subject}”范围较宽，默认输出综合框架研究，优先解释定义、边界、核心维度与局限，不直接收缩到单一应用场景。`
}

const buildComparativeScopeDecision = (subject: string, comparativeSubjects: string[]) => {
  if (comparativeSubjects.length >= 2) {
    return `当前输入属于复合命题，默认按并列研究轴展开：${comparativeSubjects.join(' / ')}；先分别核查，再讨论三者之间的联动关系。`
  }

  return `当前主题“${subject}”包含明显比较或并列判断，默认按多轴研究展开，不收缩为单一主体。`
}

const buildSubjectVariants = (subject: string, goal: string, keywords: string[]) => {
  const variants = new Set<string>()
  const normalizedSubject = stripPromptShell(subject)
  if (normalizedSubject) {
    variants.add(normalizedSubject)
  }

  if (!isWorkspaceProjectResearchPrompt(goal) && hasCjkText(normalizedSubject)) {
    return Array.from(variants).filter(Boolean)
  }

  const subjectTokens = new Set(splitTokens(normalizedSubject).map(normalizeKeyword))
  for (const keyword of keywords.filter(isUsefulKeyword).slice(0, 4)) {
    const normalized = normalizeKeyword(keyword)
    if (!normalized || subjectTokens.has(normalized)) {
      continue
    }
    if (normalizedSubject) {
      variants.add(`${normalizedSubject} ${keyword}`.trim())
    }
  }

  return Array.from(variants).filter(Boolean)
}

const pickFocusKeywords = (subject: string, goal: string, keywords: string[]) => {
  const subjectTokens = new Set(splitTokens(subject).map(normalizeKeyword))
  const goalTokens = splitTokens(stripPromptQuestionTail(stripPromptShell(goal)))
  const candidates = [...keywords, ...goalTokens]
  const seen = new Set<string>()
  const result: string[] = []

  for (const keyword of candidates) {
    const normalized = normalizeKeyword(keyword)
    if (!isUsefulKeyword(keyword) || subjectTokens.has(normalized) || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(cleanSegment(keyword))
  }

  return result.slice(0, 2)
}

const dedupeQueries = (queries: ResearchQueryPlan[], maxQueries?: number) => {
  const seen = new Set<string>()
  const result = queries.filter((item) => {
    const normalized = normalizeKeyword(item.query)
    if (!normalized || seen.has(normalized)) {
      return false
    }
    seen.add(normalized)
    return true
  })

  return Number.isFinite(Number(maxQueries)) ? result.slice(0, Number(maxQueries)) : result
}

const buildGeneralTopicQueries = (
  baseSubject: string,
  focusKeywords: string[],
  axes: string[],
  primaryFrame: ResearchPrimaryFrame,
  maxQueries?: number,
) => {
  const frameQueries: ResearchQueryPlan[] = primaryFrame === '文化历史'
    ? [
        { query: `${baseSubject} 文化 社会 功能 研究`, intent: '优先锁定文化意义与社会功能', priority: 3 },
        { query: `${baseSubject} 历史 演变 研究`, intent: '补齐历史来源与演变脉络', priority: 4 },
      ]
    : primaryFrame === '商业营销'
      ? [
          { query: `${baseSubject} 商业 应用 研究`, intent: '优先锁定商业应用与业务场景', priority: 3 },
          { query: `${baseSubject} 消费 行为 数据 分析`, intent: '补齐消费与营销分析材料', priority: 4 },
        ]
      : primaryFrame === '数据方法'
        ? [
            { query: `${baseSubject} 分析 方法 研究`, intent: '优先锁定方法论与测量框架', priority: 3 },
            { query: `${baseSubject} 指标 数据 口径`, intent: '补齐指标与数据口径材料', priority: 4 },
          ]
        : [
            { query: `${baseSubject} research framework`, intent: '优先锁定研究框架和方法论', priority: 3 },
            { query: `${baseSubject} 核心 维度 研究`, intent: '补齐核心分析维度', priority: 4 },
          ]

  return dedupeQueries([
    { query: `${baseSubject}`, intent: '先搜索用户原始主题，避免过度扩写导致失焦', priority: 1 },
    { query: `${baseSubject} 定义 研究`, intent: '补齐基础定义与边界', priority: 2 },
    ...frameQueries,
    { query: `${baseSubject} 应用 影响`, intent: '补齐现实应用场景与影响', priority: 5 },
    { query: `${baseSubject} 争议 局限`, intent: '提前发现限制、争议与不确定性', priority: 6 },
    ...focusKeywords.map((keyword, index) => ({
      query: `${baseSubject} ${keyword}`,
      intent: `补齐用户关心重点：${keyword}`,
      priority: index + 7,
    })),
    ...axes.slice(0, 1).map((axis, index) => ({
      query: `${baseSubject} ${axis}`,
      intent: `补齐维度：${axis}`,
      priority: index + 7 + focusKeywords.length,
    })),
  ], maxQueries)
}

const buildComparativeQueries = (
  subject: string,
  comparativeSubjects: string[],
  focusKeywords: string[],
  axes: string[],
  maxQueries?: number,
) => {
  const scopedSubjects = comparativeSubjects.length >= 2
    ? comparativeSubjects.slice(0, 3)
    : [subject]
  const relationshipSubject = comparativeSubjects.length >= 2
    ? comparativeSubjects.join(' ')
    : subject

  const clauseQueries = scopedSubjects.flatMap((item, index) => ([
    {
      query: item,
      intent: `先验证命题 ${index + 1} 的原始表述与真实边界`,
      priority: index * 2 + 1,
    },
    {
      query: `${item} 成因 影响`,
      intent: `补齐命题 ${index + 1} 的成因与现实影响`,
      priority: index * 2 + 2,
    },
  ]))
  const usableAxes = axes.filter(axis => !/^命题\s+\d+：/u.test(axis))

  return dedupeQueries([
    ...clauseQueries,
    {
      query: `${relationshipSubject} 关联`,
      intent: '分析多个命题之间的联动关系，而不是分散罗列',
      priority: clauseQueries.length + 1,
    },
    {
      query: `${relationshipSubject} 研究框架`,
      intent: '补齐复合命题的分析框架与讨论路径',
      priority: clauseQueries.length + 2,
    },
    ...focusKeywords.map((keyword, index) => ({
      query: `${relationshipSubject} ${keyword}`,
      intent: `补齐用户关心重点：${keyword}`,
      priority: clauseQueries.length + 3 + index,
    })),
    ...usableAxes.slice(0, 1).map((axis, index) => ({
      query: `${relationshipSubject} ${axis}`,
      intent: `补齐维度：${axis}`,
      priority: clauseQueries.length + 3 + focusKeywords.length + index,
    })),
  ], maxQueries)
}

const buildTargetQueries = (
  prompt: string,
  subject: string,
  goal: string,
  axes: string[],
  keywords: string[],
  researchMode: ResearchMode,
  primaryFrame: ResearchPrimaryFrame,
) => {
  const baseSubject = buildQuerySubject(prompt, subject, goal, keywords)
  const focusKeywords = pickFocusKeywords(subject, goal, keywords)
  const comparativeSubjects = getComparativeSubjects(prompt, subject)

  if (researchMode === 'comparative_topic') {
    return buildComparativeQueries(subject, comparativeSubjects, focusKeywords, axes)
  }

  if (researchMode !== 'entity_topic') {
    return buildGeneralTopicQueries(baseSubject, focusKeywords, axes, primaryFrame)
  }

  return dedupeQueries([
    {
      query: `${baseSubject} 官方文档`,
      intent: '优先补齐第一手资料',
      priority: 1,
    },
    {
      query: `${baseSubject} GitHub`,
      intent: '补齐代码仓库与 README 信息',
      priority: 2,
    },
    {
      query: `${baseSubject} 技术架构 workflow`,
      intent: '补齐技术实现与执行工作流',
      priority: 3,
    },
    {
      query: `${baseSubject} 风险 局限`,
      intent: '补齐风险、限制与争议点',
      priority: 4,
    },
    ...focusKeywords.map((keyword, index) => ({
      query: `${baseSubject} ${keyword}`,
      intent: `补齐用户关心重点：${keyword}`,
      priority: index + 5,
    })),
    ...axes.slice(0, 1).map((axis, index) => ({
      query: `${baseSubject} ${axis}`,
      intent: `补齐维度：${axis}`,
      priority: index + 5 + focusKeywords.length,
    })),
  ])
}

const buildInitialQueries = (
  prompt: string,
  subject: string,
  goal: string,
  axes: string[],
  keywords: string[],
  researchMode: ResearchMode,
  primaryFrame: ResearchPrimaryFrame,
  maxQueries: number,
): ResearchQueryPlan[] => {
  const baseSubject = buildQuerySubject(prompt, subject, goal, keywords)
  const focusKeywords = pickFocusKeywords(subject, goal, keywords)
  const comparativeSubjects = getComparativeSubjects(prompt, subject)

  if (researchMode === 'comparative_topic') {
    return buildComparativeQueries(subject, comparativeSubjects, focusKeywords, axes, maxQueries)
  }

  if (researchMode !== 'entity_topic') {
    return buildGeneralTopicQueries(baseSubject, focusKeywords, axes, primaryFrame, maxQueries)
  }

  return dedupeQueries([
    {
      query: `${baseSubject} 官方文档`,
      intent: '优先定位官方与第一手资料',
      priority: 1,
    },
    {
      query: `${baseSubject} GitHub`,
      intent: '优先定位源码仓库与 README',
      priority: 2,
    },
    {
      query: `${baseSubject} architecture workflow`,
      intent: '优先锁定技术架构与工作流骨架',
      priority: 3,
    },
    {
      query: `${baseSubject} 技术架构`,
      intent: '补齐中文技术资料与架构拆解',
      priority: 4,
    },
    {
      query: `${baseSubject} 风险 局限`,
      intent: '提前发现限制、争议与不确定性',
      priority: 5,
    },
    ...focusKeywords.map((keyword, index) => ({
      query: `${baseSubject} ${keyword}`,
      intent: `补齐用户关注重点：${keyword}`,
      priority: index + 6,
    })),
    ...axes.slice(0, 1).map((axis, index) => ({
      query: `${baseSubject} ${axis}`,
      intent: `补齐维度：${axis}`,
      priority: index + 6 + focusKeywords.length,
    })),
  ], maxQueries)
}

const buildOutline = (subject: string): ResearchOutlineSection[] => {
  return [
    { id: 'overview', title: '一、研究对象界定', objective: `确认 ${subject} 的研究边界与研究目标` },
    { id: 'workflow', title: '二、工作流骨架', objective: '拆解动态规划与边搜边推的执行结构' },
    { id: 'tools', title: '三、工具调用设计', objective: '定义搜索、阅读、核查、写作等工具职责' },
    { id: 'state', title: '四、状态机与数据流', objective: '设计阶段流转、证据沉淀与 SSE 协议' },
    { id: 'risks', title: '五、核查与止损机制', objective: '定义反幻觉、交叉验证、不确定性表达' },
    { id: 'landing', title: '六、落地建议', objective: '给出在当前项目中的接入与演进路径' },
  ]
}

export const buildResearchPlanSnapshot = (input: {
  prompt: string
  researchConfig?: Partial<ResearchTaskConfig> | null
  subjectOverride?: string
  goalOverride?: string
  outputTypeOverride?: 'report' | 'answer'
}): ResearchPlanSnapshot => {
  const prompt = String(input.prompt || '').trim()
  const config = normalizeResearchTaskConfig(input.researchConfig)
  const keywords = pickPromptKeywords(prompt)
  const urls = extractUrls(prompt)
  const subject = stripPromptShell(resolveResearchSubject(prompt, input.subjectOverride || extractSubject(prompt, keywords)))
  const goal = String(input.goalOverride || prompt || '围绕当前主题生成结构化研究报告').trim()
  const researchMode = inferResearchMode(prompt, subject, urls)
  const primaryFrame = inferPrimaryFrame(goal, subject)
  const comparativeSubjects = getComparativeSubjects(prompt, subject)
  const scopeDecision = researchMode === 'open_topic'
    ? buildOpenTopicScopeDecision(subject, primaryFrame)
    : researchMode === 'comparative_topic'
      ? buildComparativeScopeDecision(subject, comparativeSubjects)
      : '研究对象已具备明确主体锚点，优先围绕主体本身展开，不随意扩写成泛主题讨论。'
  const fallbackStrategy = researchMode === 'open_topic'
    ? '如果外部证据分散或场景过碎，优先输出框架型研究，而不是拼接局部案例。'
    : researchMode === 'comparative_topic'
      ? '如果并列命题证据不均衡，先分别建立每个命题的证据边界，再输出关系判断，避免把单一命题硬扩写为整体结论。'
      : '如果主体证据不足，优先保持主体锚点并补齐第一手资料。'
  const focusKeywords = pickFocusKeywords(subject, goal, keywords)
  const axes = buildAxesByMode(researchMode, primaryFrame, comparativeSubjects)
  if (focusKeywords.length > 0) {
    axes.push(`重点问题：${focusKeywords.join(' / ')}`)
  }
  const queryAnchors = collectResearchQueryAnchors(prompt, subject)
  const ambiguities = urls.length > 1
    ? ['用户输入中包含多个链接，需要确认哪个是主研究对象']
    : []
  const gaps = [
    '外部事实来源尚未接入，需要后续补齐真实搜索与网页深读能力',
    '当前骨架先保证研究状态机、事件流和报告输出闭环',
  ]

  return {
    subject,
    goal,
    outputType: input.outputTypeOverride || config.outputType,
    researchMode,
    primaryFrame,
    scopeDecision,
    fallbackStrategy,
    axes,
    queryAnchors,
    initialQueries: buildInitialQueries(prompt, subject, goal, axes, keywords, researchMode, primaryFrame, config.maxQueriesPerRound),
    targetQueries: buildTargetQueries(prompt, subject, goal, axes, keywords, researchMode, primaryFrame),
    seedUrls: urls,
    ambiguities,
    gaps,
    outline: buildOutline(subject),
  }
}

export const buildResearchPlan = (input: {
  prompt: string
  researchConfig?: Partial<ResearchTaskConfig> | null
}): {
  config: ResearchTaskConfig
  snapshot: ResearchPlanSnapshot
} => {
  const config = normalizeResearchTaskConfig(input.researchConfig)

  return {
    config,
    snapshot: buildResearchPlanSnapshot({
      prompt: input.prompt,
      researchConfig: input.researchConfig,
      outputTypeOverride: config.outputType,
    }),
  }
}
