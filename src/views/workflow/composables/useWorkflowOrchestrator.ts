/**
 * 工作流编排 Hook
 * 统一管理意图分析、执行状态与工作流策略分发。
 */

import { ref } from 'vue'
import { streamChatCompletions } from '../api/chat'
import { clearWorkflowWatchers, waitForWorkflowConfigComplete, waitForWorkflowOutputReady } from './workflow-execution-helpers'
import { getWorkflowExecutionStrategy } from './workflow-execution-strategies'
import {
  WORKFLOW_TYPES,
  type TextToImageWorkflowParams,
  type WorkflowCanvasPosition,
  type WorkflowExecutionContext,
  type WorkflowExecutionLogEntry,
  type WorkflowIntentAnalysisOptions,
  type WorkflowIntentAnalysisResult,
} from './workflow-orchestrator-types'

// 意图分析系统提示词
const INTENT_ANALYSIS_PROMPT = `你是一个工作流分析助手。根据用户输入判断需要的工作流类型，并生成对应的提示词。

工作流类型：
1. text_to_image - 用户想要生成单张图片（默认）
2. text_to_image_to_video - 用户想要生成图片并转成视频（包含"视频"、"动画"、"动起来"等关键词）
3. storyboard - 用户想要生成分镜/多场景图片（包含"分镜"、"场景一"、"镜头"等关键词，或描述多个连续场景）
4. multi_angle_storyboard - 用户想要生成多角度分镜（包含"多角度"、"正视"、"侧视"、"后视"、"俯视"、"四宫格"、"景别"等关键词）

返回 JSON：
{
  "workflow_type": "text_to_image | text_to_image_to_video | storyboard | multi_angle_storyboard",
  "description": "简短描述",
  "image_prompt": "优化后的图片生成提示词",
  "video_prompt": "视频生成提示词（仅 text_to_image_to_video）",
  "character": {
    "name": "角色名称",
    "description": "角色外观描述"
  },
  "shots": [
    { "title": "分镜标题", "prompt": "该分镜的详细画面描述" }
  ],
  "multi_angle": {
    "character_description": "角色的详细外观描述"
  }
}

返回纯 JSON，不要其他内容。`

export const useWorkflowOrchestrator = () => {
  const isAnalyzing = ref(false)
  const isExecuting = ref(false)
  const currentStep = ref(0)
  const totalSteps = ref(0)
  const executionLog = ref<WorkflowExecutionLogEntry[]>([])
  const activeWatchers: Array<() => void> = []

  const addLog = (type: string, message: string) => {
    executionLog.value.push({ type, message, timestamp: Date.now() })
    console.log(`[工作流 ${type}] ${message}`)
  }

  const clearWatchers = () => clearWorkflowWatchers(activeWatchers)

  const waitForConfigComplete = (configNodeId: string) => (
    waitForWorkflowConfigComplete(configNodeId, activeWatchers, addLog)
  )

  const waitForOutputReady = (outputNodeId: string) => (
    waitForWorkflowOutputReady(outputNodeId, activeWatchers)
  )

  // 分析用户意图
  const buildDefaultIntent = (userInput: string): TextToImageWorkflowParams => ({
    workflow_type: WORKFLOW_TYPES.TEXT_TO_IMAGE,
    image_prompt: userInput,
  })

  // 统一兜底解析结果，保证策略层拿到的是结构稳定的工作流参数。
  const normalizeIntentResult = (parsed: unknown, userInput: string): WorkflowIntentAnalysisResult => {
    if (!parsed || typeof parsed !== 'object') {
      return buildDefaultIntent(userInput)
    }

    const candidate = parsed as Record<string, unknown>
    const workflowType = String(candidate.workflow_type || '').trim().toLowerCase()
    const description = typeof candidate.description === 'string' ? candidate.description : undefined

    if (workflowType === WORKFLOW_TYPES.TEXT_TO_IMAGE_TO_VIDEO) {
      const imagePrompt = typeof candidate.image_prompt === 'string' && candidate.image_prompt.trim()
        ? candidate.image_prompt
        : userInput
      const videoPrompt = typeof candidate.video_prompt === 'string' && candidate.video_prompt.trim()
        ? candidate.video_prompt
        : imagePrompt
      return {
        workflow_type: WORKFLOW_TYPES.TEXT_TO_IMAGE_TO_VIDEO,
        description,
        image_prompt: imagePrompt,
        video_prompt: videoPrompt,
      }
    }

    if (workflowType === WORKFLOW_TYPES.STORYBOARD) {
      const rawCharacter = candidate.character
      const rawShots = candidate.shots
      const shots = Array.isArray(rawShots)
        ? rawShots
          .filter((shot): shot is Record<string, unknown> => Boolean(shot) && typeof shot === 'object')
          .map((shot, index) => ({
            title: typeof shot.title === 'string' && shot.title.trim() ? shot.title : `分镜${index + 1}`,
            prompt: typeof shot.prompt === 'string' && shot.prompt.trim() ? shot.prompt : userInput,
          }))
        : []

      if (shots.length === 0) {
        return buildDefaultIntent(userInput)
      }

      return {
        workflow_type: WORKFLOW_TYPES.STORYBOARD,
        description,
        character: {
          name: rawCharacter && typeof rawCharacter === 'object' && typeof (rawCharacter as Record<string, unknown>).name === 'string'
            ? (rawCharacter as Record<string, unknown>).name as string
            : '角色',
          description: rawCharacter && typeof rawCharacter === 'object' && typeof (rawCharacter as Record<string, unknown>).description === 'string'
            ? (rawCharacter as Record<string, unknown>).description as string
            : userInput,
        },
        shots,
      }
    }

    if (workflowType === WORKFLOW_TYPES.MULTI_ANGLE_STORYBOARD) {
      const rawMultiAngle = candidate.multi_angle
      return {
        workflow_type: WORKFLOW_TYPES.MULTI_ANGLE_STORYBOARD,
        description,
        multi_angle: {
          character_description: rawMultiAngle && typeof rawMultiAngle === 'object'
            && typeof (rawMultiAngle as Record<string, unknown>).character_description === 'string'
            ? (rawMultiAngle as Record<string, unknown>).character_description as string
            : userInput,
        },
      }
    }

    return {
      workflow_type: WORKFLOW_TYPES.TEXT_TO_IMAGE,
      description,
      image_prompt: typeof candidate.image_prompt === 'string' && candidate.image_prompt.trim()
        ? candidate.image_prompt
        : userInput,
    }
  }

  const analyzeIntent = async (
    userInput: string,
    options?: WorkflowIntentAnalysisOptions,
  ): Promise<WorkflowIntentAnalysisResult> => {
    isAnalyzing.value = true
    try {
      let response = ''
      for await (const chunk of streamChatCompletions({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: options?.systemPromptOverride || INTENT_ANALYSIS_PROMPT },
          { role: 'user', content: userInput }
        ]
      })) {
        response += chunk
      }
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return buildDefaultIntent(userInput)
      return normalizeIntentResult(JSON.parse(jsonMatch[0]), userInput)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知异常'
      addLog('error', `分析失败: ${message}`)
      return buildDefaultIntent(userInput)
    } finally {
      isAnalyzing.value = false
    }
  }

  const workflowExecutionContext: WorkflowExecutionContext = {
    addLog,
    setCurrentStep: (step) => {
      currentStep.value = step
    },
    setTotalSteps: (step) => {
      totalSteps.value = step
    },
    waitForConfigComplete,
    waitForOutputReady,
  }

  // 根据工作流类型执行
  const executeWorkflow = async (
    params: WorkflowIntentAnalysisResult,
    position: WorkflowCanvasPosition,
  ) => {
    isExecuting.value = true
    clearWatchers()
    executionLog.value = []

    try {
      const strategy = getWorkflowExecutionStrategy(params.workflow_type)
      return await strategy.execute(params, position, workflowExecutionContext)
    } finally {
      isExecuting.value = false
      clearWatchers()
    }
  }

  const reset = () => {
    isAnalyzing.value = false
    isExecuting.value = false
    currentStep.value = 0
    totalSteps.value = 0
    executionLog.value = []
    clearWatchers()
  }

  return {
    isAnalyzing, isExecuting, currentStep, totalSteps, executionLog,
    analyzeIntent, executeWorkflow, reset,
    WORKFLOW_TYPES
  }
}

export default useWorkflowOrchestrator
