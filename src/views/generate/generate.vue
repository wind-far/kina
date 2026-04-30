<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref, onMounted, onUnmounted } from 'vue'
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
import {
  createGenerationSession as createGenerationSessionRequest,
  deleteGenerationSession as deleteGenerationSessionRequest,
  listGenerationSessions as listGenerationSessionsRequest,
  updateGenerationSession as updateGenerationSessionRequest,
  type PersistedGenerationSession,
} from '@/api/generation-sessions'
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
import { normalizeGenerationErrorMessage } from '@/shared/generation-error'
import { AUTH_LOGIN_SUCCESS_EVENT, useAuthStore } from '@/stores/auth'
import { useLoginModalStore } from '@/stores/login-modal'
import { useSystemSettingsStore } from '@/stores/system-settings'
import GenerateAgentRecord from './components/GenerateAgentRecord.vue'
import GenerateSessionList from './components/GenerateSessionList.vue'
import GenerateConversationSidebar, { type GenerateConversationSidebarItem } from './components/GenerateConversationSidebar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { openLoginModal } = useLoginModalStore()
const { publicSystemSettings, loadPublicSettings } = useSystemSettingsStore()
const conversationHeroSettings = computed(() => publicSystemSettings.value.conversationSettings.entryDisplay.hero)

const formatGenerationError = (message?: string | null, fallback = '任务执行失败') => {
  return normalizeGenerationErrorMessage(String(message || '').trim(), fallback)
}

// ContentGenerator 组件引用
const contentGeneratorRef = ref<InstanceType<typeof ContentGenerator> | null>(null)

// 生成记录列表
interface GeneratingRecord {
  id: number
  dbId?: string
  sessionId?: string
  sessionTitle?: string
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

interface GenerateSessionScrollState {
  scrollTop: number
  isAtBottom: boolean
  isScrollingUp: boolean
}
const generatingRecords = ref<GeneratingRecord[]>([])
let nextId = 0
const recordPersistTimers = new Map<number, ReturnType<typeof setTimeout>>()
const recordPersistInflight = new Set<number>()
const taskStreamControllers = new Map<string, AbortController>()
const previewVisible = ref(false)
const previewIndex = ref(0)
const previewImages = ref<GeneratePreviewImageItem[]>([])
const sessionSearchKeyword = ref('')
const generationSessions = ref<PersistedGenerationSession[]>([])
const currentSessionId = ref('')
const conversationSidebarCollapsed = ref(false)
const isGenerationSessionsLoading = ref(false)

const GENERATE_SIDEBAR_COLLAPSED_STORAGE_KEY = 'generate_conversation_sidebar_collapsed'

const GENERATE_ACTIVE_SESSION_STORAGE_KEY = 'generate_active_session_id'

const readStoredCurrentSessionId = () => {
  if (typeof window === 'undefined') {
    return ''
  }
  return String(window.localStorage.getItem(GENERATE_ACTIVE_SESSION_STORAGE_KEY) || '').trim()
}

const writeStoredCurrentSessionId = (sessionId: string) => {
  if (typeof window === 'undefined') {
    return
  }
  if (!sessionId) {
    window.localStorage.removeItem(GENERATE_ACTIVE_SESSION_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(GENERATE_ACTIVE_SESSION_STORAGE_KEY, sessionId)
}

const readStoredConversationSidebarCollapsed = () => {
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(GENERATE_SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
}

const writeStoredConversationSidebarCollapsed = (collapsed: boolean) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(GENERATE_SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
}

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

// 当前会话列表先支持关键词搜索，便于快速定位提示词和结果文本。
const visibleGeneratingRecords = computed(() => {
  const activeSession = String(currentSessionId.value || '').trim()
  const keyword = String(sessionSearchKeyword.value || '').trim().toLowerCase()

  return generatingRecords.value.filter((record) => {
    if (activeSession && record.sessionId !== activeSession) {
      return false
    }

    if (!keyword) {
      return true
    }

    return [
      record.prompt,
      record.content,
      record.model,
      record.feature,
      record.skill,
      record.type,
      record.error,
    ].some((field) => String(field || '').toLowerCase().includes(keyword))
  })
})

const isCurrentSessionEmpty = computed(() => {
  if (sessionSearchKeyword.value.trim()) {
    return false
  }
  return visibleGeneratingRecords.value.length === 0
})

const mainContentClassName = computed(() => {
  const classNames = ['main-content-G632JF']
  if (isCurrentSessionEmpty.value) {
    classNames.push('new-conversation-cz8zuh')
  }
  if (!conversationSidebarCollapsed.value) {
    classNames.push('with-sidebar-mPyABv')
  }
  return classNames.join(' ')
})

const sidebarRecentSessions = computed<GenerateConversationSidebarItem[]>(() => {
  return generationSessions.value
    .filter(session => !session.isDefault)
    .map((session) => ({
      id: session.id,
      title: String(session.title || '未命名会话').trim(),
      imageUrl: session.coverImageUrl || '',
    }))
})

const sidebarDefaultSession = computed<GenerateConversationSidebarItem>(() => ({
  id: generationSessions.value.find(session => session.isDefault)?.id || 'default',
  title: generationSessions.value.find(session => session.isDefault)?.title || '默认创作',
  imageUrl: generationSessions.value.find(session => session.isDefault)?.coverImageUrl || '',
}))

const applyCurrentSessionId = (sessionId: string) => {
  currentSessionId.value = sessionId
  writeStoredCurrentSessionId(sessionId)
}

const syncCurrentSessionWithSessionList = (sessions: PersistedGenerationSession[]) => {
  if (!sessions.length) {
    applyCurrentSessionId('')
    return
  }

  const current = String(currentSessionId.value || '').trim()
  if (current && sessions.some(session => session.id === current)) {
    return
  }

  const stored = readStoredCurrentSessionId()
  const matchedStored = stored
    ? sessions.find(session => session.id === stored)
    : null

  applyCurrentSessionId(matchedStored?.id || sessions[0].id)
}

const loadPersistedGenerationSessions = async () => {
  if (!authStore.isLoggedIn.value) {
    generationSessions.value = []
    applyCurrentSessionId('')
    return
  }

  try {
    isGenerationSessionsLoading.value = true
    const sessions = await listGenerationSessionsRequest()
    generationSessions.value = sessions
    syncCurrentSessionWithSessionList(sessions)
  } catch {
    generationSessions.value = []
    applyCurrentSessionId('')
  } finally {
    isGenerationSessionsLoading.value = false
  }
}

// 新建正式会话，并切换到新会话视图。
const handleCreateSession = async () => {
  if (!authStore.isLoggedIn.value) {
    openLoginModal('generate-session-create')
    return
  }

  const createdSession = await createGenerationSessionRequest()
  generationSessions.value = generationSessions.value
    .filter(session => session.id !== createdSession.id)
  generationSessions.value.push(createdSession)
  generationSessions.value = [...generationSessions.value].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
  applyCurrentSessionId(createdSession.id)
  sessionSearchKeyword.value = ''
  const scrollNode = document.getElementById('scroll-list-generate-session')
  scrollNode?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  contentGeneratorRef.value?.expand()
}

const handleSessionSearch = () => {
  contentGeneratorRef.value?.expand()
}

const handleSessionTimeFilterClick = () => {
  ElMessage.info('时间筛选下一步接入。')
}

const handleSessionTypeFilterClick = () => {
  ElMessage.info('生成类型筛选下一步接入。')
}

const handleSessionActionFilterClick = () => {
  ElMessage.info('操作类型筛选下一步接入。')
}

const handleSelectSidebarDefault = () => {
  applyCurrentSessionId(sidebarDefaultSession.value.id)
  sessionSearchKeyword.value = ''
}

const handleSelectSidebarSession = (id: string) => {
  applyCurrentSessionId(id)
  sessionSearchKeyword.value = ''
}

const handleRenameSidebarSession = async (id: string) => {
  const targetSession = generationSessions.value.find(session => session.id === id)
  if (!targetSession) {
    return
  }

  try {
    const { value } = await ElMessageBox.prompt('请输入新的会话名称', '重命名会话', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputValue: targetSession.title,
      inputPlaceholder: '请输入会话名称',
      inputValidator: (inputValue) => {
        return String(inputValue || '').trim() ? true : '会话名称不能为空'
      },
    })

    const savedSession = await updateGenerationSessionRequest(id, {
      title: String(value || '').trim(),
    })

    generationSessions.value = generationSessions.value.map((session) => {
      if (session.id !== savedSession.id) {
        return session
      }
      return savedSession
    })

    generatingRecords.value = generatingRecords.value.map((record) => {
      if (record.sessionId !== savedSession.id) {
        return record
      }
      return {
        ...record,
        sessionTitle: savedSession.title,
      }
    })
  } catch {
    // 用户取消重命名时不提示错误。
  }
}

const handleDeleteSidebarSession = async (id: string) => {
  const targetSession = generationSessions.value.find(session => session.id === id)
  if (!targetSession) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定删除会话“${targetSession.title}”吗？该会话下的生成记录也会一并移除。`,
      '删除会话',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )

    const runningRecords = generatingRecords.value.filter(record => record.sessionId === id && !record.done && record.dbId)
    await Promise.allSettled(runningRecords.map(async (record) => {
      if (!record.dbId) {
        return
      }

      const saved = await stopGenerationTask(record.dbId)
      syncRecordWithPersisted(record, saved)
      const controller = taskStreamControllers.get(record.dbId)
      if (controller) {
        controller.abort()
        taskStreamControllers.delete(record.dbId)
      }
    }))

    await deleteGenerationSessionRequest(id)

    generationSessions.value = generationSessions.value.filter(session => session.id !== id)
    generatingRecords.value = generatingRecords.value.filter(record => record.sessionId !== id)

    if (currentSessionId.value === id) {
      const fallbackSession = generationSessions.value.find(session => session.isDefault) || generationSessions.value[0]
      applyCurrentSessionId(fallbackSession?.id || '')
    }

    if (!generationSessions.value.length) {
      conversationSidebarCollapsed.value = false
      writeStoredConversationSidebarCollapsed(false)
    }
  } catch {
    // 用户取消删除时不提示错误。
  }
}

const handleToggleConversationSidebar = () => {
  conversationSidebarCollapsed.value = !conversationSidebarCollapsed.value
  writeStoredConversationSidebarCollapsed(conversationSidebarCollapsed.value)
}

// 只有显式选择技能时，才进入工作台式 Agent 流程；通用助手仍保留原流式对话体验。
const shouldUseAgentWorkspaceFlow = (skill?: string) => {
  return isAgentWorkspaceSkill(skill)
}

// 将页面内的记录结构转换为后端持久化结构。
const toGenerationRecordPayload = (record: GeneratingRecord): GenerationRecordUpsertPayload => ({
  sessionId: record.sessionId,
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
  sessionId: record.sessionId,
  sessionTitle: record.sessionTitle || '',
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
  record.sessionId = saved.sessionId
  record.sessionTitle = saved.sessionTitle || record.sessionTitle || ''
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

  syncSessionMetaFromRecord(record, saved)
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
    if (!authStore.isLoggedIn.value) {
      generatingRecords.value = []
      return
    }

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


const ensureCurrentGenerationSession = async () => {
  if (!authStore.isLoggedIn.value) {
    return null
  }

  if (!generationSessions.value.length) {
    await loadPersistedGenerationSessions()
  }

  if (currentSessionId.value) {
    const matchedSession = generationSessions.value.find(session => session.id === currentSessionId.value)
    if (matchedSession) {
      return matchedSession
    }
  }

  const defaultSession = generationSessions.value.find(session => session.isDefault) || generationSessions.value[0]
  if (defaultSession) {
    applyCurrentSessionId(defaultSession.id)
    return defaultSession
  }

  await loadPersistedGenerationSessions()
  const reloadedDefaultSession = generationSessions.value.find(session => session.isDefault) || generationSessions.value[0]
  if (reloadedDefaultSession) {
    applyCurrentSessionId(reloadedDefaultSession.id)
    return reloadedDefaultSession
  }

  return null
}

const touchSessionAfterRecordCreated = (sessionId: string) => {
  const now = new Date().toISOString()
  generationSessions.value = generationSessions.value
    .map((session) => {
      if (session.id !== sessionId) {
        return session
      }
      return {
        ...session,
        lastRecordAt: now,
        updatedAt: now,
        recordCount: Number(session.recordCount || 0) + 1,
      }
    })
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1
      }
      return new Date(right.lastRecordAt || right.updatedAt).getTime() - new Date(left.lastRecordAt || left.updatedAt).getTime()
    })
}

// 生成记录回写后直接更新本地会话元数据，避免再次请求会话列表造成闪动。
const syncSessionMetaFromRecord = (record: GeneratingRecord, saved: PersistedGenerationRecord) => {
  const sessionId = String(saved.sessionId || record.sessionId || '').trim()
  if (!sessionId) {
    return
  }

  const nextCoverImageUrl = String(saved.images?.[0] || record.images?.[0] || '').trim()
  generationSessions.value = generationSessions.value.map((session) => {
    if (session.id !== sessionId) {
      return session
    }
    return {
      ...session,
      title: saved.sessionTitle || record.sessionTitle || session.title,
      coverImageUrl: nextCoverImageUrl || session.coverImageUrl,
    }
  })
}

// 处理发送事件
const handleSend = async (message: string, type: CreationType, options?: { model?: string, modelKey?: string, ratio?: string, resolution?: string, duration?: string, feature?: string, skill?: string }) => {
  if (!authStore.isLoggedIn.value) {
    openLoginModal('generate-send-guard')
    return
  }

  const activeSession = await ensureCurrentGenerationSession()
  if (!activeSession) {
    return
  }

  const recordId = nextId++
  const record: GeneratingRecord = {
    id: recordId,
    sessionId: activeSession.id,
    sessionTitle: activeSession.title,
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
  touchSessionAfterRecordCreated(activeSession.id)

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
      sessionId: record.sessionId,
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
    record.error = formatGenerationError(error instanceof Error ? error.message : '', '技能任务生成失败')
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
      sessionId: record.sessionId,
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
    record.error = formatGenerationError(error instanceof Error ? error.message : '', '对话生成失败')
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
      sessionId: record.sessionId,
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
    record.progressMessage = resolveTaskStageLabel(
      'failed',
      formatGenerationError(error instanceof Error ? error.message : '', '图片生成失败'),
    )
    record.progressPercent = 100
    record.error = formatGenerationError(error instanceof Error ? error.message : '', '图片生成失败')
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

// 处理 GenerateSessionList 上抛的滚动状态，控制输入框折叠/展开。
const handleSessionListScrollState = (state: GenerateSessionScrollState) => {
  if (!contentGeneratorRef.value) return
  if (state.isAtBottom) {
    contentGeneratorRef.value.expand()
  } else if (state.isScrollingUp && state.scrollTop > 50) {
    contentGeneratorRef.value.collapse()
  }
}

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

onMounted(() => {
  currentSessionId.value = readStoredCurrentSessionId()
  conversationSidebarCollapsed.value = readStoredConversationSidebarCollapsed()
  void loadPersistedGenerationSessions()
  void loadPersistedGeneratingRecords()

  // 检查路由参数（从首页跳转过来的发送请求）
  const { message, type, model, ratio, resolution, skill } = route.query
  if (message && type) {
    handleSend(
      message as string,
      type as CreationType,
      { model: model as string, ratio: ratio as string, resolution: resolution as string, skill: skill as string }
    )
    router.replace({ path: '/generate' })
  }

  document.addEventListener('click', handlePageClick)

  authLoginSuccessListener = () => {
    void loadPersistedGenerationSessions()
    void loadPersistedGeneratingRecords()
  }
  window.addEventListener(AUTH_LOGIN_SUCCESS_EVENT, authLoginSuccessListener)
})

onUnmounted(() => {
  recordPersistTimers.forEach(timer => clearTimeout(timer))
  recordPersistTimers.clear()
  document.removeEventListener('click', handlePageClick)

  if (authLoginSuccessListener) {
    window.removeEventListener(AUTH_LOGIN_SUCCESS_EVENT, authLoginSuccessListener)
    authLoginSuccessListener = null
  }

  taskStreamControllers.forEach(controller => controller.abort())
  taskStreamControllers.clear()
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
                    <div class="entry-erESAd">
                      <GenerateConversationSidebar
                        :active-session-id="currentSessionId"
                        :collapsed="conversationSidebarCollapsed"
                        :loading="isGenerationSessionsLoading"
                        :default-session="sidebarDefaultSession"
                        :sessions="sidebarRecentSessions"
                        @toggle-sidebar="handleToggleConversationSidebar"
                        @create-session="handleCreateSession"
                        @select-default="handleSelectSidebarDefault"
                        @select-session="handleSelectSidebarSession"
                        @rename-session="handleRenameSidebarSession"
                        @delete-session="handleDeleteSidebarSession"
                      />
                      <div :class="mainContentClassName">
                        <template v-if="isCurrentSessionEmpty">
                          <div v-if="conversationHeroSettings.enabled" class="new-conversation-hero-canana">
                            <h1 class="new-conversation-title-S9Fv1t" ccfmp-element="true">
                              {{ conversationHeroSettings.title || '你好，想创作什么？' }}
                            </h1>
                            <p v-if="conversationHeroSettings.subtitle" class="new-conversation-subtitle-canana">
                              {{ conversationHeroSettings.subtitle }}
                            </p>
                          </div>
                          <ContentGenerator
                            ref="contentGeneratorRef"
                            :default-expanded="true"
                            @send="handleSend"
                          />
                        </template>
                        <div v-else class=entry-lav5_s>
                          <GenerateSessionList
                            v-model:search-value="sessionSearchKeyword"
                            scroll-list-id="scroll-list-generate-session"
                            @create-session="handleCreateSession"
                            @search="handleSessionSearch"
                            @time-filter-click="handleSessionTimeFilterClick"
                            @type-filter-click="handleSessionTypeFilterClick"
                            @action-filter-click="handleSessionActionFilterClick"
                            @scroll-state="handleSessionListScrollState"
                          >
                            <template v-for="(record, index) in visibleGeneratingRecords" :key="record.id">
                              <div class="item-Xh64V7" :data-index="index * 2 + 1" style="z-index:1">
                                <GenerateAgentRecord
                                  v-if="record.type === 'agent' && record.agentRun"
                                  :run="record.agentRun"
                                  :error-text="formatGenerationError(record.error, '任务执行失败')"
                                  @stop="handleStopAgentExecution(record)"
                                />
                                <AgentLoadingRecord
                                  v-else-if="record.type === 'agent'"
                                  :prompt="record.prompt"
                                  :content="record.content"
                                  :done="record.done"
                                  :error="formatGenerationError(record.error, '对话生成失败')"
                                />
                                <ImageLoadingRecord
                                  v-else
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
                                  :error="formatGenerationError(record.error, '图片生成失败')"
                                  @preview="handlePreviewRecordImage(record, $event)"
                                  @stop="handleStopImageGeneration(record)"
                                />
                              </div>
                              <div
                                v-if="record.type === 'agent'"
                                class="item-Xh64V7"
                                :data-index="index * 2 + 2"
                                style="z-index:1"
                              >
                                <div class="responsive-container-msS_cP">
                                  <div class="content-DPogfx ai-generated-record-content-hg5EL8">
                                    <div class="group-title-mhd8yy">{{ record.time }}</div>
                                  </div>
                                </div>
                              </div>
                            </template>
                          </GenerateSessionList>
                          <ContentGenerator
                            ref="contentGeneratorRef"
                            :default-expanded="true"
                            @send="handleSend"
                          />
                          <div style=height:1px></div>
                        </div>
                      </div>
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

.main-content-G632JF.new-conversation-cz8zuh {
  align-items: center;
  display: flex;
  flex-direction: column;
}

.new-conversation-hero-canana {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.new-conversation-title-S9Fv1t {
  color: var(--text-primary, #fff);
  font-family: "Founder Yashi Black", var(--font-family, inherit);
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  margin: calc(40vh - 72px) 0 40px;
  text-align: center;
}

.new-conversation-subtitle-canana {
  color: var(--text-secondary, rgba(255, 255, 255, 0.64));
  font-size: 14px;
  line-height: 22px;
  margin: -28px 0 24px;
  text-align: center;
}
</style>
