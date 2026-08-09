<script setup lang="ts">
/**
 * 视频配置节点 - 模型/比例/时长选择 + 生成
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { CopyDocument, Delete, VideoCamera } from '@element-plus/icons-vue'
import CanvasNodeHoverToolbar, { type NodeToolbarAction } from '@/components/canvas/CanvasNodeHoverToolbar.vue'
import CanvasConfigNodeShell from '@/components/canvas/CanvasConfigNodeShell.vue'
import {
  updateNode,
  removeNode,
  duplicateNode,
  addNode,
  addEdge,
  addConnectedWorkflowNode,
  nodes,
  edges,
  type WorkflowNodeAddMenuType,
  type WorkflowCanvasNode,
  type WorkflowVideoConfigNodeData,
} from '../../composables/useWorkflowCanvas'
import { VIDEO_RATIO_LIST, getAllVideoModels, getDefaultVideoModelKey, getModelByName, loadPublicModelCatalog } from '@/config/models'
import { createGenerationTask, resolveGenerationTaskModel, subscribeGenerationTaskEvents } from '@/api/generation-tasks'
import type { SkillMediaReference } from '@/shared/skill-runtime'
import { buildWorkflowGenerationMetadata } from '@/shared/workflow-generation-metadata'
import { confirmCanvasGenerationResult, notifyCanvasGenerationResultConfirmed } from '@/shared/canvas-generation-confirmation'
import WfSelect from '@/components/common/WfSelect.vue'

const props = defineProps<{
  id: string
  data: WorkflowVideoConfigNodeData & { selected?: boolean }
  selected?: boolean
}>()
const isSelected = computed(() => props.selected || props.data?.selected)
const { updateNodeInternals } = useVueFlow()
const handleAddNode = ({ side, type }: { side: 'left' | 'right'; type: WorkflowNodeAddMenuType }) => {
  const newId = addConnectedWorkflowNode(props.id, side, type)
  if (newId) window.setTimeout(() => updateNodeInternals([props.id, newId]), 50)
}

const showActions = ref(false)
const isGenerating = ref(false)
const progress = ref(0)
const generationController = ref<AbortController | null>(null)
const awaitingConfirmationTaskId = ref('')

interface WorkflowVideoModelLike {
  ratios?: string[]
  durs?: Array<{ label: string; key: number | string }>
}

const isTextNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'text'> => node?.type === 'text'
const isImageNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'image'> => node?.type === 'image'
const isVideoNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'video'> => node?.type === 'video'
const isAudioNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'audio'> => node?.type === 'audio'
const isLlmNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'llmConfig'> => node?.type === 'llmConfig'
const readImageRole = (data: unknown) => (data && typeof data === 'object' && 'imageRole' in data
  ? String((data as { imageRole?: string }).imageRole || 'input_reference')
  : 'input_reference')
const readMediaRole = (data: unknown) => (data && typeof data === 'object' && 'mediaRole' in data
  ? String((data as { mediaRole?: string }).mediaRole || 'reference')
  : '')

const model = ref(props.data?.model || getDefaultVideoModelKey())
const ratio = ref(props.data?.ratio || '16x9')
const resolution = ref(props.data?.resolution || '720p')
const duration = ref(props.data?.duration || 5)

const currentModel = computed<WorkflowVideoModelLike | null>(() => getModelByName(model.value) as WorkflowVideoModelLike | null)
const modelOptions = computed(() => getAllVideoModels().map(m => ({ label: m.label, value: m.key })))
const ratioOptions = computed(() => (currentModel.value?.ratios || []).map((r) => {
  const item = VIDEO_RATIO_LIST.find(v => v.key === r)
  return { label: item?.label || r, value: r }
}))
const durationOptions = computed(() => (currentModel.value?.durs || []).map((d) => ({ label: d.label, value: d.key })))

// 连接的输入
const promptCount = computed(() => edges.value.filter(e => e.target === props.id && (e.type === 'promptOrder' || !e.type)).length)

watch(
  [() => props.data?.model, () => props.data?.ratio, () => props.data?.resolution, () => props.data?.duration],
  ([m, r, q, d]) => {
    if (m !== undefined) model.value = m
    if (r !== undefined) ratio.value = r
    if (q !== undefined) resolution.value = q
    if (d !== undefined) duration.value = d
  },
)

onMounted(() => {
  void loadPublicModelCatalog()
  resumePendingTask()
})

onUnmounted(() => {
  generationController.value?.abort()
  generationController.value = null
})

const updateConfig = () => {
  updateNode(props.id, { model: model.value, ratio: ratio.value, resolution: resolution.value, duration: duration.value })
}

// 收集输入
const collectInputs = () => {
  const incoming = edges.value.filter(e => e.target === props.id)
  let prompt = ''
  const mediaReferences: SkillMediaReference[] = []

  for (const edge of incoming) {
    const src = nodes.value.find(n => n.id === edge.source)
    if (!src) continue
    if (isTextNode(src) && src.data.content) prompt = src.data.content
    if (isLlmNode(src) && src.data.outputContent) prompt = src.data.outputContent
    if (isImageNode(src) && src.data.url) {
      const legacyRole = readImageRole(edge.data)
      const role = readMediaRole(edge.data) || (legacyRole === 'first_frame_image' ? 'first_frame' : legacyRole === 'last_frame_image' ? 'last_frame' : 'reference')
      mediaReferences.push({ mediaType: 'image', url: src.data.url, role: role as SkillMediaReference['role'], sourceNodeId: src.id })
    }
    if (isVideoNode(src) && src.data.url) {
      mediaReferences.push({ mediaType: 'video', url: src.data.url, role: (readMediaRole(edge.data) || 'video_reference') as SkillMediaReference['role'], sourceNodeId: src.id })
    }
    if (isAudioNode(src) && src.data.url) {
      mediaReferences.push({ mediaType: 'audio', url: src.data.url, role: (readMediaRole(edge.data) || 'audio_reference') as SkillMediaReference['role'], sourceNodeId: src.id, startSeconds: 0, endSeconds: src.data.duration })
    }
  }
  return { prompt, mediaReferences }
}

const buildCurrentGenerationMeta = () => buildWorkflowGenerationMetadata({
  kind: 'video',
  prompt: String(props.data?.prompt || ''),
  model: model.value,
  ratio: ratio.value,
  resolution: resolution.value,
  duration: Number(duration.value),
  sourceConfigNodeId: props.id,
})

const bindTaskStream = (taskId: string, outputNodeId: string, generationMeta: ReturnType<typeof buildWorkflowGenerationMetadata>, controller: AbortController) => {
  void subscribeGenerationTaskEvents(taskId, {
    signal: controller.signal,
    onEvent: (event) => {
      if (event.type === 'progress') return
      if (event.type === 'snapshot' || event.type === 'completed') {
        const output = Array.isArray(event.record?.outputs) ? event.record.outputs.find(item => item.outputType === 'video' && item.url) : null
        if (output?.url && event.done && awaitingConfirmationTaskId.value !== taskId) {
          awaitingConfirmationTaskId.value = taskId
          updateNode(props.id, { loading: true, error: '', outputNodeId, generationStatus: 'awaiting_confirmation' })
          void confirmCanvasGenerationResult({ kind: 'video', outputCount: 1 }).then((confirmed) => {
            if (confirmed) {
              updateNode(outputNodeId, { url: output.url, label: '生成视频', loading: false, error: '', generationMeta, taskRecordId: taskId })
              updateNode(props.id, { loading: false, error: '', executed: true, outputNodeId, generationStatus: 'completed' })
              notifyCanvasGenerationResultConfirmed({ kind: 'video', taskId, outputCount: 1 })
            } else {
              updateNode(outputNodeId, { label: '结果未写入', loading: false, error: '用户暂未确认写入画布' })
              updateNode(props.id, { loading: false, executed: false, generationStatus: 'discarded' })
            }
            awaitingConfirmationTaskId.value = ''
            isGenerating.value = false
          })
        } else if (event.done) {
          const message = String(event.message || event.record?.error || (event.stopped ? '任务已停止' : '任务完成但未返回视频')).trim() || '任务完成但未返回视频'
          updateNode(outputNodeId, { label: event.stopped ? '已停止' : '生成失败', loading: false, error: message })
          updateNode(props.id, {
            loading: false,
            error: message,
            executed: false,
            generationStatus: event.stopped ? 'stopped' : 'failed',
          })
        }
      }
      if (event.type === 'failed' || event.type === 'stopped') {
        const message = String(event.message || event.record?.error || (event.type === 'stopped' ? '任务已停止' : '视频生成失败'))
        updateNode(outputNodeId, { label: event.type === 'stopped' ? '已停止' : '生成失败', loading: false, error: message })
        updateNode(props.id, { loading: false, error: message, generationStatus: event.type === 'stopped' ? 'stopped' : 'failed' })
      }
      if (event.done) {
        if (awaitingConfirmationTaskId.value !== taskId) isGenerating.value = false
        if (generationController.value === controller) generationController.value = null
      }
    },
  }).catch((error: unknown) => {
    if (controller.signal.aborted) return
    const message = error instanceof Error ? error.message : '订阅视频任务失败'
    updateNode(outputNodeId, { label: '生成失败', loading: false, error: message })
    updateNode(props.id, { loading: false, error: message, generationStatus: 'failed' })
    isGenerating.value = false
    if (generationController.value === controller) generationController.value = null
  })
}

/** 恢复已有服务端任务的事件流，不重新提交视频请求。 */
const resumePendingTask = () => {
  const taskId = String(props.data?.taskRecordId || '').trim()
  if (!taskId || !props.data?.loading || isGenerating.value) return
  const outputNodeId = String(props.data?.outputNodeId || '') || edges.value
    .filter(edge => edge.source === props.id)
    .map(edge => nodes.value.find(node => node.id === edge.target))
    .find(node => node?.type === 'video')?.id
  if (!outputNodeId) return
  isGenerating.value = true
  generationController.value?.abort()
  const controller = new AbortController()
  generationController.value = controller
  bindTaskStream(taskId, outputNodeId, props.data?.generationMeta || buildCurrentGenerationMeta(), controller)
}

const handleGenerate = async () => {
  const { prompt, mediaReferences } = collectInputs()
  if (!prompt && !mediaReferences.length) return

  isGenerating.value = true
  progress.value = 0
  generationController.value?.abort()
  const controller = new AbortController()
  generationController.value = controller
  updateNode(props.id, {
    loading: true,
    error: '',
    executed: false,
    outputNodeId: undefined,
    generationStatus: 'running',
  })
  let outputNodeId: string | null = null
  let subscriptionStarted = false

  try {
    const { providerId, modelKey } = resolveGenerationTaskModel({
      modelKey: model.value,
      category: 'VIDEO',
      missingProviderMessage: '未匹配到后台视频厂商配置',
    })
    const generationMeta = buildWorkflowGenerationMetadata({
      kind: 'video',
      prompt,
      model: model.value,
      modelKey,
      ratio: ratio.value,
      resolution: resolution.value,
      duration: Number(duration.value),
      references: mediaReferences,
      sourceConfigNodeId: props.id,
    })

    // 模板可能已经预置结果节点；优先复用，避免重复运行不断新增输出节点。
    const node = nodes.value.find(n => n.id === props.id)
    const existingOutput = edges.value
      .filter(edge => edge.source === props.id)
      .map(edge => nodes.value.find(candidate => candidate.id === edge.target))
      .find(candidate => candidate?.type === 'video')
    outputNodeId = existingOutput?.id || addNode('video', {
      x: (node?.position?.x || 0) + 400,
      y: node?.position?.y || 0,
    }, { url: '', label: '视频生成中...', loading: true })
    updateNode(outputNodeId, { url: '', label: '视频生成中...', loading: true, error: '', generationMeta })
    if (!existingOutput) {
      addEdge({ source: props.id, target: outputNodeId, sourceHandle: 'right', targetHandle: 'left' })
    }
    const createdOutputNodeId = outputNodeId
    setTimeout(() => updateNodeInternals([createdOutputNodeId]), 50)

    const task = await createGenerationTask({
      source: 'workflow-canvas',
      type: 'video',
      requestMode: 'video-generation' as any,
      prompt,
      model: model.value,
      modelKey,
      ratio: ratio.value,
      resolution: resolution.value,
      duration: String(duration.value),
      mediaReferences,
      referenceImages: mediaReferences.filter(item => item.mediaType === 'image').map(item => item.url),
      requestBody: { providerId, mediaReferences },
    }, { signal: controller.signal })
    const taskId = String(task?.id || '').trim()
    if (!taskId) throw new Error('任务创建失败')
    updateNode(props.id, { taskRecordId: taskId, generationMeta, generationStatus: 'running' })
    subscriptionStarted = true
    bindTaskStream(taskId, createdOutputNodeId, generationMeta, controller)
  } catch (err: unknown) {
    console.error('视频生成失败:', err)
    const msg = err instanceof DOMException && err.name === 'AbortError'
      ? '工作流执行已取消'
      : err instanceof Error ? err.message : '视频生成失败'
    if (outputNodeId) updateNode(outputNodeId, { label: '生成失败', loading: false, error: msg })
    updateNode(props.id, { loading: false, error: msg, generationStatus: 'failed' })
  } finally {
    if (!subscriptionStarted) {
      isGenerating.value = false
      if (generationController.value === controller) generationController.value = null
      updateNode(props.id, { loading: false })
    }
  }
}

const handleDelete = () => removeNode(props.id)
const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) setTimeout(() => updateNodeInternals([newId]), 50)
}

const hoverActions = computed<NodeToolbarAction[]>(() => [
  { id: 'duplicate', label: '复制', icon: CopyDocument, onClick: handleDuplicate },
  { id: 'delete', label: '删除', icon: Delete, danger: true, onClick: handleDelete },
])

// 监听自动执行标志
watch(
  () => props.data?.autoExecute,
  (shouldExecute) => {
    if (shouldExecute && !isGenerating.value) {
      updateNode(props.id, { autoExecute: false })
      setTimeout(() => handleGenerate(), 200)
    }
  }
)

watch(
  () => props.data?.executionCancelToken,
  (token) => {
    if (!token) return
    generationController.value?.abort()
    generationController.value = null
    isGenerating.value = false
    updateNode(props.id, {
      autoExecute: false,
      loading: false,
      executed: false,
      error: '工作流执行已取消',
    })
  },
)
</script>

<template>
  <div class="video-config-node-outer" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <CanvasConfigNodeShell
      :node-id="id"
      :label="data?.label || '图生视频'"
      :icon="VideoCamera"
      :selected="isSelected"
      type="video-config"
      :min-width="320"
      :min-height="240"
      @add-node="handleAddNode"
    >
      <div class="wf-node-body" style="display: flex; flex-direction: column; gap: 8px; padding: 16px;">
        <div style="font-size: 11px; color: var(--text-tertiary);">输入: {{ promptCount }}</div>

        <div>
          <label class="wf-node-label">模型</label>
          <WfSelect v-model="model" :options="modelOptions" @change="updateConfig" />
        </div>

        <div v-if="ratioOptions.length">
          <label class="wf-node-label">比例</label>
          <WfSelect v-model="ratio" :options="ratioOptions" @change="updateConfig" />
        </div>

        <div v-if="durationOptions.length">
          <label class="wf-node-label">时长</label>
          <WfSelect v-model="duration" :options="durationOptions" @change="updateConfig" />
        </div>

        <button class="wf-node-generate-btn amber" :disabled="isGenerating" @click="handleGenerate">
          <span v-if="isGenerating" class="wf-spinner"></span>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ isGenerating ? '生成中...' : '生成视频' }}
        </button>
      </div>

      <template #overlay>
        <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />
      </template>
    </CanvasConfigNodeShell>
  </div>
</template>
