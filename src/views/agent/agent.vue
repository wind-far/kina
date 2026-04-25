<template>
  <AgentWorkspace
    :run="currentRun"
    :generator-prompt="generatorPrompt"
    @send="handleSend"
  />
</template>

<script setup lang="ts">
import AgentWorkspace from './components/AgentWorkspace.vue'
import { useAgentWorkspace } from './composables/useAgentWorkspace'

const { currentRun, generatorPrompt, handleSend } = useAgentWorkspace()
</script>
