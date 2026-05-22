<script setup lang="ts">
/**
 * 连线删除按钮
 *
 * 包含两态：
 *   1. 默认态：红色圆形 × 按钮
 *   2. 确认态：水平气泡 "删除连线？ ✓ ✗"
 * 点击 × 进入确认态；进入确认态后即使外部 visible 变 false 也保持显示，
 * 直到用户确认或取消。
 */
import { computed, ref } from 'vue'
import { removeEdge } from '../composables/useWorkflowCanvas'

const props = withDefaults(defineProps<{
  edgeId: string
  visible?: boolean
}>(), { visible: false })

const confirming = ref(false)
const shouldShow = computed(() => props.visible || confirming.value)

const handleAskConfirm = (event: MouseEvent) => {
  event.stopPropagation()
  confirming.value = true
}

const handleConfirm = (event: MouseEvent) => {
  event.stopPropagation()
  confirming.value = false
  removeEdge(props.edgeId)
}

const handleCancel = (event: MouseEvent) => {
  event.stopPropagation()
  confirming.value = false
}
</script>

<template>
  <Transition name="wf-edge-delete">
    <div
      v-show="shouldShow"
      class="wf-edge-delete-wrapper"
      :class="{ 'is-confirming': confirming }"
      @mousedown.stop
    >
      <button
        v-if="!confirming"
        type="button"
        class="wf-edge-delete-btn"
        title="删除连线"
        aria-label="删除连线"
        @click="handleAskConfirm"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      </button>

      <div v-else class="wf-edge-delete-confirm" role="alertdialog" aria-label="删除连线确认">
        <span class="wf-edge-delete-confirm-text">删除连线？</span>
        <button
          type="button"
          class="wf-edge-delete-confirm-btn is-danger"
          title="确认删除"
          aria-label="确认删除"
          @click="handleConfirm"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          class="wf-edge-delete-confirm-btn"
          title="取消"
          aria-label="取消"
          @click="handleCancel"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.wf-edge-delete-wrapper {
  position: absolute;
  top: -10px;
  right: -10px;
  z-index: 101;
  pointer-events: all;
}

.wf-edge-delete-wrapper.is-confirming {
  top: -16px;
  right: -10px;
}

.wf-edge-delete-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  border: 1.5px solid var(--canvas-bg, #0f0f12);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.35);
  transition: transform 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.wf-edge-delete-btn:hover {
  background: #dc2626;
  transform: scale(1.18);
  box-shadow: 0 3px 10px rgba(220, 38, 38, 0.5);
}

.wf-edge-delete-btn:active {
  transform: scale(0.92);
}

.wf-edge-delete-btn svg {
  pointer-events: none;
}

.wf-edge-delete-confirm {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 8px;
  border-radius: 14px;
  background: var(--canvas-float-block-default, rgba(32, 33, 39, 0.96));
  backdrop-filter: blur(20px);
  border: 0.5px solid var(--stroke-tertiary, rgba(255, 255, 255, 0.12));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
}

.wf-edge-delete-confirm-text {
  font-size: 11px;
  color: var(--text-primary, #e0f5ff);
  user-select: none;
}

.wf-edge-delete-confirm-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #e0f5ff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.wf-edge-delete-confirm-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: scale(1.1);
}

.wf-edge-delete-confirm-btn.is-danger {
  background: #ef4444;
  color: #fff;
}

.wf-edge-delete-confirm-btn.is-danger:hover {
  background: #dc2626;
}

.wf-edge-delete-confirm-btn svg {
  pointer-events: none;
}
</style>
