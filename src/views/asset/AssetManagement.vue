<template>
  <FrontstagePageShell>
    <!-- 资产管理容器 -->
    <div class="entryContainer-fe9">
      <div class="header-2ov">
        <div class="container-c5d">
          <div class="tabs-y6n">
            <div
                v-for="tab in tabs"
                :key="tab.id"
                class="tabItem-mls"
                :class="{ 'active-2nk': activeTab === tab.id }"
                @click="switchTab(tab.id)"
            >
              {{ tab.label }}
            </div>
          </div>
        </div>
      </div>
      <AssetImageTab
          v-if="activeTab === 'image'"
          :image-filter-options="imageFilterOptions"
          :image-filter="imageFilter"
          :is-batch-mode="isBatchMode"
          :selected-count="selectedCount"
          :image-groups="imageGroups"
          :is-selected="isSelected"
          @set-image-filter="setImageFilter"
          @batch-delete="handleBatchDelete"
          @batch-download="handleBatchDownload"
          @batch-publish="handleBatchPublish"
          @batch-favorite="handleBatchFavorite"
          @edit-in-capcut="handleEditInCapCut"
          @enter-batch-mode="enterBatchMode"
          @exit-batch-mode="exitBatchMode"
          @asset-click="handleAssetClick"
      />
      <AssetVideoTab
          :active="activeTab === 'video'"
          :video-filter-options="videoFilterOptions"
          :video-filter="videoFilter"
          @set-video-filter="setVideoFilter"
          @enter-batch-mode="enterBatchMode"
          @edit-in-capcut="handleEditInCapCut"
      />
      <AssetCanvasTab
          :active="activeTab === 'canvas'"
          :canvas-filter-options="canvasFilterOptions"
          :canvas-filter="canvasFilter"
          @set-canvas-filter="setCanvasFilter"
          @enter-batch-mode="enterBatchMode"
      />
      <AssetEditorTab
          :active="activeTab === 'editor'"
          :editor-filter-options="editorFilterOptions"
          :editor-filter="editorFilter"
          @set-editor-filter="setEditorFilter"
          @enter-batch-mode="enterBatchMode"
      />
      <AssetStoryTab
          :active="activeTab === 'story'"
          :story-filter-options="storyFilterOptions"
          :story-filter="storyFilter"
          @set-story-filter="setStoryFilter"
          @enter-batch-mode="enterBatchMode"
      />
      <AssetAudioTab
          :active="activeTab === 'audio'"
          :audio-filter-options="audioFilterOptions"
          :audio-filter="audioFilter"
          @set-audio-filter="setAudioFilter"
          @enter-batch-mode="enterBatchMode"
          @edit-in-capcut="handleEditInCapCut"
      />
    </div>

    <template #after>
      <ImagePreview
          v-model:visible="previewVisible"
          v-model:currentIndex="previewIndex"
          :images="allImages"
          @download="handlePreviewDownload"
          @favorite="handlePreviewFavorite"
          @publish="handlePreviewPublish"
          @generate-video="handlePreviewGenerateVideo"
          @edit-in-canvas="handlePreviewEditInCanvas"
      />

      <PublishArtworkModal
          v-model:visible="publishArtworkVisible"
          :image="publishTargetImage"
          :submitting="publishSubmitting"
          @submit="handlePublishArtworkSubmit"
      />
    </template>
  </FrontstagePageShell>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import ImagePreview from '@/components/ImagePreview.vue'
import PublishArtworkModal from '@/components/PublishArtworkModal.vue'
import FrontstagePageShell from '@/components/layout/FrontstagePageShell.vue'
import AssetImageTab from '@/views/asset/components/AssetImageTab.vue'
import AssetVideoTab from '@/views/asset/components/AssetVideoTab.vue'
import AssetCanvasTab from '@/views/asset/components/AssetCanvasTab.vue'
import AssetEditorTab from '@/views/asset/components/AssetEditorTab.vue'
import AssetStoryTab from '@/views/asset/components/AssetStoryTab.vue'
import AssetAudioTab from '@/views/asset/components/AssetAudioTab.vue'
import { useAssetImages } from '@/views/asset/composables/useAssetImages'
import {
  tabs,
  imageFilterOptions,
  videoFilterOptions,
  canvasFilterOptions,
  editorFilterOptions,
  storyFilterOptions,
  audioFilterOptions,
} from '@/views/asset/constants'
import { applyAssetAction } from '@/api/asset-items'
import { AUTH_LOGIN_SUCCESS_EVENT } from '@/stores/auth'
import type {
  AudioFilterType,
  CanvasFilterType,
  EditorFilterType,
  ImageFilterType,
  ImageItem,
  StoryFilterType,
  TabType,
  VideoFilterType,
} from '@/views/asset/types'

// 标签页状态
const activeTab = ref<TabType>('image')

// 筛选状态
const imageFilter = ref<ImageFilterType>('all')
const videoFilter = ref<VideoFilterType>('all')
const canvasFilter = ref<CanvasFilterType>('all')
const editorFilter = ref<EditorFilterType>('all')
const storyFilter = ref<StoryFilterType>('all')
const audioFilter = ref<AudioFilterType>('music')

// 批量操作模式状态
const isBatchMode = ref<boolean>(false)

// 选择状态管理
const selectedItems = ref<Set<string>>(new Set())

// 图片预览状态
const previewVisible = ref<boolean>(false)
const previewIndex = ref<number>(0)
const publishArtworkVisible = ref<boolean>(false)
const publishSubmitting = ref<boolean>(false)
const publishTargetImage = ref<ImageItem | null>(null)

const { imageGroups, allImages, loadImageAssets, resolvePreviewIndexByItemId } = useAssetImages()

// 选中数量计算属性
const selectedCount = computed(() => selectedItems.value.size)

// 切换选择状态
const toggleSelection = (itemId: string) => {
  if (!isBatchMode.value) return

  if (selectedItems.value.has(itemId)) {
    selectedItems.value.delete(itemId)
  } else {
    selectedItems.value.add(itemId)
  }
  // 触发响应式更新
  selectedItems.value = new Set(selectedItems.value)
}

// 清空选择
const clearSelection = () => {
  selectedItems.value.clear()
  selectedItems.value = new Set()
}

// 进入批量操作模式
const enterBatchMode = () => {
  isBatchMode.value = true
}

// 退出批量操作模式
const exitBatchMode = () => {
  isBatchMode.value = false
  clearSelection()
}

// 检查是否选中
const isSelected = (itemId: string) => {
  return selectedItems.value.has(itemId)
}

// 处理资产项点击（区分批量模式和正常模式）
const handleAssetClick = (itemId: string) => {
  if (isBatchMode.value) {
    // 批量操作模式：切换选择状态
    toggleSelection(itemId)
  } else {
    // 正常模式：打开预览
    openPreview(itemId)
  }
}

// 打开图片预览
const openPreview = (itemId: string) => {
  const index = resolvePreviewIndexByItemId(itemId)
  if (index !== -1) {
    previewIndex.value = index
    previewVisible.value = true
  }
}

// 登录成功后的页面数据刷新监听器。
let authLoginSuccessListener: (() => void) | null = null

onMounted(async () => {
  await loadImageAssets()

  authLoginSuccessListener = () => {
    void loadImageAssets()
  }
  window.addEventListener(AUTH_LOGIN_SUCCESS_EVENT, authLoginSuccessListener)
})

onBeforeUnmount(() => {
  if (authLoginSuccessListener) {
    window.removeEventListener(AUTH_LOGIN_SUCCESS_EVENT, authLoginSuccessListener)
    authLoginSuccessListener = null
  }
})

// 切换标签页
const switchTab = (tab: TabType) => {
  activeTab.value = tab
}

// 设置筛选条件
const setImageFilter = (filter: ImageFilterType) => {
  imageFilter.value = filter
}

const setVideoFilter = (filter: VideoFilterType) => {
  videoFilter.value = filter
}

const setCanvasFilter = (filter: CanvasFilterType) => {
  canvasFilter.value = filter
}

const setEditorFilter = (filter: EditorFilterType) => {
  editorFilter.value = filter
}

const setStoryFilter = (filter: StoryFilterType) => {
  storyFilter.value = filter
}

const setAudioFilter = (filter: AudioFilterType) => {
  audioFilter.value = filter
}

// 批量操作处理函数
const handleBatchDelete = async () => {
  const itemIds = Array.from(selectedItems.value)
  if (!itemIds.length) return

  await applyAssetAction('delete', itemIds)
  await loadImageAssets()
  exitBatchMode()
  ElMessage.success(`已删除 ${itemIds.length} 项内容`)
}

const handleBatchDownload = async () => {
  const itemIds = Array.from(selectedItems.value)
  if (!itemIds.length) return

  await applyAssetAction('download', itemIds)
  ElMessage.success(`已记录 ${itemIds.length} 项下载`)
}

const handleBatchPublish = async () => {
  const itemIds = Array.from(selectedItems.value)
  if (!itemIds.length) return

  await applyAssetAction('publish', itemIds)
  await loadImageAssets()
  ElMessage.success(`已提交 ${itemIds.length} 项内容，等待管理员审核`)
}

const handleBatchFavorite = async () => {
  const itemIds = Array.from(selectedItems.value)
  if (!itemIds.length) return

  await applyAssetAction('favorite', itemIds)
  ElMessage.success(`已收藏 ${itemIds.length} 项内容`)
}

const handleEditInCapCut = async () => {
  const itemIds = Array.from(selectedItems.value)
  console.log('去剪映编辑:', itemIds)
  // TODO: 实现剪映编辑逻辑
  ElMessage.info(`将在剪映中编辑 ${itemIds.length} 项内容`)
}

// 监听标签页切换，退出批量操作模式
watch(activeTab, () => {
  exitBatchMode()
})

// 图片预览事件处理
const handlePreviewDownload = (image: ImageItem) => {
  void applyAssetAction('download', [image.id]).then(() => {
    ElMessage.success('已记录下载')
  })
}

const handlePreviewFavorite = (image: ImageItem) => {
  void applyAssetAction('favorite', [image.id]).then(() => {
    ElMessage.success('已添加到收藏')
  })
}

const handlePreviewPublish = (image: ImageItem) => {
  publishTargetImage.value = image
  publishArtworkVisible.value = true
}

// 单张发布走参考页弹窗，确认后再真正执行发布。
const handlePublishArtworkSubmit = async ({
                                            image,
                                          }: {
  image: ImageItem
  title: string
  description: string
}) => {
  publishSubmitting.value = true

  try {
    await applyAssetAction('publish', [image.id])
    publishArtworkVisible.value = false
    publishTargetImage.value = null
    await loadImageAssets()
    ElMessage.success('已提交审核，管理员通过后将公开展示')
  } finally {
    publishSubmitting.value = false
  }
}

const handlePreviewGenerateVideo = (image: ImageItem) => {
  console.log('生成视频:', image)
  ElMessage.info('开始生成视频')
  // TODO: 实现生成视频逻辑
}

const handlePreviewEditInCanvas = (image: ImageItem) => {
  console.log('去画布编辑:', image)
  ElMessage.info('打开画布编辑器')
  // TODO: 实现画布编辑逻辑
}
</script>

<style>
@import "./AssetManagement.css";
</style>
