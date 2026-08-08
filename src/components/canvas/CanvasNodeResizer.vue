<script setup lang="ts">
/**
 * 画布节点统一缩放控件。
 *
 * Vue Flow 将尺寸写入节点 style.width / style.height；这里仅负责统一外观
 * 以及把连续拖动合并为一次画布历史记录，避免每一帧都产生撤销步骤。
 */
import { onBeforeUnmount, ref } from 'vue'
import { NodeResizer } from '@vue-flow/node-resizer'
import { pauseHistory, resumeHistory } from '@/views/workflow/composables/useWorkflowCanvas'
import '@vue-flow/node-resizer/dist/style.css'

withDefaults(defineProps<{
  visible?: boolean
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  keepAspectRatio?: boolean
}>(), {
  visible: false,
  minWidth: 180,
  minHeight: 120,
  maxWidth: 1200,
  maxHeight: 1000,
  keepAspectRatio: false,
})

const resizing = ref(false)
const handleResizeStart = () => {
  if (resizing.value) return
  resizing.value = true
  pauseHistory()
}
const handleResizeEnd = () => {
  if (!resizing.value) return
  resizing.value = false
  resumeHistory(true)
}

onBeforeUnmount(() => {
  if (resizing.value) resumeHistory(true)
})
</script>

<template>
  <NodeResizer
    :is-visible="visible"
    :min-width="minWidth"
    :min-height="minHeight"
    :max-width="maxWidth"
    :max-height="maxHeight"
    :keep-aspect-ratio="keepAspectRatio"
    color="var(--brand-main-default, #02dba3)"
    handle-class-name="canvas-node-resizer__handle"
    line-class-name="canvas-node-resizer__line"
    @resize-start="handleResizeStart"
    @resize-end="handleResizeEnd"
  />
</template>

<style>
.canvas-node-resizer__handle {
  width: 8px !important;
  height: 8px !important;
  border: 1px solid #fff !important;
  border-radius: 50% !important;
  background: var(--brand-main-default, #02dba3) !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .25);
}

.canvas-node-resizer__line {
  border-color: var(--brand-main-default, #02dba3) !important;
  opacity: .72;
}
</style>
