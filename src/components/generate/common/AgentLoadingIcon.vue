<template>
  <!-- Agent 加载帧动画：39 张 PNG 逐帧切换 -->
  <div class="agent-loading-icon" :style="{ width: size + 'px', height: size + 'px' }">
    <img
      v-if="currentSrc"
      :src="currentSrc"
      :width="size"
      :height="size"
      decoding="async"
      alt=""
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const frameModules = import.meta.glob('@/assets/image/dreamina_*.png', { eager: true, import: 'default' }) as Record<string, string>

const frames = Object.keys(frameModules)
  .sort()
  .map(key => frameModules[key])

const props = withDefaults(defineProps<{
  size?: number
  /** 帧间隔（毫秒） */
  interval?: number
}>(), {
  size: 22,
  interval: 30,
})

const currentFrame = ref(0)
const currentSrc = computed(() => frames[currentFrame.value] || frames[0] || '')

let rafId: number | null = null
let lastTickTime = 0

const tick = (time: number) => {
  if (!frames.length) {
    rafId = null
    return
  }
  if (time - lastTickTime >= props.interval) {
    currentFrame.value = (currentFrame.value + 1) % frames.length
    lastTickTime = time
  }
  rafId = requestAnimationFrame(tick)
}

onMounted(() => {
  // 预加载所有帧，避免 dev 模式下首轮切换时图片仍在请求导致画面停在第一帧。
  frames.forEach(src => {
    const img = new Image()
    img.src = src
  })
  lastTickTime = performance.now()
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})
</script>

<style scoped>
.agent-loading-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-loading-icon img {
  display: block;
}
</style>
