<template>
  <AdminPageContainer title="资源管理" description="统一管理全站资源与我的资源，支持按用户维度检索，并保留管理员批量发布、下架和删除能力。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="loadAssets" :disabled="loading || acting">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <AdminFilterToolbar>
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
      <template #actions>
        <button
          v-if="filters.scope === 'all' && filters.ownerKeyword"
          class="admin-button admin-button--secondary"
          type="button"
          :disabled="loading || acting"
          @click="resetOwnerKeyword"
        >
          清空用户筛选
        </button>
        <button
          v-if="filters.scope === 'all'"
          class="admin-button admin-button--primary"
          type="button"
          :disabled="loading || acting"
          @click="handleSearch"
        >
          搜索用户
        </button>
      </template>
    </AdminFilterToolbar>

    <div class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">批量操作</h4>
          <div class="admin-card__desc">先完成最核心的批量上架、下架和删除，后续再补详情抽屉与更细粒度筛选。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-bulk-bar">
          <label class="admin-switch-row">
            <input ref="selectAllCheckboxRef" :checked="isAllSelected" type="checkbox" @change="handleToggleAll">
            <span>全选当前页</span>
          </label>
          <div class="admin-bulk-bar__meta">
            已选择 {{ selectedIds.length }} 项，当前页 {{ assets.length }} 项，共 {{ assetSummary.totalCount }} 项
            <template v-if="selectedIds.length">
              · 已发布 {{ selectedPublishedCount }} 项
              · 草稿 {{ selectedDraftCount }} 项
            </template>
          </div>
          <div class="admin-bulk-bar__actions">
            <button class="admin-inline-button" type="button" :disabled="acting || publishableSelectedIds.length === 0" @click="handleBatchAction('publish')">
              {{ actingAction === 'publish' ? '发布中...' : `批量发布 ${publishableSelectedIds.length}` }}
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
          <div v-for="item in assets" :key="item.id" class="admin-asset-card">
            <div class="admin-asset-card__select">
              <input :checked="selectedMap[item.id] === true" type="checkbox" @change="handleToggleItem(item.id, $event)">
            </div>

            <div class="admin-asset-card__preview">
              <img
                v-if="item.previewUrl || item.coverUrl || item.fileUrl"
                :src="item.previewUrl || item.coverUrl || item.fileUrl"
                :alt="item.title || '资源预览'"
                class="admin-asset-card__image"
              >
              <div v-else class="admin-asset-card__image admin-asset-card__image--empty">无预览</div>
            </div>

            <div class="admin-asset-card__body">
              <div class="admin-asset-card__title-row">
                <div>
                  <div class="admin-asset-card__title">{{ item.title || '未命名资源' }}</div>
                  <div class="admin-asset-card__meta">
                    作者：{{ item.owner.name || '创作者' }}
                    <template v-if="item.owner.email">（{{ item.owner.email }}）</template>
                    · 用户 ID：{{ item.owner.id || '未知用户' }}
                    · 创建于 {{ formatDate(item.createdAt) }}
                  </div>
                </div>
                <div class="admin-asset-card__tags">
                  <span class="admin-status" :class="item.publishStatus === 'published' ? 'admin-status--success' : 'admin-status--warning'">
                    {{ item.publishStatus === 'published' ? '已发布' : '草稿/未发布' }}
                  </span>
                  <span class="admin-chip">{{ item.assetType === 'video' ? '视频' : '图片' }}</span>
                </div>
              </div>

              <div class="admin-asset-card__prompt">{{ item.promptText || item.description || '暂无提示词或描述信息' }}</div>

              <div class="admin-asset-card__stats">
                <span>模型：{{ item.modelLabel || '未记录' }}</span>
                <span>比例：{{ item.aspectRatio || '未记录' }}</span>
                <span>点赞：{{ item.favoriteCount }}</span>
                <span>浏览：{{ item.viewCount }}</span>
                <span>下载：{{ item.downloadCount }}</span>
              </div>

              <div class="admin-asset-card__footer">
                <div class="admin-asset-card__meta">
                  审核：{{ item.reviewStatus || 'unknown' }}
                  <template v-if="item.publishedAt"> · 发布时间：{{ formatDate(item.publishedAt) }}</template>
                </div>
                <div class="admin-list-item__actions">
                  <button
                    v-if="item.publishStatus !== 'published'"
                    class="admin-inline-button"
                    type="button"
                    :disabled="acting"
                    @click="handleSingleAction('publish', item.id)"
                  >
                    发布
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
              </div>
            </div>
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
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AdminFilterChips, { type AdminFilterChipGroup } from '@/components/admin/common/AdminFilterChips.vue'
import AdminFilterToolbar from '@/components/admin/common/AdminFilterToolbar.vue'
import AdminPagination from '@/components/admin/common/AdminPagination.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { useAdminPagination } from '@/composables/useAdminPagination'
import {
  applyAssetAction,
  listAdminAssetItems,
  type AssetActionType,
  type AssetKind,
  type AssetListSummary,
  type AssetPublishState,
  type AssetScope,
  type PersistedAssetItem,
} from '@/api/asset-items'

const loading = ref(false)
const acting = ref(false)
const actingAction = ref<AssetActionType | ''>('')
const assets = ref<PersistedAssetItem[]>([])
const assetSummary = reactive<AssetListSummary>({
  totalCount: 0,
  totalPages: 1,
  page: 1,
  pageSize: 12,
})
const selectedMap = ref<Record<string, boolean>>({})
const selectAllCheckboxRef = ref<HTMLInputElement | null>(null)

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
const { pagination, resetPage } = useAdminPagination({
  initialPageSize: 12,
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
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
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

const selectedIds = computed(() => Object.keys(selectedMap.value).filter((id) => selectedMap.value[id]))
const currentPageIds = computed(() => assets.value.map((item) => item.id))
const isAllSelected = computed(() => assets.value.length > 0 && assets.value.every((item) => selectedMap.value[item.id]))
const isPartiallySelected = computed(() => !isAllSelected.value && assets.value.some((item) => selectedMap.value[item.id]))
const selectedAssets = computed(() => assets.value.filter((item) => selectedMap.value[item.id]))
const selectedPublishedCount = computed(() => selectedAssets.value.filter((item) => item.publishStatus === 'published').length)
const selectedDraftCount = computed(() => selectedAssets.value.filter((item) => item.publishStatus !== 'published').length)
const publishableSelectedIds = computed(() => selectedAssets.value.filter((item) => item.publishStatus !== 'published').map((item) => item.id))
const unpublishableSelectedIds = computed(() => selectedAssets.value.filter((item) => item.publishStatus === 'published').map((item) => item.id))

const clearSelection = () => {
  selectedMap.value = {}
}

const loadAssets = async () => {
  loading.value = true
  try {
    const result = await listAdminAssetItems({
      scope: filters.scope,
      assetType: filters.assetType,
      publishState: filters.publishState,
      page: pagination.page,
      pageSize: pagination.pageSize,
      ownerKeyword: filters.scope === 'all' ? filters.ownerKeyword : '',
    })
    assets.value = result.items
    assetSummary.totalCount = Number(result.summary?.totalCount || 0)
    assetSummary.totalPages = Number(result.summary?.totalPages || 1)
    assetSummary.page = Number(result.summary?.page || pagination.page)
    assetSummary.pageSize = Number(result.summary?.pageSize || pagination.pageSize)
    pagination.page = assetSummary.page
    pagination.pageSize = assetSummary.pageSize
    clearSelection()
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  void loadAssets()
}

const resetOwnerKeyword = () => {
  if (!filters.ownerKeyword) {
    return
  }
  filters.ownerKeyword = ''
  pagination.page = 1
  void loadAssets()
}

const setScope = (scope: Extract<AssetScope, 'mine' | 'all'>) => {
  if (filters.scope === scope) {
    return
  }

  filters.scope = scope
  if (scope !== 'all') {
    filters.ownerKeyword = ''
  }
  resetPage()
  void loadAssets()
}

const setAssetType = (assetType: AssetKind) => {
  if (filters.assetType === assetType) {
    return
  }
  filters.assetType = assetType
  resetPage()
  void loadAssets()
}

const setPublishState = (publishState: AssetPublishState) => {
  if (filters.publishState === publishState) {
    return
  }
  filters.publishState = publishState
  resetPage()
  void loadAssets()
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

const toggleSelect = (id: string, checked: boolean) => {
  selectedMap.value = {
    ...selectedMap.value,
    [id]: checked,
  }
}

const toggleSelectAll = (checked: boolean) => {
  if (!checked) {
    const nextSelectedMap = { ...selectedMap.value }
    currentPageIds.value.forEach((id) => {
      delete nextSelectedMap[id]
    })
    selectedMap.value = nextSelectedMap
    return
  }

  selectedMap.value = {
    ...selectedMap.value,
    ...Object.fromEntries(assets.value.map((item) => [item.id, true])),
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
      successMessage: `资源${action === 'delete' ? '删除' : action === 'publish' ? '发布' : '下架'}成功`,
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

const handlePaginationChange = async (payload: { page: number; pageSize: number }) => {
  pagination.page = payload.page
  pagination.pageSize = payload.pageSize
  await loadAssets()
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

onMounted(() => {
  void loadAssets()
})

watch(isPartiallySelected, (value) => {
  if (selectAllCheckboxRef.value) {
    selectAllCheckboxRef.value.indeterminate = value
  }
}, { immediate: true })
</script>
