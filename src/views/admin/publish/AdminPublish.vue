<template>
  <AdminPageContainer title="发布管理" description="当前先基于资源层的发布状态管理内容上架与下架，后续再继续整合复杂的外部发布任务流程。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="loadPublishItems" :disabled="loading || acting">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <AdminFilterToolbar>
      <template #filters>
        <AdminFilterChips :groups="filterChipGroups" :disabled="loading || acting" @select="handleChipSelect" />
      </template>
      <template #meta>
        <span class="admin-skill-toolbar__summary">
          共 {{ items.length }} 条内容
          <em>，当前只管理我的已发布/草稿资源</em>
        </span>
      </template>
    </AdminFilterToolbar>

    <div class="admin-grid admin-grid--stats">
      <AdminStatCard label="列表总数" :value="items.length" hint="当前发布管理列表中的资源总数" />
      <AdminStatCard label="已发布" :value="publishedCount" hint="当前处于公开发布状态的资源数" />
      <AdminStatCard label="草稿" :value="draftCount" hint="当前仍处于草稿状态的资源数" />
      <AdminStatCard label="当前筛选" :value="filteredCount" hint="当前筛选条件命中的资源数" />
    </div>

    <div class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">批量发布控制</h4>
          <div class="admin-card__desc">先支持批量上架与批量下架，帮助快速处理待发布内容。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-bulk-bar">
          <label class="admin-switch-row">
            <input :checked="isAllSelected" type="checkbox" @change="handleToggleAll">
            <span>全选当前页</span>
          </label>
          <div class="admin-bulk-bar__meta">已选择 {{ selectedIds.length }} 项，当前页 {{ paginatedItems.length }} 项，共 {{ items.length }} 项</div>
          <div class="admin-bulk-bar__actions">
            <button class="admin-inline-button" type="button" :disabled="acting || selectedIds.length === 0" @click="handleBatchAction('publish')">
              {{ actingAction === 'publish' ? '发布中...' : '批量发布' }}
            </button>
            <button class="admin-inline-button" type="button" :disabled="acting || selectedIds.length === 0" @click="handleBatchAction('unpublish')">
              {{ actingAction === 'unpublish' ? '下架中...' : '批量下架' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">发布内容列表</h4>
          <div class="admin-card__desc">展示已发布与草稿内容，方便统一查看封面、文案、统计和当前发布状态。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div v-if="loading" class="admin-empty">正在加载发布内容...</div>
        <div v-else-if="items.length === 0" class="admin-empty">当前筛选条件下还没有发布内容。</div>
        <div v-else class="admin-publish-list">
          <div v-for="item in paginatedItems" :key="item.id" class="admin-publish-card">
            <div class="admin-publish-card__select">
              <input :checked="selectedMap[item.id] === true" type="checkbox" @change="handleToggleItem(item.id, $event)">
            </div>

            <div class="admin-publish-card__preview">
              <img
                v-if="item.previewUrl || item.coverUrl || item.fileUrl"
                :src="item.previewUrl || item.coverUrl || item.fileUrl"
                :alt="item.title || '发布内容预览'"
                class="admin-publish-card__image"
              >
              <div v-else class="admin-publish-card__image admin-publish-card__image--empty">无封面</div>
            </div>

            <div class="admin-publish-card__body">
              <div class="admin-publish-card__head">
                <div>
                  <div class="admin-publish-card__title">{{ item.title || '未命名内容' }}</div>
                  <div class="admin-publish-card__meta">作者：{{ item.owner.name || '创作者' }} · 创建于 {{ formatDate(item.createdAt) }}</div>
                </div>
                <div class="admin-publish-card__tags">
                  <span class="admin-status" :class="item.publishStatus === 'published' ? 'admin-status--success' : 'admin-status--warning'">
                    {{ item.publishStatus === 'published' ? '已发布' : '草稿' }}
                  </span>
                  <span class="admin-chip">{{ item.assetType === 'video' ? '视频' : '图片' }}</span>
                </div>
              </div>

              <div class="admin-publish-card__description">
                {{ item.description || item.promptText || '暂无内容说明' }}
              </div>

              <div class="admin-publish-card__stats">
                <span>模型：{{ item.modelLabel || '未记录' }}</span>
                <span>比例：{{ item.aspectRatio || '未记录' }}</span>
                <span>浏览：{{ item.viewCount }}</span>
                <span>点赞：{{ item.favoriteCount }}</span>
                <span>下载：{{ item.downloadCount }}</span>
              </div>

              <div class="admin-publish-card__footer">
                <div class="admin-publish-card__meta">
                  可见性：{{ item.visibility || 'unknown' }}
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
                    立即发布
                  </button>
                  <button
                    v-else
                    class="admin-inline-button"
                    type="button"
                    :disabled="acting"
                    @click="handleSingleAction('unpublish', item.id)"
                  >
                    下架内容
                  </button>
                </div>
              </div>
            </div>
          </div>
          <AdminPagination
            v-model:page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="items.length"
            :disabled="loading || acting"
          />
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AdminFilterChips, { type AdminFilterChipGroup } from '@/components/admin/common/AdminFilterChips.vue'
import AdminFilterToolbar from '@/components/admin/common/AdminFilterToolbar.vue'
import AdminPagination from '@/components/admin/common/AdminPagination.vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { useAdminPagination } from '@/composables/useAdminPagination'
import {
  applyAssetAction,
  listAssetItems,
  type AssetActionType,
  type AssetPublishState,
  type PersistedAssetItem,
} from '@/api/asset-items'

const loading = ref(false)
const acting = ref(false)
const actingAction = ref<AssetActionType | ''>('')
const items = ref<PersistedAssetItem[]>([])
const selectedMap = ref<Record<string, boolean>>({})

const filters = reactive<{
  publishState: AssetPublishState
}>({
  publishState: 'all',
})
const { pagination, sliceItems, resetPage } = useAdminPagination({
  initialPageSize: 12,
})

const publishStateOptions: Array<{ label: string; value: AssetPublishState }> = [
  { label: '全部内容', value: 'all' },
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
]
const filterChipGroups = computed<AdminFilterChipGroup[]>(() => [
  {
    key: 'publishState',
    label: '发布状态',
    modelValue: filters.publishState,
    options: publishStateOptions,
  },
])

const selectedIds = computed(() => Object.keys(selectedMap.value).filter((id) => selectedMap.value[id]))
const paginatedItems = computed(() => sliceItems(items.value))
const isAllSelected = computed(() => paginatedItems.value.length > 0 && paginatedItems.value.every((item) => selectedMap.value[item.id]))
const publishedCount = computed(() => items.value.filter((item) => item.publishStatus === 'published').length)
const draftCount = computed(() => items.value.filter((item) => item.publishStatus !== 'published').length)
const filteredCount = computed(() => items.value.length)

const clearSelection = () => {
  selectedMap.value = {}
}

const loadPublishItems = async () => {
  loading.value = true
  try {
    const [images, videos] = await Promise.all([
      listAssetItems({
        scope: 'mine',
        assetType: 'image',
        publishState: filters.publishState,
        take: 60,
      }),
      listAssetItems({
        scope: 'mine',
        assetType: 'video',
        publishState: filters.publishState,
        take: 60,
      }),
    ])

    items.value = [...images, ...videos].sort((first, second) => {
      const secondTime = new Date(second.publishedAt || second.createdAt).getTime()
      const firstTime = new Date(first.publishedAt || first.createdAt).getTime()
      return secondTime - firstTime
    })
    resetPage()
    clearSelection()
  } finally {
    loading.value = false
  }
}

const setPublishState = (publishState: AssetPublishState) => {
  if (filters.publishState === publishState) {
    return
  }

  filters.publishState = publishState
  void loadPublishItems()
}

const handleChipSelect = (payload: { groupKey: string; value: string }) => {
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
    clearSelection()
    return
  }

  selectedMap.value = {
    ...selectedMap.value,
    ...Object.fromEntries(paginatedItems.value.map((item) => [item.id, true])),
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

const runPublishAction = async (action: Extract<AssetActionType, 'publish' | 'unpublish'>, ids: string[]) => {
  if (!ids.length) {
    return
  }

  acting.value = true
  actingAction.value = action
  try {
    await applyAssetAction(action, ids, {
      showSuccessMessage: true,
      showErrorMessage: true,
      successMessage: action === 'publish' ? '发布操作已完成' : '下架操作已完成',
    })
    await loadPublishItems()
  } finally {
    acting.value = false
    actingAction.value = ''
  }
}

const handleBatchAction = async (action: Extract<AssetActionType, 'publish' | 'unpublish'>) => {
  await runPublishAction(action, selectedIds.value)
}

const handleSingleAction = async (action: Extract<AssetActionType, 'publish' | 'unpublish'>, id: string) => {
  await runPublishAction(action, [id])
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
  void loadPublishItems()
})

watch(() => pagination.pageSize, () => {
  resetPage()
})
</script>
