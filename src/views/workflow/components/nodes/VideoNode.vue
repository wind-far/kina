<script setup lang="ts">
/**
 * 视频节点组件 - 展示生成的视频
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
  type WorkflowVideoNodeData,
} from '../../composables/useWorkflowCanvas'
import WfNodeTitle from '../WfNodeTitle.vue'

const props = defineProps<{
  id: string
  data: WorkflowVideoNodeData & { selected?: boolean }
}>()
const { updateNodeInternals } = useVueFlow()

const showActions = ref(false)
const videoUrl = ref(props.data?.url || '')
const isLoading = ref(!!props.data?.loading)
const errorMsg = ref(props.data?.error || '')

watch(
  [() => props.data?.url, () => props.data?.loading, () => props.data?.error],
  ([url, loading, error]) => {
    if (url !== undefined) videoUrl.value = url
    if (loading !== undefined) isLoading.value = loading
    if (error !== undefined) errorMsg.value = error
  },
)

const handleUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.onchange = (e) => {
    const target = e.target as HTMLInputElement | null
    const file = target?.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    videoUrl.value = url
    updateNode(props.id, { url })
  }
  input.click()
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
</script>

<template>
  <div class="wf-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <NodeResizer :min-width="240" :min-height="160" :keep-aspect-ratio="true" />
    <div class="wf-node wf-node-video" :class="{ selected: data.selected }">
      <div class="wf-node-header">
        <div class="wf-node-header-left">
          <span class="wf-node-header-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <WfNodeTitle :node-id="id" :label="data.label" placeholder="视频" />
        </div>
        <button class="wf-btn wf-btn-sm" @click="handleDelete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div class="wf-node-body">
        <div class="wf-media-preview" @mousedown.stop>
          <div v-if="isLoading" class="wf-generating-overlay video">
            <div class="wf-generating-pulse"></div>
            <div class="wf-generating-icon"><img src="../../assets/loading.webp" alt="" /></div>
            <span class="wf-generating-text">创作中，预计等待 1 分钟</span>
          </div>
          <div v-else-if="errorMsg" class="wf-media-error">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>
            <span>{{ errorMsg }}</span>
          </div>
          <video v-else-if="videoUrl" :src="videoUrl" controls style="max-height: 240px; width: 100%;" />
          <div v-else class="wf-media-placeholder" style="aspect-ratio: 16/9; cursor: pointer;" @click="handleUpload">
            <div style="text-align: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 8px;">
                <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <span>点击上传视频</span>
            </div>
          </div>
        </div>

        <div v-if="videoUrl" style="display: flex; gap: 6px; margin-top: 8px;">
          <button class="wf-node-action-btn" @click="handleDownload" style="flex: 1; justify-content: center;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>下载</span>
          </button>
        </div>
      </div>

      <Handle type="target" :position="Position.Left" id="left" />
      <Handle type="source" :position="Position.Right" id="right" />
    </div>

    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />
  </div>
</template>
