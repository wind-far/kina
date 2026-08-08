<script setup lang="ts">
/**
 * 视频节点（RunningHUB 风样板）
 *
 * 与 ImageNode 同款结构：
 *   - 卡片 380×280, border-radius 16
 *   - 标题外置
 *   - 4 类状态：空态菜单 / ready-state / 加载 / 有视频
 *   - 选中态：青绿描边 + 流光边框
 *   - 节点外 -56px "+" 按钮
 *   - 选中后下方浮出 CanvasPromptInput（视频模型 + 480p/5s/... chip + ¥3）
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
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
import WorkflowPromptInput, {
  type WorkflowPromptModelOption,
  type WorkflowPromptReference,
  type WorkflowPromptSendOptions,
} from '@/components/canvas/WorkflowPromptInput.vue'
import CanvasNodeAddHandle from '@/components/canvas/CanvasNodeAddHandle.vue'
import CanvasNodeResizer from '@/components/canvas/CanvasNodeResizer.vue'
import { useNodeTitleEdit } from '@/composables/useNodeTitleEdit'
import {
  updateNode,
  removeNode,
  duplicateNode,
  addNode,
  addEdge,
  nodes,
  edges,
  type WorkflowCanvasNode,
  type WorkflowVideoNodeData,
} from '../../composables/useWorkflowCanvas'
import { uploadStorageFile } from '@/api/storage'
import { getAllVideoModels, getDefaultVideoModelKey, loadPublicModelCatalog } from '@/config/models'
import {
  getWorkflowPromptAvailableReferenceSlots,
  mergeWorkflowPromptReferences,
  workflowPromptFileToDataUrl,
} from '@/shared/workflow-prompt-references'
import {
  resolveWorkflowVideoReferenceRole,
  type WorkflowVideoFeature,
} from '@/shared/workflow-video-prompt'

const props = defineProps<{
  id: string
  data: WorkflowVideoNodeData & { selected?: boolean }
  selected?: boolean
}>()
const isWorkflowImageNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'image'> => node?.type === 'image'
const isSelected = computed(() => props.selected || props.data?.selected)
const titleEdit = useNodeTitleEdit(props.id, () => props.data?.label || 'Video')
const { updateNodeInternals, addSelectedNodes, removeSelectedNodes, getNodes } = useVueFlow()

const showActions = ref(false)
const videoUrl = ref(props.data?.url || '')
const isLoading = ref(!!props.data?.loading)
const errorMsg = ref(props.data?.error || '')
const fileInputRef = ref<HTMLInputElement | null>(null)
const promptText = ref('')
const promptModel = ref(getDefaultVideoModelKey())
const promptFeature = ref<WorkflowVideoFeature>('smart-multi-frame')
const promptCount = ref(1)
const promptUploadedReferences = ref<WorkflowPromptReference[]>([])
const promptExcludedReferenceIds = ref<string[]>([])

watch(
  [() => props.data?.url, () => props.data?.loading, () => props.data?.error],
  ([url, loading, error]) => {
    if (url !== undefined) videoUrl.value = url
    if (loading !== undefined) isLoading.value = loading
    if (error !== undefined) errorMsg.value = error
  },
)

const hasUpstream = computed(() => edges.value.some((e) => e.target === props.id))

const showLoading = computed(() => isLoading.value)
const showError = computed(() => !isLoading.value && !!errorMsg.value)
const showVideo = computed(() => !isLoading.value && !errorMsg.value && !!videoUrl.value)
const showReady = computed(() => !showLoading.value && !showError.value && !showVideo.value && hasUpstream.value)
const showEmpty = computed(() => !showLoading.value && !showError.value && !showVideo.value && !showReady.value)

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

const selectPromptMode = (feature: WorkflowVideoFeature) => {
  promptFeature.value = feature
  const allNodes = getNodes.value
  removeSelectedNodes(allNodes.filter(node => node.selected))
  const current = allNodes.find(node => node.id === props.id)
  if (current) addSelectedNodes([current])
}
const handleAllReference = () => selectPromptMode('all-reference')
const handleImageToVideo = () => selectPromptMode('smart-multi-frame')
const handleFirstLastFrame = () => selectPromptMode('first-last-frame')

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

const promptModelOptions = computed<WorkflowPromptModelOption[]>(() => getAllVideoModels().map(item => ({
  key: item.key,
  label: item.label,
  provider: item.providerName,
})))

const connectedPromptReferences = computed<WorkflowPromptReference[]>(() => {
  const referenceTargets = new Set([props.id])
  for (const edge of edges.value) {
    if (edge.target !== props.id) continue
    const source = nodes.value.find(node => node.id === edge.source)
    if (source?.type === 'videoConfig') referenceTargets.add(source.id)
  }

  const connected = edges.value
    .filter(edge => referenceTargets.has(edge.target))
    .map(edge => nodes.value.find(node => node.id === edge.source))
    .filter((node): node is WorkflowCanvasNode<'image'> => isWorkflowImageNode(node) && Boolean(node.data.url))
    .map(node => ({ id: node.id, url: String(node.data.url), label: String(node.data.label || '参考图'), isSubject: Boolean(node.data.isSubject) }))

  return mergeWorkflowPromptReferences(connected)
})

const subjectPromptReferences = computed<WorkflowPromptReference[]>(() => nodes.value
  .filter((node): node is WorkflowCanvasNode<'image'> => isWorkflowImageNode(node) && Boolean(node.data.url) && Boolean(node.data.isSubject))
  .map(node => ({ id: node.id, url: String(node.data.url), label: String(node.data.label || '主体'), isSubject: true })))

const promptReferences = computed(() => mergeWorkflowPromptReferences(
  connectedPromptReferences.value,
  subjectPromptReferences.value,
  promptUploadedReferences.value,
).filter(reference => !promptExcludedReferenceIds.value.includes(reference.id)))

const availablePromptReferences = computed<WorkflowPromptReference[]>(() => nodes.value
  .filter((node): node is WorkflowCanvasNode<'image'> => isWorkflowImageNode(node) && Boolean(node.data.url))
  .map(node => ({ id: node.id, url: String(node.data.url), label: String(node.data.label || '参考图'), isSubject: Boolean(node.data.isSubject) })))

const promptSubjectCandidate = computed(() => connectedPromptReferences.value[0])
const handleCreateSubject = () => {
  const candidate = promptSubjectCandidate.value
  if (!candidate) {
    ElMessage.info('请先连接一张参考图片，再创建主体')
    return
  }
  const imageNode = nodes.value.find((node): node is WorkflowCanvasNode<'image'> => (
    node.id === candidate.id && isWorkflowImageNode(node)
  ))
  if (!imageNode) return
  const nextValue = !Boolean(imageNode.data.isSubject)
  updateNode(imageNode.id, { isSubject: nextValue })
  promptExcludedReferenceIds.value = promptExcludedReferenceIds.value.filter(id => id !== imageNode.id)
  ElMessage.success(nextValue ? '已设为主体，并加入当前参考' : '已取消主体标记')
}

const handlePromptFiles = async (files: File[]) => {
  const availableSlots = getWorkflowPromptAvailableReferenceSlots(promptReferences.value.length)
  if (!availableSlots) {
    ElMessage.info('最多支持 4 张参考图')
    return
  }
  const selectedFiles = files.slice(0, availableSlots)
  const settled = await Promise.allSettled(selectedFiles.map(async file => ({
    id: `video-upload-${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`,
    url: await workflowPromptFileToDataUrl(file),
    label: file.name,
  })))
  promptUploadedReferences.value.push(...settled
    .filter((result): result is PromiseFulfilledResult<WorkflowPromptReference & { url: string }> => result.status === 'fulfilled')
    .map(result => result.value))
}

const handlePromptRemoveReference = (id: string) => {
  if (promptUploadedReferences.value.some(reference => reference.id === id)) {
    promptUploadedReferences.value = promptUploadedReferences.value.filter(reference => reference.id !== id)
    return
  }
  promptExcludedReferenceIds.value = [...new Set([...promptExcludedReferenceIds.value, id])]
}

const handlePromptSend = (text: string, options: WorkflowPromptSendOptions) => {
  if (!options.modelKey) {
    ElMessage.warning('当前暂无可用的视频模型，请先在后台配置模型')
    return
  }
  const currentNode = nodes.value.find(node => node.id === props.id)
  if (!currentNode) return

  const prompt = text || `根据${options.references.map(reference => reference.label).join('、') || '参考素材'}生成视频`
  const configPosition = { x: currentNode.position.x - 400, y: currentNode.position.y }
  const promptNodeId = addNode('text', { x: configPosition.x, y: configPosition.y + 300 }, {
    content: prompt,
    label: '视频提示词',
  })
  const configNodeId = addNode('videoConfig', configPosition, {
    prompt,
    model: options.modelKey,
    ratio: options.ratio,
    duration: options.duration || 5,
    resolution: options.resolution,
    label: '图生视频',
    autoExecute: false,
  })
  addEdge({ source: promptNodeId, target: configNodeId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })

  const connectedIds = new Set<string>()
  options.references.forEach((reference, index) => {
    let referenceNodeId = nodes.value.find(node => node.id === reference.id && node.type === 'image')?.id || ''
    if (!referenceNodeId && reference.url) {
      referenceNodeId = addNode('image', {
        x: currentNode.position.x - 800,
        y: currentNode.position.y + index * 190,
      }, { url: reference.url, label: reference.label || '参考图' })
    }
    if (!referenceNodeId || connectedIds.has(referenceNodeId)) return
    connectedIds.add(referenceNodeId)
    addEdge({
      source: referenceNodeId,
      target: configNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'imageRole',
      data: { imageRole: resolveWorkflowVideoReferenceRole(options.feature, index) },
    })
  })

  addEdge({ source: configNodeId, target: props.id, sourceHandle: 'right', targetHandle: 'left' })
  promptText.value = ''
  window.setTimeout(() => {
    updateNodeInternals([configNodeId, props.id])
    updateNode(configNodeId, { autoExecute: true })
  }, 160)
}

onMounted(async () => {
  await loadPublicModelCatalog()
  promptModel.value = getDefaultVideoModelKey() || promptModelOptions.value[0]?.key || ''
})
</script>

<template>
  <div class="video-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <CanvasNodeResizer :visible="isSelected" :min-width="380" :min-height="280" />
    <div class="video-node-title" :title="titleEdit.editing.value ? '' : '双击编辑名称'" @dblclick.stop="titleEdit.start">
      <el-icon class="video-node-title-icon"><VideoCamera /></el-icon>
      <input
        v-if="titleEdit.editing.value"
        :ref="titleEdit.setInputRef"
        v-model="titleEdit.draft.value"
        class="video-node-title-input nodrag"
        :maxlength="40"
        @blur="titleEdit.commit"
        @keydown.enter.prevent="titleEdit.commit"
        @keydown.esc.prevent="titleEdit.cancel"
        @mousedown.stop
        @click.stop
      />
      <span v-else>{{ data?.label || 'Video' }}</span>
    </div>

    <div class="video-node-card" :class="{ 'is-selected': isSelected }">
      <span v-if="isSelected" class="video-node-flow video-node-flow--ring" aria-hidden="true" />
      <span v-if="isSelected" class="video-node-flow video-node-flow--glow" aria-hidden="true" />

      <!-- 空态：尝试菜单 -->
      <div v-if="showEmpty" class="video-node-empty">
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

      <!-- ready-state -->
      <div v-else-if="showReady" class="video-node-ready">
        <div class="video-node-ready-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
          </svg>
        </div>
        <div class="video-node-ready-text">已连接参考素材</div>
        <div class="video-node-ready-hint">选中节点后在下方配置并生成</div>
      </div>

      <div v-else-if="showLoading" class="video-node-loading">
        <div class="video-node-spinner" />
        <span>生成中…</span>
      </div>
      <div v-else-if="showError" class="video-node-error" @click.stop="triggerUpload">
        <span>{{ errorMsg }}，点击重新上传</span>
      </div>
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

    <CanvasNodeAddHandle side="left" :visible="isSelected" />
    <CanvasNodeAddHandle side="right" :visible="isSelected" />

    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />

    <div v-if="isSelected" class="video-node-prompt-panel nodrag nopan" @mousedown.stop>
      <WorkflowPromptInput
        v-model="promptText"
        v-model:model-key="promptModel"
        v-model:video-feature="promptFeature"
        generation-mode="video"
        :hide-type-selector="true"
        :model-options="promptModelOptions"
        :references="promptReferences"
        :available-references="availablePromptReferences"
        :create-subject-label="promptSubjectCandidate?.isSubject ? '取消主体' : '创建主体'"
        :count="promptCount"
        placeholder="描述你想生成的视频画面，按 Enter 发送"
        @add-files="handlePromptFiles"
        @remove-reference="handlePromptRemoveReference"
        @create-subject="handleCreateSubject"
        @count-change="promptCount = $event"
        @send="handlePromptSend"
      />
    </div>
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
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding: 0 8px 0 2px;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s, color 0.2s;
}
.video-node-title:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.video-node-title-icon {
  font-size: 16px;
  color: var(--text-tertiary);
}
.video-node-title-input {
  flex: 1 1 0;
  min-width: 80px;
  max-width: 220px;
  background: transparent;
  border: 1px solid var(--brand-main-default);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
  outline: none;
  box-sizing: border-box;
}

.video-node-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 380px;
  min-height: 280px;
  background: var(--canvas-node-bg);
  border: 1px solid var(--canvas-node-border);
  border-radius: 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  transition: border-color 0.16s, box-shadow 0.16s;
}
.video-node-card.is-selected {
  border-color: var(--canvas-selection-border);
  box-shadow: 0 0 0 2px var(--canvas-selection-border);
}

.video-node-flow {
  content: '';
  position: absolute;
  pointer-events: none;
  background-size: 200% 200%;
  animation: video-node-flowing 2.4s linear infinite;
}
.video-node-flow--ring {
  inset: -2px;
  border-radius: 18px;
  background: linear-gradient(
    90deg,
    transparent,
    transparent 20%,
    rgba(2, 219, 163, 0.45) 40%,
    #02dba3 50%,
    rgba(2, 219, 163, 0.45) 60%,
    transparent 80%,
    transparent
  );
  z-index: -1;
}
.video-node-flow--glow {
  inset: -6px;
  border-radius: 22px;
  background: linear-gradient(
    90deg,
    transparent,
    transparent 20%,
    rgba(2, 219, 163, 0.18) 40%,
    rgba(2, 219, 163, 0.42) 50%,
    rgba(2, 219, 163, 0.18) 60%,
    transparent 80%,
    transparent
  );
  filter: blur(8px);
  z-index: -2;
}
@keyframes video-node-flowing {
  0% { background-position: 100% 50%; }
  100% { background-position: -100% 50%; }
}

.video-node-empty {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  justify-content: center;
  padding: 20px;
}
.video-node-empty-title {
  color: var(--text-tertiary);
  font-size: 13px;
  margin-bottom: 16px;
  margin-left: 10px;
}
.video-node-empty-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.video-node-empty-item {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  border-radius: 16px;
  width: fit-content;
  transition: background-color 0.15s, color 0.15s;
}
.video-node-empty-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.video-node-empty-item-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.video-node-empty-item:hover .video-node-empty-item-icon {
  color: var(--text-primary);
}
.video-node-upload-pill {
  margin-top: auto;
  margin-left: 10px;
  margin-right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  background: var(--canvas-float-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: 16px;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}
.video-node-upload-pill:hover {
  background: var(--canvas-float-block-hover);
  color: var(--brand-main-default);
}

.video-node-ready {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-tertiary);
  padding: 24px;
}
.video-node-ready-icon { opacity: 0.6; }
.video-node-ready-text {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}
.video-node-ready-hint {
  color: var(--text-tertiary);
  font-size: 12px;
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
  to { transform: rotate(360deg); }
}

.video-node-player {
  width: 100%;
  height: 100%;
  border-radius: var(--lv-border-radius-medium);
  background: #000;
}

.video-node-handle {
  width: 1px !important;
  height: 1px !important;
  opacity: 0 !important;
  pointer-events: none !important;
  border: 0 !important;
  background: transparent !important;
}

.video-node-add-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: var(--text-tertiary);
  cursor: pointer;
  z-index: 10;
  transition: transform 0.2s, color 0.2s;
}
.video-node-add-btn--left { left: -56px; }
.video-node-add-btn--right { right: -56px; }
.video-node-add-btn__icon {
  width: 20px;
  height: 20px;
  padding: 3px;
  border: 1px solid currentColor;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: content-box;
}
.video-node-add-btn:hover { color: var(--text-primary); }
.video-node-add-btn:active { transform: translateY(-50%) scale(0.95); }

.video-node-prompt-panel {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  min-width: 540px;
  max-width: 760px;
  z-index: 5;
}
</style>
