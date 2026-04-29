<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideMenu from '../../components/home/components/SideMenu.vue'
import ContentGenerator from '../../components/generate/ContentGenerator.vue'
import ImageLoadingRecord from '../../components/generate/common/ImageLoadingRecord.vue'
import AgentLoadingRecord from '../../components/generate/common/AgentLoadingRecord.vue'
import ImagePreview from '@/components/ImagePreview.vue'
import { getAgentModel } from '@/api/agent'
import { getModelByName, loadPublicModelCatalog, resolveModelLabel, resolveRequestModelKey, resolveRequestProviderId, type ImageModel } from '@/config/models'
import { buildAgentChatMessages, isAgentWorkspaceSkill, loadPublicSkillCatalog } from '@/config/agentSkills'
import {
  createGenerationRecord as createGenerationRecordRequest,
  listGenerationRecords as listGenerationRecordsRequest,
  updateGenerationRecord as updateGenerationRecordRequest,
  type GenerationRecordUpsertPayload,
  type PersistedGenerationRecord,
} from '@/api/generation-records'
import { createGenerationTask, stopGenerationTask, subscribeGenerationTaskEvents, type GenerationTaskStreamEvent } from '@/api/generation-tasks'
import type { CreationType } from '../../components/generate/selectors'
import type {
  AgentRunState,
} from '@/types/agent'
import {
  applyAgentWorkspaceEvent,
  buildAgentPendingRun,
  type AgentWorkspaceEvent,
} from '@/shared/agent-workspace'
import { AUTH_LOGIN_SUCCESS_EVENT, useAuthStore } from '@/stores/auth'
import { useLoginModalStore } from '@/stores/login-modal'
import { useSystemSettingsStore } from '@/stores/system-settings'
import GenerateAgentRecord from './components/GenerateAgentRecord.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { openLoginModal } = useLoginModalStore()
const { publicSystemSettings, loadPublicSettings } = useSystemSettingsStore()

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
  stopped?: boolean
  progressStage?: string
  progressMessage?: string
  progressPercent?: number
  error: string
  agentTaskId?: string
  agentRun?: AgentRunState
}

interface GeneratePreviewImageItem {
  id: string
  src: string
  promptText?: string
  modelLabel?: string
  aspectRatioLabel?: string
  resolutionLabel?: string
  featureLabel?: string
  createDate?: string
}
const generatingRecords = ref<GeneratingRecord[]>([])
let nextId = 0
const recordPersistTimers = new Map<number, ReturnType<typeof setTimeout>>()
const recordPersistInflight = new Set<number>()
const taskStreamControllers = new Map<string, AbortController>()
const previewVisible = ref(false)
const previewIndex = ref(0)
const previewImages = ref<GeneratePreviewImageItem[]>([])

interface StageConversationEntry {
  stageKey: string
  text: string
}

// 用现有 content 字段持久化图片任务阶段对话，避免额外改表。
const parseStageConversationEntries = (content: string): StageConversationEntry[] => {
  return String(content || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[\[(.+?)\]\](.+)$/)
      if (!match) {
        return {
          stageKey: '',
          text: line,
        }
      }
      return {
        stageKey: String(match[1] || '').trim(),
        text: String(match[2] || '').trim(),
      }
    })
    .filter(item => item.text)
}

// 把阶段对话序列化回 content，便于刷新后恢复。
const stringifyStageConversationEntries = (entries: StageConversationEntry[]) => {
  return entries
    .map(item => item.stageKey ? `[[${item.stageKey}]]${item.text}` : item.text)
    .join('\n')
}

// 生成当前记录在对话区展示的阶段文案。
const getRecordConversationEntries = (record: GeneratingRecord) => {
  return parseStageConversationEntries(record.content)
}

// 某个阶段重复到达时只覆盖该阶段文案，不重复堆积。
const upsertRecordStageConversation = (record: GeneratingRecord, stageKey: string, text: string) => {
  const normalizedStageKey = String(stageKey || '').trim()
  const normalizedText = String(text || '').trim()
  if (!normalizedText) {
    return false
  }

  const nextEntries = parseStageConversationEntries(record.content)
  const currentIndex = normalizedStageKey
    ? nextEntries.findIndex(item => item.stageKey === normalizedStageKey)
    : -1

  if (currentIndex >= 0) {
    if (nextEntries[currentIndex].text === normalizedText) {
      return false
    }
    nextEntries[currentIndex] = {
      stageKey: normalizedStageKey,
      text: normalizedText,
    }
  } else {
    nextEntries.push({
      stageKey: normalizedStageKey,
      text: normalizedText,
    })
  }

  record.content = stringifyStageConversationEntries(nextEntries)
  return true
}

// 将服务端阶段映射成前台百分比，避免继续显示固定 99%。
const mapTaskStageToProgressPercent = (stage?: string) => {
  const configuredStage = publicSystemSettings.value.generationProgressSettings?.stages?.find(item => item.key === String(stage || '').trim())
  if (configuredStage && Number.isFinite(Number(configuredStage.percent))) {
    return Math.max(0, Math.min(100, Number(configuredStage.percent)))
  }

  switch (String(stage || '').trim()) {
    case 'queued':
      return 5
    case 'resolved_provider':
      return 12
    case 'requesting_upstream':
      return 35
    case 'receiving_upstream_result':
      return 72
    case 'syncing_record':
      return 92
    case 'completed':
    case 'failed':
    case 'stopped':
      return 100
    case 'failing':
      return 96
    case 'stopping':
      return 98
    default:
      return 0
  }
}

// 根据后台配置解析当前阶段展示文案。
const resolveTaskStageLabel = (stage?: string, fallback = '造梦中') => {
  if (publicSystemSettings.value.generationProgressSettings?.enabled !== false) {
    const configuredStage = publicSystemSettings.value.generationProgressSettings?.stages?.find(item => item.key === String(stage || '').trim())
    if (configuredStage?.label) {
      return configuredStage.label
    }
  }

  return fallback
}

// 页面进入时预加载后台公开模型目录，确保工具栏与生成请求使用同一份模型清单。
onMounted(() => {
  void loadPublicModelCatalog()
  void loadPublicSkillCatalog()
  void loadPublicSettings()
})

const buildPreviewImagesFromRecord = (record: GeneratingRecord): GeneratePreviewImageItem[] => {
  return (record.images || []).map((imageUrl, index) => ({
    id: `${record.id}-${index + 1}`,
    src: imageUrl,
    promptText: record.prompt,
    modelLabel: resolveModelLabel(record.modelKey || record.model, 'IMAGE') || record.model,
    aspectRatioLabel: record.ratio,
    resolutionLabel: record.resolution,
    featureLabel: record.feature,
    createDate: record.time,
  }))
}

const handlePreviewRecordImage = (record: GeneratingRecord, index: number) => {
  if (!record.done || !record.images.length) {
    return
  }

  previewImages.value = buildPreviewImagesFromRecord(record)
  previewIndex.value = Math.min(Math.max(0, index), Math.max(0, previewImages.value.length - 1))
  previewVisible.value = true
}

const handlePreviewDownload = async (image: GeneratePreviewImageItem) => {
  const anchor = document.createElement('a')
  anchor.href = image.src
  anchor.download = `generate-${Date.now()}.png`
  anchor.rel = 'noopener'
  anchor.click()
}

const handlePreviewFavorite = () => {
  ElMessage.success('生成页预览暂不支持收藏入库')
}

const handlePreviewPublish = () => {
  ElMessage.success('请前往资产页或发布流程继续操作')
}

const handlePreviewGenerateVideo = () => {
  ElMessage.success('生视频能力请在资产页详情中使用')
}

const handlePreviewEditInCanvas = () => {
  ElMessage.success('请前往画布页继续编辑')
}

// 只有显式选择技能时，才进入工作台式 Agent 流程；通用助手仍保留原流式对话体验。
const shouldUseAgentWorkspaceFlow = (skill?: string) => {
  return isAgentWorkspaceSkill(skill)
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
  stopped: Boolean(record.stopped),
  agentTaskId: record.agentTaskId,
  images: record.images,
  agentRun: record.agentRun,
})

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
  // 后端若返回旧的 model 文本，这里统一按最新后台模型目录重新解析展示名称。
  model: resolveModelLabel(
    record.modelKey || record.model,
    record.type === 'image' ? 'IMAGE' : record.type === 'agent' ? 'CHAT' : 'VIDEO',
  ) || record.model,
  modelKey: record.modelKey,
  ratio: record.ratio,
  resolution: record.resolution,
  duration: record.duration,
  feature: record.feature,
  skill: record.skill,
  content: record.type === 'image'
    ? (record.content || (!record.done ? '[[queued]]任务已创建，等待服务端执行' : ''))
    : record.content,
  images: record.images,
  done: record.done,
  stopped: Boolean(record.stopped),
  progressStage: record.type === 'image'
    ? (record.done ? (record.stopped ? 'stopped' : 'completed') : 'queued')
    : undefined,
  progressMessage: record.type === 'image'
    ? (record.done
      ? resolveTaskStageLabel(record.stopped ? 'stopped' : 'completed', record.stopped ? '任务已停止' : '任务已完成')
      : resolveTaskStageLabel('queued', '任务已创建，等待服务端执行'))
    : undefined,
  progressPercent: record.type === 'image' ? (record.done ? 100 : 5) : 0,
  error: record.error,
  agentTaskId: record.agentTaskId,
  agentRun: record.agentRun,
})


// 将后端持久化后的正式资源地址回写到当前记录，避免重复提交 base64 或上游临时链接。
const syncRecordWithPersisted = (record: GeneratingRecord, saved: PersistedGenerationRecord) => {
  record.dbId = saved.id
  record.content = saved.content || record.content
  record.error = saved.error
  record.done = saved.done
  record.stopped = Boolean(saved.stopped)
  record.progressStage = saved.done
    ? (saved.stopped ? 'stopped' : saved.error ? 'failed' : 'completed')
    : (record.progressStage || 'queued')
  record.progressMessage = saved.done
    ? resolveTaskStageLabel(
      saved.stopped ? 'stopped' : saved.error ? 'failed' : 'completed',
      saved.stopped ? '任务已停止' : saved.error ? saved.error : '任务已完成',
    )
    : resolveTaskStageLabel(record.progressStage || 'queued', record.progressMessage || '任务执行中')
  record.progressPercent = saved.done
    ? 100
    : Math.max(record.progressPercent || 0, mapTaskStageToProgressPercent(record.progressStage))
  record.images = Array.isArray(saved.images) ? [...saved.images] : []
  if (saved.agentRun) {
    record.agentRun = {
      ...saved.agentRun,
      result: {
        ...saved.agentRun.result,
        images: Array.isArray(saved.agentRun.result?.images)
          ? [...saved.agentRun.result.images]
          : [],
      },
      steps: Array.isArray(saved.agentRun.steps) ? [...saved.agentRun.steps] : [],
      processSections: Array.isArray(saved.agentRun.processSections)
        ? saved.agentRun.processSections.map(section => ({
            ...section,
            paragraphs: Array.isArray(section.paragraphs) ? [...section.paragraphs] : [],
            taskItems: Array.isArray(section.taskItems) ? [...section.taskItems] : [],
          }))
        : [],
    }
    return
  }

  if (record.type === 'agent') {
    record.agentRun = undefined
  }
}

// 立即持久化一条记录；创建与更新都走这里统一收口。
const persistRecordNow = async (record: GeneratingRecord) => {
  if (recordPersistInflight.has(record.id)) return
  recordPersistInflight.add(record.id)

  try {
    if (!record.dbId) {
      const saved = await createGenerationRecordRequest(toGenerationRecordPayload(record))
      syncRecordWithPersisted(record, saved)
      return
    }

    const saved = await updateGenerationRecordRequest(record.dbId, toGenerationRecordPayload(record))
    syncRecordWithPersisted(record, saved)
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

// 处理任务事件流推送，SSE 已直接携带完整记录，不再额外回拉详情。
const handleGenerationTaskStreamEvent = (recordId: string, event: GenerationTaskStreamEvent) => {
  const targetRecord = generatingRecords.value.find(item => item.dbId === recordId)
  if (!targetRecord) {
    return
  }

  const isImageTaskRecord = targetRecord.type === 'image'
  let stageConversationChanged = false

  if (event.record) {
    syncRecordWithPersisted(targetRecord, event.record)
  }

  if (event.type === 'progress' && event.message) {
    targetRecord.error = ''
    targetRecord.progressStage = event.stage || targetRecord.progressStage || 'queued'
    targetRecord.progressMessage = resolveTaskStageLabel(event.stage, event.message)
    targetRecord.progressPercent = Math.max(
      targetRecord.progressPercent || 0,
      mapTaskStageToProgressPercent(event.stage),
    )
    if (isImageTaskRecord) {
      stageConversationChanged = upsertRecordStageConversation(
        targetRecord,
        targetRecord.progressStage || event.stage || 'queued',
        `${targetRecord.progressMessage}：${event.message}`,
      ) || stageConversationChanged
    }
  }

  if (event.type === 'content_delta') {
    targetRecord.error = ''
    if (typeof event.content === 'string') {
      targetRecord.content = event.content
    } else if (typeof event.delta === 'string') {
      targetRecord.content += event.delta
    }
    targetRecord.progressStage = event.stage || targetRecord.progressStage || 'receiving_upstream_result'
    targetRecord.progressMessage = resolveTaskStageLabel(event.stage, '内容生成中')
  }

  if (event.type === 'agent_event' && targetRecord.agentRun && event.agentEvent) {
    targetRecord.error = ''
    if (!event.record) {
      targetRecord.agentRun = applyAgentWorkspaceEvent(targetRecord.agentRun, event.agentEvent as AgentWorkspaceEvent)
    }
    targetRecord.progressStage = event.stage || targetRecord.progressStage || 'agent_workspace_running'
    targetRecord.progressMessage = resolveTaskStageLabel(event.stage, event.message || '技能任务执行中')
  }

  if (event.type === 'connected' && event.message) {
    targetRecord.progressStage = event.stage || targetRecord.progressStage || 'queued'
    targetRecord.progressMessage = resolveTaskStageLabel(event.stage, '造梦中')
    targetRecord.progressPercent = Math.max(
      targetRecord.progressPercent || 0,
      mapTaskStageToProgressPercent(event.stage),
    )
    if (isImageTaskRecord) {
      stageConversationChanged = upsertRecordStageConversation(
        targetRecord,
        targetRecord.progressStage || event.stage || 'queued',
        event.message,
      ) || stageConversationChanged
    }
  }

  if (event.type === 'completed') {
    targetRecord.progressStage = 'completed'
    targetRecord.progressMessage = resolveTaskStageLabel('completed', event.message || '图片生成完成')
    targetRecord.progressPercent = 100
    if (isImageTaskRecord) {
      stageConversationChanged = upsertRecordStageConversation(
        targetRecord,
        'completed',
        `${targetRecord.progressMessage}：${event.message || '图片生成完成'}`,
      ) || stageConversationChanged
    }
  } else if (event.type === 'failed') {
    targetRecord.progressStage = 'failed'
    targetRecord.progressMessage = resolveTaskStageLabel('failed', event.message || '任务执行失败')
    targetRecord.progressPercent = 100
    if (isImageTaskRecord) {
      stageConversationChanged = upsertRecordStageConversation(
        targetRecord,
        'failed',
        `${targetRecord.progressMessage}：${event.message || '任务执行失败'}`,
      ) || stageConversationChanged
    }
  } else if (event.type === 'stopped') {
    targetRecord.progressStage = 'stopped'
    targetRecord.progressMessage = resolveTaskStageLabel('stopped', event.message || '任务已停止')
    targetRecord.progressPercent = 100
    if (isImageTaskRecord) {
      stageConversationChanged = upsertRecordStageConversation(
        targetRecord,
        'stopped',
        `${targetRecord.progressMessage}：${event.message || '任务已停止'}`,
      ) || stageConversationChanged
    }
  }

  if (stageConversationChanged) {
    schedulePersistRecord(targetRecord)
  }

  if (event.done) {
    const controller = taskStreamControllers.get(recordId)
    if (controller) {
      controller.abort()
      taskStreamControllers.delete(recordId)
    }
  }
}

// 连接单个任务的 SSE 事件流，断线后自动重连，直到任务完成。
const connectGenerationTaskStream = (record: GeneratingRecord) => {
  if (!record.dbId || record.done) {
    return
  }

  if (taskStreamControllers.has(record.dbId)) {
    return
  }

  const controller = new AbortController()
  taskStreamControllers.set(record.dbId, controller)

  void (async () => {
    try {
      await subscribeGenerationTaskEvents(record.dbId!, {
        signal: controller.signal,
        onEvent: (event) => {
          handleGenerationTaskStreamEvent(record.dbId!, event)
        },
      })
    } catch {
      if (controller.signal.aborted) {
        return
      }
      const latestRecord = generatingRecords.value.find(item => item.dbId === record.dbId)
      if (latestRecord && !latestRecord.done) {
        taskStreamControllers.delete(record.dbId!)
        setTimeout(() => {
          connectGenerationTaskStream(latestRecord)
        }, 1500)
        return
      }
    }

    if (taskStreamControllers.get(record.dbId!) === controller) {
      taskStreamControllers.delete(record.dbId!)
    }
  })()
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
    nextRecords.forEach(connectGenerationTaskStream)
  } catch {
    // 数据库未配置或接口失败时，继续使用前端内存态。
  }
}


// 处理发送事件
const handleSend = (message: string, type: CreationType, options?: { model?: string, modelKey?: string, ratio?: string, resolution?: string, duration?: string, feature?: string, skill?: string }) => {
  if (!authStore.isLoggedIn.value) {
    openLoginModal('generate-send-guard')
    return
  }

  const recordId = nextId++
  const record: GeneratingRecord = {
    id: recordId,
    type,
    prompt: message,
    time: formatGroupLabel(new Date()),
    model: options?.model || resolveModelLabel(options?.modelKey || '', type === 'image' ? 'IMAGE' : type === 'agent' ? 'CHAT' : 'VIDEO') || '',
    modelKey: options?.modelKey || '',
    ratio: options?.ratio || '',
    resolution: options?.resolution || '',
    duration: options?.duration || '',
    feature: options?.feature || '',
    skill: options?.skill || 'general',
    content: type === 'image' ? '[[queued]]任务已创建，等待服务端执行' : '',
    images: [],
    done: false,
    stopped: false,
    progressStage: type === 'image' ? 'queued' : undefined,
    progressMessage: type === 'image' ? resolveTaskStageLabel('queued', '任务已创建，等待服务端执行') : undefined,
    progressPercent: type === 'image' ? 5 : 0,
    error: '',
    agentRun: type === 'agent' && shouldUseAgentWorkspaceFlow(options?.skill)
      ? buildAgentPendingRun(recordId, message, options?.skill || 'general')
      : undefined,
  }
  generatingRecords.value.unshift(record)

  // 根据类型触发不同的生成逻辑
  if (type === 'agent') {
    if (record.agentRun) {
      void startWorkspaceAgentTask(generatingRecords.value[0])
    } else {
      void startGeneralAgentTask(generatingRecords.value[0])
    }
  } else if (type === 'image') {
    void startImageGenerationTask(generatingRecords.value[0])
  }
}

// 技能工作台同样改为服务端任务，由后端持续推送结构化阶段事件。
const startWorkspaceAgentTask = async (record: GeneratingRecord) => {
  try {
    const currentModelKey = resolveRequestModelKey(record.modelKey || getAgentModel(), 'CHAT')
    const providerId = resolveRequestProviderId(record.modelKey || currentModelKey, 'CHAT')

    const saved = await createGenerationTask({
      type: 'agent',
      prompt: record.prompt,
      model: record.model,
      modelKey: currentModelKey,
      skill: record.skill,
      requestBody: {
        providerId,
        model: currentModelKey,
        messages: buildAgentChatMessages(record.skill, record.prompt),
        stream: true,
      },
    })

    syncRecordWithPersisted(record, saved)
    connectGenerationTaskStream(record)
  } catch (error: unknown) {
    record.done = true
    record.stopped = false
    record.error = error instanceof Error ? error.message : '技能任务生成失败'
    schedulePersistRecord(record, true)
  }
}

// 通用 AI 对话同样提交到服务端任务，由后端持续执行并通过 SSE 回推文本增量。
const startGeneralAgentTask = async (record: GeneratingRecord) => {
  try {
    const currentModelKey = resolveRequestModelKey(record.modelKey || getAgentModel(), 'CHAT')
    const providerId = resolveRequestProviderId(record.modelKey || currentModelKey, 'CHAT')
    if (!providerId) {
      throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
    }
    if (!currentModelKey) {
      throw new Error('缺少对话模型标识')
    }

    const saved = await createGenerationTask({
      type: 'agent',
      prompt: record.prompt,
      model: record.model,
      modelKey: currentModelKey,
      skill: record.skill,
      requestBody: {
        providerId,
        model: currentModelKey,
        messages: buildAgentChatMessages(record.skill, record.prompt),
        stream: true,
      },
    })

    syncRecordWithPersisted(record, saved)
    connectGenerationTaskStream(record)
  } catch (error: unknown) {
    record.done = true
    record.stopped = false
    record.error = error instanceof Error ? error.message : '对话生成失败'
    schedulePersistRecord(record, true)
  }
}

// 图片生成改为提交服务端任务，由后端继续执行并写回生成记录。
const startImageGenerationTask = async (record: GeneratingRecord) => {
  try {
    const providerId = resolveRequestProviderId(record.modelKey, 'IMAGE')
    const requestModelKey = resolveRequestModelKey(record.modelKey, 'IMAGE')
    if (!providerId) {
      throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
    }
    if (!requestModelKey) {
      throw new Error('未匹配到有效图片模型，请先检查后台模型配置')
    }

    const modelConfig = getModelByName(record.modelKey || requestModelKey) as ImageModel | null
    const size = modelConfig?.sizes?.length
      ? (modelConfig.sizes.find((sizeItem: string) => sizeItem.includes(record.ratio.replace(':', 'x'))) || modelConfig.defaultParams?.size || '')
      : (record.ratio ? record.ratio.replace(':', 'x') : '')
    const data: any = {
      model: requestModelKey,
      prompt: record.prompt,
      n: 1,
      providerId,
    }
    if (size) {
      data.size = size
    }

    const saved = await createGenerationTask({
      type: 'image',
      prompt: record.prompt,
      model: record.model,
      modelKey: requestModelKey,
      ratio: record.ratio,
      resolution: record.resolution,
      duration: record.duration,
      feature: record.feature,
      skill: record.skill,
      requestBody: data,
    })

    syncRecordWithPersisted(record, saved)
    connectGenerationTaskStream(record)
  } catch (error: unknown) {
    record.done = true
    record.stopped = false
    record.progressStage = 'failed'
    record.progressMessage = resolveTaskStageLabel('failed', error instanceof Error ? error.message : '图片生成失败')
    record.progressPercent = 100
    record.error = error instanceof Error ? error.message : '图片生成失败'
  }
}

// 图片生成支持跨页面中断；只要服务端任务仍在运行，就能远程停止。
const handleStopImageGeneration = async (record: GeneratingRecord) => {
  if (record.done) return
  if (!record.dbId) return

  try {
    const saved = await stopGenerationTask(record.dbId)
    syncRecordWithPersisted(record, saved)
    const controller = taskStreamControllers.get(record.dbId)
    if (controller) {
      controller.abort()
      taskStreamControllers.delete(record.dbId)
    }
  } catch {
    // 停止失败时保持当前状态，等待 SSE 或后续同步刷新。
  }
}

const handleStopAgentExecution = async (record: GeneratingRecord) => {
  if (!record.agentRun || record.done || !record.dbId) return

  try {
    const saved = await stopGenerationTask(record.dbId)
    syncRecordWithPersisted(record, saved)
    const controller = taskStreamControllers.get(record.dbId)
    if (controller) {
      controller.abort()
      taskStreamControllers.delete(record.dbId)
    }
  } catch {
    // 停止失败时保持当前状态，等待 SSE 或后续同步刷新。
  }
}

// 上一次滚动位置
let lastScrollTop = 0

// 登录成功后的页面数据刷新监听器。
let authLoginSuccessListener: (() => void) | null = null

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

onUnmounted(() => {
  if (authLoginSuccessListener) {
    window.removeEventListener(AUTH_LOGIN_SUCCESS_EVENT, authLoginSuccessListener)
    authLoginSuccessListener = null
  }

  taskStreamControllers.forEach(controller => controller.abort())
  taskStreamControllers.clear()
})

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

  authLoginSuccessListener = () => {
    void loadPersistedGeneratingRecords()
  }
  window.addEventListener(AUTH_LOGIN_SUCCESS_EVENT, authLoginSuccessListener)

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
                                        :progress="record.progressPercent || 0"
                                        :progress-text="record.progressMessage || ''"
                                        :done="record.done"
                                        :stopped="Boolean(record.stopped)"
                                        :images="record.images"
                                        :conversation-entries="getRecordConversationEntries(record)"
                                        :error="record.error"
                                        @preview="handlePreviewRecordImage(record, $event)"
                                        @stop="handleStopImageGeneration(record)"
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
                        </div>
                      </div>
                      <!-- 内容生成器输入框组件 -->
                      <ContentGenerator ref="contentGeneratorRef" @send="handleSend"/>
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

  <ImagePreview
    v-model:visible="previewVisible"
    v-model:currentIndex="previewIndex"
    :images="previewImages"
    @download="handlePreviewDownload"
    @favorite="handlePreviewFavorite"
    @publish="handlePreviewPublish"
    @generate-video="handlePreviewGenerateVideo"
    @edit-in-canvas="handlePreviewEditInCanvas"
  />
</template>

<style>
@import "./generate.css";
</style>
