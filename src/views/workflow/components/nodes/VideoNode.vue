<script setup lang="ts">
/**
 * 视频节点（即梦风样板）
 *
 * 视觉对照用户截图：
 *   - 标题外置（节点上方左侧浮 VideoCamera 图标 + label）
 *   - 空态时显示「尝试」菜单：全能参考 / 图生视频 / 首尾帧生视频
 *   - 有内容态：原生 <video controls> + 下载按钮
 *   - 选中态：青绿色亮描边
 *   - 左右连接点：圆形「+」按钮
 */
import { computed, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import {
  CopyDocument,
  Download,
  Delete,
  VideoCamera,
  Aim,
  Picture,
  Film,
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
  type WorkflowVideoNodeData,
} from '../../composables/useWorkflowCanvas'
import { uploadStorageFile } from '@/api/storage'

const props = defineProps<{
  id: string
  data: WorkflowVideoNodeData & { selected?: boolean }
}>()
const { updateNodeInternals } = useVueFlow()

const showActions = ref(false)
const videoUrl = ref(props.data?.url || '')
const isLoading = ref(!!props.data?.loading)
const errorMsg = ref(props.data?.error || '')
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  [() => props.data?.url, () => props.data?.loading, () => props.data?.error],
  ([url, loading, error]) => {
    if (url !== undefined) videoUrl.value = url
    if (loading !== undefined) isLoading.value = loading
    if (error !== undefined) errorMsg.value = error
  },
)

const isEmpty = computed(() => !videoUrl.value && !isLoading.value && !errorMsg.value)

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
      videoUrl.value = uploaded.publicUrl
      updateNode(props.id, { url: uploaded.publicUrl, loading: false })
    } else {
      throw new Error('upload returned empty')
    }
  } catch (err) {
    ElMessage.error('视频上传失败')
    updateNode(props.id, { loading: false, error: '上传失败' })
    // eslint-disable-next-line no-console
    console.error('[VideoNode] upload failed', err)
  } finally {
    isLoading.value = false
    input.value = ''
  }
}

const handleDownload = () => {
  if (!videoUrl.value) return
  const a = document.createElement('a')
  a.href = videoUrl.value
  a.download = `video_${Date.now()}.mp4`
  a.click()
}

const handleDelete = () => removeNode(props.id)
const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) setTimeout(() => updateNodeInternals([newId]), 50)
}

const requireVideo = (): boolean => {
  if (videoUrl.value) return true
  ElMessage.info('请先上传视频或先生成视频，再使用该能力')
  return false
}

const handleAllReference = () => {
  if (!requireVideo()) return
  ElMessage.info('「全能参考」接入中，敬请期待')
}
const handleImageToVideo = () => {
  const node = nodes.value.find((n) => n.id === props.id)
  if (!node) return
  const newId = addNode('videoConfig', { x: node.position.x + 380, y: node.position.y })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'imageRole',
    data: { imageRole: 'input_reference' },
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}
const handleFirstLastFrame = () => {
  ElMessage.info('「首尾帧生视频」接入中，敬请期待')
}

const hoverActions = computed<NodeToolbarAction[]>(() => {
  const list: NodeToolbarAction[] = [
    { id: 'duplicate', label: '复制', icon: CopyDocument, onClick: handleDuplicate },
  ]
  if (videoUrl.value) {
    list.push({ id: 'download', label: '下载', icon: Download, onClick: handleDownload })
  }
  list.push({ id: 'delete', label: '删除', icon: Delete, danger: true, onClick: handleDelete })
  return list
})

const emptyMenuItems = [
  { id: 'all-ref', label: '全能参考', icon: Aim, onClick: handleAllReference },
  { id: 'i2v', label: '图生视频', icon: Picture, onClick: handleImageToVideo },
  { id: 'first-last', label: '首尾帧生视频', icon: Film, onClick: handleFirstLastFrame },
]
</script>

<template>
  <div class="video-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <div class="video-node-title">
      <el-icon class="video-node-title-icon"><VideoCamera /></el-icon>
      <span>{{ data?.label || 'Video' }}</span>
    </div>

    <div class="video-node-card" :class="{ 'is-selected': data?.selected }">
      <!-- 空态：尝试菜单 -->
      <div v-if="isEmpty" class="video-node-empty">
        <div class="video-node-empty-title">尝试：</div>
        <div class="video-node-empty-menu">
          <button
            v-for="item in emptyMenuItems"
            :key="item.id"
            type="button"
            class="video-node-empty-item nodrag nopan"
            @click.stop="item.onClick"
          >
            <el-icon class="video-node-empty-item-icon">
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
        <button class="video-node-upload-pill nodrag nopan" @click.stop="triggerUpload">
          <el-icon><UploadIcon /></el-icon>
          <span>上传视频</span>
        </button>
      </div>

      <!-- 加载/错误 -->
      <div v-else-if="isLoading" class="video-node-loading">
        <div class="video-node-spinner" />
        <span>生成中…</span>
      </div>
      <div v-else-if="errorMsg" class="video-node-error" @click.stop="triggerUpload">
        <span>{{ errorMsg }}，点击重新上传</span>
      </div>

      <!-- 有视频态 -->
      <video
        v-else
        :src="videoUrl"
        controls
        class="video-node-player nodrag nopan"
        @mousedown.stop
        @wheel.stop
      />

      <input
        ref="fileInputRef"
        type="file"
        accept="video/*"
        style="display: none"
        @change="handleFileChange"
      />
    </div>

    <Handle type="target" :position="Position.Left" id="left" class="video-node-handle" />
    <Handle type="source" :position="Position.Right" id="right" class="video-node-handle" />

    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />
  </div>
</template>

<style scoped>
.video-node-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-node-title {
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
.video-node-title-icon {
  font-size: 14px;
  color: var(--text-tertiary);
}

.video-node-card {
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
  overflow: hidden;
  transition: border-color 0.16s, box-shadow 0.16s;
}
.video-node-card.is-selected {
  border-color: var(--canvas-selection-border);
  box-shadow: 0 0 0 1.5px var(--canvas-selection-border);
}

.video-node-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 0;
}
.video-node-empty-title {
  color: var(--text-tertiary);
  font-size: 12px;
  letter-spacing: 0.4px;
}
.video-node-empty-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.video-node-empty-item {
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
.video-node-empty-item:hover {
  background: var(--canvas-float-block-hover);
}
.video-node-empty-item-icon {
  font-size: 16px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.video-node-upload-pill {
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
.video-node-upload-pill:hover {
  background: var(--canvas-float-block-hover);
  color: var(--brand-main-default);
}

.video-node-loading,
.video-node-error {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.video-node-error {
  color: #ef4444;
  cursor: pointer;
}
.video-node-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--stroke-secondary);
  border-top-color: var(--brand-main-default);
  animation: video-node-spin 0.8s linear infinite;
}
@keyframes video-node-spin {
  to {
    transform: rotate(360deg);
  }
}

.video-node-player {
  width: 100%;
  height: 100%;
  border-radius: var(--lv-border-radius-medium);
  background: #000;
}

.video-node-handle {
  width: 20px !important;
  height: 20px !important;
  border-radius: 50% !important;
  background: var(--canvas-bg-block-default) !important;
  border: 1px solid var(--stroke-secondary) !important;
  transition: background-color 0.12s, border-color 0.12s, transform 0.12s;
}
.video-node-handle::before {
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
.video-node-handle:hover {
  background: var(--canvas-float-block-hover) !important;
  border-color: var(--canvas-selection-border) !important;
  transform: scale(1.1);
}
</style>
