<script setup lang="ts">
/**
 * 节点外侧"+"连接按钮（参照 RunningHUB .node-add-btn / .node-plus-button）
 *
 * 直接用 Vue Flow Handle 作为按钮本体——
 *   - Handle 的 mousedown 自动触发"拖拽连线"
 *   - CSS 改造为 56×56 透明圆形，::after 画出 20×20 圆形 "+" 图标
 *   - 节点外左/右 -56px 位置
 *
 * 移除原 button + Handle 的双层结构，所有"拖出连线"行为由 Vue Flow 接管。
 */
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{
  side: 'left' | 'right'
  visible?: boolean
  /** Vue Flow handle id（默认 left/right，与原节点保持兼容） */
  handleId?: string
}>()

const position = computed(() => (props.side === 'left' ? Position.Left : Position.Right))
const handleType = computed<'target' | 'source'>(() => (props.side === 'left' ? 'target' : 'source'))
const idValue = computed(() => props.handleId || props.side)
</script>

<template>
  <Handle
    :type="handleType"
    :position="position"
    :id="idValue"
    class="canvas-node-add-handle"
    :class="[`canvas-node-add-handle--${side}`, { 'is-visible': visible }]"
  />
</template>

<style scoped>
.canvas-node-add-handle {
  position: absolute !important;
  top: 50% !important;
  width: 56px !important;
  height: 56px !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 50% !important;
  opacity: 0;
  z-index: 10;
  pointer-events: auto !important;
  cursor: crosshair;
  color: var(--text-tertiary);
  transition: opacity 0.2s ease, color 0.2s ease;
}
.canvas-node-add-handle--left {
  left: -56px !important;
  right: auto !important;
  transform: translateY(-50%) !important;
}
.canvas-node-add-handle--right {
  right: -56px !important;
  left: auto !important;
  transform: translateY(-50%) !important;
}
.canvas-node-add-handle.is-visible,
.canvas-node-add-handle:hover {
  opacity: 1;
}
.canvas-node-add-handle:hover {
  color: var(--text-primary);
}

/* "+" 图标（20×20 圆形 + 14×14 内"+"），用纯 CSS 画，免内嵌 SVG */
.canvas-node-add-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  padding: 3px;
  margin: -10px 0 0 -10px;
  border: 1px solid currentColor;
  border-radius: 50%;
  background:
    linear-gradient(currentColor, currentColor) center / 10px 2px no-repeat,
    linear-gradient(currentColor, currentColor) center / 2px 10px no-repeat;
  pointer-events: none;
  box-sizing: content-box;
  transition: transform 0.18s ease;
}
.canvas-node-add-handle:active::after {
  transform: scale(0.92);
}
</style>
