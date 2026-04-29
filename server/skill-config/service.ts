import type {
  AiSkillExecutionMode,
  AiSkillPlannerModelCategory,
  AiSkillPromptScene,
  AiSkillUiMode,
  Prisma,
} from '@prisma/client'
import { isPrismaConfigured, prisma } from '../db/prisma'

export interface AdminSkillItem {
  id: string
  providerId: string
  skillKey: string
  label: string
  description: string
  iconType: string
  category: string
  uiMode: AiSkillUiMode
  executionMode: AiSkillExecutionMode
  workflowType: string
  plannerModelCategory: AiSkillPlannerModelCategory
  expectedImageCount: number
  isEnabled: boolean
  isBuiltIn: boolean
  sortOrder: number
  configJson: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface SkillDependencyItem {
  id: string
  skillId: string
  dependencySkillId: string
  dependencySkillKey: string
  dependencySkillLabel: string
  sortOrder: number
  createdAt: string
}

export interface SkillPromptTemplateItem {
  id: string
  skillId: string
  scene: AiSkillPromptScene
  systemPrompt: string
  userPromptTemplate: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SkillWorkflowTemplateItem {
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

export interface SkillPlanTemplateItem {
  id: string
  skillId: string
  itemKey: string
  titleTemplate: string
  promptTemplate: string
  sortOrder: number
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SkillStageTemplateItem {
  id: string
  skillId: string
  stageKey: string
  stageLabel: string
  indicatorTitle: string
  indicatorDescriptionTemplate: string
  sortOrder: number
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SkillDefinitionDetail {
  skill: AdminSkillItem
  dependencies: SkillDependencyItem[]
  prompts: SkillPromptTemplateItem[]
  workflowTemplates: SkillWorkflowTemplateItem[]
  planTemplates: SkillPlanTemplateItem[]
  stageTemplates: SkillStageTemplateItem[]
}

export interface RuntimeSkillPromptMap {
  CHAT?: SkillPromptTemplateItem
  PLANNER?: SkillPromptTemplateItem
}

export interface RuntimeSkillDefinition {
  skill: AdminSkillItem
  workspaceSkillKey: string
  dependencySkillKeys: string[]
  dependencies: SkillDependencyItem[]
  prompts: RuntimeSkillPromptMap
  workflowTemplate: SkillWorkflowTemplateItem | null
  workflowTemplates: SkillWorkflowTemplateItem[]
  planTemplates: SkillPlanTemplateItem[]
  stageTemplates: SkillStageTemplateItem[]
}

export interface AdminSkillPromptTemplatePayload {
  scene: AiSkillPromptScene
  systemPrompt: string
  userPromptTemplate: string
  isEnabled?: boolean
}

export interface AdminSkillWorkflowTemplatePayload {
  workflowLabel: string
  workflowType: string
  expectedImageCount?: number
  workflowParamsTemplateJson?: Record<string, unknown> | null
  isEnabled?: boolean
}

export interface AdminSkillPlanTemplatePayload {
  itemKey: string
  titleTemplate: string
  promptTemplate: string
  sortOrder?: number
  isEnabled?: boolean
}

export interface AdminSkillStageTemplatePayload {
  stageKey: string
  stageLabel: string
  indicatorTitle?: string
  indicatorDescriptionTemplate?: string
  sortOrder?: number
  isEnabled?: boolean
}

export interface AdminSkillPayload {
  providerId?: string
  skillKey?: string
  label?: string
  description?: string
  iconType?: string
  category?: string
  uiMode?: AiSkillUiMode
  executionMode?: AiSkillExecutionMode
  workflowType?: string
  plannerModelCategory?: AiSkillPlannerModelCategory
  expectedImageCount?: number
  isEnabled?: boolean
  isBuiltIn?: boolean
  sortOrder?: number
  configJson?: Record<string, unknown> | null
  dependencySkillKeys?: string[]
  promptTemplates?: AdminSkillPromptTemplatePayload[]
  workflowTemplates?: AdminSkillWorkflowTemplatePayload[]
  planTemplates?: AdminSkillPlanTemplatePayload[]
  stageTemplates?: AdminSkillStageTemplatePayload[]
}

interface BuiltInSkillSeedDefinition {
  payload: AdminSkillPayload
}

const DEFAULT_WORKSPACE_STAGE_TEMPLATES: AdminSkillStageTemplatePayload[] = [
  {
    stageKey: 'analyze',
    stageLabel: '解析需求',
    indicatorTitle: '解析需求',
    indicatorDescriptionTemplate: '正在理解你的需求，并匹配合适的技能与工作流。',
    sortOrder: 10,
    isEnabled: true,
  },
  {
    stageKey: 'plan',
    stageLabel: '确定工作流',
    indicatorTitle: '准备生成方案',
    indicatorDescriptionTemplate: '已根据技能指南确定工作流：{{workflow_type}}。',
    sortOrder: 20,
    isEnabled: true,
  },
  {
    stageKey: 'submit',
    stageLabel: '提交生成任务',
    indicatorTitle: '提交生成任务',
    indicatorDescriptionTemplate: '正在提交生成任务，请稍候。',
    sortOrder: 30,
    isEnabled: true,
  },
  {
    stageKey: 'generate',
    stageLabel: '结果生成中',
    indicatorTitle: '结果生成中',
    indicatorDescriptionTemplate: '正在生成结果，请等待服务端逐步返回。',
    sortOrder: 40,
    isEnabled: true,
  },
]

const BUILT_IN_SKILL_SEEDS: BuiltInSkillSeedDefinition[] = [
  {
    payload: {
      skillKey: 'general',
      label: '通用助手',
      description: '适合日常问答、创意发想和通用生成任务',
      iconType: 'sparkles',
      category: 'general',
      uiMode: 'PLAIN_CHAT',
      executionMode: 'CHAT_ONLY',
      workflowType: '',
      plannerModelCategory: 'CHAT',
      expectedImageCount: 1,
      isEnabled: true,
      isBuiltIn: true,
      sortOrder: 0,
      configJson: null,
      dependencySkillKeys: [],
      promptTemplates: [
        {
          scene: 'CHAT',
          systemPrompt: '你是一个中文创作助理。请准确理解用户需求，优先给出结构清晰、直接可执行的结果。',
          userPromptTemplate: '{{input}}',
          isEnabled: true,
        },
      ],
      workflowTemplates: [],
      planTemplates: [],
      stageTemplates: [],
    },
  },
  {
    payload: {
      skillKey: 'story-short',
      label: '剧情短片',
      description: '帮你自动生成故事大纲、分镜脚本并产出短片',
      iconType: 'film',
      category: 'story',
      uiMode: 'WORKSPACE',
      executionMode: 'PLANNER_THEN_STORYBOARD',
      workflowType: 'storyboard',
      plannerModelCategory: 'CHAT',
      expectedImageCount: 4,
      isEnabled: true,
      isBuiltIn: true,
      sortOrder: 5,
      configJson: {
        result_parser: 'storyboard_default',
      },
      dependencySkillKeys: [],
      promptTemplates: [
        {
          scene: 'CHAT',
          systemPrompt: '你是一名擅长短片策划的中文导演与编剧。你需要把用户的创意扩展为适合短视频生产的结构化方案，优先输出故事概述、角色设定、分镜节奏、关键画面、镜头语言与可直接用于生成的提示词。',
          userPromptTemplate: '请将下面的创意扩展为适合 AI 剧情短片制作的方案。\n\n需求：{{input}}',
          isEnabled: true,
        },
        {
          scene: 'PLANNER',
          systemPrompt: '你是一个剧情短片工作流规划助手。无论用户输入是否明确提到分镜，都优先将需求转成 storyboard 工作流，并输出适合后续视觉生成的结构化结果。',
          userPromptTemplate: '请将下面需求转成剧情短片分镜工作流，并补充角色设定与镜头节奏。\n\n需求：{{input}}',
          isEnabled: true,
        },
      ],
      workflowTemplates: [
        {
          workflowLabel: '剧情分镜',
          workflowType: 'storyboard',
          expectedImageCount: 4,
          workflowParamsTemplateJson: null,
          isEnabled: true,
        },
      ],
      planTemplates: [],
      stageTemplates: DEFAULT_WORKSPACE_STAGE_TEMPLATES,
    },
  },
  {
    payload: {
      skillKey: 'marketing-video',
      label: '营销视频',
      description: '一句话帮你生成营销推广视频',
      iconType: 'play',
      category: 'marketing',
      uiMode: 'WORKSPACE',
      executionMode: 'DIRECT_GENERATE',
      workflowType: 'text_to_image_to_video',
      plannerModelCategory: 'CHAT',
      expectedImageCount: 4,
      isEnabled: true,
      isBuiltIn: true,
      sortOrder: 15,
      configJson: {
        result_parser: 'image_to_video_default',
      },
      dependencySkillKeys: [],
      promptTemplates: [
        {
          scene: 'CHAT',
          systemPrompt: '你是一名擅长电商与品牌投放的中文营销视频策划。请把用户需求转成更适合广告视频生产的脚本、卖点结构和视觉提示词，强调卖点、目标受众、展示场景与转化导向。',
          userPromptTemplate: '请将下面需求整理成营销视频创意方案。\n\n需求：{{input}}',
          isEnabled: true,
        },
      ],
      workflowTemplates: [
        {
          workflowLabel: '营销视频',
          workflowType: 'text_to_image_to_video',
          expectedImageCount: 4,
          workflowParamsTemplateJson: null,
          isEnabled: true,
        },
      ],
      planTemplates: [],
      stageTemplates: DEFAULT_WORKSPACE_STAGE_TEMPLATES,
    },
  },
  {
    payload: {
      skillKey: 'brand-design',
      label: '品牌设计',
      description: '根据公司名称、业务与客群，生成品牌 Logo 与视觉方案',
      iconType: 'badge',
      category: 'branding',
      uiMode: 'WORKSPACE',
      executionMode: 'DIRECT_GENERATE',
      workflowType: 'text_to_image',
      plannerModelCategory: 'CHAT',
      expectedImageCount: 4,
      isEnabled: true,
      isBuiltIn: true,
      sortOrder: 25,
      configJson: {
        result_parser: 'text_to_image_default',
      },
      dependencySkillKeys: [],
      promptTemplates: [
        {
          scene: 'CHAT',
          systemPrompt: '你是一名品牌策略与视觉识别设计顾问。请根据用户需求输出适合品牌设计的定位、视觉方向、Logo 灵感与应用场景建议，兼顾行业属性、受众气质和品牌记忆点。',
          userPromptTemplate: '请将下面需求整理成品牌设计方向建议。\n\n需求：{{input}}',
          isEnabled: true,
        },
      ],
      workflowTemplates: [
        {
          workflowLabel: '品牌视觉方案',
          workflowType: 'text_to_image',
          expectedImageCount: 4,
          workflowParamsTemplateJson: null,
          isEnabled: true,
        },
      ],
      planTemplates: [],
      stageTemplates: DEFAULT_WORKSPACE_STAGE_TEMPLATES,
    },
  },
]

let ensureBuiltInSkillsPromise: Promise<void> | null = null

const normalizeJsonObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

const normalizeTrimmedString = (value: unknown) => String(value || '').trim()

const normalizeNullableJsonObject = (value: unknown, fieldLabel: string) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldLabel} 必须是对象`)
  }

  return value as Record<string, unknown>
}

const normalizeBoolean = (value: unknown, defaultValue: boolean) => {
  if (typeof value === 'boolean') {
    return value
  }
  return defaultValue
}

const normalizeInteger = (value: unknown, defaultValue: number) => {
  const parsed = Number(value)
  if (Number.isFinite(parsed)) {
    return Math.max(0, Math.floor(parsed))
  }
  return defaultValue
}

const assertUniqueValues = (values: string[], fieldLabel: string) => {
  const duplicated = values.find((item, index) => values.indexOf(item) !== index)
  if (duplicated) {
    throw new Error(`${fieldLabel} 存在重复值：${duplicated}`)
  }
}

const normalizeSkillPayload = (payload: AdminSkillPayload) => {
  const skillKey = normalizeTrimmedString(payload.skillKey)
  const label = normalizeTrimmedString(payload.label)

  if (!skillKey) {
    throw new Error('技能标识不能为空')
  }

  if (!label) {
    throw new Error('技能名称不能为空')
  }

  const dependencySkillKeys = normalizeStringArray(payload.dependencySkillKeys)
  assertUniqueValues(dependencySkillKeys, '依赖技能标识')

  if (dependencySkillKeys.includes(skillKey)) {
    throw new Error('技能不能依赖自身')
  }

  const promptTemplates = Array.isArray(payload.promptTemplates) ? payload.promptTemplates.map((item) => {
    const systemPrompt = normalizeTrimmedString(item.systemPrompt)
    const userPromptTemplate = String(item.userPromptTemplate || '').trim()

    if (!systemPrompt) {
      throw new Error('提示词模板的系统提示词不能为空')
    }

    if (!userPromptTemplate) {
      throw new Error('提示词模板的用户提示词不能为空')
    }

    return {
      scene: item.scene,
      systemPrompt,
      userPromptTemplate,
      isEnabled: normalizeBoolean(item.isEnabled, true),
    }
  }) : []

  const workflowTemplates = Array.isArray(payload.workflowTemplates) ? payload.workflowTemplates.map((item) => {
    const workflowLabel = normalizeTrimmedString(item.workflowLabel)
    const workflowType = normalizeTrimmedString(item.workflowType)

    if (!workflowLabel) {
      throw new Error('工作流模板名称不能为空')
    }

    if (!workflowType) {
      throw new Error('工作流类型不能为空')
    }

    return {
      workflowLabel,
      workflowType,
      expectedImageCount: normalizeInteger(item.expectedImageCount, 4),
      workflowParamsTemplateJson: normalizeNullableJsonObject(item.workflowParamsTemplateJson, '工作流参数模板'),
      isEnabled: normalizeBoolean(item.isEnabled, true),
    }
  }) : []

  const planTemplates = Array.isArray(payload.planTemplates) ? payload.planTemplates.map((item) => {
    const itemKey = normalizeTrimmedString(item.itemKey)
    const titleTemplate = normalizeTrimmedString(item.titleTemplate)
    const promptTemplate = String(item.promptTemplate || '').trim()

    if (!itemKey) {
      throw new Error('计划项标识不能为空')
    }

    if (!titleTemplate) {
      throw new Error(`计划项 ${itemKey} 的标题模板不能为空`)
    }

    if (!promptTemplate) {
      throw new Error(`计划项 ${itemKey} 的提示词模板不能为空`)
    }

    return {
      itemKey,
      titleTemplate,
      promptTemplate,
      sortOrder: normalizeInteger(item.sortOrder, 0),
      isEnabled: normalizeBoolean(item.isEnabled, true),
    }
  }) : []

  const stageTemplates = Array.isArray(payload.stageTemplates) ? payload.stageTemplates.map((item) => {
    const stageKey = normalizeTrimmedString(item.stageKey)
    const stageLabel = normalizeTrimmedString(item.stageLabel)

    if (!stageKey) {
      throw new Error('阶段标识不能为空')
    }

    if (!stageLabel) {
      throw new Error(`阶段 ${stageKey} 的名称不能为空`)
    }

    return {
      stageKey,
      stageLabel,
      indicatorTitle: normalizeTrimmedString(item.indicatorTitle),
      indicatorDescriptionTemplate: String(item.indicatorDescriptionTemplate || '').trim(),
      sortOrder: normalizeInteger(item.sortOrder, 0),
      isEnabled: normalizeBoolean(item.isEnabled, true),
    }
  }) : []

  assertUniqueValues(promptTemplates.map(item => item.scene), '提示词场景')
  assertUniqueValues(planTemplates.map(item => item.itemKey), '计划项标识')
  assertUniqueValues(stageTemplates.map(item => item.stageKey), '阶段标识')

  return {
    providerId: normalizeTrimmedString(payload.providerId),
    skillKey,
    label,
    description: normalizeTrimmedString(payload.description),
    iconType: normalizeTrimmedString(payload.iconType),
    category: normalizeTrimmedString(payload.category),
    uiMode: payload.uiMode || 'WORKSPACE',
    executionMode: payload.executionMode || 'PLANNER_THEN_GENERATE',
    workflowType: normalizeTrimmedString(payload.workflowType),
    plannerModelCategory: payload.plannerModelCategory || 'CHAT',
    expectedImageCount: normalizeInteger(payload.expectedImageCount, 4),
    isEnabled: normalizeBoolean(payload.isEnabled, true),
    isBuiltIn: normalizeBoolean(payload.isBuiltIn, false),
    sortOrder: normalizeInteger(payload.sortOrder, 0),
    configJson: normalizeNullableJsonObject(payload.configJson, '技能扩展配置'),
    dependencySkillKeys,
    promptTemplates,
    workflowTemplates,
    planTemplates,
    stageTemplates,
  }
}

type SkillConfigTransactionClient = Prisma.TransactionClient

const resolveDependencySkillRecords = async (client: SkillConfigTransactionClient, dependencySkillKeys: string[]) => {
  if (!dependencySkillKeys.length) {
    return []
  }

  const skills = await client.aiSkill.findMany({
    where: {
      skillKey: {
        in: dependencySkillKeys,
      },
    },
    select: {
      id: true,
      skillKey: true,
    },
  })

  const matchedKeys = skills.map(item => item.skillKey)
  const missingKey = dependencySkillKeys.find(item => !matchedKeys.includes(item))
  if (missingKey) {
    throw new Error(`依赖技能不存在：${missingKey}`)
  }

  return dependencySkillKeys.map((skillKey) => skills.find(item => item.skillKey === skillKey)!).filter(Boolean)
}

// 统一格式化技能主表数据，便于后台页面和运行时复用。
const buildAdminSkillItem = (item: {
  id: string
  providerId: string | null
  skillKey: string
  label: string
  description: string | null
  iconType: string | null
  category: string | null
  uiMode: AiSkillUiMode
  executionMode: AiSkillExecutionMode
  workflowType: string | null
  plannerModelCategory: AiSkillPlannerModelCategory
  expectedImageCount: number
  isEnabled: boolean
  isBuiltIn: boolean
  sortOrder: number
  configJson: unknown
  createdAt: Date
  updatedAt: Date
}): AdminSkillItem => ({
  id: item.id,
  providerId: item.providerId || '',
  skillKey: item.skillKey,
  label: item.label,
  description: item.description || '',
  iconType: item.iconType || '',
  category: item.category || '',
  uiMode: item.uiMode,
  executionMode: item.executionMode,
  workflowType: item.workflowType || '',
  plannerModelCategory: item.plannerModelCategory,
  expectedImageCount: item.expectedImageCount,
  isEnabled: item.isEnabled,
  isBuiltIn: item.isBuiltIn,
  sortOrder: item.sortOrder,
  configJson: normalizeJsonObject(item.configJson),
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
})

const buildSkillPromptTemplateItem = (item: {
  id: string
  skillId: string
  scene: AiSkillPromptScene
  systemPrompt: string
  userPromptTemplate: string
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}): SkillPromptTemplateItem => ({
  id: item.id,
  skillId: item.skillId,
  scene: item.scene,
  systemPrompt: item.systemPrompt,
  userPromptTemplate: item.userPromptTemplate,
  isEnabled: item.isEnabled,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
})

const buildSkillWorkflowTemplateItem = (item: {
  id: string
  skillId: string
  workflowLabel: string
  workflowType: string
  expectedImageCount: number
  workflowParamsTemplateJson: unknown
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}): SkillWorkflowTemplateItem => ({
  id: item.id,
  skillId: item.skillId,
  workflowLabel: item.workflowLabel,
  workflowType: item.workflowType,
  expectedImageCount: item.expectedImageCount,
  workflowParamsTemplateJson: normalizeJsonObject(item.workflowParamsTemplateJson),
  isEnabled: item.isEnabled,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
})

const buildSkillPlanTemplateItem = (item: {
  id: string
  skillId: string
  itemKey: string
  titleTemplate: string
  promptTemplate: string
  sortOrder: number
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}): SkillPlanTemplateItem => ({
  id: item.id,
  skillId: item.skillId,
  itemKey: item.itemKey,
  titleTemplate: item.titleTemplate,
  promptTemplate: item.promptTemplate,
  sortOrder: item.sortOrder,
  isEnabled: item.isEnabled,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
})

const buildSkillStageTemplateItem = (item: {
  id: string
  skillId: string
  stageKey: string
  stageLabel: string
  indicatorTitle: string | null
  indicatorDescriptionTemplate: string | null
  sortOrder: number
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}): SkillStageTemplateItem => ({
  id: item.id,
  skillId: item.skillId,
  stageKey: item.stageKey,
  stageLabel: item.stageLabel,
  indicatorTitle: item.indicatorTitle || '',
  indicatorDescriptionTemplate: item.indicatorDescriptionTemplate || '',
  sortOrder: item.sortOrder,
  isEnabled: item.isEnabled,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
})

const buildSkillDependencyItem = (item: {
  id: string
  skillId: string
  dependencySkillId: string
  sortOrder: number
  createdAt: Date
  dependencySkill: {
    skillKey: string
    label: string
  }
}): SkillDependencyItem => ({
  id: item.id,
  skillId: item.skillId,
  dependencySkillId: item.dependencySkillId,
  dependencySkillKey: item.dependencySkill.skillKey,
  dependencySkillLabel: item.dependencySkill.label,
  sortOrder: item.sortOrder,
  createdAt: item.createdAt.toISOString(),
})

// 读取技能关联的配置对象。
const buildRuntimeSkillDefinition = (skill: {
  id: string
  providerId: string | null
  skillKey: string
  label: string
  description: string | null
  iconType: string | null
  category: string | null
  uiMode: AiSkillUiMode
  executionMode: AiSkillExecutionMode
  workflowType: string | null
  plannerModelCategory: AiSkillPlannerModelCategory
  expectedImageCount: number
  isEnabled: boolean
  isBuiltIn: boolean
  sortOrder: number
  configJson: unknown
  createdAt: Date
  updatedAt: Date
  dependencies: Array<{
    id: string
    skillId: string
    dependencySkillId: string
    sortOrder: number
    createdAt: Date
    dependencySkill: {
      skillKey: string
      label: string
    }
  }>
  prompts: Array<{
    id: string
    skillId: string
    scene: AiSkillPromptScene
    systemPrompt: string
    userPromptTemplate: string
    isEnabled: boolean
    createdAt: Date
    updatedAt: Date
  }>
  workflowTemplates: Array<{
    id: string
    skillId: string
    workflowLabel: string
    workflowType: string
    expectedImageCount: number
    workflowParamsTemplateJson: unknown
    isEnabled: boolean
    createdAt: Date
    updatedAt: Date
  }>
  planTemplates: Array<{
    id: string
    skillId: string
    itemKey: string
    titleTemplate: string
    promptTemplate: string
    sortOrder: number
    isEnabled: boolean
    createdAt: Date
    updatedAt: Date
  }>
  stageTemplates: Array<{
    id: string
    skillId: string
    stageKey: string
    stageLabel: string
    indicatorTitle: string | null
    indicatorDescriptionTemplate: string | null
    sortOrder: number
    isEnabled: boolean
    createdAt: Date
    updatedAt: Date
  }>
}): RuntimeSkillDefinition => {
  const skillItem = buildAdminSkillItem(skill)
  const configJson = skillItem.configJson || {}
  const dependencies = skill.dependencies.map(buildSkillDependencyItem)
  const prompts = skill.prompts.map(buildSkillPromptTemplateItem)
  const workflowTemplates = skill.workflowTemplates.map(buildSkillWorkflowTemplateItem)
  const planTemplates = skill.planTemplates.map(buildSkillPlanTemplateItem)
  const stageTemplates = skill.stageTemplates.map(buildSkillStageTemplateItem)

  const runtimePromptMap = prompts.reduce<RuntimeSkillPromptMap>((result, item) => {
    result[item.scene] = item
    return result
  }, {})

  const dependencySkillKeys = normalizeStringArray(configJson.dependencySkillKeys)
  const workspaceSkillKey = String(configJson.workspaceSkillKey || '').trim() || skill.skillKey

  return {
    skill: skillItem,
    workspaceSkillKey,
    dependencySkillKeys: dependencySkillKeys.length
      ? dependencySkillKeys
      : dependencies.map(item => item.dependencySkillKey),
    dependencies,
    prompts: runtimePromptMap,
    workflowTemplate: workflowTemplates[0] || null,
    workflowTemplates,
    planTemplates,
    stageTemplates,
  }
}

const ensureBuiltInSkillSeeds = async () => {
  if (!isPrismaConfigured()) {
    return
  }

  if (ensureBuiltInSkillsPromise) {
    return ensureBuiltInSkillsPromise
  }

  ensureBuiltInSkillsPromise = (async () => {
    const skillKeys = BUILT_IN_SKILL_SEEDS.map(item => normalizeTrimmedString(item.payload.skillKey))
    const existingSkills = await prisma.aiSkill.findMany({
      where: {
        skillKey: {
          in: skillKeys,
        },
      },
      select: {
        skillKey: true,
      },
    })

    const existingSkillKeySet = new Set(existingSkills.map(item => item.skillKey))
    const missingSeeds = BUILT_IN_SKILL_SEEDS.filter(item => {
      return !existingSkillKeySet.has(normalizeTrimmedString(item.payload.skillKey))
    })

    for (const seed of missingSeeds) {
      const normalizedPayload = normalizeSkillPayload(seed.payload)
      await prisma.$transaction(async (tx) => {
        const skill = await tx.aiSkill.create({
          data: {
            providerId: normalizedPayload.providerId || null,
            skillKey: normalizedPayload.skillKey,
            label: normalizedPayload.label,
            description: normalizedPayload.description || null,
            iconType: normalizedPayload.iconType || null,
            category: normalizedPayload.category || null,
            uiMode: normalizedPayload.uiMode,
            executionMode: normalizedPayload.executionMode,
            workflowType: normalizedPayload.workflowType || null,
            plannerModelCategory: normalizedPayload.plannerModelCategory,
            expectedImageCount: normalizedPayload.expectedImageCount,
            isEnabled: normalizedPayload.isEnabled,
            isBuiltIn: true,
            sortOrder: normalizedPayload.sortOrder,
            configJson: normalizedPayload.configJson,
          },
        })

        await replaceSkillTemplates(tx, skill.id, normalizedPayload)
      })
    }
  })().finally(() => {
    ensureBuiltInSkillsPromise = null
  })

  return ensureBuiltInSkillsPromise
}

const loadSkillWithTemplates = async (skillKey: string, enabledOnly: boolean) => {
  if (!isPrismaConfigured()) {
    return null
  }

  await ensureBuiltInSkillSeeds()

  const normalizedSkillKey = String(skillKey || '').trim()
  if (!normalizedSkillKey) {
    return null
  }

  return prisma.aiSkill.findFirst({
    where: {
      skillKey: normalizedSkillKey,
      ...(enabledOnly ? { isEnabled: true } : {}),
    },
    include: {
      dependencies: {
        include: {
          dependencySkill: true,
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      },
      prompts: {
        where: enabledOnly ? { isEnabled: true } : undefined,
        orderBy: { scene: 'asc' },
      },
      workflowTemplates: {
        where: enabledOnly ? { isEnabled: true } : undefined,
        orderBy: [
          { createdAt: 'asc' },
        ],
      },
      planTemplates: {
        where: enabledOnly ? { isEnabled: true } : undefined,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      },
      stageTemplates: {
        where: enabledOnly ? { isEnabled: true } : undefined,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
  })
}

// 列出后台可维护的全部技能定义。
export const listAdminSkills = async () => {
  await ensureBuiltInSkillSeeds()
  const skills = await prisma.aiSkill.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return skills.map(buildAdminSkillItem)
}

// 读取单个技能的完整配置详情。
export const getSkillDefinitionDetail = async (skillKey: string): Promise<SkillDefinitionDetail> => {
  const skill = await loadSkillWithTemplates(skillKey, false)

  if (!skill) {
    throw new Error('技能不存在')
  }

  return {
    skill: buildAdminSkillItem(skill),
    dependencies: skill.dependencies.map(buildSkillDependencyItem),
    prompts: skill.prompts.map(buildSkillPromptTemplateItem),
    workflowTemplates: skill.workflowTemplates.map(buildSkillWorkflowTemplateItem),
    planTemplates: skill.planTemplates.map(buildSkillPlanTemplateItem),
    stageTemplates: skill.stageTemplates.map(buildSkillStageTemplateItem),
  }
}

// 返回运行时使用的完整技能定义。
export const getRuntimeSkillDefinition = async (skillKey: string) => {
  const skill = await loadSkillWithTemplates(skillKey, true)
  if (!skill) {
    return null
  }

  return buildRuntimeSkillDefinition(skill)
}

// 返回工作台执行引擎需要的技能运行时配置。
export const getWorkspaceSkillRuntimeConfig = async (skillKey: string) => {
  const runtimeSkill = await getRuntimeSkillDefinition(skillKey)
  if (!runtimeSkill) {
    return null
  }

  return {
    skillKey: runtimeSkill.skill.skillKey,
    label: runtimeSkill.skill.label,
    uiMode: runtimeSkill.skill.uiMode,
    executionMode: runtimeSkill.skill.executionMode,
    plannerModelCategory: runtimeSkill.skill.plannerModelCategory,
    workflowType: runtimeSkill.skill.workflowType,
    expectedImageCount: runtimeSkill.skill.expectedImageCount,
    workspaceSkillKey: runtimeSkill.workspaceSkillKey,
    dependencySkillKeys: runtimeSkill.dependencySkillKeys,
    prompts: runtimeSkill.prompts,
    workflowTemplate: runtimeSkill.workflowTemplate,
    planTemplates: runtimeSkill.planTemplates,
    stageTemplates: runtimeSkill.stageTemplates,
    configJson: runtimeSkill.skill.configJson,
  }
}

// 仅返回运行时可安全暴露给前台的启用技能配置。
export const listPublicEnabledSkills = async () => {
  if (!isPrismaConfigured()) {
    return []
  }

  await ensureBuiltInSkillSeeds()

  const skills = await prisma.aiSkill.findMany({
    where: {
      isEnabled: true,
    },
    include: {
      dependencies: {
        include: {
          dependencySkill: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      prompts: {
        where: { isEnabled: true },
        orderBy: { scene: 'asc' },
      },
      workflowTemplates: {
        where: { isEnabled: true },
        orderBy: { createdAt: 'asc' },
      },
      planTemplates: {
        where: { isEnabled: true },
        orderBy: { sortOrder: 'asc' },
      },
      stageTemplates: {
        where: { isEnabled: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return skills.map(skill => {
    const runtimeSkill = buildRuntimeSkillDefinition(skill)
    return {
      ...runtimeSkill.skill,
      workspaceSkillKey: runtimeSkill.workspaceSkillKey,
      dependencySkillKeys: runtimeSkill.dependencySkillKeys,
      dependencies: runtimeSkill.dependencies.map(item => ({
        skillKey: item.dependencySkillKey,
        label: item.dependencySkillLabel,
        sortOrder: item.sortOrder,
      })),
      prompts: Object.values(runtimeSkill.prompts),
      workflowTemplates: runtimeSkill.workflowTemplates,
      planTemplates: runtimeSkill.planTemplates,
      stageTemplates: runtimeSkill.stageTemplates,
    }
  })
}

const assertProviderExists = async (providerId: string) => {
  if (!providerId) {
    return null
  }

  const provider = await prisma.aiProvider.findUnique({
    where: { id: providerId },
    select: { id: true },
  })

  if (!provider) {
    throw new Error('默认厂商不存在')
  }

  return provider.id
}

const assertSkillKeyAvailable = async (skillKey: string, excludeId = '') => {
  const duplicated = await prisma.aiSkill.findFirst({
    where: {
      skillKey,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })

  if (duplicated) {
    throw new Error('技能标识已存在')
  }
}

const assertSkillNotDependedByOthers = async (skillId: string) => {
  const relation = await prisma.aiSkillDependency.findFirst({
    where: {
      dependencySkillId: skillId,
    },
    include: {
      skill: {
        select: {
          skillKey: true,
          label: true,
        },
      },
    },
  })

  if (relation?.skill) {
    throw new Error(`当前技能仍被 ${relation.skill.label}（${relation.skill.skillKey}）依赖，暂不允许删除`)
  }
}

const replaceSkillTemplates = async (
  client: SkillConfigTransactionClient,
  skillId: string,
  payload: ReturnType<typeof normalizeSkillPayload>,
) => {
  await client.aiSkillDependency.deleteMany({
    where: { skillId },
  })
  await client.aiSkillPromptTemplate.deleteMany({
    where: { skillId },
  })
  await client.aiSkillWorkflowTemplate.deleteMany({
    where: { skillId },
  })
  await client.aiSkillPlanTemplate.deleteMany({
    where: { skillId },
  })
  await client.aiSkillStageTemplate.deleteMany({
    where: { skillId },
  })

  const dependencySkills = await resolveDependencySkillRecords(client, payload.dependencySkillKeys)

  if (dependencySkills.length) {
    await client.aiSkillDependency.createMany({
      data: dependencySkills.map((item, index) => ({
        skillId,
        dependencySkillId: item.id,
        sortOrder: index,
      })),
    })
  }

  if (payload.promptTemplates.length) {
    await client.aiSkillPromptTemplate.createMany({
      data: payload.promptTemplates.map(item => ({
        skillId,
        scene: item.scene,
        systemPrompt: item.systemPrompt,
        userPromptTemplate: item.userPromptTemplate,
        isEnabled: item.isEnabled,
      })),
    })
  }

  if (payload.workflowTemplates.length) {
    await client.aiSkillWorkflowTemplate.createMany({
      data: payload.workflowTemplates.map(item => ({
        skillId,
        workflowLabel: item.workflowLabel,
        workflowType: item.workflowType,
        expectedImageCount: item.expectedImageCount,
        workflowParamsTemplateJson: item.workflowParamsTemplateJson,
        isEnabled: item.isEnabled,
      })),
    })
  }

  if (payload.planTemplates.length) {
    await client.aiSkillPlanTemplate.createMany({
      data: payload.planTemplates.map(item => ({
        skillId,
        itemKey: item.itemKey,
        titleTemplate: item.titleTemplate,
        promptTemplate: item.promptTemplate,
        sortOrder: item.sortOrder,
        isEnabled: item.isEnabled,
      })),
    })
  }

  if (payload.stageTemplates.length) {
    await client.aiSkillStageTemplate.createMany({
      data: payload.stageTemplates.map(item => ({
        skillId,
        stageKey: item.stageKey,
        stageLabel: item.stageLabel,
        indicatorTitle: item.indicatorTitle || null,
        indicatorDescriptionTemplate: item.indicatorDescriptionTemplate || null,
        sortOrder: item.sortOrder,
        isEnabled: item.isEnabled,
      })),
    })
  }
}

// 创建技能配置。
export const createAdminSkill = async (payload: AdminSkillPayload) => {
  const normalizedPayload = normalizeSkillPayload(payload)
  await assertProviderExists(normalizedPayload.providerId)
  await assertSkillKeyAvailable(normalizedPayload.skillKey)

  await prisma.$transaction(async (tx) => {
    const skill = await tx.aiSkill.create({
      data: {
        providerId: normalizedPayload.providerId || null,
        skillKey: normalizedPayload.skillKey,
        label: normalizedPayload.label,
        description: normalizedPayload.description || null,
        iconType: normalizedPayload.iconType || null,
        category: normalizedPayload.category || null,
        uiMode: normalizedPayload.uiMode,
        executionMode: normalizedPayload.executionMode,
        workflowType: normalizedPayload.workflowType || null,
        plannerModelCategory: normalizedPayload.plannerModelCategory,
        expectedImageCount: normalizedPayload.expectedImageCount,
        isEnabled: normalizedPayload.isEnabled,
        isBuiltIn: normalizedPayload.isBuiltIn,
        sortOrder: normalizedPayload.sortOrder,
        configJson: normalizedPayload.configJson,
      },
    })

    await replaceSkillTemplates(tx, skill.id, normalizedPayload)
  })

  return getSkillDefinitionDetail(normalizedPayload.skillKey)
}

// 更新技能配置。
export const updateAdminSkill = async (skillKey: string, payload: AdminSkillPayload) => {
  const normalizedSkillKey = normalizeTrimmedString(skillKey)
  if (!normalizedSkillKey) {
    throw new Error('缺少技能标识')
  }

  const existing = await prisma.aiSkill.findFirst({
    where: { skillKey: normalizedSkillKey },
    select: { id: true },
  })

  if (!existing) {
    throw new Error('技能不存在')
  }

  const normalizedPayload = normalizeSkillPayload(payload)
  await assertProviderExists(normalizedPayload.providerId)
  await assertSkillKeyAvailable(normalizedPayload.skillKey, existing.id)

  await prisma.$transaction(async (tx) => {
    await tx.aiSkill.update({
      where: { id: existing.id },
      data: {
        providerId: normalizedPayload.providerId || null,
        skillKey: normalizedPayload.skillKey,
        label: normalizedPayload.label,
        description: normalizedPayload.description || null,
        iconType: normalizedPayload.iconType || null,
        category: normalizedPayload.category || null,
        uiMode: normalizedPayload.uiMode,
        executionMode: normalizedPayload.executionMode,
        workflowType: normalizedPayload.workflowType || null,
        plannerModelCategory: normalizedPayload.plannerModelCategory,
        expectedImageCount: normalizedPayload.expectedImageCount,
        isEnabled: normalizedPayload.isEnabled,
        isBuiltIn: normalizedPayload.isBuiltIn,
        sortOrder: normalizedPayload.sortOrder,
        configJson: normalizedPayload.configJson,
      },
    })

    await replaceSkillTemplates(tx, existing.id, normalizedPayload)
  })
  return getSkillDefinitionDetail(normalizedPayload.skillKey)
}

// 快捷切换技能启用状态，避免后台列表页必须进入详情后再保存。
export const setAdminSkillEnabled = async (skillKey: string, isEnabled: boolean) => {
  const normalizedSkillKey = normalizeTrimmedString(skillKey)
  if (!normalizedSkillKey) {
    throw new Error('缺少技能标识')
  }

  const existing = await prisma.aiSkill.findFirst({
    where: { skillKey: normalizedSkillKey },
    select: { id: true },
  })

  if (!existing) {
    throw new Error('技能不存在')
  }

  await prisma.aiSkill.update({
    where: { id: existing.id },
    data: {
      isEnabled: normalizeBoolean(isEnabled, true),
    },
  })

  return getSkillDefinitionDetail(normalizedSkillKey)
}

// 删除技能配置。
export const deleteAdminSkill = async (skillKey: string) => {
  const normalizedSkillKey = normalizeTrimmedString(skillKey)
  if (!normalizedSkillKey) {
    throw new Error('缺少技能标识')
  }

  const existing = await prisma.aiSkill.findFirst({
    where: { skillKey: normalizedSkillKey },
    select: {
      id: true,
      isBuiltIn: true,
    },
  })

  if (!existing) {
    throw new Error('技能不存在')
  }

  if (existing.isBuiltIn) {
    throw new Error('内置技能不允许删除')
  }

  await assertSkillNotDependedByOthers(existing.id)

  await prisma.aiSkill.delete({
    where: { id: existing.id },
  })

  return {
    skillKey: normalizedSkillKey,
  }
}
