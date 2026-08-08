<template>
  <section class="wf-plugin-node" :style="{ '--plugin-color': color }" :aria-label="data.label || '插件节点'">
    <CanvasNodeResizer :visible="selected" :min-width="220" :min-height="140" />
    <Handle type="target" :position="Position.Left" id="left" />
    <div class="wf-plugin-node__eyebrow">受信插件节点</div>
    <strong>{{ data.label || '插件节点' }}</strong>
    <p>{{ data.pluginDescription || '插件数据由 CanvasMind 保存；插件停用后仍可恢复。' }}</p>
    <span v-if="summary" class="wf-plugin-node__summary">{{ summary }}</span>
    <Handle type="source" :position="Position.Right" id="right" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import CanvasNodeResizer from '@/components/canvas/CanvasNodeResizer.vue'

interface PluginNodeData extends Record<string, unknown> {
  label?: string
  pluginDescription?: string
  pluginColor?: string
  value?: unknown
  content?: unknown
  prompt?: unknown
}

const props = defineProps<{ data: PluginNodeData; selected?: boolean }>()
const color = computed(() => /^#[0-9a-f]{6}$/i.test(String(props.data.pluginColor || '')) ? String(props.data.pluginColor) : '#6d5dfc')
const summary = computed(() => {
  const value = props.data.value ?? props.data.content ?? props.data.prompt
  return typeof value === 'string' ? value.slice(0, 90) : ''
})
</script>

<style scoped>
.wf-plugin-node { position: relative; box-sizing: border-box; width: 100%; height: 100%; min-width: 220px; min-height: 140px; padding: 15px; border: 1px solid color-mix(in srgb, var(--plugin-color) 72%, white); border-radius: 13px; background: #17171e; box-shadow: 0 12px 34px rgba(0,0,0,.22); color: #f4f4f6; }
.wf-plugin-node__eyebrow { margin-bottom: 7px; color: var(--plugin-color); font-size: 10px; font-weight: 700; letter-spacing: .08em; }
.wf-plugin-node strong { display: block; font-size: 14px; }
.wf-plugin-node p { margin: 7px 0; color: #b8b8c5; font-size: 12px; line-height: 1.45; }
.wf-plugin-node__summary { display: block; overflow: hidden; color: #d8d8df; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
</style>
