<template>
  <div class="agent-bottom-dock">
    <div class="agent-bottom-dock-inner">
      <AgentTaskIndicator :indicator="indicator" />
      <div class="agent-bottom-dock-generator">
        <ContentGenerator
          :collapsible="true"
          :default-expanded="true"
          initial-creation-type="image"
          :external-prompt="generatorPrompt"
          popup-placement="top"
          @send="(...args) => emit('send', ...args)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ContentGenerator from '@/components/generate/ContentGenerator.vue'
import type { CreationType } from '@/components/generate/selectors'
import type { AgentTaskIndicatorState } from '@/types/agent'
import AgentTaskIndicator from './AgentTaskIndicator.vue'

defineProps<{
  indicator: AgentTaskIndicatorState
  generatorPrompt?: string
}>()

const emit = defineEmits<{
  send: [message: string, type: CreationType, options?: {
    model?: string
    modelKey?: string
    ratio?: string
    resolution?: string
    duration?: string
    feature?: string
    skill?: string
  }]
}>()
</script>

<style scoped>
.agent-bottom-dock {
  flex: 0 0 auto;
  padding: 0 0 24px;
  background:
    linear-gradient(180deg, rgba(11, 12, 15, 0) 0%, rgba(11, 12, 15, 0.74) 18%, rgba(11, 12, 15, 0.96) 40%, #0b0c0f 62%);
}

.agent-bottom-dock-inner {
  width: min(920px, calc(100vw - 64px));
  margin: 0 auto;
}

.agent-bottom-dock-inner::before {
  content: '';
  display: block;
  height: 1px;
  margin-bottom: 16px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.08) 18%, rgba(255, 255, 255, 0.08) 82%, rgba(255, 255, 255, 0) 100%);
}

.agent-bottom-dock-generator {
  margin-top: 12px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045) 0%, rgba(255, 255, 255, 0.02) 100%),
    rgba(18, 20, 25, 0.88);
  box-shadow:
    0 -12px 32px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(22px);
}

.agent-bottom-dock-generator :deep(.dimension-layout-FUl4Nj) {
  border-radius: 20px;
}

@media (max-width: 768px) {
  .agent-bottom-dock {
    padding-bottom: 16px;
  }

  .agent-bottom-dock-inner {
    width: calc(100vw - 32px);
  }

  .agent-bottom-dock-inner::before {
    margin-bottom: 12px;
  }

  .agent-bottom-dock-generator {
    padding: 8px;
    border-radius: 22px;
  }
}
</style>
