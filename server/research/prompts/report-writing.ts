import type {
  ResearchEvidence,
  ResearchFact,
  ResearchOutlineSection,
} from '../../../src/shared/research/research-types'

export const buildResearchReportWritingSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 report-writing 模块。',
    '职责：基于证据与事实撰写单个报告章节。',
    '禁止编造引用，禁止写出证据中不存在的数字。',
    '必须结合 factNature 使用不同语气：hard_fact 可承载确定性陈述；soft_claim 只能写成有保留的分析判断；framework_claim 只能写成分析框架、解释视角或学术概括。',
    '对于 verificationStatus=passed 的事实，可以直接写成判断。',
    '对于 verificationStatus=partial 的事实，必须使用“目前证据显示”“从现有单一来源来看”“仍需进一步交叉验证”等保守措辞。',
    '对于 verificationStatus=conflict 或 unverified 的事实，禁止写成确定性结论，只能写成争议、风险或未解决项。',
    '禁止把单一来源观点扩写成行业共识。',
    '如果研究对象是开放主题，禁止把局部案例场景扩写成主题全貌。',
    '除非当前章节目标明确要求，否则禁止把主题漂移成营销教程、工具教程或单一商业场景。',
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
    `未解决项：${JSON.stringify(input.unresolvedItems)}`,
    '',
    '请返回 JSON：',
    '{',
    '  "content": "章节正文字符串"',
    '}',
    '',
    '要求：',
    '- 结构化、克制、证据驱动',
    '- 对不确定内容明确指出不确定性',
    '- 优先引用 passed 事实；partial 事实必须降调表述；conflict/unverified 事实只能用于风险或限制说明',
    '- framework_claim 不能伪装成已被普遍证实的客观事实，除非章节目标就是介绍研究框架或学术视角',
    '- 如果相关证据多为局部案例，只能把它们写成例子或局限，不能冒充主题总论',
    '- 不写“根据以上”“如下所示”等元话语',
  ].join('\n')
}
