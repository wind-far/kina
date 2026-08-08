<template>
  <section class="wf-unknown-node" :aria-label="data.label || '未安装的插件节点'">
    <strong>{{ data.label || data.originalType || '未安装的插件节点' }}</strong>
    <p>此节点来自未启用的插件；数据已保留，可在启用插件后恢复。</p>
  </section>
</template>

<script setup lang="ts">
import type { WorkflowUnknownNodeData } from '../../composables/useWorkflowCanvas'

defineProps<{ id: string; data: WorkflowUnknownNodeData }>()
</script>

<style scoped>
.wf-unknown-node { width: 240px; padding: 14px; border: 1px dashed #9a7b40; border-radius: 12px; background: #fffbeb; color: #5f4716; }
.wf-unknown-node strong { display: block; font-size: 13px; }
.wf-unknown-node p { margin: 7px 0 0; font-size: 12px; line-height: 1.5; }
</style>
