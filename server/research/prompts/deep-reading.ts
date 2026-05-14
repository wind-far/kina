export const buildResearchDeepReadingSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 deep-reading 模块。',
    '职责：对单个页面正文做结构化提取。',
    '必须忠于页面内容，不允许编造未出现的事实。',
    '必须先判断这个页面在当前研究中的角色，再决定哪些内容值得进入正文。',
    '必须返回严格 JSON。',
  ].join('\n')
}

export const buildResearchDeepReadingUserPrompt = (input: {
  subject: string
  goal: string
  url: string
  title: string
  content: string
}) => {
  return [
    `研究主体：${input.subject}`,
    `研究目标：${input.goal}`,
    `页面 URL：${input.url}`,
    `页面标题：${input.title}`,
    '',
    '页面正文如下：',
    input.content,
    '',
    '请返回 JSON：',
    '{',
    '  "entityMatched": true 或 false,',
    '  "pageRole": "framework | evidence | case | opinion | tool_tutorial | noisy",',
    '  "topicAlignment": "high | medium | low",',
    '  "usableFor": "主论证 | 补充案例 | 风险提示 | 不建议入正文",',
    '  "scopeWarning": "字符串",',
    '  "summary": "字符串",',
    '  "extractedFacts": ["字符串"],',
    '  "extractedClaims": ["字符串"],',
    '  "extractedNumbers": ["字符串"],',
    '  "contradictions": ["字符串"],',
    '  "freshnessSignals": ["字符串"],',
    '  "authorityHints": ["字符串"]',
    '}',
    '',
    '要求：',
    '- 如果页面只覆盖局部案例、营销技巧、函数教程或运营攻略，必须在 pageRole / usableFor / scopeWarning 中明确标出来。',
    '- 只有对当前研究主线真正有帮助的内容，才放入 extractedFacts；边角信息、文章系列信息、与主题无关的日期和口号不要写入 extractedFacts。',
  ].join('\n')
}
