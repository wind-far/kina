import { computed, ref } from 'vue'
import { buildAgentWorkflowStrategy, getAgentSkillConfig } from '@/config/agentSkills'
import discoverContent from '@/data/homeDiscoverContent.json'
import type { AgentImageResult, AgentRunState, AgentTaskStep } from '@/types/agent'
import useWorkflowOrchestrator from '@/views/workflow/composables/useWorkflowOrchestrator'
import type { CreationType } from '@/components/generate/selectors'

interface AgentSendOptions {
  model?: string
  modelKey?: string
  ratio?: string
  resolution?: string
  duration?: string
  feature?: string
  skill?: string
}

const createIdleRun = (): AgentRunState => ({
  id: 'agent-run-idle',
  query: '设计一个小猫品牌图标',
  skill: 'brand-design',
  status: 'idle',
  user: {
    name: '即梦 Agent',
  },
  steps: [
    {
      id: 'step-empty',
      title: '说说今天想做点什么',
      status: 'pending',
      description: '输入一个任务后，这里会展示思考、执行和结果阶段。',
    },
  ],
  indicator: {
    status: 'idle',
    title: '暂无任务',
    description: '发送一个任务后，这里会显示当前执行阶段。',
  },
  result: {
    summary: '当前是工作台预览状态，发送任务后会生成阶段流程与结果内容。',
    images: [],
  },
})

const buildPendingSteps = (): AgentTaskStep[] => [
  {
    id: 'step-thinking',
    title: '再思考片刻...',
    status: 'running',
    description: '正在理解你的意图，并匹配合适的技能与工作流。',
  },
  {
    id: 'step-plan',
    title: '思考完成',
    status: 'pending',
    description: '等待生成任务规划。',
  },
  {
    id: 'step-generate',
    title: '结果生成中...',
    status: 'pending',
    description: '等待结果输出。',
  },
]

const feedImagePool: AgentImageResult[] = (discoverContent.feedItems || []).map((item, index) => ({
  id: item.id || `feed-image-${index + 1}`,
  imageSrc: item.imageSrc,
  promptText: item.promptText || item.alt,
}))

const workflowTitleMap: Record<string, string> = {
  text_to_image: '单图生成',
  text_to_image_to_video: '图生视频',
  storyboard: '剧情分镜',
  multi_angle_storyboard: '多角度分镜',
}

const pickImagesForWorkflow = (workflowType: string): AgentImageResult[] => {
  if (!feedImagePool.length) return []

  const imageCount =
    workflowType === 'storyboard'
      ? 4
      : workflowType === 'multi_angle_storyboard'
        ? 4
        : workflowType === 'text_to_image_to_video'
          ? 2
          : 4

  return feedImagePool.slice(0, imageCount)
}

const buildSummaryByParams = (params: Record<string, any>, skillLabel: string): string => {
  const workflowType = String(params.workflow_type || 'text_to_image')
  const workflowLabel = workflowTitleMap[workflowType] || '创作任务'

  if (workflowType === 'storyboard' && Array.isArray(params.shots)) {
    return `已根据「${skillLabel}」技能规划 ${params.shots.length} 个分镜镜头，当前结果区使用示例图片占位，后续可替换成真实工作流输出。`
  }

  if (workflowType === 'multi_angle_storyboard') {
    return `已根据「${skillLabel}」技能生成多角度分镜任务，当前展示为 4 个示例结果位，适合后续接入真实节点输出。`
  }

  if (workflowType === 'text_to_image_to_video') {
    return `已根据「${skillLabel}」技能拆解为首帧图与视频动作两段任务，当前结果区先展示示例素材，用于验证工作台交互流程。`
  }

  return `已根据「${skillLabel}」技能生成 ${workflowLabel} 任务，当前结果区展示的是 JSON 素材占位，用于验证 Agent 工作台结构与任务推进体验。`
}

const buildCompletedSteps = (params: Record<string, any>): AgentTaskStep[] => {
  const workflowType = String(params.workflow_type || 'text_to_image')
  const workflowLabel = workflowTitleMap[workflowType] || '创作任务'

  return [
    {
      id: 'step-thinking',
      title: '再思考片刻...',
      status: 'completed',
      description: '已完成任务理解与技能匹配。',
    },
    {
      id: 'step-plan',
      title: '思考完成',
      status: 'completed',
      description: `已确定工作流：${workflowLabel}。`,
    },
    {
      id: 'step-generate',
      title: '结果生成中...',
      status: 'completed',
      description: '已完成任务规划与首轮结果映射。',
    },
    {
      id: 'step-finish',
      title: '任务已完成',
      status: 'completed',
      description: '当前页面展示的是工作台结果视图，可继续修改提示词发起下一轮任务。',
    },
  ]
}

export function useAgentWorkspace() {
  const { analyzeIntent } = useWorkflowOrchestrator()

  const currentRun = ref<AgentRunState>(createIdleRun())
  const isSubmitting = ref(false)

  // 底部生成器始终回填当前任务，便于用户继续追问或改写。
  const generatorPrompt = computed(() => currentRun.value.query)

  const handleSend = async (
    message: string,
    type: CreationType,
    options?: AgentSendOptions,
  ) => {
    if (!message.trim()) return

    const skillKey = options?.skill || 'general'
    const skillConfig = getAgentSkillConfig(skillKey)

    currentRun.value = {
      id: `agent-run-${Date.now()}`,
      query: message,
      skill: skillKey,
      status: 'thinking',
      user: {
        name: '即梦 Agent',
      },
      steps: buildPendingSteps(),
      result: {
        summary: '',
        images: [],
      },
      indicator: {
        status: 'thinking',
        title: '再思考片刻...',
        description: '正在理解你的意图，并匹配合适的技能与工作流。',
      },
    }

    isSubmitting.value = true

    try {
      let workflowParams: Record<string, any>
      const strategy = buildAgentWorkflowStrategy(skillKey, message)

      if (strategy.mode === 'analyze') {
        workflowParams = await analyzeIntent(strategy.userInput, {
          systemPromptOverride: strategy.systemPrompt,
        })
      } else {
        workflowParams = strategy.params as Record<string, any>
      }

      const nextSteps = buildCompletedSteps(workflowParams)
      const nextImages = pickImagesForWorkflow(String(workflowParams.workflow_type || type))

      currentRun.value = {
        id: currentRun.value.id,
        query: message,
        skill: skillKey,
        status: 'completed',
        user: {
          name: '即梦 Agent',
        },
        steps: nextSteps,
        result: {
          summary: buildSummaryByParams(workflowParams, skillConfig.label),
          images: nextImages,
        },
        indicator: {
          status: 'completed',
          title: '任务已完成',
          description: '当前结果已更新，你可以继续补充要求发起下一轮任务。',
        },
      }
    } catch (error: any) {
      currentRun.value = {
        ...currentRun.value,
        status: 'error',
        steps: [
          {
            id: 'step-error',
            title: '任务执行失败',
            status: 'error',
            description: error?.message || '任务分析失败，请稍后重试。',
          },
        ],
        result: {
          summary: '当前任务未能完成分析，你可以修改需求后再次发送。',
          images: [],
        },
        indicator: {
          status: 'error',
          title: '任务执行失败',
          description: error?.message || '任务分析失败，请稍后重试。',
        },
      }
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    currentRun,
    generatorPrompt,
    isSubmitting,
    handleSend,
  }
}
