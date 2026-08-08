<template>
  <div class="canvas-prompt-library">
    <div class="canvas-prompt-library__toolbar">
      <input v-model="keyword" placeholder="搜索提示词" @input="load" />
      <button type="button" @click="savePrompt">保存当前</button>
    </div>
    <div v-if="loading" class="canvas-prompt-library__empty">正在加载提示词…</div>
    <div v-else-if="!prompts.length" class="canvas-prompt-library__empty">还没有提示词，可保存当前草稿。</div>
    <button v-for="prompt in prompts" :key="prompt.id" type="button" class="canvas-prompt-library__item" @click="emit('insert', prompt)">
      <strong>{{ prompt.title }}</strong><span>{{ prompt.content }}</span><small>{{ prompt.tags.join(' · ') }}</small>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { createCanvasPrompt, listCanvasPrompts, type CanvasPrompt } from '../api/canvas-prompts'

const emit = defineEmits<{ insert: [prompt: CanvasPrompt] }>()
const keyword = ref('')
const prompts = ref<CanvasPrompt[]>([])
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const load = () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    loading.value = true
    try { prompts.value = await listCanvasPrompts(keyword.value) } finally { loading.value = false }
  }, 180)
}
const savePrompt = async () => {
  const titleResult = await ElMessageBox.prompt('输入提示词标题', '保存到提示词库', { confirmButtonText: '下一步', cancelButtonText: '取消' }).catch(() => null)
  if (!titleResult?.value) return
  const contentResult = await ElMessageBox.prompt('输入提示词内容', '保存到提示词库', { inputType: 'textarea', confirmButtonText: '保存', cancelButtonText: '取消' }).catch(() => null)
  if (!contentResult?.value) return
  await createCanvasPrompt(String(titleResult.value), String(contentResult.value))
  load()
}
watch(keyword, load, { immediate: true })
</script>

<style scoped>
.canvas-prompt-library { display:grid; gap:8px; max-height:440px; overflow:auto; }
.canvas-prompt-library__toolbar { display:flex; gap:8px; }.canvas-prompt-library__toolbar input { min-width:0; flex:1; }
.canvas-prompt-library__item { border:1px solid #e5e7eb; background:#fff; border-radius:8px; text-align:left; padding:10px; display:grid; gap:4px; cursor:pointer; }
.canvas-prompt-library__item span { font-size:12px; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.canvas-prompt-library__item small { color:#94a3b8; }
.canvas-prompt-library__empty { color:#64748b; padding:16px 0; text-align:center; }
</style>
