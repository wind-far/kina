<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideMenu from '../../components/home/components/SideMenu.vue'
import ContentGenerator from '../../components/generate/ContentGenerator.vue'
import ImageLoadingRecord from '../../components/generate/common/ImageLoadingRecord.vue'
import AgentLoadingRecord from '../../components/generate/common/AgentLoadingRecord.vue'
import ApiSettingsDialog from '@/components/common/ApiSettingsDialog.vue'
import { streamChatCompletions } from '@/api/chat'
import { getAgentModel } from '@/api/agent'
import { generateImage } from '@/views/workflow/api/image'
import { getAllImageModels } from '@/config/models'
import { buildAgentChatMessages } from '@/config/agentSkills'
import {
  createGenerationRecord as createGenerationRecordRequest,
  listGenerationRecords as listGenerationRecordsRequest,
  updateGenerationRecord as updateGenerationRecordRequest,
  type GenerationRecordUpsertPayload,
  type PersistedGenerationRecord,
} from '@/api/generation-records'
import type { CreationType } from '../../components/generate/selectors'
import discoverContent from '@/data/homeDiscoverContent.json'
import type {
  AgentImageResult,
  AgentProcessSection,
  AgentProcessTaskItem,
  AgentRunState,
  AgentTaskStep,
} from '@/types/agent'
import { useWorkflowOrchestrator } from '@/views/workflow/composables/useWorkflowOrchestrator'
import GenerateAgentRecord from './components/GenerateAgentRecord.vue'
import {
  clearMockAgentTask,
  createMockAgentTask,
  startMockAgentTask,
  stopMockAgentTask,
  subscribeMockAgentTaskEvents,
  type MockAgentBackendEvent,
} from './mockAgentEventStream'

const route = useRoute()
const router = useRouter()
const { analyzeIntent } = useWorkflowOrchestrator()

// ContentGenerator 组件引用
const contentGeneratorRef = ref<InstanceType<typeof ContentGenerator> | null>(null)

// 生成记录列表
interface GeneratingRecord {
  id: number
  dbId?: string
  type: CreationType
  prompt: string
  time: string
  model: string
  modelKey: string
  ratio: string
  resolution: string
  duration: string
  feature: string
  skill: string
  content: string
  images: string[]
  done: boolean
  error: string
  agentTaskId?: string
  agentRun?: AgentRunState
}
const generatingRecords = ref<GeneratingRecord[]>([])
let nextId = 0
const recordPersistTimers = new Map<number, ReturnType<typeof setTimeout>>()
const recordPersistInflight = new Set<number>()

const feedImagePool: AgentImageResult[] = (discoverContent.feedItems || []).map((item, index) => ({
  id: item.id || `feed-image-${index + 1}`,
  imageSrc: item.imageSrc,
  promptText: item.promptText || item.alt,
}))

type AgentStepStatus = AgentTaskStep['status']

const buildExecutionSteps = (options: {
  workflowLabel: string
  expectedImageCount: number
  finishedImageCount: number
  phase: 'analyzing' | 'activating_skill' | 'loading_skill' | 'planning' | 'submitting' | 'generating' | 'completed'
}): AgentTaskStep[] => {
  const { workflowLabel, expectedImageCount, finishedImageCount, phase } = options

  const submitDescription = expectedImageCount
    ? `已提交 ${Math.min(finishedImageCount, expectedImageCount)}/${expectedImageCount} 个生成任务。`
    : '已提交生成任务。'

  const generateDescription = expectedImageCount
    ? `已完成 ${Math.min(finishedImageCount, expectedImageCount)}/${expectedImageCount} 个结果生成。`
    : '正在生成结果。'

  const planStatus: AgentStepStatus =
    phase === 'planning'
      ? 'running'
      : phase === 'analyzing' || phase === 'activating_skill' || phase === 'loading_skill'
        ? 'pending'
        : 'completed'

  const submitStatus: AgentStepStatus =
    phase === 'submitting'
      ? 'running'
      : phase === 'analyzing' || phase === 'activating_skill' || phase === 'loading_skill' || phase === 'planning'
        ? 'pending'
        : 'completed'

  const generateStatus: AgentStepStatus =
    phase === 'completed'
      ? 'completed'
      : phase === 'generating'
        ? 'running'
        : 'pending'

  const imageSteps: AgentTaskStep[] = expectedImageCount
    ? Array.from({ length: expectedImageCount }, (_, index) => {
        const imageIndex = index + 1
        let status: AgentStepStatus = 'pending'

        if (phase === 'completed' || imageIndex <= finishedImageCount) {
          status = 'completed'
        } else if (phase === 'generating' && imageIndex === finishedImageCount + 1) {
          status = 'running'
        }

        return {
          id: `step-image-${imageIndex}`,
          title: `生成第 ${imageIndex} 张`,
          status,
          description:
            status === 'completed'
              ? `第 ${imageIndex} 张结果已生成。`
              : status === 'running'
                ? `正在生成第 ${imageIndex} 张结果。`
                : `等待生成第 ${imageIndex} 张结果。`,
        }
      })
    : []

  return [
    {
      id: 'step-analyze',
      title: '解析需求',
      status: phase === 'analyzing' ? 'running' : 'completed',
      description: phase === 'analyzing'
        ? '正在理解你的意图，并匹配合适的技能与工作流。'
        : '已完成任务理解与技能匹配。',
    },
    {
      id: 'step-activate-skill',
      title: '激活技能',
      status:
        phase === 'activating_skill'
          ? 'running'
          : phase === 'analyzing'
            ? 'pending'
            : 'completed',
      description:
        phase === 'analyzing'
          ? '等待激活匹配技能。'
          : '已激活当前任务所需技能。',
    },
    {
      id: 'step-load-skill',
      title: '读取技能指南',
      status:
        phase === 'loading_skill'
          ? 'running'
          : phase === 'analyzing' || phase === 'activating_skill'
            ? 'pending'
            : 'completed',
      description:
        phase === 'analyzing' || phase === 'activating_skill'
          ? '等待加载技能说明与依赖。'
          : '已读取技能说明，并完成依赖技能准备。',
    },
    {
      id: 'step-plan',
      title: '确定工作流',
      status: planStatus,
      description: phase === 'analyzing'
        ? '等待生成任务规划。'
        : `已确定工作流：${workflowLabel}。`,
    },
    {
      id: 'step-submit',
      title: '提交生成任务',
      status: submitStatus,
      description: phase === 'analyzing' || phase === 'planning'
        ? '等待提交生成任务。'
        : submitDescription,
    },
    {
      id: 'step-generate',
      title: '结果生成中...',
      status: generateStatus,
      description: phase === 'completed' || phase === 'generating'
        ? generateDescription
        : '等待结果输出。',
    },
    ...imageSteps,
  ]
}


const buildAgentPendingRun = (id: number, message: string, skill: string): AgentRunState => ({
  id: `agent-run-${id}`,
  query: message,
  skill,
  status: 'thinking',
  user: {
    name: '即梦 Agent',
  },
  steps: buildExecutionSteps({
    workflowLabel: '任务规划中',
    expectedImageCount: 0,
    finishedImageCount: 0,
    phase: 'analyzing',
  }),
  indicator: {
    status: 'thinking',
    title: '再思考片刻...',
    description: '正在理解你的意图，并匹配合适的技能与工作流。',
  },
  result: {
    title: '',
    summary: '',
    images: [],
    expectedImageCount: 0,
    outputVisible: false,
  },
  processSections: [],
})

const buildAgentErrorRun = (currentRun: AgentRunState, errorMessage: string): AgentRunState => ({
  ...currentRun,
  status: 'error',
  steps: [
    {
      id: 'step-error',
      title: '任务执行失败',
      status: 'error',
      description: errorMessage,
    },
  ],
  indicator: {
    status: 'error',
    title: '任务执行失败',
    description: errorMessage,
  },
  result: {
    title: currentRun.result?.title || '',
    summary: '当前任务未能完成分析，你可以修改需求后再次发送。',
    images: [],
    expectedImageCount: currentRun.result?.expectedImageCount || 0,
    outputVisible: true,
  },
  processSections: appendProcessParagraph(
    currentRun.processSections || [],
    'task-error',
    '执行失败',
    errorMessage,
  ),
})

const buildAgentStoppedRun = (currentRun: AgentRunState, message = '任务已停止'): AgentRunState => ({
  ...currentRun,
  status: 'stopped',
  steps: [
    ...currentRun.steps.map(step => {
      if (step.status === 'running') {
        return {
          ...step,
          status: 'error' as const,
          description: `${step.description || step.title}（已停止）`,
        }
      }
      return step
    }),
    {
      id: 'step-stopped',
      title: '任务已停止',
      status: 'error',
      description: message,
    },
  ],
  indicator: {
    status: 'stopped',
    title: '已停止生成',
    description: message,
  },
  result: {
    title: currentRun.result?.title || '',
    summary: currentRun.result?.images?.length
      ? '已停止后续生成，当前已返回的结果已保留。'
      : '任务已停止，未继续执行后续步骤。',
    images: currentRun.result?.images || [],
    expectedImageCount: currentRun.result?.expectedImageCount || 0,
    outputVisible: true,
  },
  processSections: appendProcessParagraph(
    (currentRun.processSections || []).map(section => ({
      ...section,
      taskItems: section.taskItems?.map(item => (
        item.status === 'completed' || item.status === 'generated'
          ? item
          : { ...item, status: 'error' as const }
      )),
    })),
    'task-stopped',
    '任务已停止',
    message,
  ),
})

const updateAgentRun = (
  record: GeneratingRecord,
  updater: (currentRun: AgentRunState) => AgentRunState,
) => {
  if (!record.agentRun) return
  record.agentRun = updater(record.agentRun)
}

const upsertProcessSection = (
  sections: AgentProcessSection[],
  nextSection: AgentProcessSection,
) => {
  const next = [...sections]
  const index = next.findIndex(section => section.key === nextSection.key)

  if (index === -1) {
    next.push(nextSection)
    return next
  }

  next[index] = {
    ...next[index],
    ...nextSection,
  }
  return next
}

const appendProcessParagraph = (
  sections: AgentProcessSection[],
  key: string,
  label: string,
  text: string,
  kind: AgentProcessSection['kind'] = 'reasoning',
) => {
  const normalized = text.trim()
  if (!normalized) return sections

  const next = [...sections]
  const index = next.findIndex(section => section.key === key)

  if (index === -1) {
    next.push({
      key,
      kind,
      label,
      paragraphs: [normalized],
    })
    return next
  }

  const current = next[index]
  next[index] = {
    ...current,
    kind,
    label,
    paragraphs: [...(current.paragraphs || []), normalized],
  }
  return next
}

const appendProcessInlineText = (
  sections: AgentProcessSection[],
  key: string,
  label: string,
  text: string,
  kind: AgentProcessSection['kind'] = 'reasoning',
) => {
  if (!text) return sections

  const next = [...sections]
  const index = next.findIndex(section => section.key === key)

  if (index === -1) {
    next.push({
      key,
      kind,
      label,
      paragraphs: [text],
    })
    return next
  }

  const current = next[index]
  const currentParagraphs = current.paragraphs || ['']
  const lastParagraphIndex = Math.max(currentParagraphs.length - 1, 0)
  const nextParagraphs = [...currentParagraphs]
  nextParagraphs[lastParagraphIndex] = `${nextParagraphs[lastParagraphIndex] || ''}${text}`

  next[index] = {
    ...current,
    kind,
    label,
    paragraphs: nextParagraphs,
  }
  return next
}

const updateProcessTaskItems = (
  sections: AgentProcessSection[],
  key: string,
  label: string,
  taskItems: AgentProcessTaskItem[],
) => {
  return upsertProcessSection(sections, {
    key,
    kind: 'reasoning',
    label,
    taskItems,
  })
}

const buildPlanTaskItems = (planItems: string[], status: AgentProcessTaskItem['status']) => {
  return planItems.map((item, index) => ({
    id: `task-plan-${index + 1}`,
    title: item,
    status,
  }))
}

const updatePlanTaskItemStatuses = (
  currentItems: AgentProcessTaskItem[],
  updater: (item: AgentProcessTaskItem, index: number) => AgentProcessTaskItem,
) => {
  return currentItems.map(updater)
}

// 只有显式选择技能时，才进入工作台式 Agent 流程；通用助手仍保留原流式对话体验。
const shouldUseAgentWorkspaceFlow = (skill?: string) => {
  return Boolean(skill && skill !== 'general')
}

// 将页面内的记录结构转换为后端持久化结构。
const toGenerationRecordPayload = (record: GeneratingRecord): GenerationRecordUpsertPayload => ({
  type: record.type,
  prompt: record.prompt,
  content: record.content,
  error: record.error,
  model: record.model,
  modelKey: record.modelKey,
  ratio: record.ratio,
  resolution: record.resolution,
  duration: record.duration,
  feature: record.feature,
  skill: record.skill,
  done: record.done,
  agentTaskId: record.agentTaskId,
  images: record.images,
  agentRun: record.agentRun,
})

// 设置弹窗
const showSettings = ref(false)

// 格式化时间分组标签
const formatGroupLabel = (date: Date): string => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = today.getTime() - target.getTime()
  const dayMs = 86400000

  if (diff === 0) return '今天'
  if (diff === dayMs) return '昨天'
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// 将后端返回的持久化记录还原成页面使用结构。
const createRecordFromPersisted = (record: PersistedGenerationRecord): GeneratingRecord => ({
  id: nextId++,
  dbId: record.id,
  type: record.type,
  prompt: record.prompt,
  time: formatGroupLabel(new Date(record.createdAt)),
  model: record.model,
  modelKey: record.modelKey,
  ratio: record.ratio,
  resolution: record.resolution,
  duration: record.duration,
  feature: record.feature,
  skill: record.skill,
  content: record.content,
  images: record.images,
  done: record.done,
  error: record.error,
  agentTaskId: record.agentTaskId,
  agentRun: record.agentRun,
})

// 立即持久化一条记录；创建与更新都走这里统一收口。
const persistRecordNow = async (record: GeneratingRecord) => {
  if (recordPersistInflight.has(record.id)) return
  recordPersistInflight.add(record.id)

  try {
    if (!record.dbId) {
      const saved = await createGenerationRecordRequest(toGenerationRecordPayload(record))
      record.dbId = saved.id
      return
    }

    await updateGenerationRecordRequest(record.dbId, toGenerationRecordPayload(record))
  } catch {
    // 持久化失败时不影响当前页面的生成流程。
  } finally {
    recordPersistInflight.delete(record.id)
  }
}

// 执行过程中的频繁状态变化走节流更新，减少后端写入次数。
const schedulePersistRecord = (record: GeneratingRecord, immediate = false) => {
  const existingTimer = recordPersistTimers.get(record.id)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  const run = () => {
    recordPersistTimers.delete(record.id)
    void persistRecordNow(record)
  }

  if (immediate) {
    run()
    return
  }

  const timer = setTimeout(run, 200)
  recordPersistTimers.set(record.id, timer)
}

// 首屏加载最近的生成记录，用于刷新后回放历史。
const loadPersistedGeneratingRecords = async () => {
  try {
    const records = await listGenerationRecordsRequest()
    if (!records.length) return

    const existingDbIds = new Set(
      generatingRecords.value
        .map(item => item.dbId)
        .filter((id): id is string => Boolean(id)),
    )

    const nextRecords = records
      .filter(record => !existingDbIds.has(record.id))
      .map(createRecordFromPersisted)

    if (!nextRecords.length) return

    generatingRecords.value = [...generatingRecords.value, ...nextRecords]
  } catch {
    // 数据库未配置或接口失败时，继续使用前端内存态。
  }
}

// 处理发送事件
const handleSend = (message: string, type: CreationType, options?: { model?: string, modelKey?: string, ratio?: string, resolution?: string, duration?: string, feature?: string, skill?: string }) => {
  const recordId = nextId++
  const record: GeneratingRecord = {
    id: recordId,
    type,
    prompt: message,
    time: formatGroupLabel(new Date()),
    model: options?.model || '',
    modelKey: options?.modelKey || '',
    ratio: options?.ratio || '',
    resolution: options?.resolution || '',
    duration: options?.duration || '',
    feature: options?.feature || '',
    skill: options?.skill || 'general',
    content: '',
    images: [],
    done: false,
    error: '',
    agentRun: type === 'agent' && shouldUseAgentWorkspaceFlow(options?.skill)
      ? buildAgentPendingRun(recordId, message, options?.skill || 'general')
      : undefined,
  }
  generatingRecords.value.unshift(record)
  schedulePersistRecord(record, true)

  // 根据类型触发不同的生成逻辑
  if (type === 'agent') {
    if (record.agentRun) {
      runAgentExecution(generatingRecords.value[0])
    } else {
      runAgentStream(generatingRecords.value[0])
    }
  } else if (type === 'image') {
    runImageGeneration(generatingRecords.value[0])
  }
}

// 图片生成
const runImageGeneration = async (record: GeneratingRecord) => {
  try {
    // 根据模型配置构建请求参数
    const modelConfig = getAllImageModels().find(m => m.key === record.modelKey)
    const sizeKey = modelConfig?.sizes?.length
      ? (modelConfig.sizes.find(s => s.includes(record.ratio.replace(':', 'x'))) || modelConfig.defaultParams?.size || '')
      : ''

    const data: any = {
      model: record.modelKey,
      prompt: record.prompt,
      n: 1
    }
    if (sizeKey) data.size = sizeKey

    const result = await generateImage(data)

    // 提取图片 URL
    const urls: string[] = []
    if (result?.data) {
      for (const item of result.data) {
        if (item.url) urls.push(item.url)
        else if (item.b64_json) urls.push(`data:image/png;base64,${item.b64_json}`)
      }
    }

    if (urls.length) {
      record.images = urls
    } else {
      record.error = '未能获取到生成的图片'
    }
    schedulePersistRecord(record)
  } catch (e: unknown) {
    record.error = e instanceof Error ? e.message : '图片生成失败'
    schedulePersistRecord(record)
  } finally {
    record.done = true
    schedulePersistRecord(record, true)
  }
}

// Agent 在 generate 页内走任务编排流程，而不是单独新开页面。
const runAgentExecution = async (record: GeneratingRecord) => {
  if (!record.agentRun) return
  let taskId = ''
  try {
    const task = createMockAgentTask({
      prompt: record.prompt,
      skill: record.skill || 'general',
    })
    taskId = task.taskId
    record.agentTaskId = taskId

    startMockAgentTask(taskId, {
      imagePool: feedImagePool,
      analyzeIntent,
    })

    for await (const event of subscribeMockAgentTaskEvents(taskId)) {
      handleMockAgentEvent(record, event)
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : '任务分析失败，请稍后重试。'
    record.error = errorMessage
    record.agentRun = buildAgentErrorRun(record.agentRun, errorMessage)
    schedulePersistRecord(record, true)
  } finally {
    record.agentTaskId = undefined
    if (taskId) {
      clearMockAgentTask(taskId)
    }
    record.done = true
    schedulePersistRecord(record, true)
  }
}

const handleStopAgentExecution = (record: GeneratingRecord) => {
  if (!record.agentRun || !record.agentTaskId) return
  if (!(record.agentRun.status === 'thinking' || record.agentRun.status === 'running')) return

  stopMockAgentTask(record.agentTaskId)
}

const handleMockAgentEvent = (
  record: GeneratingRecord,
  event: MockAgentBackendEvent,
) => {
  if (!record.agentRun) return

  if (event.type === 'run_failed') {
    record.error = event.errorMessage
    record.agentRun = buildAgentErrorRun(record.agentRun, event.errorMessage)
    schedulePersistRecord(record, true)
    return
  }

  if (event.type === 'run_stopped') {
    record.agentRun = buildAgentStoppedRun(record.agentRun, event.message)
    schedulePersistRecord(record, true)
    return
  }

  switch (event.type) {
    case 'run_started':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'thinking',
        indicator: {
          status: 'thinking',
          title: '再思考片刻...',
          description: '正在理解你的意图，并匹配合适的技能与工作流。',
        },
        steps: buildExecutionSteps({
          workflowLabel: '任务规划中',
          expectedImageCount: 0,
          finishedImageCount: 0,
          phase: 'analyzing',
        }),
        result: {
          title: '',
          summary: '',
          images: [],
          expectedImageCount: 0,
          outputVisible: false,
        },
        processSections: [],
      }))
      break
    case 'reasoning_delta':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        processSections: appendProcessInlineText(
          currentRun.processSections || [],
          event.stageKey,
          event.stageLabel,
          event.text,
        ),
      }))
      break
    case 'assistant_text_delta':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
      }))
      break
    case 'tool_call_started':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        processSections: upsertProcessSection(currentRun.processSections || [], {
          key: event.sectionKey || `tool-call-${event.toolName}`,
          kind: 'skill',
          label: event.label || `调用工具：${event.toolName}`,
          paragraphs: [],
        }),
      }))
      break
    case 'skill_activated':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '激活技能',
          description: `已匹配并激活技能：${event.skillLabel}。`,
        },
        steps: buildExecutionSteps({
          workflowLabel: '任务规划中',
          expectedImageCount: 0,
          finishedImageCount: 0,
          phase: 'activating_skill',
        }),
        result: {
          ...currentRun.result,
          title: currentRun.result?.title || '',
          summary: '',
          images: [],
          expectedImageCount: 0,
          outputVisible: false,
        },
        processSections: upsertProcessSection(currentRun.processSections || [], {
          key: event.sectionKey || 'skill-activated',
          kind: 'skill',
          label: `使用技能：${event.skillLabel}`,
          paragraphs: [],
        }),
      }))
      break
    case 'skill_loaded':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '读取技能指南',
          description: event.dependencySkillLabel
            ? `已加载 ${event.skillLabel} 技能说明，并准备依赖技能 ${event.dependencySkillLabel}。`
            : `已加载 ${event.skillLabel} 技能说明，正在准备生成方案。`,
        },
        steps: buildExecutionSteps({
          workflowLabel: '任务规划中',
          expectedImageCount: 0,
          finishedImageCount: 0,
          phase: 'loading_skill',
        }),
        result: {
          ...currentRun.result,
          title: currentRun.result?.title || '',
          summary: '',
          images: [],
          expectedImageCount: 0,
          outputVisible: false,
        },
        processSections: upsertProcessSection(currentRun.processSections || [], {
          key: event.sectionKey || 'skill-guide',
          kind: 'skill',
          label: event.label || (event.dependencySkillLabel
            ? `已加载技能：${event.skillLabel}（依赖 ${event.dependencySkillLabel}）`
            : `已加载技能：${event.skillLabel}`),
          paragraphs: [],
        }),
      }))
      break
    case 'workflow_planned':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '准备生成方案',
          description: `已根据技能指南确定工作流：${event.workflowLabel}。`,
        },
        steps: buildExecutionSteps({
          workflowLabel: event.workflowLabel,
          expectedImageCount: event.expectedImageCount,
          finishedImageCount: 0,
          phase: 'planning',
        }),
        result: {
          title: currentRun.result?.title || '',
          summary: '',
          images: [],
          expectedImageCount: currentRun.result?.expectedImageCount || 0,
          outputVisible: false,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          'workflow-planned',
          `任务计划（${event.expectedImageCount} 项）`,
          `已确定工作流：${event.workflowLabel}。`,
        ),
      }))
      if (event.planItems?.length) {
        updateAgentRun(record, currentRun => ({
          ...currentRun,
          processSections: updateProcessTaskItems(
            currentRun.processSections || [],
            'workflow-planned',
            `任务计划（${event.planItems!.length} 项）`,
            buildPlanTaskItems(event.planItems!, 'pending'),
          ),
        }))
      }
      break
    case 'submission_started':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: event.attempt && event.attempt > 1 ? `重新提交任务（第 ${event.attempt} 轮）` : '提交生成任务',
          description: event.expectedImageCount
            ? `正在提交 ${event.expectedImageCount} 个生成任务${event.resolution ? `，当前分辨率 ${event.resolution.toUpperCase()}` : ''}。`
            : '正在提交生成任务。',
        },
        steps: buildExecutionSteps({
          workflowLabel: event.workflowLabel,
          expectedImageCount: event.expectedImageCount,
          finishedImageCount: 0,
          phase: 'submitting',
        }),
        result: {
          ...currentRun.result,
          title: currentRun.result?.title || '',
          images: [],
          expectedImageCount: event.expectedImageCount,
          outputVisible: true,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          `submission-log-attempt-${event.attempt || 1}`,
          `任务提交记录（第 ${event.attempt || 1} 轮）`,
          event.expectedImageCount
            ? `${event.attempt && event.attempt > 1 ? `第 ${event.attempt} 轮` : '当前'}已提交 ${event.expectedImageCount} 个生成任务${event.resolution ? `（${event.resolution.toUpperCase()}）` : ''}，请等待结果返回。`
            : '已提交生成任务。',
        ),
      }))
      updateAgentRun(record, currentRun => {
        const section = (currentRun.processSections || []).find(item => item.key === 'workflow-planned')
        const currentItems = section?.taskItems || []
        if (!currentItems.length) return currentRun

        return {
          ...currentRun,
          processSections: updateProcessTaskItems(
            currentRun.processSections || [],
            'workflow-planned',
            section?.label || `任务计划（${currentItems.length} 项）`,
            updatePlanTaskItemStatuses(currentItems, (item) => ({
              ...item,
              status: 'running',
            })),
          ),
        }
      })
      break
    case 'submission_failed':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '修正生成参数',
          description: event.fallbackResolution
            ? `检测到 ${event.resolution.toUpperCase()} 不可用，已准备切换为 ${event.fallbackResolution.toUpperCase()} 重试。`
            : event.errorMessage,
        },
        processSections: appendProcessParagraph(
          appendProcessParagraph(
            currentRun.processSections || [],
            `submission-log-attempt-${event.attempt}`,
            `任务提交记录（第 ${event.attempt} 轮）`,
            event.errorMessage,
          ),
          'parameter-adjustment',
          '参数修正记录',
          event.fallbackResolution
            ? `已自动降级为 ${event.fallbackResolution.toUpperCase()}，保留原有任务计划继续重试。`
            : '准备重新提交生成任务。',
        ),
      }))
      updateAgentRun(record, currentRun => {
        const section = (currentRun.processSections || []).find(item => item.key === 'workflow-planned')
        const currentItems = section?.taskItems || []
        if (!currentItems.length) return currentRun

        return {
          ...currentRun,
          processSections: updateProcessTaskItems(
            currentRun.processSections || [],
            'workflow-planned',
            section?.label || `任务计划（${currentItems.length} 项）`,
            updatePlanTaskItemStatuses(currentItems, (item) => ({
              ...item,
              status: 'error',
            })),
          ),
        }
      })
      break
    case 'submission_retrying':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '重新提交生成任务',
          description: `已切换为 ${event.resolution.toUpperCase()}，开始第 ${event.attempt} 轮提交。`,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          `submission-log-attempt-${event.attempt}`,
          `任务提交记录（第 ${event.attempt} 轮）`,
          `开始第 ${event.attempt} 轮提交，当前分辨率 ${event.resolution.toUpperCase()}。`,
        ),
      }))
      updateAgentRun(record, currentRun => {
        const section = (currentRun.processSections || []).find(item => item.key === 'workflow-planned')
        const currentItems = section?.taskItems || []
        if (!currentItems.length) return currentRun

        return {
          ...currentRun,
          processSections: updateProcessTaskItems(
            currentRun.processSections || [],
            'workflow-planned',
            section?.label || `任务计划（${currentItems.length} 项）`,
            updatePlanTaskItemStatuses(currentItems, (item) => ({
              ...item,
              status: 'running',
            })),
          ),
        }
      })
      break
    case 'image_completed':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: `结果生成中 ${event.completedCount}/${event.expectedImageCount}`,
          description: event.completedCount < event.expectedImageCount
            ? `第 ${event.completedCount} 个结果已完成，继续生成剩余内容。`
            : '最后一个结果正在收尾。',
        },
        steps: buildExecutionSteps({
          workflowLabel: event.workflowLabel,
          expectedImageCount: event.expectedImageCount,
          finishedImageCount: event.completedCount,
          phase: 'generating',
        }),
        result: {
          title: currentRun.result?.title || '',
          summary: currentRun.result?.summary || '',
          images: [...(currentRun.result?.images || []), event.image],
          expectedImageCount: event.expectedImageCount,
          outputVisible: true,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          'image-progress',
          '结果回传',
          `第 ${event.completedCount} 张结果已返回。`,
        ),
      }))
      updateAgentRun(record, currentRun => {
        const section = (currentRun.processSections || []).find(item => item.key === 'workflow-planned')
        const currentItems = section?.taskItems || []
        if (!currentItems.length) return currentRun

        return {
          ...currentRun,
          processSections: updateProcessTaskItems(
            currentRun.processSections || [],
            'workflow-planned',
            section?.label || `任务计划（${currentItems.length} 项）`,
            updatePlanTaskItemStatuses(currentItems, (item, index) => {
              if (index < event.completedCount) {
                return {
                  ...item,
                  status: 'generated',
                }
              }
              return {
                ...item,
                status: 'running',
              }
            }),
          ),
        }
      })
      break
    case 'run_completed':
      updateAgentRun(record, currentRun => ({
        ...currentRun,
        status: 'completed',
        indicator: {
          status: 'completed',
          title: '任务已完成',
          description: '当前结果已更新，你可以继续补充要求发起下一轮任务。',
        },
        steps: [
          ...buildExecutionSteps({
            workflowLabel: event.workflowLabel,
            expectedImageCount: event.expectedImageCount,
            finishedImageCount: event.expectedImageCount,
            phase: 'completed',
          }),
          {
            id: 'step-finish',
            title: '任务已完成',
            status: 'completed',
            description: '当前结果已写回 generate 页记录流，可继续补充要求发起下一轮任务。',
          },
        ],
        result: {
          title: event.title || currentRun.result?.title || '',
          summary: event.summary,
          images: currentRun.result?.images || [],
          expectedImageCount: event.expectedImageCount,
          outputVisible: true,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          'completion-log',
          '任务完成',
          '当前技能工作流已执行完成，结果已同步到记录流。',
        ),
      }))
      updateAgentRun(record, currentRun => {
        const section = (currentRun.processSections || []).find(item => item.key === 'workflow-planned')
        const currentItems = section?.taskItems || []
        if (!currentItems.length) return currentRun

        return {
          ...currentRun,
          processSections: updateProcessTaskItems(
            currentRun.processSections || [],
            'workflow-planned',
            section?.label || `任务计划（${currentItems.length} 项）`,
            updatePlanTaskItemStatuses(currentItems, (item) => ({
              ...item,
              status: 'completed',
            })),
          ),
        }
      })
      break
  }

  schedulePersistRecord(record, event.type === 'run_completed')
}

// 通用助手沿用原先的流式对话逻辑。
const runAgentStream = async (record: GeneratingRecord) => {
  let buffer = ''
  let flushing = false
  let streamDone = false

  const flush = () => {
    if (flushing) return
    flushing = true
    const step = () => {
      if (buffer.length > 0) {
        const chars = Math.min(buffer.length, Math.ceil(Math.random() * 2) + 1)
        record.content += buffer.slice(0, chars)
        buffer = buffer.slice(chars)
        schedulePersistRecord(record)
        requestAnimationFrame(step)
      } else {
        flushing = false
        if (streamDone) record.done = true
      }
    }
    requestAnimationFrame(step)
  }

  try {
    const stream = streamChatCompletions({
      model: getAgentModel(),
      messages: buildAgentChatMessages(record.skill, record.prompt),
    })
    for await (const chunk of stream) {
      buffer += chunk
      flush()
    }
  } catch (e: unknown) {
    record.error = e instanceof Error ? e.message : '请求失败'
    schedulePersistRecord(record)
  }

  streamDone = true
  if (!buffer.length) {
    record.done = true
    schedulePersistRecord(record, true)
  } else {
    flush()
  }
}

// 上一次滚动位置
let lastScrollTop = 0

// 点击空白区域折叠
const handlePageClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  // 检查点击的是否是输入框组件内部
  const contentGenerator = document.querySelector('.dimension-layout-FUl4Nj')
  if (contentGenerator && !contentGenerator.contains(target)) {
    // 点击的是输入框组件外部，折叠
    contentGeneratorRef.value?.collapse()
  }
}

// 修复滚动方向反转问题 + 控制输入框折叠/展开
onMounted(() => {
  void loadPersistedGeneratingRecords()

  // 检查路由参数（从首页跳转过来的发送请求）
  const { message, type, model, ratio, resolution, skill } = route.query
  if (message && type) {
    handleSend(
      message as string,
      type as CreationType,
      { model: model as string, ratio: ratio as string, resolution: resolution as string, skill: skill as string }
    )
    // 清除 query 参数，避免刷新重复创建
    router.replace({ path: '/generate' })
  }

  const scrollContainer = document.querySelector('.virtual-list-gUs6jj') as HTMLElement

  // 添加页面点击监听
  document.addEventListener('click', handlePageClick)

  if (scrollContainer) {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      // 反转滚动方向：由于容器被旋转了180度，我们需要反转滚动增量
      scrollContainer.scrollTop -= e.deltaY
    }

    // 滚动事件处理：控制输入框折叠/展开
    const handleScroll = () => {
      const currentScrollTop = scrollContainer.scrollTop

      // 判断是否滚动到底部（由于容器旋转180度，底部实际上是 scrollTop 接近 0）
      const isAtBottom = currentScrollTop <= 10

      // 判断滚动方向（由于容器旋转，方向也反转了）
      const isScrollingUp = currentScrollTop > lastScrollTop  // 实际是向上滚动（看旧内容）

      if (contentGeneratorRef.value) {
        if (isAtBottom) {
          // 滚动到底部时展开
          contentGeneratorRef.value.expand()
        } else if (isScrollingUp && currentScrollTop > 50) {
          // 向上滚动（看旧内容）时折叠
          contentGeneratorRef.value.collapse()
        }
      }

      lastScrollTop = currentScrollTop
    }

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false })
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })

    // 清理函数
    onUnmounted(() => {
      recordPersistTimers.forEach(timer => clearTimeout(timer))
      recordPersistTimers.clear()
      scrollContainer.removeEventListener('wheel', handleWheel)
      scrollContainer.removeEventListener('scroll', handleScroll)
      document.removeEventListener('click', handlePageClick)
    })
  }
})
</script>

<template>
  <div class="jimeng-home-container">
    <div id="csr-root">
      <div class="global-dreamina-container">
        <div id="dreamina" class="root_bf55f">
          <div class="top-down-layer-ilr3Ve">
            <div class="container-moSF_y"
                 style="--side-menu-width:76px;--side-drawer-width:440px;--side-drawer-float-limit-width:1280px">
              <!-- 侧边菜单 -->
              <SideMenu/>
              <div class=content-wrapper-cF1zaN>
                <div id=dreamina-ui-configuration-content-wrapper class=main-container-nXfW_A>
                  <div class=content-TZbgMr>
                    <div class=entry-lav5_s>
                      <div class=record-list-container-YQhwuM>
                        <div class="record-list-RjGugi record-virtual-list"
                             style=--content-generator-height:174px>
                          <div class=virtual-list-container-rarVwb
                               style=--virtual-list-rotate:rotate(180deg);--virtual-list-direction:rtl;--virtual-list-justify-content:flex-end>
                            <div class=scroll-container-j7wUS8 style=height:100%>
                              <div class=virtual-list-gUs6jj style=height:100%>
                                <div style=height:1056.88px></div>
                                <div id=scroll-list-9341e2ed-6804-4e34-9b38-1eb6fe79c48e
                                     class=scroll-list-gsJVWP
                                     style=transform:translate3d(0px,0px,0px)>
                                  <div class=scroll-slot-coWS6S></div>
                                  <div class=top-placeholder-fTCjHC>
                                    <div class=top-placeholder-aEry7y>
                                      <div class=clean-agent-context-wrapper-QM8uAh><span
                                          class=clean-agent-context-text-Lx4BjY>创建新会话</span>
                                      </div>
                                      <div class=empty-placeholder-dcs8S2></div>
                                    </div>
                                  </div>
                                  <!-- 正在生成中的记录 -->
                                  <template v-for="(record, index) in generatingRecords" :key="record.id">
                                    <div class=item-Xh64V7 :data-index="index * 2 + 1" style=z-index:1>
                                      <GenerateAgentRecord
                                        v-if="record.type === 'agent' && record.agentRun"
                                        :run="record.agentRun"
                                        :error-text="record.error"
                                        @stop="handleStopAgentExecution(record)"
                                      />
                                      <AgentLoadingRecord
                                        v-else-if="record.type === 'agent'"
                                        :prompt="record.prompt"
                                        :content="record.content"
                                        :done="record.done"
                                        :error="record.error"
                                      />
                                      <ImageLoadingRecord v-else
                                        :time="record.time"
                                        :prompt="record.prompt"
                                        :model="record.model"
                                        :ratio="record.ratio"
                                        :resolution="record.resolution"
                                        :duration="record.duration"
                                        :feature="record.feature"
                                        :done="record.done"
                                        :images="record.images"
                                        :error="record.error"
                                      />
                                    </div>
                                    <div v-if="record.type === 'agent'" class=item-Xh64V7 :data-index="index * 2 + 2" style=z-index:1>
                                      <div class=responsive-container-msS_cP>
                                        <div class="content-DPogfx ai-generated-record-content-hg5EL8">
                                          <div class=group-title-mhd8yy>{{ record.time }}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </template>
                                  <div id=item_9341e2ed-6804-4e34-9b38-1eb6fe79c48e_034d015f-dde5-f7fc-ad92-e079b6c18e44
                                       class=item-Xh64V7
                                       data-id=034d015f-dde5-f7fc-ad92-e079b6c18e44
                                       data-index=0 style=z-index:1>
                                    <div class="responsive-container-msS_cP responsive-container-Nivf0N">
                                      <div class="content-DPogfx ai-generated-record-content-hg5EL8">
                                        <div class=agentic-record-qV_0lS>
                                          <div class="agentic-record-content-pUXA3k completed-E206yG">
                                            <div class=user-message-IyG6vx>
                                              <div class=context-menu-trigger-QXaWD5>
                                                <div class=user-message-content-Qs9l2b>
                                                  <div class=user-message-text-Fb_kWq>
                                                    <span class=prompt-value-container-KCtKOf><span>你好</span></span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            <div class=assistant-message-text-e69SR6>
                                              <div class="markdown-render-DkILWY markdown-render-UH4_kU">
                                                <h1>意图分析</h1>
                                                <p>
                                                  用户输入了“你好”，这是一个友好的问候。根据系统提示，我需要主动引导用户进入创作流程。因此，我将通过提问来激发用户的创作灵感，为后续的图片或视频生成任务做准备。</p>
                                                <h1>任务规划</h1>
                                                <ol>
                                                  <li>回应用户的问候。</li>
                                                  <li>
                                                    提出一系列引导性问题，涵盖图片生成、视频生成、图片编辑等多个方面，以帮助用户明确自己的创作需求。
                                                  </li>
                                                  <li>
                                                    保持对话的开放性和友好性，鼓励用户分享他们的想法。
                                                  </li>
                                                </ol>
                                                <p>你好！很高兴能为您服务。</p>
                                                <p>
                                                  我是您的AI创作助手，可以为您生成图片、视频，或者对您的图片进行编辑。您今天想创作些什么呢？</p>
                                                <p>
                                                  是想生成一张全新的图片，比如“赛博朋克风格的城市夜景”？还是想让一张静态的图片动起来，比如“让照片里的小猫眨眨眼”？或者，您有一张图片想进行修改，比如“把照片里的背景换成星空”？</p>
                                                <p>
                                                  告诉我您的想法，我们一起把它变成现实！</p>
                                              </div>
                                            </div>
                                            <div class=ai-generated-notice-U9hEwy>
                                              以上内容由 AI 生成
                                            </div>
                                          </div>
                                          <div class=record-bottom-slots-AYv3JV>
                                            <div>
                                              <div class=card-bottom-button-view-xY_JqR
                                                   style=--right-padding:14px>
                                                <div class=icon-Eb0kRz>
                                                  <svg fill=none height=1em
                                                       preserveAspectRatio="xMidYMid meet"
                                                       role=presentation
                                                       viewBox="0 0 24 24"
                                                       width=1em
                                                       xmlns=http://www.w3.org/2000/svg>
                                                    <g>
                                                      <path clip-rule=evenodd
                                                            d="m8.56 5.726 3.948-2.776a.5.5 0 0 1 .788.41v2.23h2.72v2H9.187a.996.996 0 0 1-.631-.225c-.518-.367-.61-1.208.003-1.64Zm10.775 9.213a1 1 0 1 0 1.5 1.323 6.403 6.403 0 0 0 1.605-4.249 6.403 6.403 0 0 0-1.606-4.249 6.41 6.41 0 0 0-4.817-2.174v2a4.41 4.41 0 0 1 3.318 1.498 4.403 4.403 0 0 1 1.105 2.925 4.403 4.403 0 0 1-1.105 2.926Zm-14.67-5.88a1 1 0 1 0-1.5-1.323 6.403 6.403 0 0 0-1.605 4.249c0 1.628.607 3.117 1.606 4.25a6.41 6.41 0 0 0 4.817 2.174v-2a4.41 4.41 0 0 1-3.318-1.498 4.403 4.403 0 0 1-1.105-2.926c0-1.123.416-2.145 1.105-2.926Zm3.318 9.35h2.404v2.232a.5.5 0 0 0 .788.409l3.962-2.785a.816.816 0 0 0 .066-.05.999.999 0 0 0-.591-1.806H7.983v2Z"
                                                            data-follow-fill=currentColor
                                                            fill=currentColor
                                                            fill-rule=evenodd></path>
                                                    </g>
                                                  </svg>
                                                </div>
                                                <div>重新生成</div>
                                              </div>
                                            </div>
                                            <div>
                                              <div class=card-icon-button-PCRIDi>
                                                <div class=icon-Eb0kRz>
                                                  <svg fill=none height=1em
                                                       preserveAspectRatio="xMidYMid meet"
                                                       role=presentation
                                                       viewBox="0 0 24 24"
                                                       width=1em
                                                       xmlns=http://www.w3.org/2000/svg>
                                                    <g>
                                                      <path d="M7.06 10.154c-.2 0-.392.03-.583.059.062-.209.126-.42.228-.61.102-.277.262-.517.42-.758.134-.261.368-.438.54-.661.18-.217.426-.362.621-.542.191-.189.442-.283.64-.416.209-.12.39-.251.584-.314l.484-.199a.535.535 0 0 0 .313-.624l-.19-.757a.556.556 0 0 0-.669-.406l-.618.154c-.243.045-.503.168-.792.28-.285.127-.615.213-.922.418-.309.196-.665.359-.979.62-.304.271-.671.505-.942.849-.296.321-.589.659-.816 1.043-.263.366-.441.768-.63 1.165-.17.398-.308.804-.42 1.199a10.833 10.833 0 0 0-.344 2.187c-.03.644-.013 1.18.025 1.568.013.182.038.36.056.483l.023.15.023-.005a4.038 4.038 0 1 0 3.948-4.883Zm9.871 0c-.2 0-.392.03-.583.059.062-.209.125-.42.228-.61.102-.277.262-.517.42-.758.133-.261.367-.438.54-.661.18-.217.426-.362.62-.542.192-.189.442-.283.641-.416.209-.12.39-.251.584-.314l.483-.199a.535.535 0 0 0 .314-.624l-.19-.757a.556.556 0 0 0-.67-.406l-.617.154c-.244.045-.503.168-.792.28-.284.128-.615.213-.922.419-.31.195-.665.359-.98.62-.304.27-.67.505-.942.848-.296.321-.588.659-.815 1.043-.263.366-.442.768-.63 1.165-.17.398-.308.804-.42 1.199a10.832 10.832 0 0 0-.345 2.187c-.03.644-.012 1.18.025 1.568.014.182.039.36.057.483l.022.15.024-.005a4.038 4.038 0 1 0 3.948-4.883Z"
                                                            data-follow-fill=currentColor
                                                            fill=currentColor></path>
                                                    </g>
                                                  </svg>
                                                </div>
                                              </div>
                                              <div class="simple-tooltip-scroll-anchor sf-hidden"></div>
                                            </div>
                                            <div class="operation-button-oVtvlN normal-button-mS74ha">
                                                                                    <span class=icon-oB5C0a><svg
                                                                                        fill=none height=1em
                                                                                        preserveAspectRatio="xMidYMid meet"
                                                                                        role=presentation
                                                                                        viewBox="0 0 24 24"
                                                                                        width=1em
                                                                                        xmlns=http://www.w3.org/2000/svg><g><path
                                                                                        clip-rule=evenodd
                                                                                        d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                                                                                        data-follow-fill=currentColor
                                                                                        fill=currentColor
                                                                                        fill-rule=evenodd></path></g></svg></span>
                                            </div>
                                            <div class="simple-tooltip-scroll-anchor sf-hidden"></div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div id=item_9341e2ed-6804-4e34-9b38-1eb6fe79c48e_febd2940-ccfc-11f0-b294-af2ab3cf6b8b
                                       class=item-Xh64V7
                                       data-id=febd2940-ccfc-11f0-b294-af2ab3cf6b8b
                                       data-index=3 style=z-index:1>
                                    <div class="responsive-container-msS_cP responsive-container-NBoaUU">
                                      <div class="content-DPogfx ai-generated-record-content-hg5EL8">
                                        <div class=image-record-ytX6Dp>
                                          <div class=record-header-E91Dfj>
                                            <div class=record-header-content-Lkk9CM>
                                              <div class=prompt-suffix-labels-wrapper-qthJZj
                                                   style=--line-height:24px;--padding-top:4px>
                                                <div class=prompt-suffix-labels-NBprFc
                                                     style=--line-height:24px;--padding-top:4px>
                                                  <div class=prompt-suffix-labels-content-uFKTga>
                                                                                                <span class=prompt-P_8aF8><span
                                                                                                    class=prompt-value-container-KCtKOf><span>一只猫在花园里玩耍，卡通风格</span></span></span><span
                                                      class=labels-mHLx1x
                                                      style=visibility:visible><span
                                                      class=label-lhnDlt>图片 4.0</span><span
                                                      class=label-lhnDlt>1:1</span><span
                                                      class=label-lhnDlt>2K</span></span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          <div class=record-box-wrapper-MDgaBP>
                                            <div class=image-record-content-TuJi21>
                                              <div class=responsive-image-grid-WOh0lB>
                                                <div class="image-card-wrapper-WOgXrk landscape-Ven8Mz"
                                                     style=--aspect-ratio:1>
                                                  <div class=image-record-item-W6Y7Df>
                                                    <div class=context-menu-trigger-WJ6VDZ>
                                                      <div class="slot-card-container-gulhrr image-card-container-dFemyw">
                                                        <div class=content-container-z0JOWv>
                                                          <div aria-describedby=DndDescribedBy-0
                                                               aria-disabled=false
                                                               aria-roledescription=draggable
                                                               class=image-card-container-qy7ui4
                                                               role=button
                                                               tabindex=0>
                                                            <div class="container-bG3PQ9 image-GnB1sY">
                                                              <div style="transition:opacity 300ms;opacity:1">
                                                                <img class=image-TLmgkP
                                                                     crossorigin=anonymous
                                                                     data-apm-action=ai-generated-image-record-card
                                                                     draggable=false
                                                                     fetchpriority=high
                                                                     loading=lazy
                                                                     src="https://p3-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/6a37e138cede4802be9fcc05c42ab87c~tplv-tb4s082cfz-aigc_resize_mark:360:360.webp?lk3s=43402efa&x-expires=1771632000&x-signature=tTmi9yn9JBoHnwIQwoqg5p%2BYuDA%3D&format=.webp">
                                                              </div>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                                <div class="image-card-wrapper-WOgXrk landscape-Ven8Mz"
                                                     style=--aspect-ratio:1>
                                                  <div class=image-record-item-W6Y7Df>
                                                    <div class=context-menu-trigger-WJ6VDZ>
                                                      <div class="slot-card-container-gulhrr image-card-container-dFemyw">
                                                        <div class=content-container-z0JOWv>
                                                          <div aria-describedby=DndDescribedBy-0
                                                               aria-disabled=false
                                                               aria-roledescription=draggable
                                                               class=image-card-container-qy7ui4
                                                               role=button
                                                               tabindex=0>
                                                            <div class="container-bG3PQ9 image-GnB1sY">
                                                              <div style="transition:opacity 300ms;opacity:1">
                                                                <img class=image-TLmgkP
                                                                     crossorigin=anonymous
                                                                     data-apm-action=ai-generated-image-record-card
                                                                     draggable=false
                                                                     fetchpriority=high
                                                                     loading=lazy
                                                                     src="https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/2fbae30526cc47d48ba6fbb5a453bd60~tplv-tb4s082cfz-aigc_resize_mark:360:360.webp?lk3s=43402efa&x-expires=1771632000&x-signature=T%2Fo9gmYv7pHhMF4l85a87IhBrBI%3D&format=.webp">
                                                              </div>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>

                                              </div>
                                            </div>
                                            <div class=operations-NxPE1B>
                                              <div class=record-bottom-slots-AYv3JV>
                                                <div>
                                                  <div class=card-bottom-button-view-xY_JqR
                                                       style=--right-padding:14px>
                                                    <div class=icon-Eb0kRz>
                                                      <svg fill=none
                                                           height=1em
                                                           preserveAspectRatio="xMidYMid meet"
                                                           role=presentation
                                                           viewBox="0 0 24 24"
                                                           width=1em
                                                           xmlns=http://www.w3.org/2000/svg>
                                                        <g>
                                                          <path clip-rule=evenodd
                                                                d="M3.764 8.02a2.5 2.5 0 0 1 2.5-2.5H17.03a2.5 2.5 0 0 1 2.5 2.5V9.8a3.25 3.25 0 0 1 2-.082V8.019a4.5 4.5 0 0 0-4.5-4.5H6.264a4.5 4.5 0 0 0-4.5 4.5v7.932a4.5 4.5 0 0 0 4.5 4.5h5.837a2.436 2.436 0 0 1-.05-.57v-1.43H6.263a2.5 2.5 0 0 1-2.5-2.5V8.019Zm17.67 3.964a1 1 0 0 0-1.41-.004l-5.773 5.707a.25.25 0 0 0-.074.178v2.366c0 .138.112.25.25.25h2.347a.25.25 0 0 0 .178-.075l5.71-5.791a1 1 0 0 0-.006-1.41l-1.221-1.22Z"
                                                                data-follow-fill=currentColor
                                                                fill=currentColor
                                                                fill-rule=evenodd></path>
                                                        </g>
                                                      </svg>
                                                    </div>
                                                    <div>重新编辑</div>
                                                  </div>
                                                </div>
                                                <div>
                                                  <div>
                                                    <div class=tooltip-container-jIHxiC>
                                                      <div class=card-bottom-button-view-xY_JqR
                                                           style=--right-padding:14px>
                                                        <div class=icon-Eb0kRz>
                                                          <svg fill=none
                                                               height=1em
                                                               preserveAspectRatio="xMidYMid meet"
                                                               role=presentation
                                                               viewBox="0 0 24 24"
                                                               width=1em
                                                               xmlns=http://www.w3.org/2000/svg>
                                                            <g>
                                                              <path clip-rule=evenodd
                                                                    d="m8.56 5.726 3.948-2.776a.5.5 0 0 1 .788.41v2.23h2.72v2H9.187a.996.996 0 0 1-.631-.225c-.518-.367-.61-1.208.003-1.64Zm10.775 9.213a1 1 0 1 0 1.5 1.323 6.403 6.403 0 0 0 1.605-4.249 6.403 6.403 0 0 0-1.606-4.249 6.41 6.41 0 0 0-4.817-2.174v2a4.41 4.41 0 0 1 3.318 1.498 4.403 4.403 0 0 1 1.105 2.925 4.403 4.403 0 0 1-1.105 2.926Zm-14.67-5.88a1 1 0 1 0-1.5-1.323 6.403 6.403 0 0 0-1.605 4.249c0 1.628.607 3.117 1.606 4.25a6.41 6.41 0 0 0 4.817 2.174v-2a4.41 4.41 0 0 1-3.318-1.498 4.403 4.403 0 0 1-1.105-2.926c0-1.123.416-2.145 1.105-2.926Zm3.318 9.35h2.404v2.232a.5.5 0 0 0 .788.409l3.962-2.785a.816.816 0 0 0 .066-.05.999.999 0 0 0-.591-1.806H7.983v2Z"
                                                                    data-follow-fill=currentColor
                                                                    fill=currentColor
                                                                    fill-rule=evenodd></path>
                                                            </g>
                                                          </svg>
                                                        </div>
                                                        <div>再次生成
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                                <div class="operation-button-oVtvlN normal-button-mS74ha">
                                                                                            <span class=icon-oB5C0a><svg
                                                                                                fill=none height=1em
                                                                                                preserveAspectRatio="xMidYMid meet"
                                                                                                role=presentation
                                                                                                viewBox="0 0 24 24"
                                                                                                width=1em
                                                                                                xmlns=http://www.w3.org/2000/svg><g><path
                                                                                                clip-rule=evenodd
                                                                                                d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                                                                                                data-follow-fill=currentColor
                                                                                                fill=currentColor
                                                                                                fill-rule=evenodd></path></g></svg></span>
                                                </div>
                                                <div class="simple-tooltip-scroll-anchor sf-hidden"></div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div id=item_9341e2ed-6804-4e34-9b38-1eb6fe79c48e_1764404742876
                                       class=item-Xh64V7 data-id=1764404742876 data-index=4
                                       style=z-index:1>
                                    <div class=responsive-container-msS_cP>
                                      <div class="content-DPogfx ai-generated-record-content-hg5EL8">
                                        <div class=group-title-mhd8yy>11月29日</div>
                                      </div>
                                    </div>
                                  </div>
                                  <div class=scroll-slot-coWS6S></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class=filter-mask-IOpWQJ></div>
                        <div class="filter-container-wyGTle filter-F4oqdf">
                          <div class="container-ufW1eH collapsed-HB97Ck">
                            <div class="lv-input-group-wrapper lv-input-group-wrapper-default search-input-ZwhOpf">
                                                    <span class=lv-input-group><span
                                                        class="lv-input-inner-wrapper lv-input-inner-wrapper-has-prefix lv-input-inner-wrapper-default lv-input-clear-wrapper"><span
                                                        class=lv-input-group-prefix><svg
                                                        class="search-icon-rvzopq search-icon-interactive-LHh2d0"
                                                        fill=none
                                                        height=1em
                                                        preserveAspectRatio="xMidYMid meet"
                                                        role=presentation viewBox="0 0 24 24"
                                                        width=1em
                                                        xmlns=http://www.w3.org/2000/svg><g><path
                                                        clip-rule=evenodd
                                                        d="M4.563 10.75a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Zm6.5-8.5a8.5 8.5 0 1 0 5.261 15.176l3.406 3.406a1 1 0 0 0 1.415-1.414l-3.407-3.406A8.5 8.5 0 0 0 11.062 2.25Z"
                                                        data-follow-fill=currentColor fill=currentColor
                                                        fill-rule=evenodd></path></g></svg></span><input
                                                        class="lv-input lv-input-size-default" maxlength=100
                                                        placeholder=搜索 value></span></span>
                            </div>
                          </div>
                          <span class=separator-AluiGy></span>
                          <div class=container-KL2j0F><span class=trigger-AnFRb7><span
                              class="filter-text-bBfqrS filter-text-MnA06c">时间</span><svg
                              class=dropdown-arrow-qZsXaR fill=none height=1em
                              preserveAspectRatio="xMidYMid meet" role=presentation
                              viewBox="0 0 24 24"
                              width=1em xmlns=http://www.w3.org/2000/svg><g><path
                              clip-rule=evenodd
                              d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                              data-follow-fill=currentColor
                              fill=currentColor
                              fill-rule=evenodd></path></g></svg></span></div>
                          <span class=separator-AluiGy></span>
                          <div class=container-KL2j0F><span class=trigger-AnFRb7><span
                              class=filter-text-bBfqrS>生成类型</span><svg
                              class=dropdown-arrow-qZsXaR fill=none
                              height=1em
                              preserveAspectRatio="xMidYMid meet"
                              role=presentation
                              viewBox="0 0 24 24"
                              width=1em
                              xmlns=http://www.w3.org/2000/svg><g><path
                              clip-rule=evenodd
                              d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                              data-follow-fill=currentColor
                              fill=currentColor
                              fill-rule=evenodd></path></g></svg></span></div>
                          <span class=separator-AluiGy></span>
                          <div class=container-KL2j0F><span class=trigger-AnFRb7><span
                              class=filter-text-bBfqrS>操作类型</span><svg
                              class=dropdown-arrow-qZsXaR fill=none
                              height=1em
                              preserveAspectRatio="xMidYMid meet"
                              role=presentation
                              viewBox="0 0 24 24"
                              width=1em
                              xmlns=http://www.w3.org/2000/svg><g><path
                              clip-rule=evenodd
                              d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                              data-follow-fill=currentColor
                              fill=currentColor
                              fill-rule=evenodd></path></g></svg></span></div>
                          <!-- API 设置按钮 -->
                          <button class="agent-settings-btn" @click="showSettings = true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2"/>
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <!-- 内容生成器输入框组件 -->
                      <ContentGenerator ref="contentGeneratorRef" @send="handleSend"/>
                      <!-- API 设置弹窗 -->
                      <ApiSettingsDialog :visible="showSettings" @update:visible="showSettings = $event" />
                      <div style=height:1px></div>
                    </div>
                  </div>
                  <div class="platform-ui-service-side-drawer-container normal-mode legacy">
                    <div class=side-drawer-panel></div>
                  </div>
                  <div class=container_44d3c style=bottom:20px;right:20px>
                    <div class=help-center-nTCbew
                         style=background-color:var(--background-dropdown-menu);color:var(--text-tertiary)>
                      <div class=trigger-REbHBM>
                        <svg class=icon-RC7nOi fill=none height=1em
                             preserveAspectRatio="xMidYMid meet" role=presentation viewBox="0 0 24 24"
                             width=1em xmlns=http://www.w3.org/2000/svg>
                          <g>
                            <path clip-rule=evenodd
                                  d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm8.825 4.897a1.175 1.175 0 1 1 2.35 0 1.175 1.175 0 0 1-2.35 0ZM12 6.11c-.477 0-.95.09-1.395.263-.443.173-.85.43-1.195.755a3.538 3.538 0 0 0-.813 1.15c-.205.468-.289 1.049-.289 1.481a1 1 0 0 0 2 0c0-.235.055-.527.12-.677.081-.184.2-.354.355-.5a1.72 1.72 0 0 1 .551-.347 1.83 1.83 0 0 1 1.332 0c.21.082.396.2.55.347.155.146.275.316.355.5.08.183.12.377.12.571 0 .439-.108.662-.22.811-.139.185-.339.336-.686.572l-.066.044c-.302.204-.736.496-1.074.912-.403.495-.645 1.12-.645 1.923a1 1 0 0 0 2 0c0-.362.095-.536.196-.66.141-.174.34-.313.711-.564l.008-.005c.325-.22.793-.538 1.156-1.022.393-.524.62-1.178.62-2.01 0-.474-.098-.941-.288-1.375a3.538 3.538 0 0 0-.813-1.15 3.708 3.708 0 0 0-1.195-.756A3.829 3.829 0 0 0 12 6.11Z"
                                  data-follow-fill=currentColor fill=currentColor
                                  fill-rule=evenodd></path>
                          </g>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import "./generate.css";
</style>
