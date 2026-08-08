<template>
  <section class="canvas-prompt-library" aria-label="受管提示词库">
    <div class="canvas-prompt-library__toolbar">
      <input v-model="keyword" placeholder="搜索提示词" @input="scheduleLoad" />
      <select v-model="kind" @change="loadPrompts">
        <option value="">全部类型</option><option value="TEXT">文本</option><option value="IMAGE_CONFIG">生图配置</option><option value="VIDEO_CONFIG">视频配置</option>
      </select>
      <button type="button" @click="savePrompt">保存</button>
    </div>
    <div class="canvas-prompt-library__toolbar canvas-prompt-library__toolbar--secondary">
      <input v-model="tag" placeholder="标签" @input="scheduleLoad" />
      <select v-model="sourceId" @change="loadPrompts"><option value="">全部提示词源</option><option v-for="source in sources" :key="source.id" :value="source.id">{{ source.name }}</option></select>
      <button type="button" @click="addSource">添加源</button>
    </div>

    <div class="canvas-prompt-library__sources">
      <div v-for="source in sources" :key="source.id" class="canvas-prompt-library__source">
        <div><strong>{{ source.name }}</strong><small>{{ source.sourceKind }} · V{{ source.currentVersionNo }} · {{ source.promptCount }} 条</small></div>
        <div class="canvas-prompt-library__source-actions"><button type="button" @click="syncSource(source)">同步</button><button type="button" @click="inspectSource(source)">记录</button></div>
        <p v-if="source.lastSyncStatus === 'FAILED'" class="canvas-prompt-library__source-error">同步失败：{{ source.lastSyncError || '请查看同步记录' }}</p>
      </div>
    </div>

    <div v-if="loading" class="canvas-prompt-library__empty">正在加载提示词…</div>
    <div v-else-if="!prompts.length" class="canvas-prompt-library__empty">还没有匹配提示词。可手工保存，或同步受管 Skill/JSON 源。</div>
    <button v-for="prompt in prompts" :key="prompt.id" type="button" class="canvas-prompt-library__item" @click="emit('insert', prompt)">
      <div><strong>{{ prompt.title }}</strong><small>{{ kindLabel(prompt.kind) }}{{ prompt.sourceId ? ' · 受管源' : ' · 个人' }}</small></div>
      <span>{{ prompt.summary || prompt.content }}</span><em>{{ prompt.tags.join(' · ') }}</em>
    </button>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createCanvasPrompt, createCanvasPromptSource, listCanvasPromptSourceVersions, listCanvasPromptSources, listCanvasPromptSyncRuns,
  listCanvasPrompts, rollbackCanvasPromptSource, syncCanvasPromptSource,
  type CanvasPrompt, type CanvasPromptKind, type CanvasPromptSource,
} from '../api/canvas-prompts'

const emit = defineEmits<{ insert: [prompt: CanvasPrompt] }>()
const keyword = ref('')
const tag = ref('')
const sourceId = ref('')
const kind = ref<CanvasPromptKind | ''>('')
const prompts = ref<CanvasPrompt[]>([])
const sources = ref<CanvasPromptSource[]>([])
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const kindLabel = (value: CanvasPromptKind) => value === 'IMAGE_CONFIG' ? '生图配置' : value === 'VIDEO_CONFIG' ? '视频配置' : '文本'
const loadSources = async () => { sources.value = await listCanvasPromptSources() }
const loadPrompts = async () => {
  if (timer) { clearTimeout(timer); timer = null }
  loading.value = true
  try { prompts.value = await listCanvasPrompts({ keyword: keyword.value, tag: tag.value, sourceId: sourceId.value, kind: kind.value }) } finally { loading.value = false }
}
const load = async () => { await Promise.all([loadSources(), loadPrompts()]) }
const scheduleLoad = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { void loadPrompts() }, 180) }

const savePrompt = async () => {
  const title = await ElMessageBox.prompt('输入提示词标题', '保存到提示词库', { confirmButtonText: '下一步', cancelButtonText: '取消' }).catch(() => null)
  if (!title?.value) return
  const content = await ElMessageBox.prompt('输入提示词内容', '保存到提示词库', { inputType: 'textarea', confirmButtonText: '保存', cancelButtonText: '取消' }).catch(() => null)
  if (!content?.value) return
  await createCanvasPrompt(String(title.value), String(content.value), [])
  await loadPrompts()
}

const addSource = async () => {
  const name = await ElMessageBox.prompt('例如：MiniMax H3 产品广告 Skill', '添加受管提示词源', { confirmButtonText: '下一步', cancelButtonText: '取消' }).catch(() => null)
  if (!name?.value) return
  const url = await ElMessageBox.prompt('仅接受 raw.githubusercontent.com 的 HTTPS 原始 JSON 或 SKILL.md 地址', '添加受管提示词源', { confirmButtonText: '添加', cancelButtonText: '取消' }).catch(() => null)
  if (!url?.value) return
  const sourceKind = /\.md(?:\?|$)/i.test(String(url.value)) ? 'SKILL_MARKDOWN' : 'JSON'
  await createCanvasPromptSource({ name: String(name.value), sourceUrl: String(url.value), sourceKind, category: sourceKind === 'SKILL_MARKDOWN' ? 'Skill' : '提示词' })
  await loadSources()
  ElMessage.success('提示词源已创建，可点击同步导入')
}

const syncSource = async (source: CanvasPromptSource) => {
  await syncCanvasPromptSource(source.id)
  await load()
  ElMessage.success('提示词源已同步')
}

const inspectSource = async (source: CanvasPromptSource) => {
  const [versions, runs] = await Promise.all([listCanvasPromptSourceVersions(source.id), listCanvasPromptSyncRuns(source.id)])
  const history = versions.map(version => `V${version.versionNo} · ${version.promptCount} 条 · ${version.changeType} · ${new Date(version.createdAt).toLocaleString()}`).join('\n') || '暂无版本'
  const latestRun = runs[0] ? `\n\n最近同步：${runs[0].action} / ${runs[0].status}${runs[0].errorMessage ? `\n${runs[0].errorMessage}` : ''}` : ''
  const result = await ElMessageBox.confirm(`${history}${latestRun}\n\n需要回滚到某个版本吗？`, `${source.name} 同步记录`, { confirmButtonText: '回滚版本', cancelButtonText: '关闭', type: 'info' }).catch(() => null)
  if (result !== 'confirm') return
  const input = await ElMessageBox.prompt('输入要恢复的版本号', '回滚提示词源', { inputPattern: /^\d+$/, inputErrorMessage: '请输入版本号', confirmButtonText: '确认回滚', cancelButtonText: '取消' }).catch(() => null)
  if (!input?.value) return
  await rollbackCanvasPromptSource(source.id, Number(input.value))
  await load()
  ElMessage.success('提示词源已回滚，并生成新的审计版本')
}

watch([keyword, tag, sourceId, kind], scheduleLoad, { immediate: true })
void loadSources()
</script>

<style scoped>
.canvas-prompt-library { display:grid; gap:8px; max-height:560px; overflow:auto; }.canvas-prompt-library__toolbar { display:flex; gap:8px; }.canvas-prompt-library__toolbar input { min-width:0; flex:1; }.canvas-prompt-library__toolbar input,.canvas-prompt-library__toolbar select,.canvas-prompt-library__toolbar button,.canvas-prompt-library__source-actions button { border:1px solid #dbe2ea; background:#fff; border-radius:8px; padding:7px 8px; color:#334155; font-size:12px; }.canvas-prompt-library__sources { display:grid; gap:6px; }.canvas-prompt-library__source { border:1px solid #e2e8f0; border-radius:8px; padding:8px; display:grid; grid-template-columns:1fr auto; gap:4px; }.canvas-prompt-library__source strong { display:block; font-size:12px; }.canvas-prompt-library__source small { color:#64748b; font-size:11px; }.canvas-prompt-library__source-actions { display:flex; gap:5px; align-items:start; }.canvas-prompt-library__source-error { grid-column:1 / -1; margin:0; color:#b45309; font-size:11px; }.canvas-prompt-library__item { border:1px solid #e5e7eb; background:#fff; border-radius:8px; text-align:left; padding:10px; display:grid; gap:4px; cursor:pointer; }.canvas-prompt-library__item:hover { border-color:#7c9cff; }.canvas-prompt-library__item div { display:flex; justify-content:space-between; gap:8px; }.canvas-prompt-library__item span { font-size:12px; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.canvas-prompt-library__item small,.canvas-prompt-library__item em { color:#94a3b8; font-size:11px; font-style:normal; }.canvas-prompt-library__empty { color:#64748b; padding:16px 0; text-align:center; }
</style>
