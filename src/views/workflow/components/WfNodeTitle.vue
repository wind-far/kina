<script setup lang="ts">
/**
 * 节点标题组件
 *
 * 双击切换为输入框编辑名称，回车或失焦提交，Esc 取消。
 */
import { ref, watch, nextTick } from 'vue'
import { updateNode } from '../composables/useWorkflowCanvas'

const props = defineProps<{
  nodeId: string
  label?: string
  placeholder: string
}>()

const editing = ref(false)
const draft = ref(props.label ?? '')
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.label, (v) => {
  if (!editing.value) draft.value = v ?? ''
})

const startEdit = async () => {
  draft.value = props.label ?? ''
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

const commit = () => {
  if (!editing.value) return
  editing.value = false
  const trimmed = draft.value.trim()
  if (trimmed === (props.label ?? '')) return
  updateNode(props.nodeId, { label: trimmed })
}

const cancel = () => {
  draft.value = props.label ?? ''
  editing.value = false
}
</script>

<template>
  <span
    v-if="!editing"
    class="wf-node-header-title wf-node-header-title-editable"
    title="双击编辑名称"
    @dblclick.stop="startEdit"
  >{{ label || placeholder }}</span>
  <input
    v-else
    ref="inputRef"
    v-model="draft"
    class="wf-node-header-title-input nodrag"
    :placeholder="placeholder"
    :maxlength="40"
    @blur="commit"
    @keydown.enter.prevent="commit"
    @keydown.esc.prevent="cancel"
    @mousedown.stop
    @click.stop
  />
</template>

<style scoped>
.wf-node-header-title-editable {
  cursor: text;
  user-select: none;
}

.wf-node-header-title-input {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #e0f5ff);
  background: var(--bg-block-primary, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--brand-color, #10b981);
  border-radius: 4px;
  padding: 1px 6px;
  outline: none;
  width: 140px;
  height: 18px;
  box-sizing: border-box;
}
</style>
