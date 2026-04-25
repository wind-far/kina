<template>
  <div class="task-indicator-wWf8DJ task-indicator-srBESV inside-content-generator-ZzUKJD" data-task-indicator="true">
    <div class="status-jfz4Bo inside-content-generator-jGogM6">
      <svg class="icon-M8qF2b" fill="none" height="1em" preserveAspectRatio="xMidYMid meet" role="presentation" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path d="M2 12C2 6.48 6.48 2 12 2c5.53 0 10 4.48 10 10s-4.47 10-10 10C6.48 22 2 17.52 2 12Zm9.12-3.79c0-.48.4-.88.88-.88s.87.4.87.88v4.42a.87.87 0 0 1-.87.87.879.879 0 0 1-.88-.87V8.21Zm.89 8.47c-.49 0-.88-.4-.88-.88s.39-.87.87-.87c.49 0 .88.39.88.87s-.39.88-.87.88Z" clip-rule="evenodd" fill="currentColor" fill-rule="evenodd"></path>
        </g>
      </svg>
      <div class="preview-container-RzT24s preview-container-iPrKb6 sf-hidden"></div>
    </div>

    <div class="notice-y3FxAc">
      <span>{{ indicator.title }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AgentTaskIndicatorState } from '@/types/agent'

defineProps<{
  indicator: AgentTaskIndicatorState
}>()
</script>
