<template>
  <div class="section-generator admin-theme-front-home-preview">
    <div class="home-header admin-theme-front-home-preview__header">
      <div class="header-bto0dS">
        {{ siteNamePrefix }}开启你的
        <span class="admin-theme-front-home-preview__type-chip">{{ currentModeLabel }}</span>
        即刻造梦！
      </div>

      <div class="admin-theme-front-home-preview__generator-mask">
        <GenerateContentGenerator
          class="home-header-content-generator"
          :collapsible="false"
          :default-expanded="true"
          popup-placement="bottom"
        />
      </div>

      <div
        v-if="showSiteDescription && siteDescription"
        class="home-header-site-description-canana"
      >
        {{ siteDescription }}
      </div>

      <div v-if="showTaskIndicator" class="admin-theme-front-home-preview__task-indicator-mask">
        <TaskIndicator />
      </div>

      <HomeBanner
        v-if="showBanner"
        :banner-items-override="previewBannerItems"
        :disable-navigation="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GenerateContentGenerator from '@/components/generate/ContentGenerator.vue'
import HomeBanner from '@/components/home/components/HomeBanner.vue'
import TaskIndicator from '@/components/home/components/TaskIndicator.vue'
import type { SystemConfigPayload, SystemHomeBannerItemConfig } from '@/api/system-config'

const props = defineProps<{
  systemForm: SystemConfigPayload
  previewBannerItems: SystemHomeBannerItemConfig[]
}>()

const siteNamePrefix = computed(() => {
  const siteName = String(props.systemForm.siteInfo.siteName || '').trim()
  return siteName ? `${siteName} · ` : ''
})

const siteDescription = computed(() => String(props.systemForm.siteInfo.siteDescription || '').trim())
const showSiteDescription = computed(() => props.systemForm.homeLayoutSettings.header.showSiteDescription !== false)
const showTaskIndicator = computed(() => props.systemForm.homeLayoutSettings.header.showTaskIndicator !== false)
const showBanner = computed(() => {
  return props.systemForm.homeLayoutSettings.header.showBanner !== false
    && props.systemForm.homeLayoutSettings.banner.enabled !== false
    && props.previewBannerItems.length > 0
})

const currentModeLabel = computed(() => {
  const options = props.systemForm.conversationSettings.entryDisplay.mode.options || []
  const defaultMode = String(props.systemForm.conversationSettings.entryDisplay.mode.defaultMode || 'agent')
  return options.find(item => item.value === defaultMode)?.label || 'Agent 模式'
})
</script>

<style scoped>
.admin-theme-front-home-preview {
  margin-bottom: 0;
}

.admin-theme-front-home-preview__header {
  padding-top: 28px;
}

.admin-theme-front-home-preview__type-chip {
  display: inline-flex;
  align-items: center;
}

.admin-theme-front-home-preview__generator-mask,
.admin-theme-front-home-preview__task-indicator-mask {
  width: 100%;
  pointer-events: none;
}

.admin-theme-front-home-preview__generator-mask :deep(.content-generator-container),
.admin-theme-front-home-preview__generator-mask :deep(.content-generator-root),
.admin-theme-front-home-preview__generator-mask :deep(.generator-panel),
.admin-theme-front-home-preview__generator-mask :deep(.float-generator),
.admin-theme-front-home-preview__task-indicator-mask :deep(button) {
  pointer-events: none !important;
}
</style>
