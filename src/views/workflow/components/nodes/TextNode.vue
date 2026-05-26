<script setup lang="ts">
/**
 * 文本节点组件
 */
import { ref, computed, watch, onMounted } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import { CopyDocument, Picture, VideoCamera, Delete, Plus, Minus } from '@element-plus/icons-vue'
import CanvasNodeHoverToolbar, { type NodeToolbarAction } from '@/components/canvas/CanvasNodeHoverToolbar.vue'
import {
  updateNode,
  removeNode,
  duplicateNode,
  addNode,
  addEdge,
  nodes,
  type WorkflowTextNodeData,
} from '../../composables/useWorkflowCanvas'
import WfNodeTitle from '../WfNodeTitle.vue'
import { streamChatCompletions } from '../../api/chat'
import { getAllChatModels, getDefaultChatModelKey, loadPublicModelCatalog } from '@/config/models'
import WfSelect from '@/components/common/WfSelect.vue'

const props = defineProps<{
  id: string
  data: WorkflowTextNodeData & { selected?: boolean }
}>()
const { updateNodeInternals } = useVueFlow()

const content = ref(props.data?.content || '')
const showActions = ref(false)
const isPolishing = ref(false)
const polishModel = ref(props.data?.polishModel || getDefaultChatModelKey())
const fontSize = ref(props.data?.fontSize ?? 14)

const FONT_SIZE_MIN = 10
const FONT_SIZE_MAX = 28
const handleFontSizeChange = (delta: number) => {
  fontSize.value = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize.value + delta))
  updateNode(props.id, { fontSize: fontSize.value })
}

const chatModelOptions = computed(() => getAllChatModels().map(m => ({ label: m.label, value: m.key })))

watch(
  chatModelOptions,
  (options) => {
    const values = options.map(item => item.value)
    if (!values.length) return
    if (!values.includes(polishModel.value)) {
      polishModel.value = getDefaultChatModelKey() || values[0]
      updateNode(props.id, { polishModel: polishModel.value })
    }
  },
  { immediate: true },
)

onMounted(() => {
  void loadPublicModelCatalog()
})

watch(() => props.data?.content, (v) => { if (v !== undefined) content.value = v })
watch(() => props.data?.polishModel, (v) => { if (v !== undefined) polishModel.value = v })
watch(() => props.data?.fontSize, (v) => { if (v !== undefined) fontSize.value = v })

const handleInput = () => {
  updateNode(props.id, { content: content.value, polishModel: polishModel.value })
}

const handleDelete = () => removeNode(props.id)

const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) setTimeout(() => updateNodeInternals([newId]), 50)
}

// AI 润色提示词
const handlePolish = async () => {
  const input = content.value.trim()
  if (!input) return
  isPolishing.value = true
  const original = content.value
  try {
    let result = ''
    for await (const chunk of streamChatCompletions({
      model: polishModel.value,
      messages: [
        { role: 'system', content: '你是一个专业的AI绘画提示词专家。将用户输入的内容美化成高质量的生图提示词，包含风格、光线、构图、细节等要素。直接返回提示词，不要其他解释。' },
        { role: 'user', content: input }
      ]
    })) {
      result += chunk
    }
    if (result) {
      content.value = result
      updateNode(props.id, { content: result })
    }
  } catch {
    content.value = original
  } finally {
    isPolishing.value = false
  }
}

// 快捷创建文生图配置节点
const createImageConfig = () => {
  const node = nodes.value.find(n => n.id === props.id)
  if (!node) return
  const newId = addNode('imageConfig', {
    x: node.position.x + 380,
    y: node.position.y
  })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'promptOrder',
    data: { promptOrder: 1 }
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}

// 快捷创建视频配置节点
const createVideoConfig = () => {
  const node = nodes.value.find(n => n.id === props.id)
  if (!node) return
  const newId = addNode('videoConfig', {
    x: node.position.x + 380,
    y: node.position.y
  })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'promptOrder',
    data: { promptOrder: 1 }
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}

// hover 工具栏配置
const hoverActions = computed<NodeToolbarAction[]>(() => [
  { id: 'font-minus', label: '缩小字号', icon: Minus, disabled: fontSize.value <= FONT_SIZE_MIN, onClick: () => handleFontSizeChange(-1) },
  { id: 'font-plus', label: '放大字号', icon: Plus, disabled: fontSize.value >= FONT_SIZE_MAX, onClick: () => handleFontSizeChange(1) },
  { id: 'duplicate', label: '复制', icon: CopyDocument, onClick: handleDuplicate },
  { id: 'image-config', label: '生图', icon: Picture, onClick: createImageConfig },
  { id: 'video-config', label: '生视频', icon: VideoCamera, onClick: createVideoConfig },
  { id: 'delete', label: '删除', icon: Delete, danger: true, onClick: handleDelete },
])
</script>

<template>
  <div class="wf-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <NodeResizer :min-width="220" :min-height="120" />
    <div class="wf-node wf-node-text" :class="{ selected: data.selected }">
      <!-- 头部 -->
      <div class="wf-node-header">
        <div class="wf-node-header-left">
          <span class="wf-node-header-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h8m-8 6h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <WfNodeTitle :node-id="id" :label="data.label" placeholder="文本输入" />
        </div>
        <button class="wf-btn wf-btn-sm" @click="handleDelete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- 内容 -->
      <div class="wf-node-body">
        <textarea
          v-model="content"
          @input="handleInput"
          @wheel.stop
          @mousedown.stop
          placeholder="输入文本内容..."
          rows="4"
          :style="{ minHeight: '80px', maxHeight: '160px', overflowY: 'auto', fontSize: fontSize + 'px' }"
        />

        <!-- 润色模型选择 -->
        <WfSelect
          v-model="polishModel"
          :options="chatModelOptions"
          @change="updateNode(id, { polishModel })"
          style="margin-top: 6px;"
        />

        <!-- AI 润色按钮 -->
        <button
          class="wf-node-action-btn"
          :disabled="isPolishing || !content.trim()"
          @click="handlePolish"
          style="margin-top: 6px; width: 100%; justify-content: center;"
        >
          <span v-if="isPolishing" class="wf-spinner"></span>
          <span v-else>✨</span>
          <span>{{ isPolishing ? '润色中...' : 'AI 润色' }}</span>
        </button>

        <!-- 快捷操作 -->
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <button class="wf-node-action-btn" @click="createImageConfig" style="flex: 1; justify-content: center;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>生成图片</span>
          </button>
          <button class="wf-node-action-btn" @click="createVideoConfig" style="flex: 1; justify-content: center;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>生成视频</span>
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
