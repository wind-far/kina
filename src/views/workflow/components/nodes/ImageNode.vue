<script setup lang="ts">
/**
 * 图片节点（即梦风样板）
 *
 * 视觉对照用户截图：
 *   - 标题外置（节点上方左侧浮 Image 图标 + label）
 *   - 空态时显示「尝试」菜单：图生图 / 图生视频 / 图片换背景 / 首帧图生视频
 *   - 有内容态：显示图片（含批量组叠卡）+ 上传/替换按钮
 *   - 选中态：青绿色亮描边
 *   - 左右连接点：圆形「+」按钮
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import {
  CopyDocument,
  Download,
  Delete,
  Picture,
  VideoCamera,
  PictureFilled,
  Sunny,
  Upload as UploadIcon,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import CanvasNodeHoverToolbar, { type NodeToolbarAction } from '@/components/canvas/CanvasNodeHoverToolbar.vue'
import {
  updateNode,
  removeNode,
  duplicateNode,
  addNode,
  addEdge,
  nodes,
  type WorkflowImageNodeData,
} from '../../composables/useWorkflowCanvas'
import { uploadStorageFile } from '@/api/storage'

const props = defineProps<{
  id: string
  data: WorkflowImageNodeData & { selected?: boolean }
}>()
const { updateNodeInternals } = useVueFlow()

const showActions = ref(false)
const imageUrl = ref(props.data?.url || '')
const isLoading = ref(!!props.data?.loading)
const errorMsg = ref(props.data?.error || '')
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  [() => props.data?.url, () => props.data?.loading, () => props.data?.error],
  ([url, loading, error]) => {
    if (url !== undefined) imageUrl.value = url
    if (loading !== undefined) isLoading.value = loading
    if (error !== undefined) errorMsg.value = error
  },
)

const isEmpty = computed(() => !imageUrl.value && !isLoading.value && !errorMsg.value)

// 上传图片
const triggerUpload = () => fileInputRef.value?.click()
const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    isLoading.value = true
    updateNode(props.id, { loading: true })
    const uploaded = await uploadStorageFile(file, 'asset')
    if (uploaded) {
      imageUrl.value = uploaded.publicUrl
      updateNode(props.id, { url: uploaded.publicUrl, loading: false })
    } else {
      throw new Error('upload returned empty')
    }
  } catch (err) {
    ElMessage.error('图片上传失败')
    updateNode(props.id, { loading: false, error: '上传失败' })
    // eslint-disable-next-line no-console
    console.error('[ImageNode] upload failed', err)
  } finally {
    isLoading.value = false
    input.value = ''
  }
}

const handleDownload = async () => {
  if (!imageUrl.value) return
  try {
    const res = await fetch(imageUrl.value)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `image_${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    window.open(imageUrl.value, '_blank')
  }
}

const handleDelete = () => removeNode(props.id)
const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) setTimeout(() => updateNodeInternals([newId]), 50)
}

// 批量生图组：当 isBatchRoot 且子图数量 > 1 时显示叠卡 + 计数
const isBatchGroupVisible = computed(() =>
  Boolean(props.data?.isBatchRoot && (props.data.batchChildren?.length ?? 0) > 1),
)
const batchChildCount = computed(() => props.data?.batchChildren?.length ?? 0)
const toggleBatchExpanded = () => {
  if (!isBatchGroupVisible.value) return
  updateNode(props.id, { batchExpanded: !props.data?.batchExpanded })
}

// 「尝试」菜单：图生图 / 图生视频 / 图片换背景 / 首帧图生视频
const requireImage = (): boolean => {
  if (imageUrl.value) return true
  ElMessage.info('请先上传图片，再使用该能力')
  void nextTick(() => triggerUpload())
  return false
}

const handleImageToImage = () => {
  if (!requireImage()) return
  const node = nodes.value.find((n) => n.id === props.id)
  if (!node) return
  const newId = addNode('imageConfig', { x: node.position.x + 380, y: node.position.y })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'imageOrder',
    data: { imageOrder: 1 },
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}
const handleImageToVideo = (role: 'first_frame_image' | 'input_reference' = 'input_reference') => {
  if (!requireImage()) return
  const node = nodes.value.find((n) => n.id === props.id)
  if (!node) return
  const newId = addNode('videoConfig', { x: node.position.x + 380, y: node.position.y })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'imageRole',
    data: { imageRole: role },
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}
const handleChangeBackground = () => {
  ElMessage.info('图片换背景接入中，敬请期待')
}

const hoverActions = computed<NodeToolbarAction[]>(() => {
  const list: NodeToolbarAction[] = [
    { id: 'duplicate', label: '复制', icon: CopyDocument, onClick: handleDuplicate },
  ]
  if (imageUrl.value) {
    list.push({ id: 'download', label: '下载', icon: Download, onClick: handleDownload })
  }
  list.push({ id: 'delete', label: '删除', icon: Delete, danger: true, onClick: handleDelete })
  return list
})

const emptyMenuItems = [
  { id: 'i2i', label: '图生图', icon: Picture, onClick: handleImageToImage },
  { id: 'i2v', label: '图生视频', icon: VideoCamera, onClick: () => handleImageToVideo('input_reference') },
  { id: 'bg', label: '图片换背景', icon: Sunny, onClick: handleChangeBackground },
  { id: 'first-frame', label: '首帧图生视频', icon: PictureFilled, onClick: () => handleImageToVideo('first_frame_image') },
]
</script>

<template>
  <div class="image-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- 节点外置标题 -->
    <div class="image-node-title">
      <el-icon class="image-node-title-icon"><Picture /></el-icon>
      <span>{{ data?.label || 'Image' }}</span>
    </div>

    <!-- 节点本体 -->
    <div class="image-node-card" :class="{ 'is-selected': data?.selected }">
      <!-- 空态：尝试菜单 -->
      <div v-if="isEmpty" class="image-node-empty">
        <div class="image-node-empty-title">尝试：</div>
        <div class="image-node-empty-menu">
          <button
            v-for="item in emptyMenuItems"
            :key="item.id"
            type="button"
            class="image-node-empty-item nodrag nopan"
            @click.stop="item.onClick"
          >
            <el-icon class="image-node-empty-item-icon">
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
        <button class="image-node-upload-pill nodrag nopan" @click.stop="triggerUpload">
          <el-icon><UploadIcon /></el-icon>
          <span>上传图片</span>
        </button>
      </div>

      <!-- 加载态 -->
      <div v-else-if="isLoading" class="image-node-loading">
        <div class="image-node-spinner" />
        <span>生成中…</span>
      </div>

      <!-- 错误态 -->
      <div v-else-if="errorMsg" class="image-node-error" @click.stop="triggerUpload">
        <span>{{ errorMsg }}，点击重新上传</span>
      </div>

      <!-- 有图态 -->
      <div
        v-else
        class="image-node-display"
        :class="{ 'is-batch-root': isBatchGroupVisible, 'is-batch-expanded': data?.batchExpanded }"
        @dblclick.stop="toggleBatchExpanded"
      >
        <template v-if="isBatchGroupVisible && !data?.batchExpanded">
          <div class="image-node-batch-frame image-node-batch-frame--2" aria-hidden="true" />
          <div class="image-node-batch-frame image-node-batch-frame--1" aria-hidden="true" />
        </template>
        <img :src="imageUrl" alt="生成图片" class="image-node-image" />
        <span v-if="isBatchGroupVisible" class="image-node-batch-count" :title="`批量组 ${batchChildCount} 张，双击展开/折叠`">
          {{ batchChildCount }}
        </span>
        <div v-if="isBatchGroupVisible && data?.batchExpanded" class="image-node-batch-grid">
          <div
            v-for="child in data?.batchChildren"
            :key="child.id"
            class="image-node-batch-grid__item"
            :class="{ 'is-primary': child.id === data?.primaryImageId }"
            @click.stop
          >
            <img :src="child.url" alt="批量子图" />
            <button
              class="image-node-batch-set-primary"
              title="设为主图"
              @click.stop="updateNode(id, { primaryImageId: child.id, url: child.url })"
            >
              ★
            </button>
          </div>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        style="display: none"
        @change="handleFileChange"
      />
    </div>

    <Handle type="target" :position="Position.Left" id="left" class="image-node-handle" />
    <Handle type="source" :position="Position.Right" id="right" class="image-node-handle" />

    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />
  </div>
</template>

<style scoped>
.image-node-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.image-node-title {
  position: absolute;
  top: -26px;
  left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.2px;
  pointer-events: none;
}
.image-node-title-icon {
  font-size: 14px;
  color: var(--text-tertiary);
}

.image-node-card {
  width: 100%;
  height: 100%;
  background: var(--canvas-bg-block-default);
  border: 1px solid var(--stroke-secondary);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  transition: border-color 0.16s, box-shadow 0.16s;
  overflow: hidden;
}
.image-node-card.is-selected {
  border-color: var(--canvas-selection-border);
  box-shadow: 0 0 0 1.5px var(--canvas-selection-border);
}

.image-node-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 0;
}
.image-node-empty-title {
  color: var(--text-tertiary);
  font-size: 12px;
  letter-spacing: 0.4px;
}
.image-node-empty-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.image-node-empty-item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
  background: transparent;
  border: 0;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: var(--lv-border-radius-medium);
  transition: background-color 0.12s;
}
.image-node-empty-item:hover {
  background: var(--canvas-float-block-hover);
}
.image-node-empty-item-icon {
  font-size: 16px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.image-node-upload-pill {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  background: var(--canvas-float-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: var(--lv-border-radius-medium);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}
.image-node-upload-pill:hover {
  background: var(--canvas-float-block-hover);
  color: var(--brand-main-default);
}

/* 加载/错误态 */
.image-node-loading,
.image-node-error {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.image-node-error {
  color: #ef4444;
  cursor: pointer;
}
.image-node-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--stroke-secondary);
  border-top-color: var(--brand-main-default);
  animation: image-node-spin 0.8s linear infinite;
}
@keyframes image-node-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 批量组叠卡 + 计数（沿用上一版样式） */
.image-node-display {
  position: relative;
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.image-node-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  position: relative;
  z-index: 1;
  border-radius: var(--lv-border-radius-medium);
}
.image-node-batch-frame {
  position: absolute;
  inset: 0;
  background: var(--canvas-bg-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: var(--lv-border-radius-medium);
  pointer-events: none;
}
.image-node-batch-frame--1 {
  transform: translate(-4px, -4px) rotate(-2deg);
  z-index: 0;
  opacity: 0.6;
}
.image-node-batch-frame--2 {
  transform: translate(-8px, -8px) rotate(-4deg);
  z-index: -1;
  opacity: 0.32;
}
.image-node-batch-count {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  padding: 1px 8px;
  background: var(--brand-main-default);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  pointer-events: none;
}
.image-node-batch-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 6px;
  padding: 8px;
  background: var(--canvas-float-block-default);
  border-radius: var(--lv-border-radius-medium);
  overflow-y: auto;
  z-index: 3;
}
.image-node-batch-grid__item {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--canvas-image-loading-start);
  border-radius: var(--lv-border-radius-small);
  overflow: hidden;
  border: 1.5px solid transparent;
  transition: border-color 0.12s;
}
.image-node-batch-grid__item:hover,
.image-node-batch-grid__item.is-primary {
  border-color: var(--brand-main-default);
}
.image-node-batch-grid__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-node-batch-set-primary {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  background: var(--canvas-float-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.image-node-batch-grid__item.is-primary .image-node-batch-set-primary {
  background: var(--brand-main-default);
  color: #fff;
  border-color: var(--brand-main-default);
}

/* 左右连接点：圆形 + */
.image-node-handle {
  width: 20px !important;
  height: 20px !important;
  border-radius: 50% !important;
  background: var(--canvas-bg-block-default) !important;
  border: 1px solid var(--stroke-secondary) !important;
  transition: background-color 0.12s, border-color 0.12s, transform 0.12s;
}
.image-node-handle::before {
  content: '+';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--text-secondary);
  pointer-events: none;
  line-height: 1;
}
.image-node-handle:hover {
  background: var(--canvas-float-block-hover) !important;
  border-color: var(--canvas-selection-border) !important;
  transform: scale(1.1);
}
</style>
