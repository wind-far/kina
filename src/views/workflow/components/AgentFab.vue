<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (event: 'open'): void
}>()

const followX = ref('0px')
const followY = ref('0px')

const handlePointerMove = (event: PointerEvent) => {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const normalizedX = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2)
  const normalizedY = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2)
  followX.value = `${Math.max(-1, Math.min(1, normalizedX)) * 7}px`
  followY.value = `${Math.max(-1, Math.min(1, normalizedY)) * 5}px`
}

const resetPointerFollow = () => {
  followX.value = '0px'
  followY.value = '0px'
}
</script>

<template>
  <button
    class="canvas-assistant-toggle agent-fab"
    type="button"
    title="展开助手面板"
    aria-label="展开助手面板"
    :style="{ '--fab-follow-x': followX, '--fab-follow-y': followY }"
    @click="emit('open')"
    @pointermove="handlePointerMove"
    @pointerleave="resetPointerFollow"
  >
    <span class="agent-fab__body">
      <span class="agent-fab__motion">
        <span class="agent-fab__glow" />
        <span class="agent-fab__layer agent-fab__layer--1" />
        <span class="agent-fab__layer agent-fab__layer--2" />
        <span class="agent-fab__layer agent-fab__layer--3" />
        <span class="agent-fab__core" />
        <span class="agent-fab__eyes">
          <span class="agent-fab__eye" />
          <span class="agent-fab__eye" />
        </span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.agent-fab {
  --fab-follow-x: 0px;
  --fab-follow-y: 0px;
  position: absolute;
  top: 72px;
  right: 12px;
  z-index: 80;
  width: 82px;
  height: 82px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  box-shadow: none;
  color: inherit;
  cursor: grab;
  isolation: isolate;
  touch-action: none;
  user-select: none;
}

.agent-fab__body,
.agent-fab__motion {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.agent-fab__body {
  transform: translate(var(--fab-follow-x), var(--fab-follow-y));
  transition: transform 0.14s ease-out;
}

.agent-fab__motion {
  animation: agent-fab-float 4.8s ease-in-out infinite;
  transition: filter 0.22s ease, transform 0.22s ease;
  will-change: filter, transform;
}

.agent-fab:hover .agent-fab__motion {
  filter: brightness(1.08);
  transform: scale(1.08);
}

.agent-fab:active .agent-fab__motion {
  transform: scale(0.96);
}

.agent-fab__glow,
.agent-fab__layer,
.agent-fab__core,
.agent-fab__eyes {
  position: absolute;
  pointer-events: none;
}

.agent-fab__glow {
  width: 98px;
  height: 98px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(204, 255, 0, 0.42) 0, rgba(0, 255, 204, 0.18) 38%, transparent 72%);
  filter: blur(12px);
  animation: agent-fab-breathe 2.2s ease-in-out infinite alternate;
}

.agent-fab__layer {
  border-radius: 50%;
  filter: blur(4px);
  mix-blend-mode: screen;
}

.agent-fab__layer--1 {
  width: 74px;
  height: 74px;
  background: linear-gradient(45deg, rgba(204, 255, 0, 0.82), rgba(0, 255, 170, 0.52));
  animation: agent-fab-morph 4s ease-in-out infinite, agent-fab-spin 6s linear infinite;
}

.agent-fab__layer--2 {
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, rgba(160, 32, 240, 0.72), rgba(255, 0, 128, 0.5));
  animation: agent-fab-morph 5s ease-in-out infinite reverse, agent-fab-spin 7.2s linear infinite reverse;
}

.agent-fab__layer--3 {
  width: 78px;
  height: 78px;
  background: linear-gradient(225deg, rgba(0, 212, 255, 0.74), rgba(204, 255, 0, 0.58));
  animation: agent-fab-morph 3.6s ease-in-out infinite, agent-fab-spin 4.8s linear infinite;
}

.agent-fab__core {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.96) 0, rgba(204, 255, 0, 0.86) 30%, rgba(0, 255, 200, 0.36) 62%, transparent 100%);
  filter: blur(4px);
  animation: agent-fab-core 2.2s ease-in-out infinite alternate;
}

.agent-fab__eyes {
  z-index: 2;
  display: flex;
  gap: 10px;
  transform: translate(calc(var(--fab-follow-x) * 2.5), calc(var(--fab-follow-y) * 2.5));
  transition: transform 0.14s ease-out;
}

.agent-fab__eye {
  width: 7px;
  height: 12px;
  border-radius: 999px;
  background: rgba(8, 8, 8, 0.92);
  transform-origin: center 70%;
  animation: agent-fab-blink 5.2s linear infinite;
}

.agent-fab__eye:nth-child(2) {
  animation-delay: 0.08s;
}

@keyframes agent-fab-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes agent-fab-breathe {
  0% { opacity: 0.92; transform: scale(0.98); }
  100% { opacity: 1; transform: scale(1.02); }
}

@keyframes agent-fab-core {
  0% { opacity: 0.9; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1.06); }
}

@keyframes agent-fab-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes agent-fab-morph {
  0%, 100% { border-radius: 50% 42% 56% 48%; }
  50% { border-radius: 44% 58% 40% 60%; }
}

@keyframes agent-fab-blink {
  0%, 44%, 46%, 92%, 94%, 100% { opacity: 1; transform: scaleY(1); }
  45%, 93% { opacity: 0.85; transform: scaleY(0.12); }
}

@media (prefers-reduced-motion: reduce) {
  .agent-fab__motion,
  .agent-fab__glow,
  .agent-fab__layer,
  .agent-fab__core,
  .agent-fab__eye {
    animation: none;
  }
}
</style>
