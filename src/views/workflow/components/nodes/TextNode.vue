<script setup lang="ts">
/**
 * 文本节点（即梦风样板）
 *
 * 视觉对照用户截图：
 *   - 标题外置（节点上方居中显示图标 + Text）
 *   - 空态时节点内部显示「尝试」菜单（自己编写 / 上传文档 / 文字生视频 / 反推提示词）
 *   - 有内容时切回 textarea + 模型选择 + 润色 + 生图/生视频快捷按钮
 *   - 选中态：青绿色亮描边
 *   - 左右连接点保留 Vue Flow Handle，但视觉对齐圆形 + 图标
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import {
  CopyDocument,
  Picture,
  VideoCamera,
  Delete,
  Plus,
  Minus,
  EditPen,
  Upload,
  MagicStick,
  Document,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import CanvasNodeHoverToolbar, { type NodeToolbarAction } from '@/components/canvas/CanvasNodeHoverToolbar.vue'
import CanvasPromptInput from '@/components/canvas/CanvasPromptInput.vue'
import { useNodeTitleEdit } from '@/composables/useNodeTitleEdit'
import {
  updateNode,
  removeNode,
  duplicateNode,
  addNode,
  addEdge,
  nodes,
  type WorkflowTextNodeData,
} from '../../composables/useWorkflowCanvas'
import { streamChatCompletions } from '../../api/chat'
import { getAllChatModels, getDefaultChatModelKey, loadPublicModelCatalog } from '@/config/models'
import WfSelect from '@/components/common/WfSelect.vue'

const props = defineProps<{
  id: string
  data: WorkflowTextNodeData & { selected?: boolean }
  selected?: boolean
}>()
const isSelected = computed(() => props.selected || props.data?.selected)
const titleEdit = useNodeTitleEdit(props.id, () => props.data?.label || 'Text')
const { updateNodeInternals } = useVueFlow()

const content = ref(props.data?.content || '')
const showActions = ref(false)
const isPolishing = ref(false)
const polishModel = ref(props.data?.polishModel || getDefaultChatModelKey())
const fontSize = ref(props.data?.fontSize ?? 14)
const forceEditMode = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const FONT_SIZE_MIN = 10
const FONT_SIZE_MAX = 28
const handleFontSizeChange = (delta: number) => {
  fontSize.value = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize.value + delta))
  updateNode(props.id, { fontSize: fontSize.value })
}

const chatModelOptions = computed(() => getAllChatModels().map((m) => ({ label: m.label, value: m.key })))

/** 空态判断：内容为空且用户未主动切到编辑态 */
const isEmpty = computed(() => !forceEditMode.value && !content.value.trim())

watch(
  chatModelOptions,
  (options) => {
    const values = options.map((item) => item.value)
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

// 空态菜单：自己编写内容（切到 textarea + focus）
const handleStartEdit = async () => {
  forceEditMode.value = true
  await nextTick()
  textareaRef.value?.focus()
}

// 空态菜单：上传文档解析文本（.txt 简单读 + 写入 content）
const handleImportFile = () => {
  fileInputRef.value?.click()
}
const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 1024 * 1024) {
    ElMessage.warning('请选择 1MB 以内的纯文本文档')
    input.value = ''
    return
  }
  try {
    const text = await file.text()
    content.value = text
    updateNode(props.id, { content: text })
    forceEditMode.value = true
  } catch {
    ElMessage.error('文件读取失败')
  } finally {
    input.value = ''
  }
}

// AI 润色提示词（已有内容时使用）
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
        { role: 'user', content: input },
      ],
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
  const node = nodes.value.find((n) => n.id === props.id)
  if (!node) return
  const newId = addNode('imageConfig', { x: node.position.x + 380, y: node.position.y })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'promptOrder',
    data: { promptOrder: 1 },
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}

// 快捷创建视频配置节点
const createVideoConfig = () => {
  const node = nodes.value.find((n) => n.id === props.id)
  if (!node) return
  const newId = addNode('videoConfig', { x: node.position.x + 380, y: node.position.y })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'promptOrder',
    data: { promptOrder: 1 },
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}

// 空态菜单：图片反推提示词（占位，等接 ai-gateway 的 reverse-prompt 能力）
const handleReversePrompt = () => {
  ElMessage.info('图片反推提示词接入中，敬请期待')
}

// 节点左右"+"按钮（仅 selected 时显示）
const handleAddLeft = () => {
  ElMessage.info('从左侧追加上游节点：接入中')
}
const handleAddRight = () => {
  // 直接复用"用文本生图"逻辑（最常见的右侧追加）
  createImageConfig()
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

const emptyMenuItems = [
  { id: 'start-edit', label: '自己编写内容', icon: EditPen, onClick: handleStartEdit },
  { id: 'import-file', label: '上传文档解析文本', icon: Upload, onClick: handleImportFile },
  { id: 'create-video', label: '文字生视频', icon: VideoCamera, onClick: createVideoConfig },
  { id: 'reverse-prompt', label: '图片反推提示词', icon: MagicStick, onClick: handleReversePrompt },
]

// 选中态下方浮层 prompt：仅在节点被选中时显示
const promptText = ref('')
const promptModelOptions = computed(() =>
  getAllChatModels().map((m) => ({ key: m.key, label: m.label })),
)
const handlePromptSend = (text: string) => {
  // 文本节点：把发送内容写入 content（沿用 AI 润色作为后续步骤；这里只填充）
  content.value = text
  forceEditMode.value = true
  updateNode(props.id, { content: text })
  promptText.value = ''
}
</script>

<template>
  <div class="text-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <!-- 节点外置标题：浮在节点上方左侧 -->
    <div class="text-node-title" :title="titleEdit.editing.value ? '' : '双击编辑名称'" @dblclick.stop="titleEdit.start">
      <el-icon class="text-node-title-icon"><Document /></el-icon>
      <input
        v-if="titleEdit.editing.value"
        :ref="titleEdit.setInputRef"
        v-model="titleEdit.draft.value"
        class="text-node-title-input nodrag"
        :maxlength="40"
        @blur="titleEdit.commit"
        @keydown.enter.prevent="titleEdit.commit"
        @keydown.esc.prevent="titleEdit.cancel"
        @mousedown.stop
        @click.stop
      />
      <span v-else>{{ data?.label || 'Text' }}</span>
    </div>

    <!-- 节点本体 -->
    <div class="text-node-card" :class="{ 'is-selected': isSelected, 'is-empty': isEmpty }">
      <!-- 选中态：流光边框（参照 RunningHUB .flowing-border） -->
      <span v-if="isSelected" class="text-node-flow text-node-flow--ring" aria-hidden="true" />
      <span v-if="isSelected" class="text-node-flow text-node-flow--glow" aria-hidden="true" />
      <!-- 空态：尝试菜单 -->
      <div v-if="isEmpty" class="text-node-empty">
        <div class="text-node-empty-title">尝试：</div>
        <div class="text-node-empty-menu">
          <button
            v-for="item in emptyMenuItems"
            :key="item.id"
            type="button"
            class="text-node-empty-item nodrag nopan"
            @click.stop="item.onClick"
          >
            <el-icon class="text-node-empty-item-icon">
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </div>

      <!-- 有内容态：原 textarea + 模型 + 润色 + 生图/生视频 -->
      <div v-else class="text-node-body">
        <textarea
          ref="textareaRef"
          v-model="content"
          class="text-node-textarea nodrag nopan"
          @input="handleInput"
          @wheel.stop
          @mousedown.stop
          placeholder="输入文本内容..."
          rows="4"
          :style="{ fontSize: fontSize + 'px' }"
        />

        <WfSelect
          v-model="polishModel"
          :options="chatModelOptions"
          @change="updateNode(id, { polishModel })"
          class="text-node-model-select"
        />

        <button
          class="text-node-polish-btn nodrag nopan"
          :disabled="isPolishing || !content.trim()"
          @click.stop="handlePolish"
        >
          <span v-if="isPolishing" class="wf-spinner" />
          <el-icon v-else><MagicStick /></el-icon>
          <span>{{ isPolishing ? '润色中…' : 'AI 润色' }}</span>
        </button>

        <div class="text-node-quick">
          <button class="text-node-quick-btn nodrag nopan" @click.stop="createImageConfig">
            <el-icon><Picture /></el-icon>
            <span>生成图片</span>
          </button>
          <button class="text-node-quick-btn nodrag nopan" @click.stop="createVideoConfig">
            <el-icon><VideoCamera /></el-icon>
            <span>生成视频</span>
          </button>
        </div>
      </div>

      <!-- 隐藏 file input：用于"上传文档解析文本" -->
      <input
        ref="fileInputRef"
        type="file"
        accept=".txt,.md,.json,text/plain"
        style="display: none"
        @change="handleFileChange"
      />
    </div>

    <!-- 左右连接点（圆形 + 图标） -->
    <Handle type="target" :position="Position.Left" id="left" class="text-node-handle" />
    <Handle type="source" :position="Position.Right" id="right" class="text-node-handle" />

    <!-- 节点外左右 "+" 按钮（选中态显示，参照 RunningHUB .node-add-btn） -->
    <button
      v-if="isSelected"
      class="text-node-add-btn text-node-add-btn--left nodrag nopan"
      title="向左追加节点"
      @mousedown.stop
      @click.stop="handleAddLeft"
    >
      <span class="text-node-add-btn__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 5v10" />
          <path d="M5 10h10" />
        </svg>
      </span>
    </button>
    <button
      v-if="isSelected"
      class="text-node-add-btn text-node-add-btn--right nodrag nopan"
      title="向右追加节点"
      @mousedown.stop
      @click.stop="handleAddRight"
    >
      <span class="text-node-add-btn__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 5v10" />
          <path d="M5 10h10" />
        </svg>
      </span>
    </button>

    <!-- 节点上方浮动工具栏 -->
    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />

    <!-- 选中态下方浮出 prompt 输入框（按节点类型差异化） -->
    <div v-if="isSelected" class="text-node-prompt-panel nodrag nopan" @mousedown.stop>
      <CanvasPromptInput
        v-model="promptText"
        v-model:model-key="polishModel"
        :model-options="promptModelOptions"
        :show-add-btn="false"
        placeholder="描述你想生成的文本内容，按 Enter 发送"
        @send="handlePromptSend"
      />
    </div>
  </div>
</template>

<style scoped>
.text-node-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.text-node-title {
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
  letter-spacing: 0.2px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.text-node-title:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.text-node-title-icon {
  font-size: 16px;
  color: var(--text-tertiary);
}
.text-node-title-input {
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

.text-node-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 300px;
  min-height: 200px;
  background: var(--canvas-bg-block-default);
  border: 1px solid var(--stroke-secondary);
  border-radius: 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  transition: border-color 0.16s, box-shadow 0.16s;
}
.text-node-card.is-selected {
  border-color: var(--canvas-selection-border);
  box-shadow: 0 0 0 2px var(--canvas-selection-border);
}

/* 流光边框（参照 RunningHUB .flowing-border） */
.text-node-flow {
  content: '';
  position: absolute;
  pointer-events: none;
  background-size: 200% 200%;
  animation: text-node-flowing 2.4s linear infinite;
}
.text-node-flow--ring {
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
.text-node-flow--glow {
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
@keyframes text-node-flowing {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: -100% 50%;
  }
}

/* 空态菜单 */
.text-node-empty {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  justify-content: center;
  padding: 20px;
  text-align: left;
}
.text-node-empty-title {
  color: var(--text-tertiary);
  font-size: 13px;
  margin-bottom: 16px;
  margin-left: 10px;
}
.text-node-empty-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.text-node-empty-item {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  border-radius: 16px;
  width: fit-content;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.text-node-empty-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.text-node-empty-item-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.text-node-empty-item:hover .text-node-empty-item-icon {
  color: var(--text-primary);
}

/* 有内容态 */
.text-node-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 0;
  min-height: 0;
  padding: 16px;
}
.text-node-textarea {
  flex: 1 1 0;
  min-height: 80px;
  width: 100%;
  background: var(--canvas-float-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: var(--lv-border-radius-medium);
  padding: 8px 10px;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.55;
  resize: none;
  outline: none;
}
.text-node-textarea:focus {
  border-color: var(--canvas-selection-border);
}
.text-node-model-select {
  width: 100%;
}
.text-node-polish-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 0;
  background: var(--canvas-float-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: var(--lv-border-radius-medium);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}
.text-node-polish-btn:hover:not(:disabled) {
  background: var(--canvas-float-block-hover);
  color: var(--brand-main-default);
}
.text-node-polish-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.text-node-quick {
  display: flex;
  gap: 6px;
}
.text-node-quick-btn {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 0;
  background: var(--canvas-float-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: var(--lv-border-radius-medium);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}
.text-node-quick-btn:hover {
  background: var(--canvas-float-block-hover);
  color: var(--brand-main-default);
}

/* 左右连接点：圆形 + 中央"+"图标（即梦风） */
.text-node-handle {
  width: 20px !important;
  height: 20px !important;
  border-radius: 50% !important;
  background: var(--canvas-bg-block-default) !important;
  border: 1px solid var(--stroke-secondary) !important;
  transition: background-color 0.12s, border-color 0.12s, transform 0.12s;
}
.text-node-handle::before {
  content: '+';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
  pointer-events: none;
  line-height: 1;
}
.text-node-handle:hover {
  background: var(--canvas-float-block-hover) !important;
  border-color: var(--canvas-selection-border) !important;
  transform: scale(1.1);
}

/* 选中态下方 prompt 浮层 */
.text-node-prompt-panel {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  min-width: 380px;
  max-width: 560px;
  z-index: 5;
}

/* 节点外左右 "+" 按钮（参照 RunningHUB .node-add-btn / .node-plus-button） */
.text-node-add-btn {
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
.text-node-add-btn--left {
  left: -56px;
}
.text-node-add-btn--right {
  right: -56px;
}
.text-node-add-btn__icon {
  width: 20px;
  height: 20px;
  padding: 3px;
  border: 1px solid currentColor;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, border-color 0.2s;
  box-sizing: content-box;
}
.text-node-add-btn:hover {
  color: var(--text-primary);
}
.text-node-add-btn:active {
  transform: translateY(-50%) scale(0.95);
}
</style>
