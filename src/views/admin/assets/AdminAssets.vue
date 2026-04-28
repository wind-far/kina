<template>
  <AdminPageContainer title="资源管理" description="当前先管理登录用户自己的资源，打通筛选、批量发布、批量下架和批量删除闭环。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="loadAssets" :disabled="loading || acting">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <div class="admin-filter-bar">
      <div class="admin-filter-bar__chips">
        <button
          v-for="option in typeOptions"
          :key="option.value"
          class="admin-chip-button"
          type="button"
          :class="{ 'is-active': filters.assetType === option.value }"
          @click="setAssetType(option.value)"
        >
          {{ option.label }}
        </button>
        <button
          v-for="option in publishStateOptions"
          :key="option.value"
          class="admin-chip-button"
          type="button"
          :class="{ 'is-active': filters.publishState === option.value }"
          @click="setPublishState(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="admin-list-item__meta">当前只管理“我的资源”，这样批量动作可以直接复用现有服务端权限约束。</div>
    </div>

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
            <input :checked="isAllSelected" type="checkbox" @change="handleToggleAll">
            <span>全选当前列表</span>
          </label>
          <div class="admin-bulk-bar__meta">已选择 {{ selectedIds.length }} 项，共 {{ assets.length }} 项</div>
          <div class="admin-bulk-bar__actions">
            <button class="admin-inline-button" type="button" :disabled="acting || selectedIds.length === 0" @click="handleBatchAction('publish')">
              {{ actingAction === 'publish' ? '发布中...' : '批量发布' }}
            </button>
            <button class="admin-inline-button" type="button" :disabled="acting || selectedIds.length === 0" @click="handleBatchAction('unpublish')">
              {{ actingAction === 'unpublish' ? '下架中...' : '批量下架' }}
            </button>
            <button class="admin-inline-button admin-inline-button--danger" type="button" :disabled="acting || selectedIds.length === 0" @click="handleBatchAction('delete')">
              {{ actingAction === 'delete' ? '删除中...' : '批量删除' }}
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
                  <div class="admin-asset-card__meta">作者：{{ item.owner.name || '创作者' }} · 创建于 {{ formatDate(item.createdAt) }}</div>
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
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import {
  applyAssetAction,
  listAssetItems,
  type AssetActionType,
  type AssetKind,
  type AssetPublishState,
  type PersistedAssetItem,
} from '@/api/asset-items'

const loading = ref(false)
const acting = ref(false)
const actingAction = ref<AssetActionType | ''>('')
const assets = ref<PersistedAssetItem[]>([])
const selectedMap = ref<Record<string, boolean>>({})

const filters = reactive<{
  assetType: AssetKind
  publishState: AssetPublishState
}>({
  assetType: 'image',
  publishState: 'all',
})

const typeOptions: Array<{ label: string; value: AssetKind }> = [
  { label: '图片资源', value: 'image' },
  { label: '视频资源', value: 'video' },
]

const publishStateOptions: Array<{ label: string; value: AssetPublishState }> = [
  { label: '全部状态', value: 'all' },
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
]

const selectedIds = computed(() => Object.keys(selectedMap.value).filter((id) => selectedMap.value[id]))
const isAllSelected = computed(() => assets.value.length > 0 && assets.value.every((item) => selectedMap.value[item.id]))

const clearSelection = () => {
  selectedMap.value = {}
}

const loadAssets = async () => {
  loading.value = true
  try {
    assets.value = await listAssetItems({
      scope: 'mine',
      assetType: filters.assetType,
      publishState: filters.publishState,
      take: 80,
    })
    clearSelection()
  } finally {
    loading.value = false
  }
}

const setAssetType = (assetType: AssetKind) => {
  if (filters.assetType === assetType) {
    return
  }
  filters.assetType = assetType
  void loadAssets()
}

const setPublishState = (publishState: AssetPublishState) => {
  if (filters.publishState === publishState) {
    return
  }
  filters.publishState = publishState
  void loadAssets()
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

  selectedMap.value = Object.fromEntries(assets.value.map((item) => [item.id, true]))
}

const handleToggleAll = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  toggleSelectAll(Boolean(target?.checked))
}

const handleToggleItem = (id: string, event: Event) => {
  const target = event.target as HTMLInputElement | null
  toggleSelect(id, Boolean(target?.checked))
}

// 统一执行资源动作，避免单项和批量操作维护两套逻辑。
const runAssetAction = async (action: AssetActionType, ids: string[]) => {
  if (!ids.length) {
    return
  }

  acting.value = true
  actingAction.value = action
  try {
    await applyAssetAction(action, ids, {
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
  await runAssetAction(action, selectedIds.value)
}

const handleSingleAction = async (action: Extract<AssetActionType, 'publish' | 'unpublish' | 'delete'>, id: string) => {
  await runAssetAction(action, [id])
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
</script>
