<template>
  <div class="agent-workspace">
    <div class="agent-workspace-shell">
      <AgentTopbar />
      <div class="agent-workspace-scroll">
        <div class="agent-workspace-content">
          <div class="agent-workspace-date">今天</div>
          <div v-if="run.status === 'idle'" class="agent-workspace-empty">
            发送一个任务后，这里会按对话记录展示用户消息、执行过程和结果。
          </div>
          <GenerateAgentRecord v-else :run="run" />
        </div>
      </div>
      <AgentBottomDock
        :indicator="resolvedIndicator"
        :generator-prompt="generatorPrompt"
        @send="(...args) => emit('send', ...args)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AgentRunState } from '@/types/agent'
import type { CreationType } from '@/components/generate/selectors'
import AgentBottomDock from './AgentBottomDock.vue'
import AgentTopbar from './AgentTopbar.vue'
import GenerateAgentRecord from '@/views/generate/components/GenerateAgentRecord.vue'

const emit = defineEmits<{
  send: [message: string, type: CreationType, options?: {
    model?: string
    modelKey?: string
    ratio?: string
    resolution?: string
    duration?: string
    feature?: string
    skill?: string
    referenceImages?: string[]
  }]
}>()

const props = defineProps<{
  run: AgentRunState
  generatorPrompt?: string
}>()

const resolvedIndicator = computed(() => props.run.indicator || {
  status: props.run.status,
  title: '暂无任务',
  description: '发送一个任务后，这里会显示当前执行阶段。',
})
</script>

<style scoped>
.agent-workspace {
  height: 100vh;
  padding: 24px 32px 0;
  background:
    radial-gradient(circle at top center, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 32%),
    #0b0c0f;
  overflow: hidden;
}

.agent-workspace-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 24px);
}

.agent-workspace-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.agent-workspace-scroll::-webkit-scrollbar {
  display: none;
}

.agent-workspace-content {
  width: min(920px, 100%);
  padding: 30px 0 156px;
  margin: 0 auto;
}

.agent-workspace-date {
  color: rgba(255, 255, 255, 0.92);
  font-size: 24px;
  font-weight: 600;
}

.agent-workspace-empty {
  margin-top: 24px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  line-height: 22px;
}

@media (max-width: 768px) {
  .agent-workspace {
    padding: 16px 16px 0;
  }

  .agent-workspace-shell {
    height: calc(100vh - 16px);
  }

  .agent-workspace-content {
    padding: 22px 0 144px;
  }

  .agent-workspace-date {
    font-size: 22px;
  }

  .agent-workspace-empty {
    margin-top: 18px;
  }
}
</style>
