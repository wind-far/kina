<template>
  <div class="canvas-plugin-manager" role="dialog" aria-modal="true" aria-label="画布插件">
    <header class="canvas-plugin-manager__header">
      <div>
        <h3>画布插件</h3>
        <p>仅显示管理员发布并审核通过的受信插件。插件在沙箱 iframe 中运行。</p>
      </div>
      <button type="button" class="canvas-plugin-manager__close" aria-label="关闭插件管理" @click="emit('close')">×</button>
    </header>

    <p v-if="loading" class="canvas-plugin-manager__state">正在加载插件…</p>
    <p v-else-if="!plugins.length" class="canvas-plugin-manager__state">暂无可安装的受信插件。</p>
    <ul v-else class="canvas-plugin-manager__list">
      <li v-for="plugin in plugins" :key="plugin.id" class="canvas-plugin-manager__item">
        <div>
          <strong>{{ plugin.name }}</strong>
          <span>{{ plugin.slug }} · {{ plugin.release?.version || '未发布版本' }}</span>
          <p>{{ plugin.description || '未提供插件说明。' }}</p>
        </div>
        <div class="canvas-plugin-manager__actions">
          <button
            type="button"
            :disabled="busyPluginId === plugin.id || !plugin.release"
            @click="toggle(plugin)"
          >{{ plugin.installation?.enabled ? '停用' : '启用' }}</button>
          <button
            v-if="plugin.installation"
            type="button"
            class="danger"
            :disabled="busyPluginId === plugin.id"
            @click="uninstall(plugin)"
          >卸载</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { buildApiUrl } from '@/api/http'

interface CanvasPluginItem {
  id: string
  slug: string
  name: string
  description: string
  release: null | { version: string }
  installation: null | { enabled: boolean }
}

const emit = defineEmits<{ close: []; updated: [] }>()
const plugins = ref<CanvasPluginItem[]>([])
const loading = ref(true)
const busyPluginId = ref('')

const load = async () => {
  loading.value = true
  try {
    const response = await fetch(buildApiUrl('/api/canvas/plugins'), { credentials: 'include' })
    if (!response.ok) throw new Error('加载插件列表失败')
    const body = await response.json()
    plugins.value = Array.isArray(body?.data) ? body.data : []
  } catch (error: any) {
    ElMessage.error(error?.message || '加载插件列表失败')
  } finally {
    loading.value = false
  }
}

const toggle = async (plugin: CanvasPluginItem) => {
  busyPluginId.value = plugin.id
  try {
    const response = await fetch(buildApiUrl(`/api/canvas/plugins/${encodeURIComponent(plugin.id)}/install`), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !plugin.installation?.enabled }),
    })
    if (!response.ok) throw new Error('更新插件状态失败')
    await load()
    emit('updated')
    ElMessage.success(plugin.installation?.enabled ? '插件已停用' : '插件已启用')
  } catch (error: any) {
    ElMessage.error(error?.message || '更新插件状态失败')
  } finally {
    busyPluginId.value = ''
  }
}

const uninstall = async (plugin: CanvasPluginItem) => {
  busyPluginId.value = plugin.id
  try {
    const response = await fetch(buildApiUrl(`/api/canvas/plugins/${encodeURIComponent(plugin.id)}/install`), {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) throw new Error('卸载插件失败')
    await load()
    emit('updated')
    ElMessage.success('插件已卸载')
  } catch (error: any) {
    ElMessage.error(error?.message || '卸载插件失败')
  } finally {
    busyPluginId.value = ''
  }
}

onMounted(() => { void load() })
</script>

<style scoped>
.canvas-plugin-manager { position: fixed; z-index: 2100; top: 76px; right: 24px; width: min(420px, calc(100vw - 32px)); max-height: min(640px, calc(100vh - 108px)); overflow: auto; padding: 18px; border: 1px solid rgba(255,255,255,.15); border-radius: 16px; background: #17191f; box-shadow: 0 22px 70px rgba(0,0,0,.42); color: #f5f7fa; }
.canvas-plugin-manager__header { display: flex; gap: 12px; justify-content: space-between; }
.canvas-plugin-manager h3 { margin: 0; font-size: 16px; }
.canvas-plugin-manager p { margin: 5px 0 0; color: #aeb5c3; font-size: 12px; line-height: 1.55; }
.canvas-plugin-manager__close { border: 0; background: transparent; color: #d7dce5; font-size: 24px; line-height: 1; cursor: pointer; }
.canvas-plugin-manager__state { padding: 24px 0; text-align: center; }
.canvas-plugin-manager__list { display: grid; gap: 10px; margin: 16px 0 0; padding: 0; list-style: none; }
.canvas-plugin-manager__item { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 12px; border-radius: 12px; background: rgba(255,255,255,.06); }
.canvas-plugin-manager__item strong, .canvas-plugin-manager__item span { display: block; }
.canvas-plugin-manager__item span { margin-top: 3px; color: #8d96a7; font-size: 11px; }
.canvas-plugin-manager__actions { display: flex; flex: 0 0 auto; gap: 6px; }
.canvas-plugin-manager__actions button { border: 0; border-radius: 8px; padding: 7px 9px; background: #d6ff35; color: #1a1e09; font-size: 12px; cursor: pointer; }
.canvas-plugin-manager__actions button:disabled { cursor: wait; opacity: .55; }
.canvas-plugin-manager__actions .danger { background: rgba(255,255,255,.12); color: #e8edf5; }
</style>
