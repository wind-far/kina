<template>
  <AdminPageContainer title="资源管理" description="统一管理全站资源与我的资源，支持按用户维度检索，并保留管理员批量发布、下架和删除能力。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="loadAssets" :disabled="loading || acting">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <AdminFilterToolbar
      title="筛选条件"
      description="按范围、类型、发布状态和用户身份筛选资产。"
      :active-count="activeFilterCount"
      :disabled="loading || acting"
      show-reset
      show-apply
      reset-label="重置"
      apply-label="搜索"
      @reset="resetFilters"
      @apply="handleSearch"
    >
      <template #search>
        <input
          v-if="filters.scope === 'all'"
          v-model.trim="filters.ownerKeyword"
          class="admin-input"
          type="text"
          placeholder="搜索用户 ID / 昵称 / 邮箱"
          :disabled="loading || acting"
          @keydown.enter="handleSearch"
        >
      </template>
      <template #filters>
        <AdminFilterChips :groups="filterChipGroups" :disabled="loading || acting" @select="handleChipSelect" />
      </template>
      <template #meta>
        <span class="admin-skill-toolbar__summary">
          共 {{ assetSummary.totalCount }} 条资源
          <em>，{{ scopeSummaryText }}</em>
        </span>
      </template>
    </AdminFilterToolbar>

    <div class="admin-card admin-asset-ops-card">
      <div class="admin-card__content">
        <div class="admin-bulk-bar admin-asset-bulk-bar">
          <label class="admin-switch-row">
            <input ref="selectAllCheckboxRef" :checked="isAllSelected" type="checkbox" @change="handleToggleAll">
            <span>全选当前页</span>
          </label>
          <div class="admin-bulk-bar__meta">
            已选择 {{ selectedIds.length }} 项，当前页 {{ assets.length }} 项，共 {{ assetSummary.totalCount }} 项
            <template v-if="selectedIds.length">
              · 已发布 {{ selectedPublishedCount }} 项
              · 待审核 {{ selectedPendingCount }} 项
              · 草稿 {{ selectedDraftCount }} 项
            </template>
          </div>
          <div class="admin-bulk-bar__actions admin-asset-bulk-bar__actions">
            <button class="admin-inline-button" type="button" :disabled="acting || publishableSelectedIds.length === 0" @click="handleBatchAction('publish')">
              {{ actingAction === 'publish' ? '审核中...' : `批量通过 ${publishableSelectedIds.length}` }}
            </button>
            <button class="admin-inline-button" type="button" :disabled="acting || unpublishableSelectedIds.length === 0" @click="handleBatchAction('unpublish')">
              {{ actingAction === 'unpublish' ? '下架中...' : `批量下架 ${unpublishableSelectedIds.length}` }}
            </button>
            <button class="admin-inline-button admin-inline-button--danger" type="button" :disabled="acting || selectedIds.length === 0" @click="handleBatchAction('delete')">
              {{ actingAction === 'delete' ? '删除中...' : `批量删除 ${selectedIds.length}` }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">资源列表</h4>
          <div class="admin-card__desc">展示封面、提示词、模型、比例、统计与发布状态，便于快速运营处理。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div v-if="loading" class="admin-empty">正在加载资源列表...</div>
        <div v-else-if="assets.length === 0" class="admin-empty">当前筛选条件下还没有资源记录。</div>
        <div v-else class="admin-asset-list">
          <div class="admin-asset-table">
            <div class="admin-asset-table__head">
              <span>资源</span>
              <span>状态</span>
              <span>规格</span>
              <span>数据</span>
              <span>时间</span>
              <span>操作</span>
            </div>

            <article v-for="item in assets" :key="item.id" class="admin-asset-card">
              <div class="admin-asset-card__main">
                <label class="admin-asset-card__select" :aria-label="`选择资源 ${item.title || item.id}`">
                  <input :checked="selectedMap[item.id] === true" type="checkbox" @change="handleToggleItem(item.id, $event)">
                </label>

                <div class="admin-asset-card__preview">
                  <button
                    v-if="item.previewUrl || item.coverUrl || item.fileUrl"
                    class="admin-asset-card__image-button"
                    type="button"
                    :disabled="acting"
                    @click="openImagePreview(item)"
                  >
                    <img
                      :src="resolveAssetPreviewUrl(item)"
                      :alt="item.title || '资源预览'"
                      class="admin-asset-card__image"
                    >
                  </button>
                  <div v-else class="admin-asset-card__image admin-asset-card__image--empty">无预览</div>
                  <span class="admin-asset-card__type">{{ item.assetType === 'video' ? '视频' : '图片' }}</span>
                </div>

                <div class="admin-asset-card__identity">
                  <div class="admin-asset-card__title-row">
                    <div class="admin-asset-card__title">{{ item.title || buildAssetFallbackTitle(item) }}</div>
                    <span class="admin-chip">{{ getSourceLabel(item.source) }}</span>
                  </div>
                  <div class="admin-asset-card__owner">
                    {{ item.owner.name || '创作者' }}
                    <template v-if="item.owner.email"> · {{ item.owner.email }}</template>
                    <template v-if="item.owner.id"> · {{ item.owner.id }}</template>
                  </div>
                  <div class="admin-asset-card__prompt">{{ item.promptText || item.description || '暂无提示词或描述信息' }}</div>
                  <div class="admin-asset-card__id">资源 ID {{ item.id }}</div>
                </div>
              </div>

              <div class="admin-asset-card__status">
                <AdminStatusBadge category="assetPublishStatus" :value="getAssetDisplayStatus(item)" />
                <span class="admin-asset-card__state">可见性：{{ getVisibilityLabel(item.visibility) }}</span>
                <span class="admin-asset-card__state">审核：{{ getReviewStatusLabel(item.reviewStatus) }}</span>
              </div>

              <div class="admin-asset-card__specs">
                <div>
                  <span>尺寸</span>
                  <strong>{{ formatDimensions(item) }}</strong>
                </div>
                <div>
                  <span>{{ item.assetType === 'video' ? '时长' : '比例' }}</span>
                  <strong>{{ item.assetType === 'video' ? formatDuration(item.durationSeconds) : (item.aspectRatio || '未记录') }}</strong>
                </div>
                <div>
                  <span>大小</span>
                  <strong>{{ formatFileSize(item.fileSizeBytes) }}</strong>
                </div>
                <div>
                  <span>模型</span>
                  <strong>{{ item.modelLabel || '未记录' }}</strong>
                </div>
              </div>

              <div class="admin-asset-card__metrics">
                <div>
                  <strong>{{ item.viewCount }}</strong>
                  <span>浏览</span>
                </div>
                <div>
                  <strong>{{ item.favoriteCount }}</strong>
                  <span>点赞</span>
                </div>
                <div>
                  <strong>{{ item.downloadCount }}</strong>
                  <span>下载</span>
                </div>
              </div>

              <div class="admin-asset-card__times">
                <span>创建 {{ formatDate(item.createdAt) }}</span>
                <span>更新 {{ formatDate(item.updatedAt || item.createdAt) }}</span>
                <span v-if="item.publishedAt">发布 {{ formatDate(item.publishedAt) }}</span>
              </div>

              <div class="admin-list-item__actions admin-asset-card__actions">
                <button
                  v-if="item.publishStatus !== 'published'"
                  class="admin-inline-button"
                  type="button"
                  :disabled="acting"
                  @click="handleSingleAction('publish', item.id)"
                >
                  {{ item.reviewStatus === 'pending' ? '通过' : '发布' }}
                </button>
                <button
                  v-else
                  class="admin-inline-button"
                  type="button"
                  :disabled="acting"
                  @click="handleSingleAction('unpublish', item.id)"
                >
                  下架
                </button>
                <button class="admin-inline-button admin-inline-button--danger" type="button" :disabled="acting" @click="handleSingleAction('delete', item.id)">
                  删除
                </button>
              </div>
            </article>
          </div>
          <AdminPagination
            v-model:page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="assetSummary.totalCount"
            :disabled="loading || acting"
            @change="handlePaginationChange"
          />
        </div>
      </div>
    </div>

    <CommonImagePreview
      v-model:visible="imagePreview.visible"
      :src="imagePreview.src"
      :title="imagePreview.title"
      :description="imagePreview.description"
      :download-name="imagePreview.downloadName"
      :meta="imagePreview.meta"
    />
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AdminFilterChips, { type AdminFilterChipGroup } from '@/components/admin/common/AdminFilterChips.vue'
import AdminFilterToolbar from '@/components/admin/common/AdminFilterToolbar.vue'
import AdminPagination from '@/components/admin/common/AdminPagination.vue'
import AdminStatusBadge from '@/components/admin/common/AdminStatusBadge.vue'
import CommonImagePreview from '@/components/common/CommonImagePreview.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { useAdminList } from '@/composables/admin/useAdminList'
import { useAdminListFilters } from '@/composables/useAdminListFilters'
import { resolveAdminDictionaryItem } from '@/config/adminDictionaries'
import {
  applyAssetAction,
  listAdminAssetItems,
  type AssetActionType,
  type AssetKind,
  type AssetPublishState,
  type AssetScope,
  type PersistedAssetItem,
} from '@/api/asset-items'

const acting = ref(false)
const actingAction = ref<AssetActionType | ''>('')
const selectAllCheckboxRef = ref<HTMLInputElement | null>(null)
const imagePreview = reactive<{
  visible: boolean
  src: string
  title: string
  description: string
  downloadName: string
  meta: Array<{ label: string; value: string | number }>
}>({
  visible: false,
  src: '',
  title: '',
  description: '',
  downloadName: '',
  meta: [],
})

const filters = reactive<{
  scope: Extract<AssetScope, 'mine' | 'all'>
  assetType: AssetKind
  publishState: AssetPublishState
  ownerKeyword: string
}>({
  scope: 'all',
  assetType: 'image',
  publishState: 'all',
  ownerKeyword: '',
})
const filterDefaults = {
  scope: 'all' as Extract<AssetScope, 'mine' | 'all'>,
  assetType: 'image' as AssetKind,
  publishState: 'all' as AssetPublishState,
  ownerKeyword: '',
}
const { activeFilterCount, resetFilters: resetFilterValues } = useAdminListFilters({
  filters,
  defaults: filterDefaults,
})
const {
  loading,
  items: assets,
  pagination,
  selectedMap,
  selectedIds,
  selectedItems: selectedAssets,
  isAllSelected,
  isPartiallySelected,
  loadList: loadAssets,
  resetAndLoad,
  handlePaginationChange,
  toggleSelect,
  toggleSelectAll,
} = useAdminList<PersistedAssetItem>({
  initialPageSize: 12,
  fetcher: ({ page, pageSize }) => listAdminAssetItems({
    scope: filters.scope,
    assetType: filters.assetType,
    publishState: filters.publishState,
    page,
    pageSize,
    ownerKeyword: filters.scope === 'all' ? filters.ownerKeyword : '',
  }),
})

const typeOptions: Array<{ label: string; value: AssetKind }> = [
  { label: '图片资源', value: 'image' },
  { label: '视频资源', value: 'video' },
]

const scopeOptions: Array<{ label: string; value: Extract<AssetScope, 'mine' | 'all'> }> = [
  { label: '全站资源', value: 'all' },
  { label: '我的资源', value: 'mine' },
]

const publishStateOptions: Array<{ label: string; value: AssetPublishState }> = [
  { label: '全部状态', value: 'all' },
  { label: resolveAdminDictionaryItem('assetPublishStatus', 'published').label, value: 'published' },
  { label: resolveAdminDictionaryItem('assetPublishStatus', 'pending').label, value: 'pending' },
  { label: resolveAdminDictionaryItem('assetPublishStatus', 'draft').label, value: 'draft' },
]
const filterChipGroups = computed<AdminFilterChipGroup[]>(() => [
  {
    key: 'scope',
    label: '资源范围',
    modelValue: filters.scope,
    options: scopeOptions,
  },
  {
    key: 'assetType',
    label: '资源类型',
    modelValue: filters.assetType,
    options: typeOptions,
  },
  {
    key: 'publishState',
    label: '发布状态',
    modelValue: filters.publishState,
    options: publishStateOptions,
  },
])
const scopeSummaryText = computed(() => filters.scope === 'all'
  ? `当前查看全站资源${filters.ownerKeyword ? `，用户筛选：${filters.ownerKeyword}` : ''}`
  : '当前只管理我的资源')
const assetSummary = computed(() => ({
  totalCount: pagination.total,
  totalPages: pagination.totalPages,
  page: pagination.page,
  pageSize: pagination.pageSize,
}))
const selectedPublishedCount = computed(() => selectedAssets.value.filter((item) => item.publishStatus === 'published').length)
const selectedDraftCount = computed(() => selectedAssets.value.filter((item) => item.publishStatus !== 'published' && item.reviewStatus !== 'pending').length)
const selectedPendingCount = computed(() => selectedAssets.value.filter((item) => item.reviewStatus === 'pending').length)
const publishableSelectedIds = computed(() => selectedAssets.value.filter((item) => item.publishStatus !== 'published').map((item) => item.id))
const unpublishableSelectedIds = computed(() => selectedAssets.value.filter((item) => item.publishStatus === 'published').map((item) => item.id))

const handleSearch = () => {
  void resetAndLoad()
}

const resetFilters = () => {
  resetFilterValues()
  void resetAndLoad()
}

const setScope = (scope: Extract<AssetScope, 'mine' | 'all'>) => {
  if (filters.scope === scope) {
    return
  }

  filters.scope = scope
  if (scope !== 'all') {
    filters.ownerKeyword = ''
  }
  void resetAndLoad()
}

const setAssetType = (assetType: AssetKind) => {
  if (filters.assetType === assetType) {
    return
  }
  filters.assetType = assetType
  void resetAndLoad()
}

const setPublishState = (publishState: AssetPublishState) => {
  if (filters.publishState === publishState) {
    return
  }
  filters.publishState = publishState
  void resetAndLoad()
}

const handleChipSelect = (payload: { groupKey: string; value: string }) => {
  if (payload.groupKey === 'scope') {
    setScope(payload.value as Extract<AssetScope, 'mine' | 'all'>)
    return
  }
  if (payload.groupKey === 'assetType') {
    setAssetType(payload.value as AssetKind)
    return
  }
  if (payload.groupKey === 'publishState') {
    setPublishState(payload.value as AssetPublishState)
  }
}

const handleToggleAll = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  toggleSelectAll(Boolean(target?.checked))
}

const handleToggleItem = (id: string, event: Event) => {
  const target = event.target as HTMLInputElement | null
  toggleSelect(id, Boolean(target?.checked))
}

const resolveActionableIds = (action: Extract<AssetActionType, 'publish' | 'unpublish' | 'delete'>) => {
  if (action === 'publish') {
    return publishableSelectedIds.value
  }
  if (action === 'unpublish') {
    return unpublishableSelectedIds.value
  }
  return selectedIds.value
}

// 统一执行资源动作，避免单项和批量操作维护两套逻辑。
const runAssetAction = async (action: AssetActionType, ids: string[]) => {
  if (!ids.length) {
    return
  }

  acting.value = true
  actingAction.value = action
  try {
    await applyAssetAction(action, ids, filters.scope, {
      showSuccessMessage: true,
      showErrorMessage: true,
      successMessage: `资源${action === 'delete' ? '删除' : action === 'publish' ? '审核发布' : '下架'}成功`,
    })
    await loadAssets()
  } finally {
    acting.value = false
    actingAction.value = ''
  }
}

const handleBatchAction = async (action: Extract<AssetActionType, 'publish' | 'unpublish' | 'delete'>) => {
  const actionableIds = resolveActionableIds(action)
  if (!actionableIds.length) {
    ElMessage.warning(action === 'publish' ? '当前所选资源里没有可发布项。' : action === 'unpublish' ? '当前所选资源里没有可下架项。' : '请先选择要删除的资源。')
    return
  }

  if (actionableIds.length < selectedIds.value.length) {
    ElMessage.info(`已自动跳过 ${selectedIds.value.length - actionableIds.length} 条不可执行资源。`)
  }

  await runAssetAction(action, actionableIds)
}

const handleSingleAction = async (action: Extract<AssetActionType, 'publish' | 'unpublish' | 'delete'>, id: string) => {
  await runAssetAction(action, [id])
}

const resolveAssetPreviewUrl = (item: PersistedAssetItem) => {
  return item.previewUrl || item.coverUrl || item.thumbnailUrl || item.fileUrl
}

const formatDate = (value?: string) => {
  if (!value) {
    return '未知时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const buildAssetFallbackTitle = (item: PersistedAssetItem) => {
  return `${item.assetType === 'video' ? '视频' : '图片'}资源`
}

const formatDimensions = (item: PersistedAssetItem) => {
  if (!item.width || !item.height) {
    return '未记录'
  }
  return `${item.width}x${item.height}`
}

const formatDuration = (value?: number) => {
  const totalSeconds = Math.max(0, Number(value || 0))
  if (!totalSeconds) {
    return '未记录'
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

const formatFileSize = (value?: number) => {
  const size = Number(value || 0)
  if (!Number.isFinite(size) || size <= 0) {
    return '未记录'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  let currentSize = size
  let unitIndex = 0
  while (currentSize >= 1024 && unitIndex < units.length - 1) {
    currentSize /= 1024
    unitIndex += 1
  }
  return `${currentSize >= 10 || unitIndex === 0 ? currentSize.toFixed(0) : currentSize.toFixed(1)} ${units[unitIndex]}`
}

const getVisibilityLabel = (value?: string) => {
  const normalizedValue = String(value || '').toLowerCase()
  if (normalizedValue === 'public') return '公开'
  if (normalizedValue === 'private') return '私有'
  return normalizedValue || '未知'
}

const getReviewStatusLabel = (value?: string) => {
  const normalizedValue = String(value || '').toLowerCase()
  if (normalizedValue === 'approved') return '已通过'
  if (normalizedValue === 'pending') return '待审核'
  if (normalizedValue === 'rejected') return '已拒绝'
  return normalizedValue || '未知'
}

const getAssetDisplayStatus = (item: PersistedAssetItem) => {
  return item.reviewStatus === 'pending' ? 'pending' : item.publishStatus
}

const getSourceLabel = (value?: string) => {
  const normalizedValue = String(value || '').toLowerCase()
  if (normalizedValue === 'generated') return '生成'
  if (normalizedValue === 'uploaded') return '上传'
  if (normalizedValue === 'imported') return '导入'
  return normalizedValue || '来源未知'
}

const openImagePreview = (item: PersistedAssetItem) => {
  imagePreview.src = resolveAssetPreviewUrl(item)
  imagePreview.title = item.title || buildAssetFallbackTitle(item)
  imagePreview.description = item.promptText || item.description || ''
  imagePreview.downloadName = `${item.id}.${item.assetType === 'video' ? 'jpg' : 'png'}`
  imagePreview.meta = [
    { label: '类型', value: item.assetType === 'video' ? '视频封面' : '图片' },
    { label: '尺寸', value: formatDimensions(item) },
    { label: '大小', value: formatFileSize(item.fileSizeBytes) },
    { label: '模型', value: item.modelLabel || '未记录' },
    { label: '比例', value: item.aspectRatio || '未记录' },
    { label: '来源', value: getSourceLabel(item.source) },
    { label: '发布', value: getAssetDisplayStatus(item) === 'published' ? '已发布' : getAssetDisplayStatus(item) === 'pending' ? '待审核' : '草稿' },
    { label: '审核', value: getReviewStatusLabel(item.reviewStatus) },
  ]
  imagePreview.visible = true
}

onMounted(() => {
  void loadAssets()
})

watch(isPartiallySelected, (value) => {
  if (selectAllCheckboxRef.value) {
    selectAllCheckboxRef.value.indeterminate = value
  }
}, { immediate: true })
</script>

<style scoped>
.admin-asset-ops-card {
  border-color: color-mix(in srgb, var(--brand-main-default) 14%, var(--line-divider, #00000014));
}

.admin-asset-bulk-bar {
  align-items: center;
}

.admin-asset-bulk-bar__actions {
  justify-content: flex-end;
}

.admin-asset-table {
  display: grid;
  gap: 8px;
}

.admin-asset-table__head,
.admin-asset-card {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) 138px minmax(250px, 0.8fr) 132px 184px 132px;
  gap: 16px;
  align-items: center;
}

.admin-asset-table__head {
  min-height: 38px;
  padding: 0 16px;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 700;
}

.admin-asset-card {
  padding: 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-surface) 92%, var(--bg-block-secondary-default));
  transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
}

.admin-asset-card:hover {
  border-color: color-mix(in srgb, var(--brand-main-default) 22%, var(--line-divider, #00000014));
  background: color-mix(in srgb, var(--bg-surface) 96%, var(--bg-block-secondary-default));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.admin-asset-card__main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.admin-asset-card__select {
  flex: 0 0 auto;
  padding-top: 28px;
}

.admin-asset-card__select input {
  width: 16px;
  height: 16px;
}

.admin-asset-card__preview {
  position: relative;
  flex: 0 0 86px;
  width: 86px;
}

.admin-asset-card__image-button {
  display: block;
  width: 86px;
  height: 86px;
  border: none;
  padding: 0;
  border-radius: 8px;
  background: transparent;
  cursor: zoom-in;
}

.admin-asset-card__image-button:disabled {
  cursor: default;
}

.admin-asset-card__image {
  width: 86px;
  height: 86px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 8px;
  background: var(--bg-block-secondary-hover);
  object-fit: cover;
}

.admin-asset-card__image-button:hover .admin-asset-card__image {
  border-color: color-mix(in srgb, var(--brand-main-default) 40%, var(--line-divider, #00000014));
}

.admin-asset-card__image--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 12px;
}

.admin-asset-card__type {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.admin-asset-card__identity {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.admin-asset-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.admin-asset-card__title {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-asset-card__owner,
.admin-asset-card__id,
.admin-asset-card__state,
.admin-asset-card__times {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.admin-asset-card__owner,
.admin-asset-card__id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-asset-card__prompt {
  display: -webkit-box;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.55;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.admin-asset-card__status,
.admin-asset-card__times {
  display: grid;
  gap: 6px;
  align-content: center;
}

.admin-asset-card__specs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.admin-asset-card__specs div,
.admin-asset-card__metrics div {
  min-width: 0;
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-block-secondary-default) 74%, transparent);
}

.admin-asset-card__specs span,
.admin-asset-card__metrics span {
  display: block;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.25;
}

.admin-asset-card__specs strong,
.admin-asset-card__metrics strong {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-asset-card__metrics {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

.admin-asset-card__metrics div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
}

.admin-asset-card__metrics strong,
.admin-asset-card__metrics span {
  margin: 0;
}

.admin-asset-card__actions {
  justify-content: flex-end;
}

@media (max-width: 1280px) and (min-width: 961px) {
  .admin-asset-table__head,
  .admin-asset-card {
    grid-template-columns: minmax(340px, 1fr) 128px minmax(220px, 0.8fr) 120px;
  }

  .admin-asset-table__head span:nth-child(5),
  .admin-asset-table__head span:nth-child(6),
  .admin-asset-card__times,
  .admin-asset-card__actions {
    grid-column: 1 / -1;
  }

  .admin-asset-card__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 960px) {
  .admin-asset-table__head {
    display: none;
  }

  .admin-asset-card {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .admin-asset-card__main {
    flex-wrap: wrap;
  }

  .admin-asset-card__preview,
  .admin-asset-card__image-button,
  .admin-asset-card__image {
    width: 96px;
    height: 96px;
  }

  .admin-asset-card__identity {
    flex: 1 1 220px;
  }

  .admin-asset-card__specs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-asset-card__actions {
    justify-content: flex-start;
  }
}
</style>
