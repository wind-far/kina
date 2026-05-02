<template>
  <div class="home-header">
    <div class="header-bto0dS">
      {{ siteNamePrefix }}开启你的
      <TypeSelector />
      即刻造梦！
    </div>
    <div :class="{ 'home-header-preview-mask': previewReadonly }">
      <!-- 首页配置：不可折叠、默认展开、弹窗强制向下弹出 -->
      <GenerateContentGenerator
        class="home-header-content-generator"
        :collapsible="false"
        :default-expanded="true"
        popup-placement="bottom"
        @send="handleSend"
      />
    </div>
    <div v-if="showSiteDescription && siteDescription" class="home-header-site-description-canana">{{ siteDescription }}</div>
    <div v-if="showTaskIndicator" :class="{ 'home-header-preview-mask': previewReadonly }">
      <TaskIndicator />
    </div>
    <HomeBanner
      v-if="showBanner"
      :banner-items-override="bannerItemsOverride"
      :disable-navigation="disableNavigation"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TypeSelector from './TypeSelector.vue'
import GenerateContentGenerator from '@/components/generate/ContentGenerator.vue'
import TaskIndicator from './TaskIndicator.vue'
import HomeBanner from './HomeBanner.vue'
import { useSystemSettingsStore } from '@/stores/system-settings'
import { useHomeLayoutConfig } from '@/composables/useHomeLayoutConfig'
import type { SystemConfigPayload, SystemHomeBannerItemConfig } from '@/api/system-config'

const props = withDefaults(defineProps<{
  systemFormOverride?: SystemConfigPayload | null
  bannerItemsOverride?: SystemHomeBannerItemConfig[]
  disableNavigation?: boolean
  previewReadonly?: boolean
}>(), {
  systemFormOverride: null,
  bannerItemsOverride: () => [],
  disableNavigation: false,
  previewReadonly: false,
})

const router = useRouter()
const systemSettingsStore = useSystemSettingsStore()
const { headerSettings, bannerSettings } = useHomeLayoutConfig()

const resolvedSystemSettings = computed(() => {
  return props.systemFormOverride || systemSettingsStore.publicSystemSettings.value
})

const resolvedHeaderSettings = computed(() => {
  return props.systemFormOverride
    ? props.systemFormOverride.homeLayoutSettings.header
    : headerSettings.value
})

const resolvedBannerSettings = computed(() => {
  return props.systemFormOverride
    ? props.systemFormOverride.homeLayoutSettings.banner
    : bannerSettings.value
})

const resolvedBannerItems = computed(() => {
  if (props.bannerItemsOverride.length > 0) {
    return props.bannerItemsOverride
  }

  return resolvedBannerSettings.value.items || []
})

const siteNamePrefix = computed(() => {
  const siteName = String(resolvedSystemSettings.value.siteInfo.siteName || '').trim()
  return siteName ? `${siteName} · ` : ''
})
const siteDescription = computed(() => String(resolvedSystemSettings.value.siteInfo.siteDescription || '').trim())
const showSiteDescription = computed(() => resolvedHeaderSettings.value.showSiteDescription !== false)
const showTaskIndicator = computed(() => resolvedHeaderSettings.value.showTaskIndicator !== false)
const showBanner = computed(() => {
  return resolvedHeaderSettings.value.showBanner !== false
    && resolvedBannerSettings.value.enabled !== false
    && resolvedBannerItems.value.some(item => item.visible !== false)
})

const handleSend = (message: string, type: string, options?: Record<string, string>) => {
  if (props.previewReadonly) {
    return
  }

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

.home-header-preview-mask {
  width: 100%;
  pointer-events: none;
}

.home-header-preview-mask :deep(button),
.home-header-preview-mask :deep(input),
.home-header-preview-mask :deep(textarea),
.home-header-preview-mask :deep(.generator-panel),
.home-header-preview-mask :deep(.content-generator-root),
.home-header-preview-mask :deep(.content-generator-container),
.home-header-preview-mask :deep(.float-generator) {
  pointer-events: none !important;
}
</style>
