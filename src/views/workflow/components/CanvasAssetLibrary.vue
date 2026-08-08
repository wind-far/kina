<template>
  <section class="canvas-asset-library" aria-label="画布素材库">
    <div class="canvas-asset-library__toolbar">
      <input v-model="keyword" placeholder="搜索名称、提示词或模型" @input="scheduleLoad" />
      <select v-model="assetType" @change="load">
        <option value="image">图片</option>
        <option value="video">视频</option>
        <option value="audio">音频</option>
      </select>
      <select v-model="source" @change="load">
        <option value="">全部来源</option>
        <option value="generated">生成结果</option>
        <option value="uploaded">上传素材</option>
        <option value="imported">导入素材</option>
        <option value="editor_upload">画布上传</option>
      </select>
    </div>
    <div class="canvas-asset-library__toolbar canvas-asset-library__toolbar--secondary">
      <input v-model="tag" placeholder="按标签筛选" @input="scheduleLoad" />
      <input v-model="generationRecordId" placeholder="生成记录 ID" @input="scheduleLoad" />
      <button type="button" @click="load">刷新</button>
    </div>

    <p v-if="loading" class="canvas-asset-library__empty">正在加载素材…</p>
    <p v-else-if="!assets.length" class="canvas-asset-library__empty">没有匹配的私有素材。</p>
    <div v-else class="canvas-asset-library__grid">
      <button v-for="asset in assets" :key="asset.id" type="button" class="canvas-asset-library__item" @click="emit('insert', asset)">
        <img v-if="asset.assetType === 'image'" :src="asset.previewUrl || asset.fileUrl" :alt="asset.title || '图片素材'" />
        <div v-else class="canvas-asset-library__media-icon">{{ asset.assetType === 'video' ? '▶' : '♪' }}</div>
        <strong>{{ asset.title || '未命名素材' }}</strong>
        <small>{{ typeLabel(asset.assetType) }} · {{ sourceLabel(asset.source) }}</small>
        <span v-if="asset.promptText">{{ asset.promptText }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { listAssetItems, type AssetKind, type PersistedAssetItem } from '@/api/asset-items'

const emit = defineEmits<{ insert: [asset: PersistedAssetItem] }>()
const keyword = ref('')
const tag = ref('')
const generationRecordId = ref('')
const assetType = ref<AssetKind>('image')
const source = ref<'' | 'generated' | 'uploaded' | 'imported' | 'editor_upload'>('')
const assets = ref<PersistedAssetItem[]>([])
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const typeLabel = (type: string) => type === 'video' ? '视频' : type === 'audio' ? '音频' : '图片'
const sourceLabel = (value: string) => ({ generated: '生成', uploaded: '上传', imported: '导入', editor_upload: '画布上传' }[value] || '素材')

const load = async () => {
  if (timer) { clearTimeout(timer); timer = null }
  loading.value = true
  try {
    assets.value = await listAssetItems({
      scope: 'mine', assetType: assetType.value, source: source.value || undefined,
      keyword: keyword.value, tag: tag.value, generationRecordId: generationRecordId.value,
      includeEditorUploads: true, take: 100,
    })
  } finally {
    loading.value = false
  }
}

const scheduleLoad = () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void load() }, 220)
}

void load()
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<style scoped>
.canvas-asset-library { display:grid; gap:10px; max-height:560px; overflow:auto; }
.canvas-asset-library__toolbar { display:flex; gap:8px; }.canvas-asset-library__toolbar input { flex:1; min-width:0; }
.canvas-asset-library__toolbar input, .canvas-asset-library__toolbar select, .canvas-asset-library__toolbar button { border:1px solid #dbe2ea; border-radius:8px; padding:7px 9px; background:#fff; color:#334155; font-size:12px; }
.canvas-asset-library__toolbar--secondary input { width:0; }.canvas-asset-library__grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.canvas-asset-library__item { border:1px solid #e2e8f0; border-radius:10px; background:#fff; padding:8px; display:grid; gap:5px; text-align:left; overflow:hidden; cursor:pointer; }.canvas-asset-library__item:hover { border-color:#7c9cff; box-shadow:0 5px 16px rgba(59,91,219,.12); }
.canvas-asset-library__item img, .canvas-asset-library__media-icon { width:100%; height:88px; border-radius:7px; object-fit:cover; background:#f1f5f9; }.canvas-asset-library__media-icon { display:grid; place-items:center; font-size:30px; color:#64748b; }
.canvas-asset-library__item strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }.canvas-asset-library__item small, .canvas-asset-library__item span { color:#64748b; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.canvas-asset-library__empty { padding:20px; text-align:center; color:#64748b; }
</style>
