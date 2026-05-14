<template>
  <div class="research-review-grid">
    <article class="research-review-card">
      <div class="research-review-card__title">
        <el-icon><CircleCheck /></el-icon>
        <span>事实核查</span>
      </div>
      <div v-if="verification" class="research-verification">
        <div class="research-verification__verdict" :class="`is-${verification.verdict}`">
          {{ verificationVerdictText }}
        </div>
        <div class="research-verification__grid">
          <span>已核查 {{ verification.checkedFacts }}</span>
          <span>通过 {{ verification.passedFacts.length }}</span>
          <span>弱证据 {{ verification.weakFacts.length }}</span>
          <span>冲突 {{ verification.conflictFacts.length }}</span>
        </div>
        <div v-if="verification.unresolvedItems?.length" class="research-verification__issues">
          <p
            v-for="(item, index) in verification.unresolvedItems.slice(0, 4)"
            :key="`${index}-${item}`"
          >
            {{ item }}
          </p>
        </div>
      </div>
      <div v-else class="research-panel-empty">正在核查事实链</div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck } from '@element-plus/icons-vue'
import type { ResearchVerificationResult } from '@/shared/research/research-types'

const props = defineProps<{
  verification: ResearchVerificationResult | null
}>()

const verificationVerdictText = computed(() => {
  switch (props.verification?.verdict) {
    case 'passed':
      return '核查通过'
    case 'partial':
      return '部分通过'
    case 'blocked':
      return '核查受阻'
    default:
      return '等待核查'
  }
})
</script>
