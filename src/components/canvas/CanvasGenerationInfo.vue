<script setup lang="ts">
import { computed } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { WorkflowGenerationMetadata } from '@/shared/workflow-generation-metadata'

const props = defineProps<{ metadata?: WorkflowGenerationMetadata }>()
const emit = defineEmits<{ (event: 'retry'): void }>()

const summary = computed(() => {
  const value = props.metadata
  if (!value) return []
  return [
    value.model || value.modelKey ? ['模型', value.model || value.modelKey!] : null,
    value.outputFormat ? ['格式', value.outputFormat] : null,
    value.kind === 'image' && (value.size || value.ratio) ? ['尺寸', value.size || value.ratio!] : null,
    value.quality || value.resolution ? ['清晰度', value.quality || value.resolution!] : null,
    value.duration ? ['时长', `${value.duration} 秒`] : null,
    value.count && value.count > 1 ? ['数量', `${value.count} 个结果`] : null,
    value.references.length ? ['参考', `${value.references.length} 个素材`] : null,
  ].filter((item): item is [string, string] => Boolean(item))
})
</script>

<template>
  <section v-if="metadata" class="canvas-generation-info nodrag nopan" @mousedown.stop>
    <div class="canvas-generation-info__head">
      <span>生成信息</span>
      <button type="button" class="canvas-generation-info__retry" @click.stop="emit('retry')">
        <el-icon><Refresh /></el-icon> 基于此重试
      </button>
    </div>
    <p v-if="metadata.prompt" class="canvas-generation-info__prompt">{{ metadata.prompt }}</p>
    <div v-if="summary.length" class="canvas-generation-info__items">
      <span v-for="item in summary" :key="item[0]">{{ item[0] }}：{{ item[1] }}</span>
    </div>
  </section>
</template>

<style scoped>
.canvas-generation-info { margin-top: 10px; padding: 9px 10px; border: 1px solid rgba(70, 205, 179, .24); border-radius: 10px; background: rgba(14, 29, 35, .92); color: #cbd7d8; font-size: 11px; line-height: 1.45; }
.canvas-generation-info__head { display: flex; align-items: center; justify-content: space-between; color: #f1f8f7; font-weight: 600; }
.canvas-generation-info__retry { border: 0; color: #68e1c5; background: transparent; padding: 0; cursor: pointer; font-size: 11px; display: inline-flex; align-items: center; gap: 3px; }
.canvas-generation-info__prompt { margin: 7px 0 5px; color: #aebfc0; display: -webkit-box; overflow: hidden; -webkit-line-clamp: 3; -webkit-box-orient: vertical; white-space: pre-wrap; }
.canvas-generation-info__items { display: flex; flex-wrap: wrap; gap: 3px 8px; color: #8aa2a3; }
</style>
