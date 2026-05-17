<template>
  <AdminPageContainer title="会话列表" description="作为独立会话管理模块的首个页面，按用户维度统一管理全站创作会话，并查看会话下的生成记录明细。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" :disabled="loading || detailLoading" @click="loadSessions">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <div class="admin-grid admin-grid--stats">
      <AdminStatCard label="会话总数" :value="summary.totalCount" hint="当前筛选条件下命中的会话总数" />
      <AdminStatCard label="异常会话" :value="errorSessionCount" hint="包含失败记录的会话数量" />
      <AdminStatCard label="运行中" :value="runningSessionCount" hint="仍存在进行中记录的会话数量" />
      <AdminStatCard label="默认会话" :value="defaultSessionCount" hint="当前筛选结果中的默认会话数量" />
    </div>

    <AdminFilterToolbar
      title="筛选条件"
      description="按会话内容、用户与最近记录类型定位全站创作会话。"
      :active-count="activeFilterCount"
      :disabled="loading"
      show-reset
      show-apply
      reset-label="重置"
      apply-label="搜索"
      @reset="resetFilters"
      @apply="handleSearch"
    >
      <template #search>
        <div class="admin-conversations__search-row">
          <input
            v-model.trim="filters.keyword"
            class="admin-input"
            type="text"
            placeholder="搜索会话标题 / 会话 ID / 提示词 / 错误信息"
            :disabled="loading"
            @keydown.enter="handleSearch"
          >
          <input
            v-model.trim="filters.userKeyword"
            class="admin-input"
            type="text"
            placeholder="搜索用户 ID / 昵称 / 邮箱"
            :disabled="loading"
            @keydown.enter="handleSearch"
          >
        </div>
      </template>
      <template #filters>
        <AdminFilterChips :groups="filterChipGroups" :disabled="loading" @select="handleChipSelect" />
      </template>
      <template #meta>
        <span class="admin-skill-toolbar__summary">
          共 {{ summary.totalCount }} 个会话
          <em v-if="activeFilterCount">，已启用 {{ activeFilterCount }} 个筛选</em>
        </span>
      </template>
    </AdminFilterToolbar>

    <div class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">会话列表</h4>
          <div class="admin-card__desc">优先展示用户、最新记录、异常状态和最近活跃时间，方便快速定位具体会话。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div v-if="loading" class="admin-empty">正在加载会话列表...</div>
        <div v-else-if="sessions.length === 0" class="admin-empty">当前筛选条件下还没有会话记录。</div>
        <div v-else class="admin-conversation-list">
          <div class="admin-conversation-table">
            <div class="admin-conversation-table__head">
              <span>会话</span>
              <span>状态</span>
              <span>记录概览</span>
              <span>活跃时间</span>
              <span>操作</span>
            </div>

            <article v-for="session in sessions" :key="session.id" class="admin-conversation-row">
              <div class="admin-conversation-row__main">
                <div v-if="conversationSettings.listDisplay.showCoverImage" class="admin-conversation-row__preview">
                  <img
                    v-if="session.coverImageUrl"
                    :src="session.coverImageUrl"
                    :alt="session.title"
                    class="admin-conversation-row__image"
                  >
                  <div v-else class="admin-conversation-row__image admin-conversation-row__image--empty">
                    {{ getSessionFallbackText(session.title) }}
                  </div>
                </div>

                <div class="admin-conversation-row__identity">
                  <div class="admin-conversation-row__title-line">
                    <button class="admin-conversation-row__title" type="button" :disabled="detailLoading" @click="handleOpenDetail(session.id)">
                      {{ session.title || '未命名会话' }}
                    </button>
                    <span v-if="session.isDefault" class="admin-chip">默认</span>
                    <span v-if="session.latestRecord" class="admin-conversation-row__type">{{ getRecordTypeLabel(session.latestRecord.type) }}</span>
                  </div>

                  <div v-if="conversationSettings.listDisplay.showUserInfo" class="admin-conversation-row__user">
                    {{ formatUserName(session.user.name) || '未命名用户' }}
                    <template v-if="session.user.email"> · {{ formatUserEmail(session.user.email) }}</template>
                    <template v-if="session.user.id"> · {{ formatUserId(session.user.id) }}</template>
                  </div>

                  <div v-if="conversationSettings.listDisplay.showLatestPrompt" class="admin-conversation-row__prompt">
                    {{ session.latestRecord?.prompt || '当前会话下还没有生成记录。' }}
                  </div>

                  <div v-if="conversationSettings.listDisplay.showSessionId" class="admin-conversation-row__id">
                    ID {{ session.id }}
                  </div>
                </div>
              </div>

              <div class="admin-conversation-row__status">
                <span class="admin-status" :class="getSessionStatusClass(session)">
                  {{ getSessionStatusLabel(session) }}
                </span>
                <span v-if="session.latestRecord?.error" class="admin-conversation-row__error-dot">最近有错误</span>
              </div>

              <div class="admin-conversation-row__metrics">
                <div class="admin-conversation-metric">
                  <span class="admin-conversation-metric__value">{{ session.recordCount }}</span>
                  <span class="admin-conversation-metric__label">总记录</span>
                </div>
                <div v-if="conversationSettings.listDisplay.showStatusStats" class="admin-conversation-metric">
                  <span class="admin-conversation-metric__value">{{ session.completedRecordCount }}</span>
                  <span class="admin-conversation-metric__label">完成</span>
                </div>
                <div v-if="conversationSettings.listDisplay.showStatusStats" class="admin-conversation-metric" :class="{ 'is-danger': session.failedRecordCount > 0 }">
                  <span class="admin-conversation-metric__value">{{ session.failedRecordCount }}</span>
                  <span class="admin-conversation-metric__label">失败</span>
                </div>
                <div v-if="conversationSettings.listDisplay.showStatusStats" class="admin-conversation-metric" :class="{ 'is-warning': session.runningRecordCount > 0 }">
                  <span class="admin-conversation-metric__value">{{ session.runningRecordCount }}</span>
                  <span class="admin-conversation-metric__label">运行中</span>
                </div>
              </div>

              <div class="admin-conversation-row__activity">
                <span v-if="conversationSettings.listDisplay.showLastRecordTime">{{ formatDate(session.lastRecordAt || session.updatedAt) }}</span>
                <span v-else>{{ formatDate(session.updatedAt) }}</span>
                <small>创建 {{ formatDate(session.createdAt) }}</small>
              </div>

              <div class="admin-conversation-row__actions">
                <button class="admin-inline-button" type="button" :disabled="detailLoading" @click="handleOpenDetail(session.id)">
                  记录
                </button>
                <button class="admin-inline-button" type="button" :disabled="detailLoading || !conversationSettings.basicRules.allowAdminRename" @click="handleRename(session)">
                  重命名
                </button>
                <button
                  class="admin-inline-button admin-inline-button--danger"
                  type="button"
                  :disabled="detailLoading || !conversationSettings.basicRules.allowAdminDelete || (!conversationSettings.basicRules.allowDeleteDefaultSession && session.isDefault)"
                  @click="handleDelete(session)"
                >
                  删除
                </button>
              </div>
            </article>
          </div>

          <AdminPagination
            v-model:page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="summary.totalCount"
            :disabled="loading"
            @change="handlePaginationChange"
          />
        </div>
      </div>
    </div>

    <el-drawer
      v-model="detailVisible"
      title="会话详情"
      size="min(1080px, 92vw)"
      destroy-on-close
      class="admin-session-detail-drawer"
      @closed="handleClosedDetail"
    >
      <div v-if="selectedSession" class="admin-session-drawer">
        <section class="admin-session-drawer__hero">
          <div class="admin-session-drawer__profile">
            <div class="admin-session-drawer__title-row">
              <h3 class="admin-session-drawer__title">{{ selectedSession.title || '未命名会话' }}</h3>
              <span class="admin-status" :class="getSessionStatusClass(selectedSession)">
                {{ getSessionStatusLabel(selectedSession) }}
              </span>
              <span v-if="selectedSession.isDefault" class="admin-chip">默认会话</span>
            </div>

            <div class="admin-session-drawer__owner">
              <span>{{ formatUserName(selectedSession.user.name) || '未命名用户' }}</span>
              <span v-if="selectedSession.user.email">{{ formatUserEmail(selectedSession.user.email) }}</span>
              <span>{{ formatUserId(selectedSession.user.id) }}</span>
            </div>

            <div class="admin-session-drawer__meta-grid">
              <div>
                <span>会话 ID</span>
                <strong>{{ selectedSession.id }}</strong>
              </div>
              <div>
                <span>创建时间</span>
                <strong>{{ formatDate(selectedSession.createdAt) }}</strong>
              </div>
              <div>
                <span>最近活跃</span>
                <strong>{{ formatDate(selectedSession.lastRecordAt || selectedSession.updatedAt) }}</strong>
              </div>
            </div>
          </div>

          <div class="admin-session-drawer__stats-panel">
            <div class="admin-session-drawer__stat">
              <span>总记录</span>
              <strong>{{ selectedSession.recordCount }}</strong>
            </div>
            <div class="admin-session-drawer__stat">
              <span>完成</span>
              <strong>{{ selectedSession.completedRecordCount }}</strong>
            </div>
            <div class="admin-session-drawer__stat" :class="{ 'is-danger': selectedSession.failedRecordCount > 0 }">
              <span>失败</span>
              <strong>{{ selectedSession.failedRecordCount }}</strong>
            </div>
            <div class="admin-session-drawer__stat" :class="{ 'is-warning': selectedSession.runningRecordCount > 0 }">
              <span>运行中</span>
              <strong>{{ selectedSession.runningRecordCount }}</strong>
            </div>
          </div>
        </section>

        <div class="admin-card admin-card--drawer">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">会话记录</h4>
              <div class="admin-card__desc">按时间倒序展示生成记录、模型参数、输出数量与异常原因。</div>
            </div>
            <span class="admin-skill-toolbar__summary">共 {{ detailSummary.totalCount }} 条</span>
          </div>
          <div class="admin-card__content">
            <div v-if="detailLoading" class="admin-empty">正在加载会话记录...</div>
            <div v-else-if="detailRecords.length === 0" class="admin-empty">该会话下暂无生成记录。</div>
            <div v-else class="admin-session-record-list">
              <article v-for="record in detailRecords" :key="record.id" class="admin-session-record-card">
                <div class="admin-session-record-card__preview">
                  <img
                    v-if="getRecordPreviewUrl(record)"
                    :src="getRecordPreviewUrl(record) || ''"
                    :alt="record.prompt || '记录预览'"
                    class="admin-session-record-card__image"
                  >
                  <div v-else class="admin-session-record-card__image admin-session-record-card__image--empty">
                    {{ getRecordTypeLabel(record.type) }}
                  </div>
                </div>

                <div class="admin-session-record-card__body">
                  <div class="admin-session-record-card__head">
                    <div class="admin-session-record-card__identity">
                      <div class="admin-session-record-card__title">
                        {{ buildRecordTitle(record) }}
                      </div>
                      <div class="admin-session-record-card__meta">
                        {{ getRecordTypeLabel(record.type) }} · {{ formatDate(record.createdAt) }} · ID {{ record.id }}
                      </div>
                    </div>
                    <div class="admin-session-record-card__tags">
                      <span class="admin-status" :class="getRecordStatusClass(record)">
                        {{ getRecordStatusLabel(record) }}
                      </span>
                    </div>
                  </div>

                  <div class="admin-session-record-card__prompt">
                    {{ record.prompt || '暂无提示词' }}
                  </div>

                  <div class="admin-session-record-card__specs">
                    <div>
                      <span>模型</span>
                      <strong>{{ record.model || record.modelKey || '未记录' }}</strong>
                    </div>
                    <div>
                      <span>技能</span>
                      <strong>{{ record.skill || '未记录' }}</strong>
                    </div>
                    <div>
                      <span>比例</span>
                      <strong>{{ record.ratio || '未记录' }}</strong>
                    </div>
                    <div>
                      <span>输出</span>
                      <strong>{{ record.outputs.length || record.images.length }}</strong>
                    </div>
                  </div>

                  <div v-if="record.error" class="admin-session-record-card__error">
                    <span>错误信息</span>
                    <strong>{{ formatGenerationError(record.error, '任务执行失败') }}</strong>
                  </div>

                  <div v-else-if="record.content && record.type === 'agent'" class="admin-session-record-card__content-preview">
                    <div class="admin-session-record-card__content-head">
                      <span>文本结果</span>
                      <button
                        v-if="isLongRecordContent(record.content)"
                        class="admin-session-record-card__toggle"
                        type="button"
                        @click="toggleRecordContent(record.id)"
                      >
                        {{ expandedRecordContentMap[record.id] ? '收起' : '展开全文' }}
                      </button>
                    </div>
                    <strong :class="{ 'is-collapsed': isLongRecordContent(record.content) && !expandedRecordContentMap[record.id] }">
                      {{ record.content }}
                    </strong>
                  </div>
                </div>
              </article>

              <AdminPagination
                v-model:page="detailPagination.page"
                v-model:page-size="detailPagination.pageSize"
                :total="detailSummary.totalCount"
                :disabled="detailLoading"
                @change="handleDetailPaginationChange"
              />
            </div>
          </div>
        </div>
      </div>
    </el-drawer>

    <div v-if="renameDialogVisible" class="admin-dialog-mask admin-session-rename-mask" @click="closeRenameDialog">
      <div class="admin-dialog admin-session-rename-dialog" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">重命名会话</h3>
            <div class="admin-dialog__desc">调整后台展示与用户侧会话标题，保存后会同步刷新当前列表和详情。</div>
          </div>
          <button class="admin-dialog__close" type="button" :disabled="renameSubmitting" @click="closeRenameDialog">×</button>
        </div>
        <form class="admin-form admin-dialog__body" @submit.prevent="handleSubmitRename">
          <label class="admin-form__field">
            <span class="admin-form__label">会话名称</span>
            <input
              v-model.trim="renameTitle"
              class="admin-input"
              type="text"
              placeholder="请输入会话名称"
              :disabled="renameSubmitting"
              autofocus
            >
          </label>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" :disabled="renameSubmitting" @click="closeRenameDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="renameSubmitting || !renameTitle.trim()">
              {{ renameSubmitting ? '保存中...' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AdminFilterChips, { type AdminFilterChipGroup } from '@/components/admin/common/AdminFilterChips.vue'
import AdminFilterToolbar from '@/components/admin/common/AdminFilterToolbar.vue'
import AdminPagination from '@/components/admin/common/AdminPagination.vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { useAdminConfirm } from '@/composables/admin/useAdminConfirm'
import { useAdminListFilters } from '@/composables/useAdminListFilters'
import { useAdminPagination } from '@/composables/useAdminPagination'
import {
  createDefaultConversationSettings,
  getAdminConversationSettings,
  type ConversationSettingsConfig,
} from '@/api/admin-conversation-settings'
import {
  deleteAdminGenerationSession,
  getAdminGenerationSessionDetail,
  listAdminGenerationSessionRecords,
  listAdminGenerationSessions,
  updateAdminGenerationSession,
  type AdminGenerationSessionItem,
  type AdminGenerationSessionStatus,
  type AdminGenerationSessionType,
  type AdminSessionRecordItem,
} from '@/api/admin-generation-sessions'
import { normalizeGenerationErrorMessage } from '@/shared/generation-error'

const loading = ref(false)
const detailLoading = ref(false)
const sessions = ref<AdminGenerationSessionItem[]>([])
const { confirmDanger } = useAdminConfirm()
const formatGenerationError = (message?: string | null, fallback = '任务执行失败') => {
  return normalizeGenerationErrorMessage(String(message || '').trim(), fallback)
}
const conversationSettings = reactive<ConversationSettingsConfig>(createDefaultConversationSettings())
const summary = reactive({
  totalCount: 0,
  totalPages: 1,
  page: 1,
  pageSize: 12,
})

const filters = reactive<{
  keyword: string
  userKeyword: string
  status: AdminGenerationSessionStatus
  type: AdminGenerationSessionType
}>({
  keyword: '',
  userKeyword: '',
  status: 'ALL',
  type: 'ALL',
})

const filterDefaults = {
  keyword: '',
  userKeyword: '',
  status: 'ALL' as AdminGenerationSessionStatus,
  type: 'ALL' as AdminGenerationSessionType,
}

const { activeFilterCount, resetFilters: resetFilterValues } = useAdminListFilters({
  filters,
  defaults: filterDefaults,
})

const { pagination } = useAdminPagination({
  initialPageSize: 12,
})

const detailVisible = ref(false)
const selectedSession = ref<AdminGenerationSessionItem | null>(null)
const detailRecords = ref<AdminSessionRecordItem[]>([])
const expandedRecordContentMap = reactive<Record<string, boolean>>({})
const renameDialogVisible = ref(false)
const renameSubmitting = ref(false)
const renamingSession = ref<AdminGenerationSessionItem | null>(null)
const renameTitle = ref('')
const detailSummary = reactive({
  totalCount: 0,
  totalPages: 1,
  page: 1,
  pageSize: 10,
})
const detailPagination = reactive({
  page: 1,
  pageSize: 10,
})

const statusOptions: Array<{ label: string; value: AdminGenerationSessionStatus }> = [
  { label: '全部状态', value: 'ALL' },
  { label: '异常会话', value: 'HAS_ERROR' },
  { label: '运行中', value: 'RUNNING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '空会话', value: 'EMPTY' },
]

const typeOptions: Array<{ label: string; value: AdminGenerationSessionType }> = [
  { label: '全部类型', value: 'ALL' },
  { label: '图片', value: 'IMAGE' },
  { label: '视频', value: 'VIDEO' },
  { label: '智能体', value: 'AGENT' },
  { label: '数字人', value: 'DIGITAL_HUMAN' },
  { label: '动态内容', value: 'MOTION' },
]

const filterChipGroups = computed((): AdminFilterChipGroup[] => [
  {
    key: 'status',
    label: '会话状态',
    modelValue: filters.status,
    options: statusOptions,
  },
  {
    key: 'type',
    label: '最近类型',
    modelValue: filters.type,
    options: typeOptions,
  },
])

const errorSessionCount = computed(() => sessions.value.filter(session => session.failedRecordCount > 0).length)
const runningSessionCount = computed(() => sessions.value.filter(session => session.runningRecordCount > 0).length)
const defaultSessionCount = computed(() => sessions.value.filter(session => session.isDefault).length)

const applyConversationSettings = (value?: ConversationSettingsConfig | null) => {
  const nextValue = value || createDefaultConversationSettings()
  Object.assign(conversationSettings.basicRules, nextValue.basicRules)
  Object.assign(conversationSettings.listDisplay, nextValue.listDisplay)
  Object.assign(conversationSettings.entryDisplay.hero, nextValue.entryDisplay.hero)
  Object.assign(conversationSettings.entryDisplay.workbench, nextValue.entryDisplay.workbench)
  Object.assign(conversationSettings.entryDisplay.input, nextValue.entryDisplay.input)
  Object.assign(conversationSettings.entryDisplay.mode, {
    ...nextValue.entryDisplay.mode,
    options: nextValue.entryDisplay.mode.options.map(item => ({ ...item })),
  })
  Object.assign(conversationSettings.entryDisplay.modelSelector, {
    ...nextValue.entryDisplay.modelSelector,
    allowedModelKeys: [...nextValue.entryDisplay.modelSelector.allowedModelKeys],
  })
  Object.assign(conversationSettings.entryDisplay.assistantSelector, {
    ...nextValue.entryDisplay.assistantSelector,
    allowedAssistantKeys: [...nextValue.entryDisplay.assistantSelector.allowedAssistantKeys],
  })
  Object.assign(conversationSettings.entryDisplay.actions.auto, nextValue.entryDisplay.actions.auto)
  Object.assign(conversationSettings.entryDisplay.actions.inspiration, nextValue.entryDisplay.actions.inspiration)
  Object.assign(conversationSettings.entryDisplay.actions.creativeDesign, nextValue.entryDisplay.actions.creativeDesign)
  Object.assign(conversationSettings.managementPolicy, nextValue.managementPolicy)
}

const loadConversationSettings = async () => {
  try {
    const result = await getAdminConversationSettings()
    applyConversationSettings(result?.conversationSettings)
    pagination.pageSize = Number(result?.conversationSettings?.listDisplay?.defaultPageSize || pagination.pageSize)
  } catch {
    applyConversationSettings(createDefaultConversationSettings())
  }
}

const loadSessions = async () => {
  loading.value = true
  try {
    const result = await listAdminGenerationSessions({
      ...filters,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    sessions.value = result.items
    summary.totalCount = Number(result.summary?.totalCount || 0)
    summary.totalPages = Number(result.summary?.totalPages || 1)
    summary.page = Number(result.summary?.page || pagination.page)
    summary.pageSize = Number(result.summary?.pageSize || pagination.pageSize)
    pagination.page = summary.page
    pagination.pageSize = summary.pageSize
  } finally {
    loading.value = false
  }
}

const loadSessionDetail = async (sessionId: string) => {
  detailLoading.value = true
  try {
    const [sessionDetail, recordsResult] = await Promise.all([
      getAdminGenerationSessionDetail(sessionId),
      listAdminGenerationSessionRecords(sessionId, detailPagination.page, detailPagination.pageSize),
    ])
    selectedSession.value = sessionDetail
    detailRecords.value = recordsResult.items
    detailSummary.totalCount = Number(recordsResult.summary?.totalCount || 0)
    detailSummary.totalPages = Number(recordsResult.summary?.totalPages || 1)
    detailSummary.page = Number(recordsResult.summary?.page || detailPagination.page)
    detailSummary.pageSize = Number(recordsResult.summary?.pageSize || detailPagination.pageSize)
    detailPagination.page = detailSummary.page
    detailPagination.pageSize = detailSummary.pageSize
  } finally {
    detailLoading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  void loadSessions()
}

const handleChipSelect = (payload: { groupKey: string; value: string }) => {
  if (payload.groupKey === 'status') {
    filters.status = payload.value as AdminGenerationSessionStatus
  }

  if (payload.groupKey === 'type') {
    filters.type = payload.value as AdminGenerationSessionType
  }

  pagination.page = 1
  void loadSessions()
}

const handlePaginationChange = (payload: { page: number; pageSize: number }) => {
  pagination.page = payload.page
  pagination.pageSize = payload.pageSize
  void loadSessions()
}

const resetFilters = () => {
  resetFilterValues()
  pagination.page = 1
  void loadSessions()
}

const handleOpenDetail = async (sessionId: string) => {
  detailVisible.value = true
  detailPagination.page = 1
  await loadSessionDetail(sessionId)
}

const handleCloseDetail = () => {
  detailVisible.value = false
}

const handleClosedDetail = () => {
  selectedSession.value = null
  detailRecords.value = []
  detailPagination.page = 1
  Object.keys(expandedRecordContentMap).forEach((recordId) => {
    delete expandedRecordContentMap[recordId]
  })
}

const handleDetailPaginationChange = (payload: { page: number; pageSize: number }) => {
  detailPagination.page = payload.page
  detailPagination.pageSize = payload.pageSize
  if (selectedSession.value?.id) {
    void loadSessionDetail(selectedSession.value.id)
  }
}

const handleRename = async (session: AdminGenerationSessionItem) => {
  if (!conversationSettings.basicRules.allowAdminRename) {
    return
  }

  renamingSession.value = session
  renameTitle.value = session.title || ''
  renameDialogVisible.value = true
}

const closeRenameDialog = () => {
  if (renameSubmitting.value) {
    return
  }
  renameDialogVisible.value = false
  renamingSession.value = null
  renameTitle.value = ''
}

const handleSubmitRename = async () => {
  const session = renamingSession.value
  const nextTitle = renameTitle.value.trim()
  if (!session || !nextTitle) {
    return
  }

  renameSubmitting.value = true
  try {
    await updateAdminGenerationSession(session.id, nextTitle)
    await loadSessions()

    if (selectedSession.value?.id === session.id) {
      await loadSessionDetail(session.id)
    }

  } finally {
    renameSubmitting.value = false
  }

  closeRenameDialog()
}

const handleDelete = async (session: AdminGenerationSessionItem) => {
  if (!conversationSettings.basicRules.allowAdminDelete) {
    return
  }

  await confirmDanger({
    title: '删除会话',
    message: `确定删除会话“${session.title}”吗？该会话下的生成记录也会一并移除。`,
    confirmText: '确定删除',
  })

  await deleteAdminGenerationSession(session.id)

  if (selectedSession.value?.id === session.id) {
    handleCloseDetail()
  }

  await loadSessions()
}

const formatDate = (value?: string) => {
  if (!value) {
    return '未记录'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '未记录'
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  })
}

const maskMiddle = (value: string, left = 2, right = 2) => {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue.length <= left + right) {
    return `${normalizedValue.slice(0, 1)}***`
  }

  return `${normalizedValue.slice(0, left)}***${normalizedValue.slice(-right)}`
}

const formatUserName = (value?: string) => {
  const normalizedValue = String(value || '').trim()
  if (!conversationSettings.listDisplay.enableUserMasking) {
    return normalizedValue
  }

  return maskMiddle(normalizedValue, 1, 1)
}

const formatUserEmail = (value?: string) => {
  const normalizedValue = String(value || '').trim()
  if (!conversationSettings.listDisplay.enableUserMasking) {
    return normalizedValue
  }

  const [prefix, domain] = normalizedValue.split('@')
  if (!domain) {
    return maskMiddle(normalizedValue, 1, 1)
  }

  return `${maskMiddle(prefix, 1, 1)}@${domain}`
}

const formatUserId = (value?: string) => {
  const normalizedValue = String(value || '').trim()
  if (!conversationSettings.listDisplay.enableUserMasking) {
    return normalizedValue
  }

  return maskMiddle(normalizedValue, 4, 4)
}

const getSessionStatusLabel = (session: AdminGenerationSessionItem) => {
  if (session.recordCount === 0) {
    return '空会话'
  }
  if (session.failedRecordCount > 0) {
    return '存在异常'
  }
  if (session.runningRecordCount > 0) {
    return '运行中'
  }
  return '已完成'
}

const getSessionStatusClass = (session: AdminGenerationSessionItem) => {
  if (session.recordCount === 0) {
    return 'admin-status--warning'
  }
  if (session.failedRecordCount > 0) {
    return 'admin-status--danger'
  }
  if (session.runningRecordCount > 0) {
    return 'admin-status--warning'
  }
  return 'admin-status--success'
}

const getSessionFallbackText = (title: string) => {
  const normalizedTitle = String(title || '').trim()
  return normalizedTitle.slice(0, 2) || '会话'
}

const getRecordPreviewUrl = (record: AdminSessionRecordItem) => {
  return record.images?.[0] || record.outputs.find(output => output.outputType === 'image' && output.url)?.url || ''
}

const getRecordTypeLabel = (type: string) => {
  const normalizedType = String(type || '').trim()
  if (normalizedType === 'image') return '图片'
  if (normalizedType === 'video') return '视频'
  if (normalizedType === 'agent') return '智能体'
  if (normalizedType === 'digital-human') return '数字人'
  if (normalizedType === 'motion') return '动态内容'
  return normalizedType || '未知类型'
}

const getRecordStatusLabel = (record: AdminSessionRecordItem) => {
  if (record.error) return '失败'
  if (record.stopped) return '已停止'
  if (record.done) return '已完成'
  return '进行中'
}

const getRecordStatusClass = (record: AdminSessionRecordItem) => {
  if (record.error) return 'admin-status--danger'
  if (record.stopped) return 'admin-status--warning'
  if (record.done) return 'admin-status--success'
  return 'admin-status--warning'
}

const buildRecordTitle = (record: AdminSessionRecordItem) => {
  return record.prompt?.trim() || `${getRecordTypeLabel(record.type)}记录`
}

const isLongRecordContent = (value?: string | null) => {
  return String(value || '').trim().length > 180
}

const toggleRecordContent = (recordId: string) => {
  expandedRecordContentMap[recordId] = !expandedRecordContentMap[recordId]
}

onMounted(() => {
  void (async () => {
    await loadConversationSettings()
    await loadSessions()
  })()
})
</script>

<style scoped>
:deep(.admin-session-detail-drawer .el-drawer) {
  background: var(--bg-surface);
  color: var(--text-primary);
}

:deep(.admin-session-detail-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--line-divider, #00000014);
  background: color-mix(in srgb, var(--bg-surface) 94%, var(--bg-block-secondary-default));
}

:deep(.admin-session-detail-drawer .el-drawer__title) {
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 600;
}

:deep(.admin-session-detail-drawer .el-drawer__close-btn) {
  color: var(--text-secondary);
}

:deep(.admin-session-detail-drawer .el-drawer__close-btn:hover) {
  color: var(--text-primary);
}

:deep(.admin-session-detail-drawer .el-drawer__body) {
  padding: 20px;
  background: var(--bg-surface);
}

.admin-conversations__search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 300px);
  gap: 12px;
}

.admin-conversation-list,
.admin-session-record-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-conversation-table {
  display: grid;
  gap: 8px;
}

.admin-conversation-table__head,
.admin-conversation-row {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) 128px minmax(220px, 0.7fr) 190px 172px;
  gap: 16px;
  align-items: center;
}

.admin-conversation-table__head {
  min-height: 38px;
  padding: 0 16px;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
}

.admin-conversation-row {
  min-height: 112px;
  padding: 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-surface) 92%, var(--bg-block-secondary-default));
  transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
}

.admin-conversation-row:hover {
  border-color: color-mix(in srgb, var(--brand-main-default) 24%, var(--line-divider, #00000014));
  background: color-mix(in srgb, var(--bg-surface) 96%, var(--bg-block-secondary-default));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.admin-conversation-row__main {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: 14px;
}

.admin-conversation-row__preview {
  flex: 0 0 72px;
}

.admin-conversation-row__image {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--line-divider, #00000014);
  background: color-mix(in srgb, var(--bg-block-secondary-default) 84%, transparent);
}

.admin-conversation-row__image--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.admin-conversation-row__identity {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.admin-conversation-row__title-line {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.admin-conversation-row__title {
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-conversation-row__title:hover {
  color: var(--brand-main-default);
}

.admin-conversation-row__type {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 12px;
}

.admin-conversation-row__user,
.admin-conversation-row__id,
.admin-conversation-row__activity,
.admin-conversation-row__error-dot {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.admin-conversation-row__user,
.admin-conversation-row__id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-conversation-row__prompt {
  display: -webkit-box;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.55;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.admin-conversation-row__status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.admin-conversation-row__error-dot {
  color: #dc2626;
  font-weight: 600;
}

.admin-conversation-row__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(44px, 1fr));
  gap: 8px;
}

.admin-conversation-metric {
  min-width: 0;
  padding: 8px 6px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-block-secondary-default) 72%, transparent);
  text-align: center;
}

.admin-conversation-metric.is-danger {
  background: color-mix(in srgb, #ff5f57 12%, var(--bg-block-secondary-default));
}

.admin-conversation-metric.is-warning {
  background: color-mix(in srgb, #f59e0b 12%, var(--bg-block-secondary-default));
}

.admin-conversation-metric__value {
  display: block;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
}

.admin-conversation-metric__label {
  display: block;
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
}

.admin-conversation-row__activity {
  display: grid;
  gap: 4px;
}

.admin-conversation-row__activity span {
  color: var(--text-primary);
  font-weight: 600;
}

.admin-conversation-row__activity small {
  color: var(--text-tertiary);
  font-size: 12px;
}

.admin-conversation-row__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.admin-session-record-card {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-surface) 94%, var(--bg-block-secondary-default));
}

.admin-session-record-card__preview {
  display: flex;
  align-items: stretch;
}

.admin-session-record-card__image {
  width: 100%;
  height: 112px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--line-divider, #00000014);
  background: color-mix(in srgb, var(--bg-block-secondary-default) 84%, transparent);
}

.admin-session-record-card__image--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.admin-session-record-card__body {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.admin-session-record-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.admin-session-record-card__identity {
  min-width: 0;
}

.admin-session-drawer__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-session-record-card__title,
.admin-session-drawer__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  word-break: break-word;
}

.admin-session-record-card__meta,
.admin-session-drawer__meta,
.admin-session-drawer__owner {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.admin-session-record-card__tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.admin-session-record-card__prompt {
  display: -webkit-box;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.65;
  overflow: hidden;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.admin-session-record-card__specs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.admin-session-record-card__specs div,
.admin-session-drawer__meta-grid div,
.admin-session-drawer__stat {
  min-width: 0;
  padding: 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-block-secondary-default) 70%, transparent);
}

.admin-session-record-card__specs span,
.admin-session-drawer__meta-grid span,
.admin-session-drawer__stat span {
  display: block;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.3;
}

.admin-session-record-card__specs strong,
.admin-session-drawer__meta-grid strong,
.admin-session-drawer__stat strong {
  display: block;
  margin-top: 4px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-session-record-card__error,
.admin-session-record-card__content-preview {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
}

.admin-session-record-card__error {
  background: color-mix(in srgb, #ff5f57 12%, transparent);
  color: var(--text-primary);
}

.admin-session-record-card__content-preview {
  background: color-mix(in srgb, var(--brand-primary) 8%, transparent);
  color: var(--text-primary);
}

.admin-session-record-card__error span,
.admin-session-record-card__content-preview span {
  display: block;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
}

.admin-session-record-card__error strong,
.admin-session-record-card__content-preview strong {
  display: block;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.admin-session-record-card__content-preview strong.is-collapsed {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.admin-session-record-card__content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.admin-session-record-card__toggle {
  border: none;
  padding: 0;
  background: transparent;
  color: var(--brand-main-default);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.admin-session-record-card__toggle:hover {
  text-decoration: underline;
}

.admin-session-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-primary);
}

.admin-session-drawer__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: stretch;
}

.admin-session-drawer__profile,
.admin-session-drawer__stats-panel {
  padding: 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-surface) 94%, var(--bg-block-secondary-default));
}

.admin-session-drawer__profile {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.admin-session-drawer__owner {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.admin-session-drawer__meta-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.admin-session-drawer__stats-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.admin-session-drawer__stat strong {
  font-size: 24px;
  line-height: 1.1;
}

.admin-session-drawer__stat.is-danger {
  background: color-mix(in srgb, #ff5f57 12%, var(--bg-block-secondary-default));
}

.admin-session-drawer__stat.is-warning {
  background: color-mix(in srgb, #f59e0b 12%, var(--bg-block-secondary-default));
}

.admin-card--drawer {
  box-shadow: none;
  background: color-mix(in srgb, var(--bg-surface) 94%, var(--bg-block-secondary-default));
}

.admin-session-rename-mask {
  z-index: 3000;
}

.admin-session-rename-dialog {
  width: min(520px, 100%);
}

@media (max-width: 960px) {
  .admin-conversations__search-row {
    grid-template-columns: 1fr;
  }

  .admin-conversation-table__head {
    display: none;
  }

  .admin-conversation-row {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .admin-conversation-row__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-conversation-row__actions {
    justify-content: flex-start;
  }

  .admin-session-record-card {
    grid-template-columns: 1fr;
  }

  .admin-session-record-card__head {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-session-drawer__hero,
  .admin-session-drawer__meta-grid,
  .admin-session-record-card__specs {
    grid-template-columns: 1fr;
  }

  .admin-session-drawer__stats-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) and (min-width: 961px) {
  .admin-conversation-table__head,
  .admin-conversation-row {
    grid-template-columns: minmax(280px, 1fr) 116px minmax(180px, 0.65fr) 172px;
  }

  .admin-conversation-table__head span:last-child,
  .admin-conversation-row__actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}
</style>
