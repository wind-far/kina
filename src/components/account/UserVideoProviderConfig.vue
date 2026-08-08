<template>
  <section class="user-video-provider-config" aria-labelledby="user-video-provider-title">
    <div class="user-video-provider-config__heading">
      <div>
        <h2 id="user-video-provider-title">我的视频 API</h2>
        <p>仅用于视频生成。密钥会提交至服务端加密保存，不会再次显示在浏览器中。</p>
      </div>
      <span :class="['user-video-provider-config__status', { 'is-ready': savedConfig?.apiKeyConfigured }]">
        {{ savedConfig?.apiKeyConfigured ? '已配置' : '未配置' }}
      </span>
    </div>

    <div class="user-video-provider-config__fields">
      <label>
        视频厂商
        <select v-model="providerId" :disabled="isLoading || isSaving">
          <option value="">请选择已启用的视频厂商</option>
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">
            {{ provider.name }}
          </option>
        </select>
      </label>
      <label>
        API Key
        <input v-model.trim="apiKey" type="password" autocomplete="new-password" :placeholder="savedConfig?.apiKeyConfigured ? `已保存 ${savedConfig.apiKeyHint}` : '输入你的视频 API Key'" :disabled="isLoading || isSaving">
      </label>
    </div>

    <div class="user-video-provider-config__actions">
      <button type="button" class="user-video-provider-config__button" :disabled="isLoading || isSaving || !providerId" @click="save">
        {{ isSaving ? '保存中…' : '保存视频 API' }}
      </button>
      <button v-if="savedConfig?.apiKeyConfigured" type="button" class="user-video-provider-config__button is-secondary" :disabled="isSaving" @click="remove">
        移除配置
      </button>
    </div>
    <p v-if="!providers.length && !isLoading" class="user-video-provider-config__hint">管理员尚未启用视频厂商，暂时无法配置个人视频 API。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAllVideoModels, loadPublicModelCatalog } from '@/config/models'
import { deleteUserVideoProviderConfig, listUserVideoProviderConfigs, saveUserVideoProviderConfig, type UserVideoProviderConfig } from '@/api/user-provider-config'

const isLoading = ref(true)
const isSaving = ref(false)
const providerId = ref('')
const apiKey = ref('')
const savedConfig = ref<UserVideoProviderConfig | null>(null)

const providers = computed(() => {
  const map = new Map<string, { id: string; name: string }>()
  getAllVideoModels().forEach(model => {
    if (!map.has(model.providerId)) map.set(model.providerId, { id: model.providerId, name: model.providerName })
  })
  return [...map.values()]
})

const load = async () => {
  isLoading.value = true
  try {
    await loadPublicModelCatalog(true)
    savedConfig.value = (await listUserVideoProviderConfigs()).find(item => item.category === 'VIDEO') || null
    providerId.value = savedConfig.value?.providerId || providers.value[0]?.id || ''
  } catch (error) {
    console.warn('读取个人视频 API 配置失败。', error)
  } finally {
    isLoading.value = false
  }
}

const save = async () => {
  if (!providerId.value) return
  if (!apiKey.value && !savedConfig.value?.apiKeyConfigured) {
    ElMessage.warning('请填写视频 API Key')
    return
  }
  isSaving.value = true
  try {
    savedConfig.value = await saveUserVideoProviderConfig({ providerId: providerId.value, ...(apiKey.value ? { apiKey: apiKey.value } : {}) })
    apiKey.value = ''
  } finally {
    isSaving.value = false
  }
}

const remove = async () => {
  try {
    await ElMessageBox.confirm('移除后，视频生成将恢复使用平台厂商配置。确定继续吗？', '移除个人视频 API', { type: 'warning' })
  } catch {
    return
  }
  isSaving.value = true
  try {
    await deleteUserVideoProviderConfig()
    savedConfig.value = null
    apiKey.value = ''
  } finally {
    isSaving.value = false
  }
}

onMounted(() => void load())
</script>

<style scoped>
.user-video-provider-config{margin:24px 0;padding:20px;border:1px solid var(--border-color,#e5e7eb);border-radius:16px;background:var(--bg-block-primary,#fff)}
.user-video-provider-config__heading{display:flex;gap:16px;justify-content:space-between;align-items:flex-start}.user-video-provider-config h2{margin:0;font-size:17px}.user-video-provider-config p{margin:6px 0 0;color:var(--text-tertiary,#6b7280);font-size:13px;line-height:1.55}.user-video-provider-config__status{border-radius:999px;padding:4px 9px;background:#f3f4f6;color:#6b7280;font-size:12px;white-space:nowrap}.user-video-provider-config__status.is-ready{background:#dcfce7;color:#15803d}.user-video-provider-config__fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:12px;margin-top:16px}.user-video-provider-config label{display:grid;gap:6px;font-size:13px;color:var(--text-secondary,#4b5563)}.user-video-provider-config select,.user-video-provider-config input{min-width:0;height:38px;padding:0 10px;border:1px solid var(--border-color,#d1d5db);border-radius:8px;background:transparent;color:inherit}.user-video-provider-config__actions{display:flex;gap:10px;margin-top:14px}.user-video-provider-config__button{border:0;border-radius:8px;padding:9px 14px;background:#18181b;color:#fff;cursor:pointer}.user-video-provider-config__button.is-secondary{background:#f3f4f6;color:#374151}.user-video-provider-config__button:disabled{cursor:not-allowed;opacity:.55}.user-video-provider-config__hint{color:#b45309}@media (max-width:640px){.user-video-provider-config__fields{grid-template-columns:1fr}.user-video-provider-config__heading{display:block}.user-video-provider-config__status{display:inline-block;margin-top:10px}}
</style>
