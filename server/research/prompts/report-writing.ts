import type {
  ResearchEvidence,
  ResearchFact,
  ResearchOutlineSection,
} from '../../../src/shared/research/research-types'

const buildCitationReferenceLines = (evidences: ResearchEvidence[]) => {
  const seen = new Set<number>()
  const lines: string[] = []

  for (const evidence of evidences) {
    const searchSources = Array.isArray(evidence.discovery?.searchSources)
      ? evidence.discovery?.searchSources || []
      : []
    for (const source of searchSources) {
      const referenceIndex = Number(source.referenceIndex)
      if (!Number.isFinite(referenceIndex) || referenceIndex <= 0 || seen.has(referenceIndex)) {
        continue
      }
      seen.add(referenceIndex)
      const title = String(source.title || evidence.source?.title || evidence.title || `信源 ${referenceIndex}`).trim()
      const siteName = String(source.siteName || '').trim()
      const publishedTime = String(source.publishedTime || source.datePublished || '').trim()
      lines.push(
        `- [${referenceIndex}] ${title}${siteName ? ` | ${siteName}` : ''}${publishedTime ? ` | ${publishedTime}` : ''}`,
      )
    }
  }

  return lines.length ? lines.join('\n') : '- 当前无可直接引用的编号信源'
}

export const buildResearchReportWritingSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 report-writing 模块。',
    '职责：基于证据与事实撰写单个报告章节。',
    '禁止编造引用，禁止写出证据中不存在的数字。',
    '目标风格：更像强输出、弱显式核查的成品研究报告，而不是审计记录或方法说明。',
    '必须结合 factNature 使用不同语气：hard_fact 可承载明确判断；soft_claim 可写成较强分析判断；framework_claim 可写成解释框架与行业逻辑。',
    '对于 verificationStatus=passed 的事实，可以直接写成判断。',
    '对于 verificationStatus=partial 的事实，优先使用自然、专业的审慎措辞，例如“当前行业信息显示”“多方线索共同指向”“从现有材料看”。避免反复出现“单一来源”“仍需进一步交叉验证”等审计式话术，除非该点正是本章核心争议。',
    '对于 verificationStatus=conflict 或 unverified 的事实，不写成铁板钉钉的定论，但可以写成争议、市场预期、行业判断或待验证趋势。',
    '不要把不确定性写成整章主角；让主叙事始终围绕主题洞察展开。',
    '不要频繁自我提醒“证据不足”“本研究”“本章节”；只在必要处轻量提示。',
    '禁止把单一来源观点硬写成普遍共识，但可以把它写成有代表性的行业判断或值得重视的信号。',
    '如果研究对象是开放主题，允许从多个局部案例归纳产业逻辑，但不要超出证据所能承载的边界。',
    '除非当前章节目标明确要求，否则禁止把主题漂移成营销教程、工具教程或单一商业场景。',
    '只要写到明确事实、数字、日期、公司动作、市场份额、融资并购、政策变化或直接判断，优先在相关句子末尾附上引用编号，例如 [12] 或 [12][18]。',
    '只能使用输入中提供的引用编号；如果某句没有可用编号，就不要伪造引用。',
    '引用编号要直接写在正文里，不要集中堆到段末的单独一行。',
    '必须返回严格 JSON。',
  ].join('\n')
}

export const buildResearchReportWritingUserPrompt = (input: {
  subject: string
  goal: string
  section: ResearchOutlineSection
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
  unresolvedItems: string[]
}) => {
  return [
    `研究主体：${input.subject}`,
    `研究目标：${input.goal}`,
    `章节标题：${input.section.title}`,
    `章节目标：${input.section.objective}`,
    `关键问题：${(input.section.keyQuestions || []).join('；') || '无'}`,
    '',
    '相关证据：',
    JSON.stringify(input.evidences, null, 2),
    '',
    '相关事实：',
    JSON.stringify(input.facts, null, 2),
    '',
    '可用引用编号：',
    buildCitationReferenceLines(input.evidences),
    '',
    `未解决项：${JSON.stringify(input.unresolvedItems)}`,
    '',
    '请返回 JSON：',
    '{',
    '  "content": "章节正文字符串"',
    '}',
    '',
    '要求：',
    '- 写成可直接交付用户的成品章节，信息密度高，判断明确',
    '- 对不确定内容做轻量降调，而不是大段核查免责声明',
    '- 优先让章节先给结论、再给原因、再给影响',
    '- 有可用引用编号时，把引用编号直接写进正文句子，例如“公司在 2024 年完成并购[12]”',
    '- 数字、日期、公司动作、融资并购、政策更新这类表述，尽量都带引用编号',
    '- framework_claim 可以作为行业逻辑来写，但不要伪装成精确数据事实',
    '- 如果相关证据多为局部案例，可以把它们组织成趋势、样本或信号，不必处处声明局限',
    '- 不写“根据以上”“如下所示”等元话语',
  ].join('\n')
}
