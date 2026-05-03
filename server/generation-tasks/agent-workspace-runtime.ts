import { buildAgentWorkflowStrategy, getAgentSkillConfig } from '../../src/shared/agent-skills-core'
import { getWorkspaceSkillRuntimeConfig, type SkillPlanTemplateItem } from '../skill-config/service'

export interface AgentWorkspaceTaskPayload {
  prompt: string
  skill: string
}

export interface AgentWorkspacePlannedImageTask {
  label: string
  promptText: string
}

export interface AgentWorkspacePlan {
  workflowLabel: string
  workflowParams: Record<string, unknown>
  planItems: string[]
  imageTasks: AgentWorkspacePlannedImageTask[]
}

export interface AgentWorkspaceSkillRuntimeMeta {
  skill: string
  skillLabel: string
  workspaceSkillKey: string
  dependencySkillKeys: string[]
}

export const workspaceTimingProfile = {
  preAnalyzeDelay: 900,
  analyzeDelayRange: [2400, 3600],
  reasoningChunkDelayRange: [120, 220],
  toolCallDelayRange: [280, 420],
  postPlanDelayRange: [1200, 1800],
  preSubmitDelay: 800,
  betweenImageDelayRange: [500, 900],
  completionDelayRange: [400, 700],
} as const

export class AgentWorkspaceStoppedError extends Error {
  constructor(message = '任务已停止') {
    super(message)
    this.name = 'AgentWorkspaceStoppedError'
  }
}

const workflowTitleMap: Record<string, string> = {
  text_to_image: '单图生成',
  text_to_image_to_video: '图生视频',
  storyboard: '剧情分镜',
  multi_angle_storyboard: '多角度分镜',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 海报类技能底层工作台技能键兜底。
const workspaceSkillKeyMap: Record<string, string> = {
  'poster-design': 'image-poster',
}

// 海报类技能依赖链兜底。
const workspaceDependencySkillKeyMap: Record<string, string[]> = {
  'poster-design': ['image-main'],
  'image-poster': ['image-main'],
}

const interpolateTemplateString = (template: string, variables: Record<string, string>) => {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_matched, key: string) => {
    return variables[key] ?? ''
  })
}

const renderTemplateValue = (value: unknown, variables: Record<string, string>): unknown => {
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

export const assertWorkspaceNotAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new AgentWorkspaceStoppedError()
  }
}

export const sleepWithWorkspaceAbort = async (signal: AbortSignal, ms: number) => {
  let rest = ms
  while (rest > 0) {
    assertWorkspaceNotAborted(signal)
    const wait = Math.min(rest, 80)
    await sleep(wait)
    rest -= wait
  }
  assertWorkspaceNotAborted(signal)
}

export const getWorkspaceRandomDelay = ([min, max]: readonly [number, number]) => {
  if (min >= max) return min
  return Math.round(min + Math.random() * (max - min))
}

const inferStoryboardShots = (prompt: string) => {
  const normalizedPrompt = prompt.trim() || '当前主题'
  return [
    {
      title: '开场建立',
      prompt: `${normalizedPrompt}，故事开场镜头，建立场景与主角状态，电影感构图。`,
    },
    {
      title: '冲突出现',
      prompt: `${normalizedPrompt}，冲突开始显现，人物动作与情绪更明确，戏剧张力增强。`,
    },
    {
      title: '情绪推进',
      prompt: `${normalizedPrompt}，故事推进阶段，镜头更贴近角色，强调关键变化。`,
    },
    {
      title: '收束定格',
      prompt: `${normalizedPrompt}，结尾定格画面，情绪落点鲜明，适合剧情短片封面。`,
    },
  ]
}

const analyzeWorkflowParams = (skill: string, prompt: string) => {
  const strategy = buildAgentWorkflowStrategy(skill || 'general', prompt)

  if (strategy.mode === 'direct') {
    return strategy.params as Record<string, unknown>
  }

  if (skill === 'story-short') {
    return {
      workflow_type: 'storyboard',
      character: {
        name: '主角',
        description: prompt.trim() || '围绕用户主题构建的核心角色',
      },
      shots: inferStoryboardShots(prompt),
    }
  }

  return {
    workflow_type: 'text_to_image',
    image_prompt: prompt.trim() || strategy.userInput || '当前主题',
  }
}

const getWorkflowExecutionLabel = (params: Record<string, unknown>, fallbackLabel = '') => {
  if (fallbackLabel) {
    return fallbackLabel
  }

  const workflowType = String(params.workflow_type || 'text_to_image')
  return workflowTitleMap[workflowType] || '创作任务'
}

const buildPosterImageTasks = (basePrompt: string): AgentWorkspacePlannedImageTask[] => [
  {
    label: '主视觉构图',
    promptText: `${basePrompt}，海报主视觉方案一，强调唯一视觉中心、主体识别度、营销传播感与纵深空间，画面需具备明确标题区、副标题区与信息承载区，整体适合活动海报或品牌宣传海报，禁止空洞背景，确保主体、背景、文字区域天然融合。`,
  },
  {
    label: '版式留白',
    promptText: `${basePrompt}，海报主视觉方案二，强化版式设计与留白控制，预留清晰主标题、副标题和辅助卖点排版空间，整体更高级克制，兼顾缩略图识别度与落地传播效果，加入细腻渐变、图形结构或纹理提升完成度。`,
  },
  {
    label: '氛围强化',
    promptText: `${basePrompt}，海报主视觉方案三，强化色彩氛围、光影戏剧感和商业传播张力，主体与场景关系自然统一，画面具备更强情绪感染力，同时保留清晰文案区与视觉动线，不要堆叠无效元素。`,
  },
  {
    label: '细节特写',
    promptText: `${basePrompt}，海报主视觉方案四，突出局部细节、材质层次与高级设计语言，在保证完整海报版式的同时增强质感表达，适合形成差异化提案版本，主体边缘过渡自然、背景不单薄、整体具备品牌化完成度。`,
  },
]

const buildEcommerceImageTasks = (basePrompt: string): AgentWorkspacePlannedImageTask[] => [
  { label: '商品主图', promptText: `${basePrompt}，电商主图风格，主体清晰，背景干净，卖点突出。` },
  { label: '场景展示', promptText: `${basePrompt}，加入真实使用场景，强化代入感与生活方式表达。` },
  { label: '卖点细节', promptText: `${basePrompt}，突出材质、工艺和功能细节，商业摄影质感。` },
  { label: '氛围延展', promptText: `${basePrompt}，做一张偏品牌感的延展海报，兼顾商品与情绪氛围。` },
]

const buildBrandImageTasks = (basePrompt: string): AgentWorkspacePlannedImageTask[] => [
  { label: '品牌主视觉', promptText: `${basePrompt}，品牌主视觉提案图，识别度高，适合首页头图。` },
  { label: '概念情绪板', promptText: `${basePrompt}，品牌 moodboard 风格，强调颜色、材质与气质。` },
  { label: '符号元素', promptText: `${basePrompt}，强化品牌识别元素、图形语言与记忆点。` },
  { label: '应用场景', promptText: `${basePrompt}，展示品牌视觉在广告或物料场景中的落地效果。` },
]

const buildMarketingVideoTasks = (basePrompt: string): AgentWorkspacePlannedImageTask[] => [
  { label: '首帧封面', promptText: `${basePrompt}，营销视频首帧封面，卖点聚焦，冲击力强。` },
  { label: '卖点特写', promptText: `${basePrompt}，突出产品卖点与核心利益点，适合中段镜头。` },
  { label: '场景演绎', promptText: `${basePrompt}，加入用户使用场景与情绪反馈，画面更具叙事感。` },
  { label: '收尾定格', promptText: `${basePrompt}，做一张适合视频收尾的品牌定格画面。` },
]

const buildStoryboardImageTasks = (shots: Array<Record<string, unknown>>) => {
  return shots.map((shot, index) => ({
    label: String(shot.title || `分镜 ${index + 1}`),
    promptText: String(shot.prompt || '').trim(),
  })).filter(item => item.promptText)
}

const buildGenericImageTasks = (basePrompt: string): AgentWorkspacePlannedImageTask[] => [
  { label: '方案方向 1', promptText: `${basePrompt}，主画面版本，突出整体完成度。` },
  { label: '方案方向 2', promptText: `${basePrompt}，改变构图重心与主体比例，形成差异化版本。` },
  { label: '方案方向 3', promptText: `${basePrompt}，调整色彩氛围与光影层次，形成风格化版本。` },
  { label: '方案方向 4', promptText: `${basePrompt}，强调细节、质感与视觉张力，形成强化版本。` },
]

const buildImageTasksFromWorkflow = (skill: string, workflowParams: Record<string, unknown>) => {
  const workflowType = String(workflowParams.workflow_type || 'text_to_image')

  if (workflowType === 'storyboard' && Array.isArray(workflowParams.shots)) {
    return buildStoryboardImageTasks(workflowParams.shots as Array<Record<string, unknown>>)
  }

  const basePrompt = String(
    workflowParams.image_prompt
    || workflowParams.video_prompt
    || workflowParams.prompt
    || '',
  ).trim()

  if (!basePrompt) {
    return []
  }

  if (skill === 'poster-design') {
    return buildPosterImageTasks(basePrompt)
  }

  if (skill === 'ecommerce-pack') {
    return buildEcommerceImageTasks(basePrompt)
  }

  if (skill === 'brand-design') {
    return buildBrandImageTasks(basePrompt)
  }

  if (skill === 'marketing-video') {
    return buildMarketingVideoTasks(basePrompt)
  }

  return buildGenericImageTasks(basePrompt)
}

const buildImageTasksFromPlanTemplates = (
  planTemplates: SkillPlanTemplateItem[],
  workflowParams: Record<string, unknown>,
  prompt: string,
) => {
  const basePrompt = String(
    workflowParams.image_prompt
    || workflowParams.video_prompt
    || workflowParams.prompt
    || prompt,
  ).trim()

  const variables = {
    input: prompt.trim(),
    base_prompt: basePrompt,
    basePrompt,
  }

  return planTemplates.map(item => ({
    label: interpolateTemplateString(item.titleTemplate, variables).trim() || item.titleTemplate,
    promptText: interpolateTemplateString(item.promptTemplate, variables).trim(),
  })).filter(item => item.label && item.promptText)
}

const buildPlanFromRuntimeConfig = (input: {
  skill: string
  prompt: string
  workflowLabel: string
  workflowParams: Record<string, unknown>
  planTemplates: SkillPlanTemplateItem[]
}) => {
  const imageTasks = input.planTemplates.length
    ? buildImageTasksFromPlanTemplates(input.planTemplates, input.workflowParams, input.prompt)
    : buildImageTasksFromWorkflow(input.skill, input.workflowParams)

  return {
    workflowLabel: input.workflowLabel,
    workflowParams: input.workflowParams,
    planItems: imageTasks.map(item => item.label),
    imageTasks,
  }
}

export const buildWorkspaceCompletionSummary = (options: {
  title?: string
  prompt: string
  planItems?: string[]
}) => {
  const subject = options.title?.trim() || options.prompt.trim() || '当前主题'
  const count = options.planItems?.length || 0
  const directions = (options.planItems || []).join('、')

  if (count > 0 && directions) {
    return `已成功生成 ${count} 张${subject}结果，包含${directions}等不同表现方向。`
  }

  if (count > 0) {
    return `已成功生成 ${count} 张${subject}结果。`
  }

  return `${subject}任务已完成。`
}

// 获取工作台执行所需的技能运行时元信息。
export const getAgentWorkspaceSkillMeta = async (skill: string): Promise<AgentWorkspaceSkillRuntimeMeta> => {
  const normalizedSkill = String(skill || '').trim() || 'general'
  const runtimeConfig = await getWorkspaceSkillRuntimeConfig(normalizedSkill)
  const fallbackConfig = getAgentSkillConfig(normalizedSkill)

  return {
    skill: normalizedSkill,
    skillLabel: runtimeConfig?.label || fallbackConfig.label,
    workspaceSkillKey: runtimeConfig?.workspaceSkillKey
      || workspaceSkillKeyMap[normalizedSkill]
      || normalizedSkill,
    dependencySkillKeys: runtimeConfig?.dependencySkillKeys?.length
      ? runtimeConfig.dependencySkillKeys
      : (workspaceDependencySkillKeyMap[normalizedSkill] || []),
  }
}

export const planAgentWorkspace = async (payload: AgentWorkspaceTaskPayload): Promise<AgentWorkspacePlan> => {
  const skill = String(payload.skill || '').trim() || 'general'
  const runtimeConfig = await getWorkspaceSkillRuntimeConfig(skill)
  const strategyParams = analyzeWorkflowParams(skill, payload.prompt)

  const variables = {
    input: payload.prompt.trim(),
    prompt: payload.prompt.trim(),
  }

  const workflowParams = runtimeConfig?.workflowTemplate?.workflowParamsTemplateJson
    ? renderTemplateValue(runtimeConfig.workflowTemplate.workflowParamsTemplateJson, variables) as Record<string, unknown>
    : strategyParams

  const workflowLabel = getWorkflowExecutionLabel(
    workflowParams,
    runtimeConfig?.workflowTemplate?.workflowLabel || '',
  )

  if (runtimeConfig) {
    return buildPlanFromRuntimeConfig({
      skill,
      prompt: payload.prompt,
      workflowLabel,
      workflowParams,
      planTemplates: runtimeConfig.planTemplates,
    })
  }

  const imageTasks = buildImageTasksFromWorkflow(skill, workflowParams)
  return {
    workflowLabel,
    workflowParams,
    planItems: imageTasks.map(item => item.label),
    imageTasks,
  }
}

export const getAgentWorkspaceSkillLabel = async (skill: string) => {
  const meta = await getAgentWorkspaceSkillMeta(skill)
  return meta.skillLabel
}
