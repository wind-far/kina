<template>
  <div class="policy-page-canana">
    <div class="policy-page-canana__container">
      <div class="policy-page-canana__top">
        <RouterLink class="policy-page-canana__back" to="/">返回首页</RouterLink>
      </div>
      <h1 class="policy-page-canana__title">{{ currentTitle }}</h1>
      <div v-if="currentDescription" class="policy-page-canana__desc">{{ currentDescription }}</div>
      <div class="policy-page-canana__content">
        <template v-if="currentContent">
          <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
        </template>
        <div v-else class="policy-page-canana__empty">
          当前还没有配置正文内容。
          <a v-if="currentUrl" :href="currentUrl" target="_blank" rel="noreferrer">点击查看外部页面</a>
        </div>
      </div>
      <div v-if="currentUrl" class="policy-page-canana__external">
        <a :href="currentUrl" target="_blank" rel="noreferrer">打开原始链接</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSystemSettingsStore } from '@/stores/system-settings'

const route = useRoute()
const systemSettingsStore = useSystemSettingsStore()

const policy = computed(() => systemSettingsStore.publicSystemSettings.value.policySettings)
const siteInfo = computed(() => systemSettingsStore.publicSystemSettings.value.siteInfo)
const policyType = computed(() => String(route.params.type || 'user-agreement'))

const currentTitle = computed(() => {
  if (policyType.value === 'privacy-policy') return policy.value.privacyPolicyTitle || '隐私政策'
  if (policyType.value === 'ai-notice') return policy.value.aiNoticeTitle || 'AI功能使用须知'
  return policy.value.userAgreementTitle || '用户服务协议'
})

const currentContent = computed(() => {
  if (policyType.value === 'privacy-policy') return policy.value.privacyPolicyContent || ''
  if (policyType.value === 'ai-notice') return policy.value.aiNoticeContent || ''
  return policy.value.userAgreementContent || ''
})

const currentUrl = computed(() => {
  if (policyType.value === 'privacy-policy') return policy.value.privacyPolicyUrl || ''
  if (policyType.value === 'ai-notice') return policy.value.aiNoticeUrl || ''
  return policy.value.userAgreementUrl || ''
})

const currentDescription = computed(() => String(siteInfo.value.siteDescription || '').trim())
const paragraphs = computed(() => currentContent.value.split(/\n{2,}/).map(item => item.trim()).filter(Boolean))

const syncDocument = () => {
  if (typeof document === 'undefined') return
  document.title = `${currentTitle.value} - ${siteInfo.value.siteName || 'Canana'}`
}

onMounted(async () => {
  await systemSettingsStore.loadPublicSettings()
  syncDocument()
})

watch([currentTitle, siteInfo], () => {
  syncDocument()
})
</script>

<style scoped>
.policy-page-canana {
  min-height: 100vh;
  padding: 48px 20px 72px;
  background: var(--bg-body);
}

.policy-page-canana__container {
  max-width: 920px;
  margin: 0 auto;
}

.policy-page-canana__top {
  margin-bottom: 20px;
}

.policy-page-canana__back,
.policy-page-canana__external a {
  color: var(--brand-main-default);
  text-decoration: none;
}

.policy-page-canana__title {
  margin: 0;
  font-size: 32px;
  line-height: 1.25;
  color: var(--text-primary);
}

.policy-page-canana__desc {
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.policy-page-canana__content {
  margin-top: 28px;
  padding: 28px;
  border-radius: 20px;
  background: var(--bg-surface);
  border: 1px solid var(--line-divider, #00000014);
}

.policy-page-canana__content p,
.policy-page-canana__empty {
  margin: 0 0 18px;
  font-size: 15px;
  line-height: 1.95;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.policy-page-canana__external {
  margin-top: 18px;
  font-size: 14px;
}
</style>
