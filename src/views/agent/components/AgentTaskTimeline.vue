<template>
  <section class="agent-timeline">
    <div
      v-for="step in steps"
      :key="step.id"
      class="agent-timeline-item"
      :class="`is-${step.status}`"
    >
      <div class="agent-timeline-dot" :class="`is-${step.status}`"></div>
      <div class="agent-timeline-content">
        <div class="agent-timeline-title-row">
          <div class="agent-timeline-title">{{ step.title }}</div>
          <div class="agent-timeline-status">{{ statusTextMap[step.status] }}</div>
        </div>
        <div v-if="step.description" class="agent-timeline-description">
          {{ step.description }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AgentTaskStep } from '@/types/agent'

defineProps<{
  steps: AgentTaskStep[]
}>()

const statusTextMap: Record<AgentTaskStep['status'], string> = {
  pending: '等待中',
  running: '进行中',
  completed: '已完成',
  error: '失败',
}
</script>

<style scoped>
.agent-timeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.agent-timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 2px 0;
}

.agent-timeline-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.03);
  flex: 0 0 auto;
}

.agent-timeline-dot.is-running {
  background: #38bdf8;
}

.agent-timeline-dot.is-completed {
  background: #34d399;
}

.agent-timeline-dot.is-error {
  background: #f87171;
}

.agent-timeline-content {
  min-width: 0;
  flex: 1 1 auto;
}

.agent-timeline-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.agent-timeline-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.agent-timeline-status {
  color: rgba(255, 255, 255, 0.36);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.agent-timeline-description {
  max-width: 760px;
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  line-height: 19px;
}

.agent-timeline-item.is-completed .agent-timeline-title {
  color: rgba(255, 255, 255, 0.82);
}

.agent-timeline-item.is-running .agent-timeline-title {
  color: rgba(255, 255, 255, 0.96);
}

.agent-timeline-item.is-error .agent-timeline-title,
.agent-timeline-item.is-error .agent-timeline-status {
  color: #fda4a4;
}
</style>
