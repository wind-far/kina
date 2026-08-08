<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CopyDocument, Delete, Film } from '@element-plus/icons-vue'
import CanvasNodeHoverToolbar, { type NodeToolbarAction } from '@/components/canvas/CanvasNodeHoverToolbar.vue'
import CanvasNodeAddHandle from '@/components/canvas/CanvasNodeAddHandle.vue'
import CanvasNodeResizer from '@/components/canvas/CanvasNodeResizer.vue'
import { useNodeTitleEdit } from '@/composables/useNodeTitleEdit'
import {
  duplicateNode,
  removeNode,
  updateNode,
  type WorkflowDirectorNodeData,
} from '../../composables/useWorkflowCanvas'

const props = defineProps<{
  id: string
  data: WorkflowDirectorNodeData & { selected?: boolean }
  selected?: boolean
}>()

const isSelected = computed(() => props.selected || props.data?.selected)
const titleEdit = useNodeTitleEdit(props.id, () => props.data?.label || '导演台')
const showActions = ref(false)
const brief = ref(props.data?.brief || '')
const shotPlan = ref(props.data?.shotPlan || '')
const mode = ref(props.data?.mode || 'storyboard')

watch(() => props.data?.brief, value => { if (value !== undefined) brief.value = value })
watch(() => props.data?.shotPlan, value => { if (value !== undefined) shotPlan.value = value })
watch(() => props.data?.mode, value => { if (value) mode.value = value })

const persist = () => updateNode(props.id, {
  brief: brief.value,
  shotPlan: shotPlan.value,
  mode: mode.value,
})

const hoverActions = computed<NodeToolbarAction[]>(() => [
  { id: 'duplicate', label: '复制', icon: CopyDocument, onClick: () => duplicateNode(props.id) },
  { id: 'delete', label: '删除', icon: Delete, danger: true, onClick: () => removeNode(props.id) },
])
</script>

<template>
  <div class="director-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <CanvasNodeResizer :visible="isSelected" :min-width="300" :min-height="260" />
    <div class="director-node-title" title="双击编辑名称" @dblclick.stop="titleEdit.start">
      <el-icon><Film /></el-icon>
      <input
        v-if="titleEdit.editing.value"
        :ref="titleEdit.setInputRef"
        v-model="titleEdit.draft.value"
        class="director-node-title-input nodrag"
        @blur="titleEdit.commit"
        @keydown.enter.prevent="titleEdit.commit"
        @keydown.esc.prevent="titleEdit.cancel"
        @mousedown.stop
      >
      <span v-else>{{ data?.label || '导演台' }}</span>
    </div>
    <div class="director-node-card" :class="{ 'is-selected': isSelected }">
      <div class="director-node-status">规划节点 · 不自动执行生成</div>
      <label>
        <span>创作类型</span>
        <select v-model="mode" class="nodrag nopan" @change="persist">
          <option value="storyboard">分镜规划</option>
          <option value="commercial">商业广告</option>
          <option value="short-video">短视频</option>
        </select>
      </label>
      <label>
        <span>导演意图</span>
        <textarea v-model="brief" class="nodrag nopan" placeholder="描述叙事目标、节奏、镜头语言…" @input="persist" @mousedown.stop />
      </label>
      <label>
        <span>镜头规划</span>
        <textarea v-model="shotPlan" class="nodrag nopan" placeholder="每行一个镜头或场次…" @input="persist" @mousedown.stop />
      </label>
    </div>
    <CanvasNodeAddHandle side="left" :visible="isSelected" />
    <CanvasNodeAddHandle side="right" :visible="isSelected" />
    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />
  </div>
</template>

<style scoped>
.director-node-wrapper { position: relative; width: 100%; height: 100%; min-width: 300px; min-height: 260px; }
.director-node-title { position: absolute; bottom: calc(100% + 8px); left: 2px; display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 15px; }
.director-node-title-input { width: 180px; border: 1px solid var(--brand-main-default); border-radius: 5px; padding: 2px 6px; background: var(--canvas-node-bg); color: var(--text-primary); }
.director-node-card { box-sizing: border-box; width: 100%; height: 100%; min-height: 0; padding: 16px; border: 1px solid var(--canvas-node-border); border-radius: 16px; background: var(--canvas-node-bg); display: flex; flex-direction: column; gap: 12px; }
.director-node-card.is-selected { border-color: var(--brand-main-default); box-shadow: 0 0 0 2px rgba(2, 219, 163, .16); }
.director-node-status { padding: 7px 9px; border-radius: 8px; background: rgba(245, 158, 11, .1); color: #f6b94d; font-size: 12px; }
.director-node-card label { display: flex; flex-direction: column; gap: 6px; color: var(--text-tertiary); font-size: 12px; }
.director-node-card select, .director-node-card textarea { box-sizing: border-box; width: 100%; border: 1px solid var(--stroke-secondary); border-radius: 9px; background: rgba(0, 0, 0, .18); color: var(--text-primary); padding: 8px 10px; outline: none; }
.director-node-card textarea { min-height: 72px; resize: vertical; line-height: 1.5; }
.director-node-card select:focus, .director-node-card textarea:focus { border-color: var(--brand-main-default); }
</style>
