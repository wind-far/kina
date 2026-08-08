<template>
  <div class="canvas-plugin-host" aria-live="polite">
    <iframe
      v-for="plugin in enabledPlugins"
      :key="plugin.id"
      :ref="(el) => setFrame(plugin.id, el)"
      class="canvas-plugin-host__frame"
      :src="plugin.release?.packageUrl || ''"
      :title="`${plugin.name} 插件`"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { buildApiUrl } from '@/api/http'

interface PluginItem {
  id: string
  name: string
  release: null | { packageUrl: string; integritySha256: string; manifest: Record<string, unknown> }
  installation: null | { enabled: boolean }
}

const props = defineProps<{ snapshot: Record<string, unknown> }>()
const emit = defineEmits<{ proposal: [value: { pluginId: string; operations: unknown[] }] }>()
const plugins = ref<PluginItem[]>([])
const frames = new Map<string, HTMLIFrameElement>()

const enabledPlugins = computed(() => plugins.value.filter(plugin => plugin.installation?.enabled && plugin.release?.packageUrl))
const setFrame = (pluginId: string, element: Element | { $el?: unknown } | null) => {
  if (element instanceof HTMLIFrameElement) frames.set(pluginId, element)
  else frames.delete(pluginId)
}

const post = (pluginId: string, message: Record<string, unknown>) => {
  frames.get(pluginId)?.contentWindow?.postMessage(message, '*')
}

const allowsCapability = (plugin: PluginItem, capability: string) => {
  const capabilities = plugin.release?.manifest?.capabilities
  return Array.isArray(capabilities) && capabilities.includes(capability)
}

const handleMessage = (event: MessageEvent) => {
  const plugin = enabledPlugins.value.find(item => frames.get(item.id)?.contentWindow === event.source)
  if (!plugin || !event.data || typeof event.data !== 'object') return
  const data = event.data as { type?: string; operations?: unknown[] }
  if (data.type === 'canvas-plugin:request-snapshot') {
    if (!allowsCapability(plugin, 'canvas.read')) return
    post(plugin.id, { type: 'canvas-plugin:snapshot', snapshot: props.snapshot })
    return
  }
  if (data.type === 'canvas-plugin:propose-operation' && Array.isArray(data.operations)) {
    if (!allowsCapability(plugin, 'canvas.propose')) return
    emit('proposal', { pluginId: plugin.id, operations: data.operations.slice(0, 20) })
  }
}

onMounted(async () => {
  window.addEventListener('message', handleMessage)
  try {
    const response = await fetch(buildApiUrl('/api/canvas/plugins'), { credentials: 'include' })
    if (response.ok) {
      const body = await response.json()
      plugins.value = Array.isArray(body?.data) ? body.data : []
    }
  } catch {
    // 插件不可用不应阻止画布启动。
  }
})

onBeforeUnmount(() => window.removeEventListener('message', handleMessage))
</script>

<style scoped>
.canvas-plugin-host { display: none; }
.canvas-plugin-host__frame { display: none; }
</style>
