export type AgentSkillKey =
  | 'general'
  | 'story-short'
  | 'marketing-video'
  | 'ecommerce-pack'
  | 'poster-design'
  | 'brand-design'

export type SkillUiMode = 'PLAIN_CHAT' | 'WORKSPACE'
export type SkillPromptScene = 'CHAT' | 'PLANNER'

interface WorkflowIntentAnalyzeStrategy {
  mode: 'analyze'
  systemPrompt?: string
  userInput: string
}

interface WorkflowIntentDirectStrategy {
  mode: 'direct'
  params: Record<string, unknown>
}

export type AgentWorkflowStrategy = WorkflowIntentAnalyzeStrategy | WorkflowIntentDirectStrategy

export interface AgentSkillConfig {
  key: string
  label: string
  description: string
  uiMode: SkillUiMode
  chatSystemPrompt: string
  buildChatUserPrompt: (input: string) => string
  buildWorkflowStrategy: (input: string) => AgentWorkflowStrategy
}

export interface PublicSkillPromptTemplate {
  id: string
  skillId: string
  scene: SkillPromptScene
  systemPrompt: string
  userPromptTemplate: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicSkillWorkflowTemplate {
  id: string
  skillId: string
  workflowLabel: string
  workflowType: string
  expectedImageCount: number
  workflowParamsTemplateJson: Record<string, unknown> | null
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicAgentSkillCatalogItem {
  id: string
  providerId: string
  skillKey: string
  label: string
  description: string
  iconType: string
  category: string
  uiMode: SkillUiMode
  executionMode: string
  workflowType: string
  plannerModelCategory: string
  expectedImageCount: number
  isEnabled: boolean
  isBuiltIn: boolean
  sortOrder: number
  configJson: Record<string, unknown> | null
  workspaceSkillKey: string
  dependencySkillKeys: string[]
  prompts: PublicSkillPromptTemplate[]
  workflowTemplates: PublicSkillWorkflowTemplate[]
}

const normalizeInput = (input: string) => input.trim()

const buildWrappedUserPrompt = (title: string, input: string, requirements: string[]) => {
  const normalizedInput = normalizeInput(input)
  return [
    `${title}`,
    '',
    '用户原始需求：',
    normalizedInput,
    '',
    '生成要求：',
    ...requirements.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n')
}

const buildTextToImageParams = (imagePrompt: string) => ({
  workflow_type: 'text_to_image',
  image_prompt: imagePrompt,
})

const buildImageToVideoParams = (imagePrompt: string, videoPrompt: string) => ({
  workflow_type: 'text_to_image_to_video',
  image_prompt: imagePrompt,
  video_prompt: videoPrompt,
})

export const interpolateTemplateString = (template: string, variables: Record<string, string>) => {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_matched, key: string) => {
    return variables[key] ?? ''
  })
}

export const renderTemplateValue = (value: unknown, variables: Record<string, string>): unknown => {
  if (typeof value === 'string') {
    return interpolateTemplateString(value, variables)
  }

  if (Array.isArray(value)) {
    return value.map(item => renderTemplateValue(item, variables))
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((result, [key, item]) => {
      result[key] = renderTemplateValue(item, variables)
      return result
    }, {})
  }

  return value
}

const getCatalogPromptByScene = (
  prompts: PublicSkillPromptTemplate[] | undefined,
  scene: SkillPromptScene,
) => {
  return (prompts || []).find(item => item.scene === scene && item.isEnabled)
}

const getCatalogWorkflowTemplate = (skill: PublicAgentSkillCatalogItem | undefined) => {
  return (skill?.workflowTemplates || []).find(item => item.isEnabled)
}

const buildDynamicSkillConfig = (skill: PublicAgentSkillCatalogItem): AgentSkillConfig | null => {
  const chatPrompt = getCatalogPromptByScene(skill.prompts, 'CHAT')
  if (!chatPrompt) {
    return null
  }

  const workflowTemplate = getCatalogWorkflowTemplate(skill)
  const plannerPrompt = getCatalogPromptByScene(skill.prompts, 'PLANNER')

  return {
    key: skill.skillKey,
    label: skill.label,
    description: skill.description,
    uiMode: skill.uiMode,
    chatSystemPrompt: chatPrompt.systemPrompt,
    buildChatUserPrompt: (input: string) => interpolateTemplateString(chatPrompt.userPromptTemplate, {
      input: normalizeInput(input),
    }),
    buildWorkflowStrategy: (input: string) => {
      const normalizedInput = normalizeInput(input)

      if (plannerPrompt?.systemPrompt || plannerPrompt?.userPromptTemplate) {
        return {
          mode: 'analyze',
          systemPrompt: plannerPrompt.systemPrompt,
          userInput: interpolateTemplateString(plannerPrompt.userPromptTemplate, {
            input: normalizedInput,
          }),
        }
      }

      if (workflowTemplate?.workflowParamsTemplateJson) {
        return {
          mode: 'direct',
          params: renderTemplateValue(workflowTemplate.workflowParamsTemplateJson, {
            input: normalizedInput,
            prompt: normalizedInput,
          }) as Record<string, unknown>,
        }
      }

      return {
        mode: 'analyze',
        userInput: normalizedInput,
      }
    },
  }
}

const STATIC_SKILL_CONFIGS: Record<AgentSkillKey, AgentSkillConfig> = {
  general: {
    key: 'general',
    label: '通用助手',
    description: '适合日常问答、创意发想和通用生成任务',
    uiMode: 'PLAIN_CHAT',
    chatSystemPrompt: '你是一个中文创作助理。请准确理解用户需求，优先给出结构清晰、直接可执行的结果。',
    buildChatUserPrompt: (input) => normalizeInput(input),
    buildWorkflowStrategy: (input) => ({
      mode: 'analyze',
      userInput: normalizeInput(input),
    }),
  },
  'story-short': {
    key: 'story-short',
    label: '剧情短片',
    description: '帮你自动生成故事大纲、分镜脚本并产出短片',
    uiMode: 'WORKSPACE',
    chatSystemPrompt: [
      '你是一名擅长短片策划的中文导演与编剧。',
      '你需要把用户的创意扩展为适合短视频生产的结构化方案。',
      '优先输出：故事概述、角色设定、分镜节奏、关键画面、镜头语言与可直接用于生成的提示词。',
    ].join(''),
    buildChatUserPrompt: (input) => buildWrappedUserPrompt(
      '请将下面的创意扩展为适合 AI 剧情短片制作的方案。',
      input,
      [
        '保留用户核心主题与情绪',
        '补全角色、场景、冲突、转折和结尾',
        '给出适合短片的镜头或分镜建议',
        '输出中文，内容可直接用于后续视觉生成',
      ],
    ),
    buildWorkflowStrategy: (input) => ({
      mode: 'analyze',
      systemPrompt: [
        '你是一个剧情短片工作流规划助手。',
        '无论用户输入是否明确提到“分镜”，都优先将需求转成 storyboard 工作流。',
        '必须尽量输出 character 与 shots 字段；shots 至少 4 条，至多 8 条。',
        '每个 shot.prompt 都要是可直接用于图片生成的完整画面描述。',
        '返回纯 JSON，不要输出解释。',
      ].join('\n'),
      userInput: buildWrappedUserPrompt(
        '请将下面需求转成剧情短片分镜工作流。',
        input,
        [
          '主工作流固定优先为 storyboard',
          '角色设定要稳定，便于多镜头复用',
          '分镜节奏要有起承转合',
          '每个分镜要明确场景、人物动作、镜头和氛围',
        ],
      ),
    }),
  },
  'marketing-video': {
    key: 'marketing-video',
    label: '营销视频',
    description: '一句话帮你生成营销推广视频',
    uiMode: 'WORKSPACE',
    chatSystemPrompt: [
      '你是一名擅长电商与品牌投放的中文营销视频策划。',
      '请把用户需求转成更适合广告视频生产的脚本、卖点结构和视觉提示词。',
      '内容要强调卖点、目标受众、展示场景与转化导向。',
    ].join(''),
    buildChatUserPrompt: (input) => buildWrappedUserPrompt(
      '请将下面需求整理成营销视频创意方案。',
      input,
      [
        '突出产品卖点与目标人群',
        '画面节奏适合短视频投放',
        '补充适合首帧图与动态镜头的描述',
        '输出中文',
      ],
    ),
    buildWorkflowStrategy: (input) => {
      const normalizedInput = normalizeInput(input)
      return {
        mode: 'direct',
        params: buildImageToVideoParams(
          `营销视频首帧，突出核心卖点与品牌识别，商业广告质感，主体明确，适合短视频投放。需求：${normalizedInput}`,
          `营销视频镜头，围绕卖点进行动态展示，节奏明快，转场自然，强调产品使用场景与转化感。需求：${normalizedInput}`,
        ),
      }
    },
  },
  'ecommerce-pack': {
    key: 'ecommerce-pack',
    label: '电商套图',
    description: '生成风格统一的商品全套视觉素材，适用于各大电商平台',
    uiMode: 'WORKSPACE',
    chatSystemPrompt: [
      '你是一名电商视觉策划与商品拍摄导演。',
      '请把用户需求整理为适合电商商品套图生成的视觉方案。',
      '要强调主图、卖点图、场景图、细节图的一致风格。',
    ].join(''),
    buildChatUserPrompt: (input) => buildWrappedUserPrompt(
      '请将下面需求整理成电商套图策划案。',
      input,
      [
        '突出商品主体、材质、卖点与适用场景',
        '保持整套视觉风格统一',
        '描述要适合商品主图与详情图生成',
        '输出中文',
      ],
    ),
    buildWorkflowStrategy: (input) => {
      const normalizedInput = normalizeInput(input)
      return {
        mode: 'direct',
        params: buildTextToImageParams(
          `电商商品视觉主图，主体清晰，棚拍级打光，商业修图质感，背景简洁，突出商品卖点与品牌调性，适合电商套图起始图。需求：${normalizedInput}`,
        ),
      }
    },
  },
  'poster-design': {
    key: 'poster-design',
    label: '海报设计',
    description: '生成更有创意的海报内容，擅长营销场景和节日热点',
    uiMode: 'WORKSPACE',
    chatSystemPrompt: [
      '你是一名海报创意总监。',
      '请将用户需求扩展为适合宣传海报生产的视觉创意与文案结构。',
      '重点关注主视觉、版式焦点、气氛与传播主题。',
    ].join(''),
    buildChatUserPrompt: (input) => buildWrappedUserPrompt(
      '请将下面需求整理成海报设计方案。',
      input,
      [
        '突出海报主题与视觉焦点',
        '补充氛围、色彩、构图与文字区域预留建议',
        '结果适合后续图像生成',
        '输出中文',
      ],
    ),
    buildWorkflowStrategy: (input) => {
      const normalizedInput = normalizeInput(input)
      return {
        mode: 'direct',
        params: buildTextToImageParams(
          `创意宣传海报主视觉，构图鲜明，视觉中心突出，具备营销传播感与版式空间，适合活动海报或品牌宣传。需求：${normalizedInput}`,
        ),
      }
    },
  },
  'brand-design': {
    key: 'brand-design',
    label: '品牌设计',
    description: '根据公司名称、业务与客群，生成品牌 Logo 与视觉方案',
    uiMode: 'WORKSPACE',
    chatSystemPrompt: [
      '你是一名品牌策略与视觉识别设计顾问。',
      '请根据用户需求输出适合品牌设计的定位、视觉方向、Logo 灵感与应用场景建议。',
      '要兼顾行业属性、受众气质和品牌记忆点。',
    ].join(''),
    buildChatUserPrompt: (input) => buildWrappedUserPrompt(
      '请将下面需求整理成品牌设计方向建议。',
      input,
      [
        '提炼品牌关键词、气质与目标客群',
        '给出适合视觉识别设计的方向',
        '结果可用于生成品牌主视觉或 Logo 概念图',
        '输出中文',
      ],
    ),
    buildWorkflowStrategy: (input) => {
      const normalizedInput = normalizeInput(input)
      return {
        mode: 'direct',
        params: buildTextToImageParams(
          `品牌视觉概念板，体现品牌定位、Logo 方向、识别元素与主色调，现代品牌设计展示风格，适合作为品牌提案视觉。需求：${normalizedInput}`,
        ),
      }
    },
  },
}

const defaultSkillCatalog = Object.values(STATIC_SKILL_CONFIGS).map(item => ({
  value: item.key,
  label: item.label,
  description: item.description,
}))

let publicSkillCatalog: PublicAgentSkillCatalogItem[] = []

const buildPublicSkillConfig = (skill: string) => {
  const normalizedSkill = String(skill || '').trim() || 'general'
  const catalogItem = publicSkillCatalog.find(item => item.skillKey === normalizedSkill) || null
  const dynamicConfig = catalogItem ? buildDynamicSkillConfig(catalogItem) : null
  if (dynamicConfig) {
    return dynamicConfig
  }

  return STATIC_SKILL_CONFIGS[(normalizedSkill as AgentSkillKey)] || STATIC_SKILL_CONFIGS.general
}

export const applyPublicSkillCatalog = (skills?: PublicAgentSkillCatalogItem[]) => {
  publicSkillCatalog = Array.isArray(skills) ? skills : []
  return publicSkillCatalog
}

export const listEnabledAgentSkills = () => {
  if (publicSkillCatalog.length) {
    return publicSkillCatalog.map(item => ({
      value: item.skillKey,
      label: item.label,
      description: item.description || item.label,
    }))
  }

  return defaultSkillCatalog
}

export const getAgentSkillCatalogItem = (skill: string) => {
  const normalizedSkill = String(skill || '').trim()
  return publicSkillCatalog.find(item => item.skillKey === normalizedSkill) || null
}

export const isAgentWorkspaceSkill = (skill?: string) => {
  const normalizedSkill = String(skill || '').trim()
  if (!normalizedSkill) {
    return false
  }

  const catalogItem = getAgentSkillCatalogItem(normalizedSkill)
  if (catalogItem) {
    return catalogItem.uiMode === 'WORKSPACE'
  }

  return getAgentSkillConfig(normalizedSkill).uiMode === 'WORKSPACE'
}

export const getAgentSkillConfig = (skill: string): AgentSkillConfig => {
  return buildPublicSkillConfig(skill)
}

export const buildAgentChatMessages = (skill: string, input: string) => {
  const config = getAgentSkillConfig(skill)
  return [
    { role: 'system', content: config.chatSystemPrompt },
    { role: 'user', content: config.buildChatUserPrompt(input) },
  ]
}

export const buildAgentWorkflowStrategy = (skill: string, input: string): AgentWorkflowStrategy => {
  const config = getAgentSkillConfig(skill)
  return config.buildWorkflowStrategy(input)
}
