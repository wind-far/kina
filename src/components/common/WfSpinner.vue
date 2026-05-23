<script setup lang="ts">
/**
 * 通用 loading spinner
 *
 * 使用 SVG + CSS 动画，单色描边圆环；可通过 size/color/stroke 调整。
 * 替代项目中散落在多个 css 文件的 @keyframes spin 实现。
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: number | string
  color?: string
  stroke?: number
  duration?: string
}>(), {
  size: 16,
  color: 'currentColor',
  stroke: 2,
  duration: '0.8s',
})

const sizeStyle = computed(() => {
  const value = typeof props.size === 'number' ? `${props.size}px` : props.size
  return { width: value, height: value }
})

const ringStyle = computed(() => ({
  stroke: props.color,
  strokeWidth: String(props.stroke),
  animationDuration: props.duration,
}))
</script>

<template>
  <span class="wf-spinner" :style="sizeStyle" role="status" aria-label="加载中">
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        class="wf-spinner-track"
        cx="12"
        cy="12"
        r="10"
        :stroke-width="String(props.stroke)"
      />
      <circle
        class="wf-spinner-ring"
        cx="12"
        cy="12"
        r="10"
        :style="ringStyle"
      />
    </svg>
  </span>
</template>

<style scoped>
.wf-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

.wf-spinner svg {
  width: 100%;
  height: 100%;
}

.wf-spinner-track {
  stroke: currentColor;
  opacity: 0.15;
  fill: none;
}

.wf-spinner-ring {
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 60;
  stroke-dashoffset: 30;
  transform-origin: center;
  animation: wf-spinner-rotate linear infinite;
}

@keyframes wf-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
