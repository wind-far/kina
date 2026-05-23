<script setup lang="ts">
/**
 * 顶部路由进度条
 *
 * 监听 loadingStore.isLoading('route')：
 *   - start：进度条从 0% 缓慢推进到 80%（前 600ms 内推到 50%，之后渐近 80%）
 *   - stop：跳到 100%，停留 150ms 后淡出
 *   - 最小可见时长 200ms：本地缓存 chunk 时也不闪烁
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useLoadingStore } from '@/stores/loading'

const { isLoading } = useLoadingStore()

const progress = ref(0)
const visible = ref(false)

let rampTimer: ReturnType<typeof setInterval> | null = null
let finishTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let startedAt = 0

const MIN_VISIBLE_MS = 200
const FINISH_HOLD_MS = 150
const FADE_OUT_MS = 200

const clearRamp = () => {
  if (rampTimer) {
    clearInterval(rampTimer)
    rampTimer = null
  }
}

const clearTimers = () => {
  clearRamp()
  if (finishTimer) {
    clearTimeout(finishTimer)
    finishTimer = null
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

const startProgress = () => {
  clearTimers()
  visible.value = true
  progress.value = 8
  startedAt = Date.now()
  rampTimer = setInterval(() => {
    // 越接近 80%，递增越慢
    const remaining = 80 - progress.value
    if (remaining <= 0) {
      clearRamp()
      return
    }
    progress.value = Math.min(80, progress.value + Math.max(0.4, remaining * 0.08))
  }, 120)
}

const finishProgress = () => {
  clearRamp()
  progress.value = 100
  const elapsed = Date.now() - startedAt
  const wait = Math.max(FINISH_HOLD_MS, MIN_VISIBLE_MS - elapsed)
  finishTimer = setTimeout(() => {
    visible.value = false
    hideTimer = setTimeout(() => {
      progress.value = 0
    }, FADE_OUT_MS)
  }, wait)
}

watch(
  () => isLoading('route'),
  (loading) => {
    if (loading) {
      startProgress()
    } else if (visible.value) {
      finishProgress()
    }
  },
  { immediate: true },
)

onBeforeUnmount(clearTimers)

const barStyle = computed(() => ({
  width: `${progress.value}%`,
  opacity: visible.value ? 1 : 0,
  transition: visible.value
    ? 'width 0.2s ease'
    : `width 0.2s ease, opacity ${FADE_OUT_MS}ms ease`,
}))
</script>

<template>
  <div class="wf-route-progress" aria-hidden="true">
    <div class="wf-route-progress-bar" :style="barStyle"></div>
  </div>
</template>

<style scoped>
.wf-route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  pointer-events: none;
  z-index: 99999;
}

.wf-route-progress-bar {
  height: 100%;
  width: 0;
  background: linear-gradient(
    90deg,
    var(--brand-color, #10b981) 0%,
    #3b82f6 50%,
    #6366f1 100%
  );
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
}
</style>
