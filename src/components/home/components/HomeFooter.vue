<template>
  <footer class="home-footer-canana">
    <div class="home-footer-canana__brand">{{ siteName }}</div>
    <div v-if="siteDescription" class="home-footer-canana__description">{{ siteDescription }}</div>
    <div class="home-footer-canana__links">
      <RouterLink class="home-footer-canana__link" to="/policies/user-agreement">{{ policy.userAgreementTitle }}</RouterLink>
      <RouterLink class="home-footer-canana__link" to="/policies/privacy-policy">{{ policy.privacyPolicyTitle }}</RouterLink>
      <RouterLink class="home-footer-canana__link" to="/policies/ai-notice">{{ policy.aiNoticeTitle }}</RouterLink>
    </div>
    <div class="home-footer-canana__meta">
      <a v-if="siteInfo.icpLink && siteInfo.icpText" class="home-footer-canana__record" :href="siteInfo.icpLink" target="_blank" rel="noreferrer">{{ siteInfo.icpText }}</a>
      <span v-else-if="siteInfo.icpText" class="home-footer-canana__record">{{ siteInfo.icpText }}</span>
      <span v-if="siteInfo.copyrightText" class="home-footer-canana__copyright">{{ siteInfo.copyrightText }}</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSystemSettingsStore } from '@/stores/system-settings'

const systemSettingsStore = useSystemSettingsStore()
const siteInfo = computed(() => systemSettingsStore.publicSystemSettings.value.siteInfo)
const policy = computed(() => systemSettingsStore.publicSystemSettings.value.policySettings)
const siteName = computed(() => siteInfo.value.siteName || 'Canana')
const siteDescription = computed(() => siteInfo.value.siteDescription || '')
</script>

<style scoped>
.home-footer-canana {
  margin-top: 28px;
  padding: 28px 0 40px;
  border-top: 1px solid var(--line-divider, rgba(255,255,255,.08));
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home-footer-canana__brand {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.home-footer-canana__description,
.home-footer-canana__meta {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.home-footer-canana__links {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.home-footer-canana__link,
.home-footer-canana__record {
  color: var(--brand-main-default);
  text-decoration: none;
}

.home-footer-canana__link:hover,
.home-footer-canana__record:hover {
  opacity: .88;
}

.home-footer-canana__copyright {
  margin-left: 10px;
}
</style>
