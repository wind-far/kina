/**
 * 画布助手会话状态（接入服务端 generation-sessions API + source 隔离）
 *
 * - 通过 source='canvas-assistant' 与 /generate 物理隔离会话列表与默认会话
 * - localStorage 持久化 active session id，刷新后自动恢复上次选中
 * - 模块级单例（与 useChatSessions / useWorkflowCanvas 风格一致），多个组件共享同一份会话状态
 */
import { computed, ref, type Ref } from 'vue'
import {
  listGenerationSessions,
  createGenerationSession,
  updateGenerationSession,
  deleteGenerationSession,
  type PersistedGenerationSession,
} from '@/api/generation-sessions'
import { CANVAS_ASSISTANT_SOURCE } from '@/shared/canvas-assistant-session'

interface AssistantSessionState {
  sessions: Ref<PersistedGenerationSession[]>
  activeSessionId: Ref<string>
  isLoading: Ref<boolean>
  isInitialized: Ref<boolean>
}

const stateBySource = new Map<string, AssistantSessionState>()

const normalizeAssistantSource = (source?: string | null) => String(source || '').trim().slice(0, 64) || CANVAS_ASSISTANT_SOURCE

const getAssistantSessionState = (source: string): AssistantSessionState => {
  const existing = stateBySource.get(source)
  if (existing) return existing
  const created: AssistantSessionState = {
    sessions: ref<PersistedGenerationSession[]>([]),
    activeSessionId: ref(''),
    isLoading: ref(false),
    isInitialized: ref(false),
  }
  stateBySource.set(source, created)
  return created
}

const readPersistedActiveId = (source: string): string => {
  try {
    return localStorage.getItem(`${source}_active_session_id`) || ''
  } catch {
    return ''
  }
}

const writePersistedActiveId = (source: string, id: string) => {
  try {
    if (id) {
      localStorage.setItem(`${source}_active_session_id`, id)
    } else {
      localStorage.removeItem(`${source}_active_session_id`)
    }
  } catch {
    // ignore (隐私模式 / quota 等)
  }
}

const pickFallbackSessionId = (list: PersistedGenerationSession[]): string => {
  if (!list.length) return ''
  const def = list.find((s) => s.isDefault)
  return (def || list[0]).id
}

const syncActiveAgainstList = (state: AssistantSessionState, source: string, list: PersistedGenerationSession[]) => {
  const persisted = readPersistedActiveId(source)
  const matchedId = persisted && list.some((s) => s.id === persisted) ? persisted : pickFallbackSessionId(list)
  state.activeSessionId.value = matchedId
  if (matchedId) writePersistedActiveId(source, matchedId)
}

export function useAssistantSessions(source?: string | null) {
  const ASSISTANT_SOURCE = normalizeAssistantSource(source)
  const state = getAssistantSessionState(ASSISTANT_SOURCE)
  const { sessions, activeSessionId, isLoading, isInitialized } = state
  const activeSession = computed<PersistedGenerationSession | null>(
    () => sessions.value.find((s) => s.id === activeSessionId.value) || null,
  )

  const loadSessions = async (force = false) => {
    if (isLoading.value) return
    if (isInitialized.value && !force) return
    isLoading.value = true
    try {
      const list = await listGenerationSessions(ASSISTANT_SOURCE)
      sessions.value = Array.isArray(list) ? list : []
      syncActiveAgainstList(state, ASSISTANT_SOURCE, sessions.value)
      isInitialized.value = true
    } finally {
      isLoading.value = false
    }
  }

  const createNewSession = async (title?: string) => {
    const created = await createGenerationSession({ source: ASSISTANT_SOURCE, title })
    sessions.value = [created, ...sessions.value.filter((s) => s.id !== created.id)]
    activeSessionId.value = created.id
    writePersistedActiveId(ASSISTANT_SOURCE, created.id)
    return created
  }

  const renameSessionTitle = async (id: string, title: string) => {
    const trimmed = String(title || '').trim()
    if (!trimmed) return
    const updated = await updateGenerationSession(id, { title: trimmed })
    sessions.value = sessions.value.map((s) => (s.id === id ? updated : s))
    return updated
  }

  const removeSessionById = async (id: string) => {
    const target = sessions.value.find((s) => s.id === id)
    if (target?.isDefault) {
      throw new Error('默认会话不允许删除')
    }
    await deleteGenerationSession(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (activeSessionId.value === id) {
      const next = pickFallbackSessionId(sessions.value)
      activeSessionId.value = next
      writePersistedActiveId(ASSISTANT_SOURCE, next)
    }
  }

  const setActive = (id: string) => {
    if (!id) return
    if (!sessions.value.some((s) => s.id === id)) return
    activeSessionId.value = id
    writePersistedActiveId(ASSISTANT_SOURCE, id)
  }

  // 给上层调：发消息前确保有一个会话；没有就走默认（loadSessions 兜底已建过）
  const ensureSession = async (): Promise<string> => {
    if (!isInitialized.value) await loadSessions()
    if (activeSessionId.value) return activeSessionId.value
    if (!sessions.value.length) {
      // 极端兜底：本地没有，主动建一条
      const created = await createNewSession()
      return created.id
    }
    const next = pickFallbackSessionId(sessions.value)
    activeSessionId.value = next
    writePersistedActiveId(ASSISTANT_SOURCE, next)
    return next
  }

  return {
    sessions,
    activeSession,
    activeSessionId,
    isLoading,
    loadSessions,
    createNewSession,
    renameSessionTitle,
    removeSessionById,
    setActive,
    ensureSession,
    ASSISTANT_SOURCE,
  }
}
