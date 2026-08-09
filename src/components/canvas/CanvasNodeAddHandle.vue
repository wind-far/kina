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
import { computed, nextTick, onMounted, onUnmounted, ref, type CSSProperties } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import {
  addConnectedWorkflowNode,
  type WorkflowNodeAddMenuType,
} from '@/views/workflow/composables/useWorkflowCanvas'
import {
  WORKFLOW_NODE_ADD_MENU_WIDTH,
  resolveWorkflowNodeAddMenuPlacement,
} from '@/shared/workflow-node-add-menu'

let addMenuInstanceSerial = 0

const props = defineProps<{
  side: 'left' | 'right'
  visible?: boolean
  /** Vue Flow handle id（默认 left/right，与原节点保持兼容） */
  handleId?: string
  /** 传入后，点击加号会打开“引用该节点生成”菜单并自动创建连线。 */
  nodeId?: string
}>()

const position = computed(() => (props.side === 'left' ? Position.Left : Position.Right))
const handleType = computed<'target' | 'source'>(() => (props.side === 'left' ? 'target' : 'source'))
const idValue = computed(() => props.handleId || props.side)
const addMenuOpen = ref(false)
const { updateNodeInternals } = useVueFlow()
const addMenuInstanceId = `canvas-node-add-${addMenuInstanceSerial++}`
const dropPosition = ref<null | { screen: { x: number; y: number }; flow?: { x: number; y: number } }>(null)
const addMenuStyle = computed<CSSProperties | undefined>(() => {
  if (!dropPosition.value) return undefined
  const placement = resolveWorkflowNodeAddMenuPlacement({
    screen: dropPosition.value.screen,
    side: props.side,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  })
  return {
    position: 'fixed',
    width: `${WORKFLOW_NODE_ADD_MENU_WIDTH}px`,
    left: `${Math.round(placement.left)}px`,
    top: `${Math.round(placement.top)}px`,
    right: 'auto',
    transform: 'none',
  }
})
const addMenuItems: Array<{ type: WorkflowNodeAddMenuType; label: string; icon: string; badge?: string }> = [
  { type: 'text', label: '文本', icon: '☰' },
  { type: 'image', label: '图片', icon: '▧' },
  { type: 'video', label: '视频', icon: '◴' },
  { type: 'director', label: '导演台', icon: '⌘', badge: 'NEW' },
  { type: 'audio', label: '音频', icon: '♫' },
  { type: 'reference', label: '参考节点', icon: '⌁' },
]

const notifyMenuClosed = () => {
  window.dispatchEvent(new CustomEvent('canvasmind:node-add-menu-closed'))
}
const closeAddMenu = () => {
  const wasOpen = addMenuOpen.value
  addMenuOpen.value = false
  dropPosition.value = null
  if (wasOpen) notifyMenuClosed()
}
const toggleAddMenu = (event: MouseEvent) => {
  if (!props.nodeId) return
  const willOpen = !addMenuOpen.value
  if (willOpen) {
    window.dispatchEvent(new CustomEvent('canvasmind:close-node-add-menus', { detail: addMenuInstanceId }))
    dropPosition.value = { screen: { x: event.clientX, y: event.clientY } }
  } else {
    closeAddMenu()
  }
  addMenuOpen.value = willOpen
}
const chooseAddNode = async (type: WorkflowNodeAddMenuType) => {
  if (!props.nodeId) return
  const newId = addConnectedWorkflowNode(props.nodeId, props.side, type, dropPosition.value?.flow)
  closeAddMenu()
  if (!newId) return
  await nextTick()
  updateNodeInternals([props.nodeId, newId])
}
const closeAddMenuOutside = (event: PointerEvent) => {
  const target = event.target
  if (!(target instanceof Element) || (!target.closest('.canvas-node-add-menu') && !target.closest('.canvas-node-add-handle'))) {
    closeAddMenu()
  }
}
const closeSiblingAddMenu = (event: Event) => {
  if ((event as CustomEvent<string>).detail !== addMenuInstanceId) {
    closeAddMenu()
  }
}
const openMenuForUnconnectedDrop = (event: Event) => {
  const detail = (event as CustomEvent<{
    nodeId?: string
    side?: 'left' | 'right'
    screen?: { x: number; y: number }
    flow?: { x: number; y: number }
  }>).detail
  if (!detail || detail.nodeId !== props.nodeId || detail.side !== props.side || !detail.screen || !detail.flow) return
  window.dispatchEvent(new CustomEvent('canvasmind:close-node-add-menus', { detail: addMenuInstanceId }))
  dropPosition.value = { screen: detail.screen, flow: detail.flow }
  addMenuOpen.value = true
}
onMounted(() => document.addEventListener('pointerdown', closeAddMenuOutside))
onMounted(() => window.addEventListener('canvasmind:close-node-add-menus', closeSiblingAddMenu))
onMounted(() => window.addEventListener('canvasmind:open-node-add-menu', openMenuForUnconnectedDrop))
onUnmounted(() => {
  document.removeEventListener('pointerdown', closeAddMenuOutside)
  window.removeEventListener('canvasmind:close-node-add-menus', closeSiblingAddMenu)
  window.removeEventListener('canvasmind:open-node-add-menu', openMenuForUnconnectedDrop)
})
</script>

<template>
  <Handle
    :type="handleType"
    :position="position"
    :id="idValue"
    class="canvas-node-add-handle"
    :class="[`canvas-node-add-handle--${side}`, { 'is-visible': visible }]"
    @click.stop="toggleAddMenu"
  />
  <Teleport to="body">
    <div
      v-if="addMenuOpen"
      class="canvas-node-add-menu nodrag nopan"
      :class="`is-${side}`"
      :style="addMenuStyle"
      @mousedown.stop
      @click.stop
    >
      <div class="canvas-node-add-menu__title">引用该节点生成</div>
      <button v-for="item in addMenuItems" :key="item.type" type="button" @click="chooseAddNode(item.type)">
        <span class="canvas-node-add-menu__icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
        <small v-if="item.badge">{{ item.badge }}</small>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/*
 * Handle DOM 本体放在卡片边缘（1×1，透明），用作 Vue Flow 连线锚点；
 * 视觉的"+" 圆圈和 56×56 命中区，全部通过 ::before（命中区）+ ::after（图标）
 * 在卡片外侧 56px 处绘制——这样 bezier 边的端点恰好落在卡片边上，不再出现"线条
 * 离卡片有缝"的视觉问题。
 */
.canvas-node-add-handle {
  position: absolute !important;
  top: 50% !important;
  width: 1px !important;
  height: 1px !important;
  min-width: 1px !important;
  min-height: 1px !important;
  background: transparent !important;
  border: 0 !important;
  opacity: 0;
  z-index: 10;
  pointer-events: auto !important;
  cursor: crosshair;
  color: var(--text-tertiary);
  transition: opacity 0.2s ease, color 0.2s ease;
}
.canvas-node-add-handle--left {
  left: 0 !important;
  right: auto !important;
  transform: translateY(-50%) !important;
}
.canvas-node-add-handle--right {
  right: 0 !important;
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

/* 56×56 不可见命中区，让用户能在卡片外侧 56px 处直接拖出连线 */
.canvas-node-add-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  width: 56px;
  height: 56px;
  margin-top: -28px;
  background: transparent;
  pointer-events: auto;
}
.canvas-node-add-handle--left::before {
  left: -56px;
}
.canvas-node-add-handle--right::before {
  right: -56px;
}

/* "+" 圆形图标（20×20 圆形 + 14×14 内"+"），通过 ::after 在卡片外侧绘制 */
.canvas-node-add-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  padding: 3px;
  margin-top: -10px;
  border: 1px solid currentColor;
  border-radius: 50%;
  background:
    linear-gradient(currentColor, currentColor) center / 10px 2px no-repeat,
    linear-gradient(currentColor, currentColor) center / 2px 10px no-repeat;
  pointer-events: none;
  box-sizing: content-box;
  transition: transform 0.18s ease;
}
.canvas-node-add-handle--left::after {
  left: -38px;
}
.canvas-node-add-handle--right::after {
  right: -38px;
}
.canvas-node-add-handle:active::after {
  transform: scale(0.92);
}

.canvas-node-add-menu {
  position: fixed;
  width: 213px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  box-sizing: border-box;
  padding: 12px 10px;
  border: 1px solid var(--canvas-selection-border, #1677ff);
  border-radius: 14px;
  background: var(--canvas-float-block-default, #fff);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.2);
  z-index: 220;
}
.canvas-node-add-menu__title {
  padding: 4px 10px 8px;
  color: var(--text-secondary);
  font-size: 16px;
  font-weight: 600;
}
.canvas-node-add-menu button {
  width: 100%;
  min-height: 42px;
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-primary);
  font-size: 16px;
  text-align: left;
  cursor: pointer;
}
.canvas-node-add-menu button:hover { background: var(--canvas-float-block-hover, rgba(0, 0, 0, 0.05)); }
.canvas-node-add-menu__icon { color: var(--text-secondary); }
.canvas-node-add-menu small {
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(2, 219, 163, 0.16);
  color: var(--brand-main-default);
  font-size: 9px;
}
</style>
