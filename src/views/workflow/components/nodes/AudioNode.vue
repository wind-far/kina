<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CopyDocument, Delete, Download, Headset, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import CanvasNodeHoverToolbar, { type NodeToolbarAction } from '@/components/canvas/CanvasNodeHoverToolbar.vue'
import CanvasNodeAddHandle from '@/components/canvas/CanvasNodeAddHandle.vue'
import CanvasNodeResizer from '@/components/canvas/CanvasNodeResizer.vue'
import { useNodeTitleEdit } from '@/composables/useNodeTitleEdit'
import { uploadStorageFile } from '@/api/storage'
import { validateWorkflowAudioFile, WORKFLOW_AUDIO_ACCEPT } from '@/shared/workflow-audio-file'
import {
  duplicateNode,
  removeNode,
  updateNode,
  type WorkflowAudioNodeData,
} from '../../composables/useWorkflowCanvas'

const props = defineProps<{
  id: string
  data: WorkflowAudioNodeData & { selected?: boolean }
  selected?: boolean
}>()

const isSelected = computed(() => props.selected || props.data?.selected)
const titleEdit = useNodeTitleEdit(props.id, () => props.data?.label || '音频节点')
const showActions = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const url = ref(props.data?.url || '')
const transcript = ref(props.data?.transcript || '')

watch(() => props.data?.url, value => { if (value !== undefined) url.value = value })
watch(() => props.data?.transcript, value => { if (value !== undefined) transcript.value = value })

const triggerUpload = () => fileInputRef.value?.click()
const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const validation = validateWorkflowAudioFile(file)
  if (!validation.valid) {
    ElMessage.warning(validation.message)
    input.value = ''
    return
  }
  uploading.value = true
  try {
    const uploaded = await uploadStorageFile(file, 'asset')
    if (!uploaded?.publicUrl) throw new Error('音频上传失败')
    url.value = uploaded.publicUrl
    updateNode(props.id, { url: uploaded.publicUrl, fileName: file.name, error: '' })
    ElMessage.success('音频已上传')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '音频上传失败')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

const persistTranscript = () => updateNode(props.id, { transcript: transcript.value })
const handleMetadata = (event: Event) => {
  const duration = Number((event.target as HTMLAudioElement).duration || 0)
  if (Number.isFinite(duration)) updateNode(props.id, { duration })
}
const handleDownload = () => {
  if (!url.value) return
  const anchor = document.createElement('a')
  anchor.href = url.value
  anchor.download = props.data?.fileName || `audio-${Date.now()}`
  anchor.click()
}

const hoverActions = computed<NodeToolbarAction[]>(() => [
  { id: 'upload', label: url.value ? '替换' : '上传', icon: Upload, onClick: triggerUpload },
  ...(url.value ? [{ id: 'download', label: '下载', icon: Download, onClick: handleDownload }] : []),
  { id: 'duplicate', label: '复制', icon: CopyDocument, onClick: () => duplicateNode(props.id) },
  { id: 'delete', label: '删除', icon: Delete, danger: true, onClick: () => removeNode(props.id) },
])
</script>

<template>
  <div class="audio-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <CanvasNodeResizer :visible="isSelected" :min-width="300" :min-height="210" />
    <div class="audio-node-title" title="双击编辑名称" @dblclick.stop="titleEdit.start">
      <el-icon><Headset /></el-icon>
      <input
        v-if="titleEdit.editing.value"
        :ref="titleEdit.setInputRef"
        v-model="titleEdit.draft.value"
        class="audio-node-title-input nodrag"
        @blur="titleEdit.commit"
        @keydown.enter.prevent="titleEdit.commit"
        @keydown.esc.prevent="titleEdit.cancel"
        @mousedown.stop
      >
      <span v-else>{{ data?.label || '音频节点' }}</span>
    </div>
    <div class="audio-node-card" :class="{ 'is-selected': isSelected }">
      <div class="audio-node-status">素材节点 · 当前不自动执行语音生成</div>
      <button v-if="!url" class="audio-node-upload nodrag nopan" :disabled="uploading" @click.stop="triggerUpload">
        <el-icon><Upload /></el-icon>
        <span>{{ uploading ? '上传中…' : '上传音频' }}</span>
      </button>
      <template v-else>
        <audio :src="url" controls preload="metadata" class="nodrag nopan" @loadedmetadata="handleMetadata" @mousedown.stop />
        <div class="audio-node-file">{{ data?.fileName || '已上传音频' }}</div>
      </template>
      <label>
        <span>字幕 / 备注</span>
        <textarea v-model="transcript" class="nodrag nopan" placeholder="可填写旁白、歌词或音频说明…" @input="persistTranscript" @mousedown.stop />
      </label>
      <input ref="fileInputRef" type="file" :accept="WORKFLOW_AUDIO_ACCEPT" hidden @change="handleFileChange">
    </div>
    <CanvasNodeAddHandle side="left" :visible="isSelected" :node-id="id" />
    <CanvasNodeAddHandle side="right" :visible="isSelected" :node-id="id" />
    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />
  </div>
</template>

<style scoped>
.audio-node-wrapper { position: relative; width: 100%; height: 100%; min-width: 300px; min-height: 210px; }
.audio-node-title { position: absolute; bottom: calc(100% + 8px); left: 2px; display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 15px; }
.audio-node-title-input { width: 180px; border: 1px solid var(--brand-main-default); border-radius: 5px; padding: 2px 6px; background: var(--canvas-node-bg); color: var(--text-primary); }
.audio-node-card { box-sizing: border-box; width: 100%; height: 100%; min-height: 0; padding: 16px; border: 1px solid var(--canvas-node-border); border-radius: 16px; background: var(--canvas-node-bg); display: flex; flex-direction: column; gap: 12px; }
.audio-node-card.is-selected { border-color: var(--brand-main-default); box-shadow: 0 0 0 2px rgba(2, 219, 163, .16); }
.audio-node-status { padding: 7px 9px; border-radius: 8px; background: rgba(59, 130, 246, .1); color: #7db2ff; font-size: 12px; }
.audio-node-upload { min-height: 72px; border: 1px dashed var(--stroke-secondary); border-radius: 10px; background: rgba(255, 255, 255, .03); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.audio-node-card audio { width: 100%; height: 36px; }
.audio-node-file { overflow: hidden; color: var(--text-tertiary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.audio-node-card label { display: flex; flex-direction: column; gap: 6px; color: var(--text-tertiary); font-size: 12px; }
.audio-node-card textarea { box-sizing: border-box; width: 100%; min-height: 68px; resize: vertical; border: 1px solid var(--stroke-secondary); border-radius: 9px; padding: 8px 10px; background: rgba(0, 0, 0, .18); color: var(--text-primary); outline: none; }
.audio-node-card textarea:focus { border-color: var(--brand-main-default); }
</style>
