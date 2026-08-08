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
      @load="notifyReady(plugin)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { buildApiUrl } from '@/api/http'
import { startCanvasPluginGenerationTask, subscribeGenerationTaskEvents } from '@/api/canvas-plugins'
import {
  EMPTY_CANVAS_PLUGIN_CONTRIBUTIONS,
  normalizeCanvasPluginRuntimeContributions,
  type CanvasPluginRuntimeContributions,
} from '@/shared/canvas-plugin-runtime'

interface PluginItem {
  id: string
  slug: string
  name: string
  release: null | { packageUrl: string; integritySha256: string; isMirrored: boolean; manifest: Record<string, unknown> }
  installation: null | { enabled: boolean }
}

const props = defineProps<{ snapshot: Record<string, unknown> }>()
const emit = defineEmits<{
  proposal: [value: { pluginId: string; operations: unknown[] }]
  registration: [value: { pluginId: string; slug: string; contributions: CanvasPluginRuntimeContributions }]
  generationResult: [value: {
    pluginId: string
    templateId: string
    resultNodeId: string
    targetNodeId?: string
    taskId: string
    prompt: string
    referenceImages: string[]
    model: string
    modelKey: string
    content: string
    outputs: Array<{ url: string; outputType: string }>
  }]
  reset: []
}>()
const plugins = ref<PluginItem[]>([])
const frames = new Map<string, HTMLIFrameElement>()
const registrations = new Map<string, CanvasPluginRuntimeContributions>()
const forwardedGenerationResults = new Set<string>()

// 旧版直链发布不进入沙箱，必须由服务端完成下载、哈希校验和镜像后才允许执行。
const enabledPlugins = computed(() => plugins.value.filter(plugin => plugin.installation?.enabled && plugin.release?.packageUrl && plugin.release.isMirrored))
const setFrame = (pluginId: string, element: Element | { $el?: unknown } | null) => {
  if (element instanceof HTMLIFrameElement) frames.set(pluginId, element)
  else frames.delete(pluginId)
}

const post = (pluginId: string, message: Record<string, unknown>) => {
  frames.get(pluginId)?.contentWindow?.postMessage(message, '*')
}
const notifyReady = (plugin: PluginItem) => post(plugin.id, { type: 'canvas-plugin:ready', protocol: 1 })

const allowsCapability = (plugin: PluginItem, capability: string) => {
  const capabilities = plugin.release?.manifest?.capabilities
  return Array.isArray(capabilities) && capabilities.includes(capability)
}

const emitRegistration = (plugin: PluginItem, raw: unknown) => {
  const capabilities = plugin.release?.manifest?.capabilities
  const contributions = normalizeCanvasPluginRuntimeContributions(raw, Array.isArray(capabilities) ? capabilities.map(String) : [])
  registrations.set(plugin.id, contributions)
  emit('registration', { pluginId: plugin.id, slug: plugin.slug, contributions })
}

const handleMessage = (event: MessageEvent) => {
  const plugin = enabledPlugins.value.find(item => frames.get(item.id)?.contentWindow === event.source)
  if (!plugin || !event.data || typeof event.data !== 'object') return
  const data = event.data as { type?: string; operations?: unknown[]; contributions?: unknown; templateId?: unknown; prompt?: unknown; referenceImages?: unknown; targetNodeId?: unknown }
  if (data.type === 'canvas-plugin:request-snapshot') {
    if (!allowsCapability(plugin, 'canvas.read')) return
    post(plugin.id, { type: 'canvas-plugin:snapshot', snapshot: props.snapshot })
    return
  }
  if (data.type === 'canvas-plugin:propose-operation' && Array.isArray(data.operations)) {
    if (!allowsCapability(plugin, 'canvas.propose')) return
    emit('proposal', { pluginId: plugin.id, operations: data.operations.slice(0, 20) })
    return
  }
  if (data.type === 'canvas-plugin:register') {
    emitRegistration(plugin, data.contributions)
    return
  }
  if (data.type === 'canvas-plugin:request-generation') {
    if (!allowsCapability(plugin, 'generation')) return
    void runGeneration(plugin, data)
  }
}

const runGeneration = async (plugin: PluginItem, input: { templateId?: unknown; prompt?: unknown; referenceImages?: unknown; targetNodeId?: unknown }) => {
  const templateId = String(input.templateId || '').trim()
  const prompt = String(input.prompt || '').trim()
  const action = (registrations.get(plugin.id) || EMPTY_CANVAS_PLUGIN_CONTRIBUTIONS).generation.find(item => item.id === templateId)
  if (!templateId || !prompt) {
    post(plugin.id, { type: 'canvas-plugin:generation-error', message: '生成请求缺少模板或提示词' })
    return
  }
  if (!action) {
    post(plugin.id, { type: 'canvas-plugin:generation-error', message: '生成模板尚未由插件登记' })
    return
  }
  const referenceImages = Array.isArray(input.referenceImages) ? input.referenceImages.map(String).slice(0, 4) : []
  const targetNodeId = String(input.targetNodeId || '').trim().slice(0, 120)
  try {
    const task = await startCanvasPluginGenerationTask(plugin.id, {
      templateId,
      prompt,
      referenceImages,
    })
    const taskId = String(task?.id || '').trim()
    if (!taskId) throw new Error('生成任务创建失败')
    post(plugin.id, { type: 'canvas-plugin:generation-started', taskId, templateId })
    await subscribeGenerationTaskEvents(taskId, {
      onEvent: (taskEvent) => {
        const record = taskEvent.record
        const outputs = Array.isArray(record?.outputs) ? record.outputs.map(item => ({ url: String(item?.url || ''), outputType: String(item?.outputType || '') })).filter(item => item.url) : []
        post(plugin.id, {
          type: 'canvas-plugin:generation-event', taskId,
          event: taskEvent.type,
          done: Boolean(taskEvent.done),
          message: String(taskEvent.message || ''),
          content: typeof record?.content === 'string' ? record.content : '',
          outputs,
        })
        // 只有宿主生成的终态结果才可进入确认预览；iframe 无法借 postMessage 伪造该事件。
        if (taskEvent.type === 'completed' && action.resultNodeId && !forwardedGenerationResults.has(taskId)) {
          forwardedGenerationResults.add(taskId)
          emit('generationResult', {
            pluginId: plugin.id,
            templateId,
            resultNodeId: action.resultNodeId,
            ...(targetNodeId ? { targetNodeId } : {}),
            taskId,
            prompt,
            referenceImages,
            model: String(record?.model || ''),
            modelKey: String(record?.modelKey || ''),
            content: typeof record?.content === 'string' ? record.content : '',
            outputs,
          })
        }
      },
    })
  } catch (error: any) {
    post(plugin.id, { type: 'canvas-plugin:generation-error', message: String(error?.message || '插件生成任务失败') })
  }
}

/** 由主应用调用；会再次核对 action 是否已登记，iframe 无法伪造其他插件动作。 */
const invoke = (input: { pluginId: string; scope: 'toolbar' | 'inspector' | 'generation'; actionId: string; nodeId?: string }) => {
  const plugin = enabledPlugins.value.find(item => item.id === input.pluginId)
  const registered = registrations.get(input.pluginId) || EMPTY_CANVAS_PLUGIN_CONTRIBUTIONS
  const actions = input.scope === 'toolbar' ? registered.toolbar : input.scope === 'inspector' ? registered.inspectors : registered.generation
  if (!plugin || !actions.some(action => action.id === input.actionId)) return false
  post(input.pluginId, { type: 'canvas-plugin:invoke', ...input })
  return true
}

defineExpose({ invoke })

onMounted(async () => {
  window.addEventListener('message', handleMessage)
  emit('reset')
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

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
  registrations.clear()
  forwardedGenerationResults.clear()
})
</script>

<style scoped>
.canvas-plugin-host { display: none; }
.canvas-plugin-host__frame { display: none; }
</style>
