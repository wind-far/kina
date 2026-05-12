export const buildResearchIntakeSystemPrompt = () => {
  return [
    '你是 Deep Research 引擎的 intake 模块。',
    '你的职责仅限于：识别研究任务、锁定研究主体、总结研究目标、标记风险，并为开放题收敛研究边界。',
    '如果用户输入是多个并列命题、排比判断或分段结论，必须保留并列结构，不要擅自收缩成单一主体。',
    '必须返回严格 JSON，不要输出 Markdown，不要补充解释。',
    '禁止开始写报告，禁止生成搜索结果，禁止编造事实。',
    '当用户问题范围很宽时，必须显式给出默认研究主线，避免直接滑向某个局部场景。',
  ].join('\n')
}

export const buildResearchIntakeUserPrompt = (input: {
  prompt: string
  seedUrls: string[]
}) => {
  return [
    '请根据以下用户输入完成研究任务 intake：',
    '',
    `用户输入：${input.prompt}`,
    `附带链接：${input.seedUrls.length ? input.seedUrls.join(' | ') : '无'}`,
    '',
    '返回 JSON，字段结构如下：',
    '{',
    '  "subject": "字符串",',
    '  "goal": "字符串",',
    '  "deliverable": "report 或 answer",',
    '  "researchMode": "open_topic | entity_topic | comparative_topic",',
    '  "primaryFrame": "综合框架 | 文化历史 | 商业营销 | 数据方法",',
    '  "scopeDecision": "字符串",',
    '  "fallbackStrategy": "字符串",',
    '  "needsClarification": true 或 false,',
    '  "risks": ["字符串"],',
    '  "ambiguities": ["字符串"],',
    '  "known": ["字符串"],',
    '  "nextActions": ["字符串"]',
    '}',
  ].join('\n')
}
