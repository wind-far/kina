<script setup lang="ts">
/**
 * 图片节点组件
 * 展示生成的图片，支持上传、URL输入和预览
 */
import { ref, computed, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import { CopyDocument, Download, Delete } from '@element-plus/icons-vue'
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
import WfNodeTitle from '../WfNodeTitle.vue'
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
const urlInput = ref('')
const urlLoading = ref(false)

watch(
  [() => props.data?.url, () => props.data?.loading, () => props.data?.error],
  ([url, loading, error]) => {
    if (url !== undefined) imageUrl.value = url
    if (loading !== undefined) isLoading.value = loading
    if (error !== undefined) errorMsg.value = error
  },
)

// 上传图片
const handleUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e) => {
    const target = e.target as HTMLInputElement | null
    const file = target?.files?.[0]
    if (!file) return
    urlLoading.value = true
    errorMsg.value = ''
    try {
      // 工作流参考图优先转成托管地址，避免后续链路继续传递超长 base64。
      const uploaded = await uploadStorageFile(file, 'reference', {
        showSuccessMessage: false,
      })
      const nextUrl = String(uploaded.publicUrl || uploaded.filePath || '').trim()
      if (!nextUrl) {
        throw new Error('上传后未返回可用图片地址')
      }
      imageUrl.value = nextUrl
      updateNode(props.id, { url: nextUrl, base64: '', error: '' })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '图片上传失败'
      errorMsg.value = message
      updateNode(props.id, { error: message })
    } finally {
      urlLoading.value = false
    }
  }
  input.click()
}

// URL 输入加载图片
const handleUrlSubmit = () => {
  const url = urlInput.value.trim()
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return
  urlLoading.value = true
  const img = new Image()
  img.onload = () => {
    updateNode(props.id, { url, label: '网络图片' })
    imageUrl.value = url
    urlInput.value = ''
    urlLoading.value = false
  }
  img.onerror = () => { urlLoading.value = false }
  img.src = url
}

// 预览图片（新窗口）
const handlePreview = () => {
  if (imageUrl.value) window.open(imageUrl.value, '_blank')
}

// 下载图片
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

// 快捷创建图生图
const createImageConfig = () => {
  const node = nodes.value.find(n => n.id === props.id)
  if (!node) return
  const newId = addNode('imageConfig', {
    x: (node.position?.x || 0) + 380,
    y: node.position?.y || 0
  })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'imageOrder',
    data: { imageOrder: 1 }
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}

// 快捷创建视频生成
const createVideoConfig = () => {
  const node = nodes.value.find(n => n.id === props.id)
  if (!node) return
  const x = (node.position?.x || 0), y = (node.position?.y || 0)
  const textId = addNode('text', { x: x + 300, y: y - 100 }, { content: '', label: '提示词' })
  const configId = addNode('videoConfig', { x: x + 600, y }, { label: '视频生成' })
  addEdge({ source: props.id, target: configId, sourceHandle: 'right', targetHandle: 'left', type: 'imageRole', data: { imageRole: 'first_frame_image' } })
  addEdge({ source: textId, target: configId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })
  setTimeout(() => { updateNodeInternals([textId]); updateNodeInternals([configId]) }, 50)
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
</script>

<template>
  <div class="wf-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <NodeResizer :min-width="220" :min-height="160" />
    <div class="wf-node wf-node-image" :class="{ selected: data.selected }">
      <!-- 头部 -->
      <div class="wf-node-header">
        <div class="wf-node-header-left">
          <span class="wf-node-header-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <WfNodeTitle :node-id="id" :label="data.label" placeholder="图片" />
        </div>
        <button class="wf-btn wf-btn-sm" @click="handleDelete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- 内容 -->
      <div class="wf-node-body">
        <div class="wf-media-preview" @mousedown.stop>
          <!-- 加载中 -->
          <div v-if="isLoading" class="wf-generating-overlay square">
            <div class="wf-generating-pulse"></div>
            <div class="wf-generating-icon"><img src="../../assets/loading.webp" alt="" /></div>
            <span class="wf-generating-text">创作中</span>
          </div>
          <!-- 错误状态 -->
          <div
            v-else-if="errorMsg"
            class="wf-media-error"
            style="cursor: pointer;"
            title="点击重新上传"
            @click="handleUpload"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>
            <span>{{ errorMsg }}</span>
          </div>
          <!-- 有图片 -->
          <div
            v-else-if="imageUrl"
            class="image-node-display"
            :class="{ 'is-batch-root': isBatchGroupVisible, 'is-batch-expanded': data?.batchExpanded }"
            @dblclick.stop="toggleBatchExpanded"
          >
            <!-- 批量组未展开时显示叠卡假影 -->
            <template v-if="isBatchGroupVisible && !data?.batchExpanded">
              <div class="image-node-batch-frame image-node-batch-frame--2" aria-hidden="true" />
              <div class="image-node-batch-frame image-node-batch-frame--1" aria-hidden="true" />
            </template>
            <img :src="imageUrl" alt="生成图片" class="image-node-image" />
            <span v-if="isBatchGroupVisible" class="image-node-batch-count" :title="`批量组 ${batchChildCount} 张，双击展开/折叠`">
              {{ batchChildCount }}
            </span>
            <!-- 展开后的子图网格 -->
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
          <!-- URL 加载中 -->
          <div v-else-if="urlLoading" class="wf-generating-overlay square">
            <div class="wf-generating-pulse"></div>
            <span class="wf-generating-text">加载中...</span>
          </div>
          <!-- 空状态：上传 + URL 输入 -->
          <div v-else class="wf-media-placeholder" style="cursor: default;">
            <div style="text-align: center; cursor: pointer;" @click="handleUpload">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 8px;">
                <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>点击上传图片</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 0.5px solid var(--stroke-tertiary, rgba(204,221,255,0.08));">
              <input
                v-model="urlInput"
                placeholder="输入图片地址..."
                @keydown.enter="handleUrlSubmit"
                @mousedown.stop
                style="flex: 1; background: var(--bg-block-secondary-default); border: 0.5px solid var(--stroke-tertiary); border-radius: 6px; padding: 4px 8px; color: var(--text-primary); font-size: 11px; outline: none;"
              />
              <button class="wf-node-action-btn" @click="handleUrlSubmit" :disabled="!urlInput.trim()" style="padding: 4px 8px; white-space: nowrap;">
                <span>预览</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div v-if="imageUrl" style="display: flex; gap: 6px; margin-top: 8px;">
          <button class="wf-node-action-btn" @click="createImageConfig" style="flex: 1; justify-content: center;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>图生图</span>
          </button>
          <button class="wf-node-action-btn" @click="createVideoConfig" style="flex: 1; justify-content: center;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>生成视频</span>
          </button>
          <button class="wf-node-action-btn" @click="handlePreview" title="预览">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <button class="wf-node-action-btn" @click="handleDownload" title="下载">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 连接点 -->
      <Handle type="target" :position="Position.Left" id="left" />
      <Handle type="source" :position="Position.Right" id="right" />
    </div>

    <!-- 悬浮操作 -->
    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />
  </div>
</template>

<style scoped>
/* 批量生图组：叠卡 + 计数 chip + 展开网格 */
.image-node-display {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.image-node-image {
  max-height: 300px;
  object-fit: contain;
  position: relative;
  z-index: 1;
  border-radius: var(--lv-border-radius-medium);
}
.image-node-display.is-batch-root .image-node-image {
  box-shadow: 0 0 0 0.5px var(--stroke-secondary);
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
  user-select: none;
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
.image-node-batch-grid__item:hover {
  border-color: var(--brand-main-default);
}
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
</style>
