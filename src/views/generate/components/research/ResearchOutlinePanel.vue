<template>
  <div class="research-review-grid">
    <article class="research-review-card">
      <div class="research-review-card__title">
        <el-icon><Document /></el-icon>
        <span>报告大纲</span>
      </div>
      <ol v-if="outlineSections.length" class="research-outline">
        <li v-for="section in outlineSections" :key="section.id">
          <span>{{ section.title }}</span>
          <p v-if="section.objective">{{ section.objective }}</p>
        </li>
      </ol>
      <div v-else class="research-panel-empty">正在规划报告结构</div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import type { ResearchOutlineSection } from '@/shared/research/research-types'

defineProps<{
  outlineSections: ResearchOutlineSection[]
}>()
</script>
