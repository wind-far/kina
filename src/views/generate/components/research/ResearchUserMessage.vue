<template>
  <header class="research-user-message">
    <div class="research-user-message__bubble" :class="{ 'is-verification': isVerificationRecord }">
      <span v-if="isVerificationRecord" class="research-user-message__badge">报告核查</span>
      <span>{{ displayPrompt }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 顶部用户消息气泡：纯展示组件，根据 prompt 是否以"核查报告："开头切换样式。
const props = defineProps<{
  prompt: string
}>()

const isVerificationRecord = computed(() => String(props.prompt || '').trim().startsWith('核查报告：'))

const displayPrompt = computed(() => {
  const promptValue = String(props.prompt || '').trim()
  if (!isVerificationRecord.value) {
    return promptValue
  }

  return promptValue.replace(/^核查报告：\s*/u, '').trim() || '当前研究报告'
})
</script>
