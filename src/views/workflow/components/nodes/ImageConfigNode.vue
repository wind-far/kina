<script setup lang="ts">
/**
 * 图片配置节点组件
 * 收集连接的提示词和参考图，通过服务端任务统一执行图片生成
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { CopyDocument, Delete, Picture } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
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
  type WorkflowImageConfigNodeData,
} from '../../composables/useWorkflowCanvas'
import { BANANA_SIZE_OPTIONS, SEEDREAM_SIZE_OPTIONS, getAllImageModels, loadPublicModelCatalog, getDefaultImageModelKey, getModelByName } from '@/config/models'
import { createGenerationTask, resolveGenerationTaskModel, subscribeGenerationTaskEvents } from '@/api/generation-tasks'
import WfSelect from '@/components/common/WfSelect.vue'
import { appendImageReferencesToRequestBody, collectOrderedImageReferences } from '@/shared/image-generation-request'

const props = defineProps<{
  id: string
  data: WorkflowImageConfigNodeData & { selected?: boolean }
  selected?: boolean
}>()
const isSelected = computed(() => props.selected || props.data?.selected)
const { updateNodeInternals } = useVueFlow()
const handleAddNode = ({ side, type }: { side: 'left' | 'right'; type: WorkflowNodeAddMenuType }) => {
  if (type === 'director' || type === 'audio') {
    ElMessage.info(`${type === 'director' ? '导演台' : '音频'}节点暂未开放`)
    return
  }
  const newId = addConnectedWorkflowNode(props.id, side, type)
  if (newId) window.setTimeout(() => updateNodeInternals([props.id, newId]), 50)
}

const showActions = ref(false)
const isGenerating = ref(false)
const taskStreamController = ref<AbortController | null>(null)

// 本地状态
const model = ref(props.data?.model || getDefaultImageModelKey())
const size = ref(props.data?.size || '1x1')
const quality = ref(props.data?.quality || 'standard')

interface WorkflowImageModelLike {
  key?: string
  sizes?: Array<{ label: string; key: string }>
  qualities?: Array<{ label: string; key: string }>
  getSizesByQuality?: (quality: string) => Array<{ label: string; key: string }>
}

const isTextNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'text'> => node?.type === 'text'
const isImageNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'image'> => node?.type === 'image'
const isLlmNode = (node?: WorkflowCanvasNode): node is WorkflowCanvasNode<'llmConfig'> => node?.type === 'llmConfig'
const readPromptOrder = (data: unknown) => (data && typeof data === 'object' && 'promptOrder' in data
  ? Number((data as { promptOrder?: number }).promptOrder) || 1
  : 1)
const readImageOrder = (data: unknown) => (data && typeof data === 'object' && 'imageOrder' in data
  ? Number((data as { imageOrder?: number }).imageOrder) || 1
  : 1)

// 模型选项（包含自定义模型）
const modelOptions = computed(() => getAllImageModels().map(m => ({ label: m.label, value: m.key })))

// 当前模型配置
const currentModel = computed<WorkflowImageModelLike | null>(() => getModelByName(model.value) as WorkflowImageModelLike | null)

// 尺寸选项（根据模型和画质动态变化）
const sizeOptions = computed(() => {
  const m = currentModel.value
  if (!m || !m.sizes?.length) return []
  if (m.getSizesByQuality) {
    return m.getSizesByQuality(quality.value).map((s) => ({ label: s.label, value: s.key }))
  }
  if (m.key === 'nano-banana-pro' || m.key === 'nano-banana') {
    return BANANA_SIZE_OPTIONS.map(s => ({ label: s.label, value: s.key }))
  }
  return SEEDREAM_SIZE_OPTIONS.map(s => ({ label: s.label, value: s.key }))
})

// 画质选项
const qualityOptions = computed(() => {
  const m = currentModel.value
  if (!m?.qualities) return []
  return m.qualities.map((q) => ({ label: q.label, value: q.key }))
})

// 连接的提示词数量
const promptCount = computed(() => {
  return edges.value.filter(e => e.target === props.id && (e.type === 'promptOrder' || !e.type)).length
})

// 连接的参考图数量
const refImageCount = computed(() => {
  return edges.value.filter(e => e.target === props.id && e.type === 'imageOrder').length
})

// 监听外部数据变化
watch(
  [() => props.data?.model, () => props.data?.size, () => props.data?.quality],
  ([m, s, q]) => {
    if (m !== undefined) model.value = m
    if (s !== undefined) size.value = s
    if (q !== undefined) quality.value = q
  },
)

onMounted(() => {
  void loadPublicModelCatalog()
})

onUnmounted(() => {
  taskStreamController.value?.abort()
  taskStreamController.value = null
})

const updateConfig = () => {
  updateNode(props.id, { model: model.value, size: size.value, quality: quality.value })
}

// 收集连接的提示词和参考图
const collectInputs = () => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const prompts: Array<{ order: number; content: string }> = []
  const refImages: Array<{ order: number; imageData: string }> = []

  for (const edge of connectedEdges) {
    const src = nodes.value.find(n => n.id === edge.source)
    if (!src) continue

    if (isTextNode(src)) {
      const content = src.data.content || ''
      if (content) prompts.push({ order: readPromptOrder(edge.data), content })
    } else if (isLlmNode(src)) {
      const content = src.data.outputContent || ''
      if (content) prompts.push({ order: readPromptOrder(edge.data), content })
    } else if (isImageNode(src)) {
      const imageData = src.data.url || src.data.base64
      if (imageData) refImages.push({ order: readImageOrder(edge.data), imageData })
    }
  }

  prompts.sort((a, b) => a.order - b.order)
  return {
    prompt: prompts.map(p => p.content).join('\n'),
    refImages: collectOrderedImageReferences(refImages)
  }
}

const cleanupTaskStream = () => {
  taskStreamController.value?.abort()
  taskStreamController.value = null
}

const readRecordImageUrl = (record: {
  images?: string[]
  outputs?: Array<{ url?: string }>
} | null | undefined) => {
  if (Array.isArray(record?.images) && record.images.length) {
    return String(record.images[0] || '').trim()
  }

  if (Array.isArray(record?.outputs)) {
    const matched = record.outputs.find(item => typeof item?.url === 'string' && String(item.url || '').trim())
    if (matched?.url) {
      return String(matched.url).trim()
    }
  }

  return ''
}

const bindTaskStream = (taskRecordId: string, outputNodeId: string, controller: AbortController) => {
  void subscribeGenerationTaskEvents(taskRecordId, {
    signal: controller.signal,
    onEvent: (event) => {
      if (event.type === 'progress') {
        updateNode(props.id, {
          loading: true,
          error: '',
        })
        return
      }

      if (event.type === 'snapshot' || event.type === 'completed') {
        const url = readRecordImageUrl(event.record)
        if (url) {
          updateNode(outputNodeId, { url, label: '生成结果', loading: false, error: '' })
          updateNode(props.id, {
            loading: !event.done,
            error: '',
            executed: Boolean(event.done),
            outputNodeId,
          })
        } else if (event.done) {
          updateNode(outputNodeId, { label: '生成失败', loading: false, error: '任务完成但未返回图片' })
          updateNode(props.id, { loading: false, error: '任务完成但未返回图片', executed: false })
        }
      }

      if (event.type === 'failed') {
        const message = String(event.message || event.record?.error || '图片生成失败').trim() || '图片生成失败'
        updateNode(outputNodeId, { label: '生成失败', loading: false, error: message })
        updateNode(props.id, {
          loading: false,
          error: message,
        })
      }

      if (event.type === 'stopped') {
        updateNode(outputNodeId, { label: '已停止', loading: false, error: '任务已停止' })
        updateNode(props.id, {
          loading: false,
          error: '任务已停止',
        })
      }

      if (event.done) {
        isGenerating.value = false
        cleanupTaskStream()
      }
    },
  }).catch((error: unknown) => {
    if (controller.signal.aborted) {
      return
    }

    const message = error instanceof Error ? error.message : '订阅图片任务失败'
    updateNode(outputNodeId, { label: '生成失败', loading: false, error: message })
    updateNode(props.id, {
      loading: false,
      error: message,
    })
    isGenerating.value = false
    cleanupTaskStream()
  })
}

// 生成图片
const handleGenerate = async () => {
  const { prompt, refImages } = collectInputs()
  if (!prompt && !refImages.length) return

  isGenerating.value = true
  cleanupTaskStream()
  const controller = new AbortController()
  taskStreamController.value = controller
  let outputNodeId: string | null = null
  try {
    const { providerId, modelKey } = resolveGenerationTaskModel({
      modelKey: model.value,
      category: 'IMAGE',
      missingModelMessage: '未匹配到有效图片模型，请先检查后台模型配置',
    })
    const requestBody: {
      model: string
      prompt: string
      n: number
      providerId: string
      size?: string
      quality?: string
      image?: string[]
    } = {
      model: modelKey,
      prompt: prompt || '',
      n: 1,
      providerId,
    }
    if (size.value && currentModel.value?.sizes?.length) requestBody.size = size.value
    if (quality.value) requestBody.quality = quality.value
    const hasReferenceImages = refImages.length > 0
    const normalizedRequestBody = hasReferenceImages
      ? appendImageReferencesToRequestBody(requestBody, refImages)
      : requestBody

    // 模板可能已经预置结果节点；优先复用，避免重复运行不断新增输出节点。
    const node = nodes.value.find(n => n.id === props.id)
    const existingOutput = edges.value
      .filter(edge => edge.source === props.id)
      .map(edge => nodes.value.find(candidate => candidate.id === edge.target))
      .find(candidate => candidate?.type === 'image')
    outputNodeId = existingOutput?.id || addNode('image', {
      x: (node?.position?.x || 0) + 400,
      y: node?.position?.y || 0,
    }, { url: '', label: '生成中...', loading: true })
    updateNode(outputNodeId, { url: '', label: '生成中...', loading: true, error: '' })
    if (!existingOutput) {
      addEdge({ source: props.id, target: outputNodeId, sourceHandle: 'right', targetHandle: 'left' })
    }
    const createdOutputNodeId = outputNodeId
    setTimeout(() => updateNodeInternals([createdOutputNodeId]), 50)

    updateNode(props.id, {
      loading: true,
      error: '',
      executed: false,
      outputNodeId: undefined,
      taskRecordId: '',
    })

    const saved = await createGenerationTask({
      source: 'workflow',
      type: 'image',
      requestMode: hasReferenceImages ? 'image-edit' : 'image-generation',
      prompt,
      model: model.value,
      modelKey,
      referenceImages: [...refImages],
      requestBody: normalizedRequestBody,
    }, { signal: controller.signal })

    const taskRecordId = String(saved.id || '').trim()
    if (!taskRecordId) {
      throw new Error('图片任务创建失败')
    }

    updateNode(props.id, {
      taskRecordId,
      loading: true,
      error: '',
    })
    bindTaskStream(taskRecordId, createdOutputNodeId, controller)
  } catch (err: unknown) {
    console.error('图片生成失败:', err)
    const msg = err instanceof DOMException && err.name === 'AbortError'
      ? '工作流执行已取消'
      : err instanceof Error ? err.message : '图片生成失败'
    if (outputNodeId) updateNode(outputNodeId, { label: '生成失败', loading: false, error: msg })
    updateNode(props.id, { loading: false, error: msg })
    isGenerating.value = false
    cleanupTaskStream()
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
    cleanupTaskStream()
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
  <div class="image-config-node-outer" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <CanvasConfigNodeShell
      :node-id="id"
      :label="data?.label || '文生图'"
      :icon="Picture"
      :selected="isSelected"
      type="image-config"
      :min-width="320"
      :min-height="260"
      @add-node="handleAddNode"
    >
      <!-- 配置内容（保留原 wf-node-body 表单）-->
      <div class="wf-node-body" style="display: flex; flex-direction: column; gap: 8px; padding: 16px;">
        <!-- 连接信息 -->
        <div style="display: flex; gap: 8px; font-size: 11px; color: var(--text-tertiary);">
          <span>提示词: {{ promptCount }}</span>
          <span v-if="refImageCount">参考图: {{ refImageCount }}</span>
        </div>

        <!-- 模型选择 -->
        <div>
          <label class="wf-node-label">模型</label>
          <WfSelect v-model="model" :options="modelOptions" @change="updateConfig" />
        </div>

        <!-- 画质选择 -->
        <div v-if="qualityOptions.length">
          <label class="wf-node-label">画质</label>
          <WfSelect v-model="quality" :options="qualityOptions" @change="updateConfig" />
        </div>

        <!-- 尺寸选择 -->
        <div v-if="sizeOptions.length">
          <label class="wf-node-label">尺寸</label>
          <WfSelect v-model="size" :options="sizeOptions" @change="updateConfig" />
        </div>

        <!-- 生成按钮 -->
        <button
          class="wf-node-generate-btn green"
          :disabled="isGenerating || (!promptCount && !refImageCount)"
          @click="handleGenerate"
        >
          <span v-if="isGenerating" class="wf-spinner"></span>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ isGenerating ? '生成中...' : '生成图片' }}
        </button>
      </div>

      <template #overlay>
        <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />
      </template>
    </CanvasConfigNodeShell>
  </div>
</template>
