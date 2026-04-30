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

    <AdminFilterToolbar>
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
      <template #actions>
        <button class="admin-button admin-button--secondary" type="button" :disabled="loading" @click="resetFilters">重置</button>
        <button class="admin-button admin-button--primary" type="button" :disabled="loading" @click="handleSearch">搜索</button>
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
          <div v-for="session in sessions" :key="session.id" class="admin-conversation-card">
            <div class="admin-conversation-card__preview">
              <img
                v-if="session.coverImageUrl"
                :src="session.coverImageUrl"
                :alt="session.title"
                class="admin-conversation-card__image"
              >
              <div v-else class="admin-conversation-card__image admin-conversation-card__image--empty">
                {{ getSessionFallbackText(session.title) }}
              </div>
            </div>

            <div class="admin-conversation-card__body">
              <div class="admin-conversation-card__head">
                <div>
                  <div class="admin-conversation-card__title-row">
                    <span class="admin-conversation-card__title">{{ session.title || '未命名会话' }}</span>
                    <span v-if="session.isDefault" class="admin-chip">默认会话</span>
                  </div>
                  <div class="admin-conversation-card__meta">
                    用户：{{ session.user.name || '未命名用户' }}
                    <template v-if="session.user.email">（{{ session.user.email }}）</template>
                    · 用户 ID：{{ session.user.id }}
                  </div>
                </div>
                <div class="admin-conversation-card__tags">
                  <span class="admin-status" :class="getSessionStatusClass(session)">
                    {{ getSessionStatusLabel(session) }}
                  </span>
                  <span class="admin-chip">记录 {{ session.recordCount }}</span>
                </div>
              </div>

              <div class="admin-conversation-card__prompt">
                {{ session.latestRecord?.prompt || '当前会话下还没有生成记录。' }}
              </div>

              <div class="admin-conversation-card__stats">
                <span>完成：{{ session.completedRecordCount }}</span>
                <span>失败：{{ session.failedRecordCount }}</span>
                <span>进行中：{{ session.runningRecordCount }}</span>
                <span>最近活跃：{{ formatDate(session.lastRecordAt || session.updatedAt) }}</span>
              </div>

              <div v-if="session.latestRecord?.error" class="admin-conversation-card__error">
                <strong>最近错误：</strong>{{ session.latestRecord.error }}
              </div>

              <div class="admin-conversation-card__footer">
                <div class="admin-conversation-card__meta">
                  会话 ID：{{ session.id }}
                </div>
                <div class="admin-list-item__actions">
                  <button class="admin-inline-button" type="button" :disabled="detailLoading" @click="handleOpenDetail(session.id)">
                    查看记录
                  </button>
                  <button class="admin-inline-button" type="button" :disabled="detailLoading" @click="handleRename(session)">
                    重命名
                  </button>
                  <button
                    class="admin-inline-button admin-inline-button--danger"
                    type="button"
                    :disabled="detailLoading || session.isDefault"
                    @click="handleDelete(session)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
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
      size="860px"
      destroy-on-close
      class="admin-session-detail-drawer"
      @closed="handleClosedDetail"
    >
      <div v-if="selectedSession" class="admin-session-drawer">
        <div class="admin-session-drawer__summary">
          <div class="admin-session-drawer__summary-main">
            <div class="admin-session-drawer__title-row">
              <h3 class="admin-session-drawer__title">{{ selectedSession.title || '未命名会话' }}</h3>
              <span v-if="selectedSession.isDefault" class="admin-chip">默认会话</span>
            </div>
            <div class="admin-session-drawer__meta">
              用户：{{ selectedSession.user.name || '未命名用户' }}
              <template v-if="selectedSession.user.email">（{{ selectedSession.user.email }}）</template>
              · 用户 ID：{{ selectedSession.user.id }}
            </div>
            <div class="admin-session-drawer__meta">
              创建时间：{{ formatDate(selectedSession.createdAt) }} · 最近活跃：{{ formatDate(selectedSession.lastRecordAt || selectedSession.updatedAt) }}
            </div>
          </div>
          <div class="admin-session-drawer__summary-stats">
            <span class="admin-chip">记录 {{ selectedSession.recordCount }}</span>
            <span class="admin-chip">完成 {{ selectedSession.completedRecordCount }}</span>
            <span class="admin-chip">失败 {{ selectedSession.failedRecordCount }}</span>
            <span class="admin-chip">运行中 {{ selectedSession.runningRecordCount }}</span>
          </div>
        </div>

        <div class="admin-card admin-card--drawer">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">会话记录</h4>
              <div class="admin-card__desc">展示该会话下的生成记录、模型、输出结果与错误详情。</div>
            </div>
          </div>
          <div class="admin-card__content">
            <div v-if="detailLoading" class="admin-empty">正在加载会话记录...</div>
            <div v-else-if="detailRecords.length === 0" class="admin-empty">该会话下暂无生成记录。</div>
            <div v-else class="admin-session-record-list">
              <div v-for="record in detailRecords" :key="record.id" class="admin-session-record-card">
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
                    <div>
                      <div class="admin-session-record-card__title">
                        {{ buildRecordTitle(record) }}
                      </div>
                      <div class="admin-session-record-card__meta">
                        类型：{{ getRecordTypeLabel(record.type) }} · 创建于 {{ formatDate(record.createdAt) }}
                      </div>
                    </div>
                    <div class="admin-session-record-card__tags">
                      <span class="admin-status" :class="getRecordStatusClass(record)">
                        {{ getRecordStatusLabel(record) }}
                      </span>
                    </div>
                  </div>

                  <div class="admin-session-record-card__prompt">{{ record.prompt || '暂无提示词' }}</div>

                  <div class="admin-session-record-card__stats">
                    <span>模型：{{ record.model || record.modelKey || '未记录' }}</span>
                    <span>技能：{{ record.skill || '未记录' }}</span>
                    <span>比例：{{ record.ratio || '未记录' }}</span>
                    <span>输出：{{ record.outputs.length || record.images.length }}</span>
                  </div>

                  <div v-if="record.error" class="admin-session-record-card__error">
                    <strong>错误信息：</strong>{{ record.error }}
                  </div>

                  <div v-else-if="record.content && record.type === 'agent'" class="admin-session-record-card__content-preview">
                    <strong>文本结果：</strong>{{ record.content }}
                  </div>

                  <div class="admin-session-record-card__meta">
                    记录 ID：{{ record.id }}
                  </div>
                </div>
              </div>

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
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import AdminFilterChips, { type AdminFilterChipGroup } from '@/components/admin/common/AdminFilterChips.vue'
import AdminFilterToolbar from '@/components/admin/common/AdminFilterToolbar.vue'
import AdminPagination from '@/components/admin/common/AdminPagination.vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { useAdminListFilters } from '@/composables/useAdminListFilters'
import { useAdminPagination } from '@/composables/useAdminPagination'
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

const loading = ref(false)
const detailLoading = ref(false)
const sessions = ref<AdminGenerationSessionItem[]>([])
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
}

const handleDetailPaginationChange = (payload: { page: number; pageSize: number }) => {
  detailPagination.page = payload.page
  detailPagination.pageSize = payload.pageSize
  if (selectedSession.value?.id) {
    void loadSessionDetail(selectedSession.value.id)
  }
}

const handleRename = async (session: AdminGenerationSessionItem) => {
  const { value } = await ElMessageBox.prompt('请输入新的会话名称', '重命名会话', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: session.title,
    inputPlaceholder: '请输入会话名称',
    inputValidator: (inputValue) => {
      return String(inputValue || '').trim() ? true : '会话名称不能为空'
    },
  })

  await updateAdminGenerationSession(session.id, String(value || '').trim())
  await loadSessions()

  if (selectedSession.value?.id === session.id) {
    await loadSessionDetail(session.id)
  }
}

const handleDelete = async (session: AdminGenerationSessionItem) => {
  await ElMessageBox.confirm(
    `确定删除会话“${session.title}”吗？该会话下的生成记录也会一并移除。`,
    '删除会话',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    },
  )

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

onMounted(() => {
  void loadSessions()
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
  padding: 24px;
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

.admin-conversation-card,
.admin-session-record-card {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg-surface) 90%, var(--bg-block-secondary-default));
}

.admin-conversation-card__preview,
.admin-session-record-card__preview {
  display: flex;
  align-items: stretch;
}

.admin-conversation-card__image,
.admin-session-record-card__image {
  width: 100%;
  height: 96px;
  object-fit: cover;
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-block-secondary-default) 84%, transparent);
}

.admin-conversation-card__image--empty,
.admin-session-record-card__image--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.admin-conversation-card__body,
.admin-session-record-card__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.admin-conversation-card__head,
.admin-session-record-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.admin-conversation-card__title-row,
.admin-session-drawer__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-conversation-card__title,
.admin-session-record-card__title,
.admin-session-drawer__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-word;
}

.admin-conversation-card__meta,
.admin-session-record-card__meta,
.admin-session-drawer__meta {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.admin-conversation-card__tags,
.admin-session-record-card__tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.admin-conversation-card__prompt,
.admin-session-record-card__prompt {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}

.admin-conversation-card__stats,
.admin-session-record-card__stats,
.admin-session-drawer__summary-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.admin-conversation-card__error,
.admin-session-record-card__error {
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, #ff5f57 12%, transparent);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.7;
}

.admin-session-record-card__content-preview {
  padding: 10px 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--brand-primary) 8%, transparent);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.7;
}

.admin-conversation-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-session-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-primary);
}

.admin-session-drawer__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg-surface) 92%, var(--bg-block-secondary-default));
}

.admin-session-drawer__summary-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.admin-card--drawer {
  box-shadow: none;
  background: color-mix(in srgb, var(--bg-surface) 94%, var(--bg-block-secondary-default));
}

@media (max-width: 960px) {
  .admin-conversations__search-row {
    grid-template-columns: 1fr;
  }

  .admin-conversation-card,
  .admin-session-record-card {
    grid-template-columns: 1fr;
  }

  .admin-conversation-card__footer,
  .admin-session-drawer__summary,
  .admin-conversation-card__head,
  .admin-session-record-card__head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
