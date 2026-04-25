import { buildAgentWorkflowStrategy, getAgentSkillConfig } from '@/config/agentSkills'
import type { AgentImageResult } from '@/types/agent'

type AnalyzeIntentFn = (
  userInput: string,
  options?: { systemPromptOverride?: string }
) => Promise<Record<string, any>>

export interface MockAgentTaskPayload {
  prompt: string
  skill: string
}

export interface MockAgentTask {
  taskId: string
  prompt: string
  skill: string
  status: 'created' | 'running' | 'completed' | 'failed' | 'stopped'
  createdAt: string
}

export type MockAgentBackendEvent =
  | {
      type: 'run_started'
      taskId: string
    }
  | {
      type: 'run_stopped'
      taskId: string
      message: string
    }
  | {
      type: 'reasoning_delta'
      taskId: string
      stageKey: string
      stageLabel: string
      text: string
    }
  | {
      type: 'assistant_text_delta'
      taskId: string
      stageKey: string
      stageLabel: string
      text: string
    }
  | {
      type: 'tool_call_started'
      taskId: string
      toolName: string
      argumentsText?: string
      sectionKey?: string
      label?: string
    }
  | {
      type: 'skill_activated'
      taskId: string
      skillLabel: string
      sectionKey?: string
    }
  | {
      type: 'skill_loaded'
      taskId: string
      skillLabel: string
      dependencySkillLabel?: string
      sectionKey?: string
      label?: string
    }
  | {
      type: 'workflow_planned'
      taskId: string
      workflowLabel: string
      workflowParams: Record<string, any>
      expectedImageCount: number
      planItems?: string[]
    }
  | {
      type: 'submission_started'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      attempt?: number
      resolution?: string
    }
  | {
      type: 'submission_failed'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      attempt: number
      resolution: string
      errorMessage: string
      fallbackResolution?: string
    }
  | {
      type: 'submission_retrying'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      attempt: number
      resolution: string
    }
  | {
      type: 'image_completed'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      completedCount: number
      image: AgentImageResult
    }
  | {
      type: 'run_completed'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      summary: string
      title?: string
    }
  | {
      type: 'run_failed'
      taskId: string
      errorMessage: string
    }

interface MockAgentTaskRuntime {
  task: MockAgentTask
  events: MockAgentBackendEvent[]
  waiters: Array<(event: MockAgentBackendEvent | null) => void>
  started: boolean
  finished: boolean
  cancelRequested: boolean
}

class MockAgentTaskStoppedError extends Error {
  constructor(message = '任务已停止') {
    super(message)
    this.name = 'MockAgentTaskStoppedError'
  }
}

const workflowTitleMap: Record<string, string> = {
  text_to_image: '单图生成',
  text_to_image_to_video: '图生视频',
  storyboard: '剧情分镜',
  multi_angle_storyboard: '多角度分镜',
}

// 按参考录屏节奏做慢推进：长时间停留在过程区，结果区后置出现。
const mockAgentTimingProfile = {
  preAnalyzeDelay: 900,
  analyzeDelayRange: [5800, 8600],
  postPlanDelayRange: [4200, 6200],
  preSubmitDelay: 1600,
  preImagePhaseDelayRange: [9000, 12000],
  firstImageDelayRange: [2200, 3200],
  nextImageDelayRange: [1600, 2600],
  completionDelayRange: [1200, 1800],
} as const

const taskStore = new Map<string, MockAgentTaskRuntime>()
let nextTaskId = 1

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const assertTaskNotCancelled = (runtime: MockAgentTaskRuntime) => {
  if (runtime.cancelRequested) {
    throw new MockAgentTaskStoppedError()
  }
}

const sleepWithCancellation = async (runtime: MockAgentTaskRuntime, ms: number) => {
  let rest = ms
  while (rest > 0) {
    assertTaskNotCancelled(runtime)
    const wait = Math.min(rest, 80)
    await sleep(wait)
    rest -= wait
  }
  assertTaskNotCancelled(runtime)
}

const useHttpRawReplay = import.meta.env.DEV

const chineseNumberMap: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

const chunkReplayText = (text: string, options?: { min?: number, max?: number }) => {
  const source = text.trim()
  if (!source) return []

  const min = options?.min ?? 2
  const max = options?.max ?? 8
  const punctuation = new Set(['，', '。', '！', '？', '：', '；', '、', '\n'])
  const chunks: string[] = []
  let index = 0

  while (index < source.length) {
    let size = Math.min(
      source.length - index,
      Math.max(min, Math.floor(min + Math.random() * (max - min + 1))),
    )

    const candidate = source.slice(index, index + size)
    const punctuationOffset = [...candidate].findIndex(char => punctuation.has(char))
    if (punctuationOffset !== -1) {
      size = punctuationOffset + 1
    }

    chunks.push(source.slice(index, index + size))
    index += size
  }

  return chunks
}

const getChunkReplayDelay = (chunk: string) => {
  if (/[。！？]$/.test(chunk)) return getRandomDelay([160, 260])
  if (/[，：；、]$/.test(chunk)) return getRandomDelay([90, 150])
  if (chunk.length <= 2) return getRandomDelay([26, 44])
  return getRandomDelay([36, 68])
}

const emitChunkedText = async (
  runtime: MockAgentTaskRuntime,
  builder: (text: string) => MockAgentBackendEvent,
  text: string,
  options?: { min?: number, max?: number, leadingDelay?: number },
) => {
  if (options?.leadingDelay) {
    await sleepWithCancellation(runtime, options.leadingDelay)
  }

  const chunks = chunkReplayText(text, options)
  for (const chunk of chunks) {
    assertTaskNotCancelled(runtime)
    pushTaskEvent(runtime, builder(chunk))
    await sleepWithCancellation(runtime, getChunkReplayDelay(chunk))
  }
}

const getRandomDelay = ([min, max]: readonly [number, number]) => {
  if (min >= max) return min
  return Math.round(min + Math.random() * (max - min))
}

const isTerminalEvent = (event: MockAgentBackendEvent) => {
  return event.type === 'run_completed' || event.type === 'run_failed' || event.type === 'run_stopped'
}

const getTaskRuntime = (taskId: string) => {
  const runtime = taskStore.get(taskId)
  if (!runtime) {
    throw new Error('未找到对应的任务实例。')
  }
  return runtime
}

const pushTaskEvent = (runtime: MockAgentTaskRuntime, event: MockAgentBackendEvent) => {
  if (runtime.finished) return
  runtime.events.push(event)

  if (event.type === 'run_failed') {
    runtime.task.status = 'failed'
    runtime.finished = true
  } else if (event.type === 'run_stopped') {
    runtime.task.status = 'stopped'
    runtime.finished = true
  } else if (event.type === 'run_completed') {
    runtime.task.status = 'completed'
    runtime.finished = true
  } else {
    runtime.task.status = runtime.started ? 'running' : runtime.task.status
  }

  const waiter = runtime.waiters.shift()
  if (waiter) {
    waiter(event)
  }
}

const closeTaskStream = (runtime: MockAgentTaskRuntime) => {
  runtime.finished = true
  while (runtime.waiters.length) {
    const waiter = runtime.waiters.shift()
    waiter?.(null)
  }
}

const getWorkflowExecutionLabel = (params: Record<string, any>) => {
  const workflowType = String(params.workflow_type || 'text_to_image')
  return workflowTitleMap[workflowType] || '创作任务'
}

const pickImagesForWorkflow = (
  params: Record<string, any>,
  imagePool: AgentImageResult[],
): AgentImageResult[] => {
  if (!imagePool.length) return []

  const workflowType = String(params.workflow_type || 'text_to_image')
  const shotCount = Array.isArray(params.shots) ? params.shots.length : 0
  const imageCount =
    workflowType === 'text_to_image_to_video'
      ? 2
      : workflowType === 'storyboard'
        ? Math.max(shotCount || 4, 1)
        : workflowType === 'multi_angle_storyboard'
          ? 4
          : 4

  return imagePool.slice(0, imageCount)
}

const getExpectedImageCount = (
  params: Record<string, any>,
  plannedImages: AgentImageResult[],
) => {
  if (plannedImages.length) return plannedImages.length

  const workflowType = String(params.workflow_type || 'text_to_image')
  if (workflowType === 'text_to_image_to_video') return 2
  if (workflowType === 'storyboard' && Array.isArray(params.shots)) return params.shots.length
  return 1
}

const buildUserFacingSubmissionSummary = (options: {
  title?: string
  prompt: string
  expectedImageCount: number
  planItems?: string[]
}) => {
  const subject = options.title?.trim() || options.prompt.trim() || '当前主题'
  const count = options.expectedImageCount || options.planItems?.length || 0
  const directions = (options.planItems || []).join('、')

  if (count > 0 && directions) {
    return `已成功提交 ${count} 张不同构图的${subject}生成任务，包含${directions}四种不同表现方向，请等待生成完成即可查看结果。`
  }

  if (count > 0) {
    return `已成功提交 ${count} 张${subject}生成任务，请等待生成完成即可查看结果。`
  }

  return `已成功提交${subject}生成任务，请等待生成完成即可查看结果。`
}

const getDependencySkillLabel = (skill: string) => {
  if (skill === 'image-poster') return 'image-main'
  return ''
}

const getReasoningStageMeta = (state: {
  hasActivatedSkill: boolean
  hasLoadedSkill: boolean
  hasPlannedWorkflow: boolean
  hasSubmitted: boolean
}) => {
  if (!state.hasActivatedSkill) {
    return { stageKey: 'stage-analyze', stageLabel: '解析需求' }
  }
  if (!state.hasLoadedSkill) {
    return { stageKey: 'stage-activate-skill', stageLabel: '激活技能' }
  }
  if (!state.hasPlannedWorkflow) {
    return { stageKey: 'stage-plan', stageLabel: '工作流规划' }
  }
  if (!state.hasSubmitted) {
    return { stageKey: 'stage-submit', stageLabel: '提交生成任务' }
  }
  return { stageKey: 'stage-generate', stageLabel: '结果生成中' }
}

interface RawTranscriptEvent {
  event: string
  data: any
}

interface TranscriptToolCall {
  index: number
  funcName: string
  argumentsText: string
  argumentsData: Record<string, any> | null
}

const parseRawTranscript = (rawText: string): RawTranscriptEvent[] => {
  return rawText
    .split(/\n\s*\n/g)
    .map(block => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      const eventLine = lines.find(line => line.startsWith('event:'))
      const dataLineStartIndex = lines.findIndex(line => line.startsWith('data:'))
      const event = eventLine ? eventLine.slice(6).trim() : 'message'

      if (dataLineStartIndex === -1) {
        return { event, data: null }
      }

      const dataText = lines
        .slice(dataLineStartIndex)
        .map((line, index) => (index === 0 ? line.slice(5).trim() : line.trim()))
        .join('\n')

      try {
        return {
          event,
          data: JSON.parse(dataText),
        }
      } catch {
        return {
          event,
          data: dataText,
        }
      }
    })
}

const parseExpectedImageCountFromSummary = (summaryText: string) => {
  const arabicMatch = summaryText.match(/已完成(\d+)张/)
  if (arabicMatch) return Number(arabicMatch[1])

  const chineseMatch = summaryText.match(/已完成([一二两三四五六七八九十])张/)
  if (chineseMatch) return chineseNumberMap[chineseMatch[1]] || 0

  return 0
}

const parseJsonSafely = (value: string) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const getSkillLabelByName = (skillName: string) => {
  if (skillName === 'image-poster') return '海报设计'
  if (skillName === 'image-main') return '图片创作主能力'
  return skillName
}

const inferPlanItemLabel = (promptText: string, index: number) => {
  if (/close-up|close up/i.test(promptText)) return '特写表情方向'
  if (/distant composition|distant/i.test(promptText)) return '远景氛围方向'
  if (/panoramic|low-angle|仰拍/i.test(promptText)) return '全景史诗方向'
  if (/medium shot/i.test(promptText)) return '中景人物方向'
  return `方案方向 ${index + 1}`
}

const extractPlanItemsFromToolCalls = (toolCalls: TranscriptToolCall[]) => {
  return toolCalls.map((toolCall, index) => {
    const promptText = String(toolCall.argumentsData?.text2image_param?.prompt || '')
    return inferPlanItemLabel(promptText, index)
  })
}

const collectTranscriptToolCalls = (events: RawTranscriptEvent[]): TranscriptToolCall[] => {
  const callMap = new Map<number, { baseText: string, argumentsText: string }>()

  events.forEach((event) => {
    if (event.event !== 'delta' || !event.data?.path || typeof event.data.path !== 'string') {
      return
    }

    const matched = event.data.path.match(/^\/message\/tool_calls\/(\d+)(?:\/(.*))?$/)
    if (!matched) return

    const index = Number(matched[1])
    const suffix = matched[2] || ''
    const current = callMap.get(index) || { baseText: '', argumentsText: '' }

    if (!suffix && typeof event.data.value === 'string') {
      current.baseText += event.data.value
    }

    if (suffix === 'func/arguments' && event.data.op === 'append' && typeof event.data.value === 'string') {
      current.argumentsText += event.data.value
    }

    callMap.set(index, current)
  })

  return [...callMap.entries()]
    .map(([index, value]) => {
      const baseData = parseJsonSafely(value.baseText)
      const funcName = String(baseData?.func?.name || '')
      return {
        index,
        funcName,
        argumentsText: value.argumentsText,
        argumentsData: parseJsonSafely(value.argumentsText),
      }
    })
    .filter(item => item.funcName)
    .sort((a, b) => a.index - b.index)
}

const loadRawTranscriptEvents = async () => {
  const response = await fetch('/__mock_agent_http_raw')
  if (!response.ok) {
    throw new Error('读取真实流回放文件失败')
  }

  const rawText = await response.text()
  return parseRawTranscript(rawText)
}

const replayRawTranscriptTask = async (
  runtime: MockAgentTaskRuntime,
  options: {
    imagePool: AgentImageResult[]
    analyzeIntent: AnalyzeIntentFn
  },
) => {
  const { prompt, skill, taskId } = runtime.task
  const { imagePool, analyzeIntent } = options
  const transcriptEvents = await loadRawTranscriptEvents()
  const transcriptToolCalls = collectTranscriptToolCalls(transcriptEvents)
  const skillConfig = getAgentSkillConfig(skill as any)
  const dependencySkillLabel = getDependencySkillLabel(skill)
  const strategy = buildAgentWorkflowStrategy(skill || 'general', prompt)
  const activationCalls = transcriptToolCalls.filter(item => item.funcName === 'activate_skill')
  const dreaminaCalls = transcriptToolCalls.filter(item => item.funcName === 'dreamina_cli')
  const firstAttemptCalls = dreaminaCalls.filter(item => String(item.argumentsData?.text2image_param?.resolution_type || '').toLowerCase() === '4k')
  const secondAttemptCalls = dreaminaCalls.filter(item => String(item.argumentsData?.text2image_param?.resolution_type || '').toLowerCase() === '2k')

  let workflowParams: Record<string, any> | null = null
  let workflowLabel = '创作任务'
  let expectedImageCount = 4
  let summaryText = ''
  let reasoningBuffer = ''
  let assistantTextBuffer = ''
  let toolArgumentsBuffer = ''
  let currentMessageAuthorRole = ''
  let currentMessageAuthorName = ''
  let hasStarted = false
  let activatedSkillCount = 0
  let loadedSkillCount = 0
  let hasPlannedWorkflow = false
  let hasSubmitted = false
  let generatedTitle = ''
  let currentPlanItems: string[] = []

  for (const transcriptEvent of transcriptEvents) {
    await sleepWithCancellation(runtime, 24)

    const payload = transcriptEvent.data

    if (transcriptEvent.event === 'message' && payload?.author) {
      currentMessageAuthorRole = payload.author.role || ''
      currentMessageAuthorName = payload.author.name || ''
    }

    if (!hasStarted && transcriptEvent.event === 'message' && payload?.author?.role === 'assistant') {
      pushTaskEvent(runtime, {
        type: 'run_started',
        taskId,
      })
      hasStarted = true
      continue
    }

    if (
      transcriptEvent.event === 'delta' &&
      payload?.path === '/message/content/reasoning_content' &&
      payload?.op === 'append' &&
      typeof payload?.value === 'string' &&
      currentMessageAuthorRole === 'assistant'
    ) {
      reasoningBuffer += payload.value
      if (/[。！？，、\n]$/.test(reasoningBuffer) || reasoningBuffer.length >= 24) {
        await emitChunkedText(runtime, text => ({
          type: 'reasoning_delta',
          taskId,
          ...getReasoningStageMeta({
            hasActivatedSkill: activatedSkillCount > 0,
            hasLoadedSkill: loadedSkillCount >= Math.max(activationCalls.length, 1),
            hasPlannedWorkflow,
            hasSubmitted,
          }),
          text,
        }), reasoningBuffer, { min: 1, max: 5 })
        reasoningBuffer = ''
      }
      continue
    }

    if (
      activatedSkillCount < activationCalls.length &&
      transcriptEvent.event === 'delta' &&
      payload?.path === `/message/tool_calls/${activationCalls[activatedSkillCount]?.index}` &&
      typeof payload?.value === 'string' &&
      payload.value.includes('activate_skill')
    ) {
      const currentActivationCall = activationCalls[activatedSkillCount]
      const activatedSkillName = String(currentActivationCall?.argumentsData?.name || '')
      pushTaskEvent(runtime, {
        type: 'skill_activated',
        taskId,
        skillLabel: getSkillLabelByName(activatedSkillName) || skillConfig.label,
        sectionKey: activatedSkillCount === 0 ? 'skill-activated' : `skill-activated-${activatedSkillCount + 1}`,
      })
      activatedSkillCount += 1
      continue
    }

    if (
      transcriptEvent.event === 'delta' &&
      payload?.path === '/message/tool_calls/0/func/arguments' &&
      payload?.op === 'append' &&
      typeof payload?.value === 'string'
    ) {
      toolArgumentsBuffer += payload.value
      continue
    }

    if (
      transcriptEvent.event === 'delta' &&
      payload?.path === '/message/tool_calls/0/streaming' &&
      payload?.op === 'replace' &&
      payload?.value === 'false'
    ) {
      await sleepWithCancellation(runtime, getRandomDelay([120, 240]))
      assertTaskNotCancelled(runtime)
      pushTaskEvent(runtime, {
        type: 'tool_call_started',
        taskId,
        toolName: 'activate_skill',
        argumentsText: toolArgumentsBuffer,
      })
      toolArgumentsBuffer = ''
      continue
    }

    if (
      loadedSkillCount < activationCalls.length &&
      transcriptEvent.event === 'message' &&
      payload?.author?.role === 'tool' &&
      payload?.author?.name === 'activate_skill'
    ) {
      const loadedSkillCall = activationCalls[loadedSkillCount]
      const loadedSkillName = String(loadedSkillCall?.argumentsData?.name || '')
      pushTaskEvent(runtime, {
        type: 'skill_loaded',
        taskId,
        skillLabel: getSkillLabelByName(loadedSkillName) || skillConfig.label,
        dependencySkillLabel: loadedSkillCount === 0 ? dependencySkillLabel : undefined,
        sectionKey: loadedSkillCount === 0 ? 'skill-guide-primary' : 'skill-guide-dependency',
        label: loadedSkillCount === 0
          ? `已加载技能：${getSkillLabelByName(loadedSkillName) || skillConfig.label}`
          : `已加载依赖：${getSkillLabelByName(loadedSkillName) || loadedSkillName}`,
      })
      loadedSkillCount += 1
      continue
    }

    if (
      !hasPlannedWorkflow &&
      transcriptEvent.event === 'message' &&
      payload?.author?.role === 'assistant' &&
      payload?.author?.name === 'executor' &&
      loadedSkillCount >= Math.max(activationCalls.length, 1)
    ) {
      if (strategy.mode === 'analyze') {
        workflowParams = await analyzeIntent(strategy.userInput, {
          systemPromptOverride: strategy.systemPrompt,
        })
      } else {
        workflowParams = strategy.params as Record<string, any>
      }

      workflowLabel = getWorkflowExecutionLabel(workflowParams)
      const plannedImages = pickImagesForWorkflow(workflowParams, imagePool)
      expectedImageCount = getExpectedImageCount(workflowParams, plannedImages) || expectedImageCount
      currentPlanItems = extractPlanItemsFromToolCalls(secondAttemptCalls.length ? secondAttemptCalls : firstAttemptCalls)

      pushTaskEvent(runtime, {
        type: 'workflow_planned',
        taskId,
        workflowLabel,
        workflowParams,
        expectedImageCount,
        planItems: currentPlanItems,
      })
      hasPlannedWorkflow = true
      continue
    }

    if (
      transcriptEvent.event === 'delta' &&
      payload?.path === '/message/content/content_parts/0/text' &&
      typeof payload?.value === 'string' &&
      currentMessageAuthorRole === 'assistant' &&
      currentMessageAuthorName === 'executor' &&
      hasPlannedWorkflow
    ) {
      summaryText += payload.value
      assistantTextBuffer += payload.value

      if (!hasSubmitted && summaryText.includes('请等待生成完成')) {
        const firstResolution = String(firstAttemptCalls[0]?.argumentsData?.text2image_param?.resolution_type || '4k').toLowerCase()
        const retryResolution = String(secondAttemptCalls[0]?.argumentsData?.text2image_param?.resolution_type || '2k').toLowerCase()
        pushTaskEvent(runtime, {
          type: 'submission_started',
          taskId,
          workflowLabel,
          expectedImageCount,
          attempt: 1,
          resolution: firstResolution,
        })
        if (firstAttemptCalls.length) {
          pushTaskEvent(runtime, {
            type: 'submission_failed',
            taskId,
            workflowLabel,
            expectedImageCount,
            attempt: 1,
            resolution: firstResolution,
            errorMessage: '检测到账户当前不支持 4K 分辨率，首轮提交失败。',
            fallbackResolution: retryResolution,
          })
        }
        if (secondAttemptCalls.length) {
          pushTaskEvent(runtime, {
            type: 'submission_retrying',
            taskId,
            workflowLabel,
            expectedImageCount,
            attempt: 2,
            resolution: retryResolution,
          })
          pushTaskEvent(runtime, {
            type: 'submission_started',
            taskId,
            workflowLabel,
            expectedImageCount,
            attempt: 2,
            resolution: retryResolution,
          })
        }
        hasSubmitted = true
      }
      continue
    }

    if (transcriptEvent.event === 'system' && payload?.type === 'title_generation' && typeof payload?.title === 'string') {
      generatedTitle = payload.title
      continue
    }

    if (transcriptEvent.event === 'system' && payload?.type === 'summary' && typeof payload?.content === 'string') {
      const count = parseExpectedImageCountFromSummary(payload.content)
      if (count > 0) {
        expectedImageCount = count
      }
      continue
    }

    if (transcriptEvent.event === 'system' && payload?.type === 'stream_complete') {
      if (reasoningBuffer.trim()) {
        await emitChunkedText(runtime, text => ({
          type: 'reasoning_delta',
          taskId,
          ...getReasoningStageMeta({
            hasActivatedSkill: activatedSkillCount > 0,
            hasLoadedSkill: loadedSkillCount >= Math.max(activationCalls.length, 1),
            hasPlannedWorkflow,
            hasSubmitted,
          }),
          text,
        }), reasoningBuffer, { min: 1, max: 5 })
        reasoningBuffer = ''
      }

      if (assistantTextBuffer.trim()) {
        assistantTextBuffer = ''
      }

      const plannedImages = pickImagesForWorkflow(workflowParams || {}, imagePool)
      const finalImages = plannedImages.slice(0, expectedImageCount || plannedImages.length)

      for (let index = 0; index < finalImages.length; index += 1) {
        await sleepWithCancellation(runtime, index === 0 ? 500 : 360)
        pushTaskEvent(runtime, {
          type: 'image_completed',
          taskId,
          workflowLabel,
          expectedImageCount: finalImages.length,
          completedCount: index + 1,
          image: finalImages[index],
        })
      }

      pushTaskEvent(runtime, {
        type: 'run_completed',
        taskId,
        workflowLabel,
        expectedImageCount: finalImages.length,
        summary: buildUserFacingSubmissionSummary({
          title: generatedTitle,
          prompt,
          expectedImageCount: finalImages.length,
          planItems: currentPlanItems,
        }),
        title: generatedTitle || undefined,
      })
      return
    }
  }

  throw new Error('真实流回放未能解析出完整结束事件。')
}

const runMockTask = async (
  runtime: MockAgentTaskRuntime,
  options: {
    imagePool: AgentImageResult[]
    analyzeIntent: AnalyzeIntentFn
  },
) => {
  const { prompt, skill, taskId } = runtime.task
  const { imagePool, analyzeIntent } = options

  try {
    if (useHttpRawReplay) {
      await replayRawTranscriptTask(runtime, options)
      return
    }

    await sleepWithCancellation(runtime, mockAgentTimingProfile.preAnalyzeDelay)

    pushTaskEvent(runtime, {
      type: 'run_started',
      taskId,
    })

    let workflowParams: Record<string, any>
    const strategy = buildAgentWorkflowStrategy(skill || 'general', prompt)
    const skillConfig = getAgentSkillConfig(skill as any)

    await sleepWithCancellation(runtime, 1200)

    pushTaskEvent(runtime, {
      type: 'skill_activated',
      taskId,
      skillLabel: skillConfig.label,
    })

    await sleepWithCancellation(runtime, getRandomDelay([2200, 3200]))

    pushTaskEvent(runtime, {
      type: 'skill_loaded',
      taskId,
      skillLabel: skillConfig.label,
      dependencySkillLabel: getDependencySkillLabel(skill),
    })

    if (strategy.mode === 'analyze') {
      workflowParams = await analyzeIntent(strategy.userInput, {
        systemPromptOverride: strategy.systemPrompt,
      })
      await sleepWithCancellation(runtime, getRandomDelay(mockAgentTimingProfile.analyzeDelayRange))
    } else {
      await sleepWithCancellation(runtime, getRandomDelay(mockAgentTimingProfile.analyzeDelayRange))
      workflowParams = strategy.params as Record<string, any>
    }

    const workflowLabel = getWorkflowExecutionLabel(workflowParams)
    const plannedImages = pickImagesForWorkflow(workflowParams, imagePool)
    const expectedImageCount = getExpectedImageCount(workflowParams, plannedImages)

    const fallbackPlanItems = plannedImages.map((_, index) => `方案方向 ${index + 1}`)

    pushTaskEvent(runtime, {
      type: 'workflow_planned',
      taskId,
      workflowLabel,
      workflowParams,
      expectedImageCount,
      planItems: fallbackPlanItems,
    })

    await sleepWithCancellation(runtime, getRandomDelay(mockAgentTimingProfile.postPlanDelayRange))
    await sleepWithCancellation(runtime, mockAgentTimingProfile.preSubmitDelay)

    pushTaskEvent(runtime, {
      type: 'submission_started',
      taskId,
      workflowLabel,
      expectedImageCount,
    })

    await sleepWithCancellation(runtime, getRandomDelay(mockAgentTimingProfile.preImagePhaseDelayRange))

    for (let index = 0; index < plannedImages.length; index += 1) {
      await sleepWithCancellation(
        runtime,
        index === 0
          ? getRandomDelay(mockAgentTimingProfile.firstImageDelayRange)
          : getRandomDelay(mockAgentTimingProfile.nextImageDelayRange),
      )
      pushTaskEvent(runtime, {
        type: 'image_completed',
        taskId,
        workflowLabel,
        expectedImageCount,
        completedCount: index + 1,
        image: plannedImages[index],
      })
    }

    await sleepWithCancellation(runtime, getRandomDelay(mockAgentTimingProfile.completionDelayRange))

    pushTaskEvent(runtime, {
      type: 'run_completed',
      taskId,
      workflowLabel,
      expectedImageCount,
      summary: buildUserFacingSubmissionSummary({
        prompt,
        expectedImageCount,
        planItems: fallbackPlanItems,
      }),
    })
  } catch (error: any) {
    if (error instanceof MockAgentTaskStoppedError) {
      pushTaskEvent(runtime, {
        type: 'run_stopped',
        taskId,
        message: error.message || '任务已停止',
      })
    } else {
      pushTaskEvent(runtime, {
        type: 'run_failed',
        taskId,
        errorMessage: error?.message || '任务分析失败，请稍后重试。',
      })
    }
  } finally {
    closeTaskStream(runtime)
  }
}

export const createMockAgentTask = (payload: MockAgentTaskPayload): MockAgentTask => {
  const taskId = `mock-agent-task-${nextTaskId++}`
  const task: MockAgentTask = {
    taskId,
    prompt: payload.prompt,
    skill: payload.skill,
    status: 'created',
    createdAt: new Date().toISOString(),
  }

  taskStore.set(taskId, {
    task,
    events: [],
    waiters: [],
    started: false,
    finished: false,
    cancelRequested: false,
  })

  return task
}

export const startMockAgentTask = (
  taskId: string,
  options: {
    imagePool: AgentImageResult[]
    analyzeIntent: AnalyzeIntentFn
  },
) => {
  const runtime = getTaskRuntime(taskId)
  if (runtime.started) return runtime.task

  runtime.started = true
  runtime.task.status = 'running'
  void runMockTask(runtime, options)
  return runtime.task
}

export async function* subscribeMockAgentTaskEvents(
  taskId: string,
): AsyncGenerator<MockAgentBackendEvent> {
  const runtime = getTaskRuntime(taskId)
  let cursor = 0

  while (true) {
    if (cursor < runtime.events.length) {
      const event = runtime.events[cursor]
      cursor += 1
      yield event
      if (isTerminalEvent(event) && cursor >= runtime.events.length) {
        break
      }
      continue
    }

    if (runtime.finished) {
      break
    }

    const event = await new Promise<MockAgentBackendEvent | null>(resolve => {
      runtime.waiters.push(resolve)
    })

    if (!event) {
      break
    }

    cursor = runtime.events.length
    yield event

    if (isTerminalEvent(event) && cursor >= runtime.events.length) {
      break
    }
  }
}

export const getMockAgentTask = (taskId: string) => {
  return getTaskRuntime(taskId).task
}

export const stopMockAgentTask = (taskId: string) => {
  const runtime = getTaskRuntime(taskId)
  if (runtime.finished) return runtime.task
  runtime.cancelRequested = true
  return runtime.task
}

export const clearMockAgentTask = (taskId: string) => {
  taskStore.delete(taskId)
}
