<template>
  <div class="home-header">
    <div class="header-bto0dS">
      {{ siteNamePrefix }}开启你的
      <TypeSelector />
      即刻造梦！
    </div>
    <!-- 首页配置：不可折叠、默认展开、弹窗强制向下弹出 -->
    <GenerateContentGenerator
      class="home-header-content-generator"
      :collapsible="false"
      :default-expanded="true"
      popup-placement="bottom"
      @send="handleSend"
    />
    <div v-if="siteDescription" class="home-header-site-description-canana">{{ siteDescription }}</div>
    <TaskIndicator />
    <HomeBanner />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TypeSelector from './TypeSelector.vue'
import GenerateContentGenerator from '@/components/generate/ContentGenerator.vue'
import TaskIndicator from './TaskIndicator.vue'
import HomeBanner from './HomeBanner.vue'
import { useSystemSettingsStore } from '@/stores/system-settings'

const router = useRouter()
const systemSettingsStore = useSystemSettingsStore()
const siteNamePrefix = computed(() => {
  const siteName = String(systemSettingsStore.publicSystemSettings.value.siteInfo.siteName || '').trim()
  return siteName ? `${siteName} · ` : ''
})
const siteDescription = computed(() => String(systemSettingsStore.publicSystemSettings.value.siteInfo.siteDescription || '').trim())

const handleSend = (message, type, options) => {
  router.push({
    path: '/generate',
    query: {
      message,
      type,
      ...(options?.model && { model: options.model }),
      ...(options?.skill && { skill: options.skill }),
      ...(options?.ratio && { ratio: options.ratio }),
      ...(options?.resolution && { resolution: options.resolution })
    }
  })
}
</script>

<style scoped>
.home-header-site-description-canana {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-secondary);
}
</style>
