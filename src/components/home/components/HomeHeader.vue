<template>
  <div class="home-header">
    <div v-if="showWorkbenchTitle" class="header-bto0dS">
      <template v-if="showSiteNameInTitle">{{ siteNamePrefix }}</template>
      {{ workbenchPrefixText }}
      <TypeSelector
        v-if="showModeSelectorInTitle"
        :current-label="currentModeLabel"
        :options="modeOptions"
      />
      <span v-else-if="currentModeLabel" class="home-header-mode-label">{{ currentModeLabel }}</span>
      {{ workbenchSuffixText }}
    </div>
    <div
      v-if="showWorkbenchGenerator"
      :class="{ 'home-header-preview-mask': previewReadonly }"
    >
      <!-- 首页配置：不可折叠、默认展开、弹窗强制向下弹出 -->
      <GenerateContentGenerator
        class="home-header-content-generator"
        :collapsible="false"
        :default-expanded="true"
        popup-placement="bottom"
        @send="handleSend"
      />
    </div>
    <div
      v-if="showWorkbenchGenerator && showSiteDescription && siteDescription"
      class="home-header-site-description-canana"
    >
      {{ siteDescription }}
    </div>
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

const resolvedEntryDisplay = computed(() => {
  return resolvedSystemSettings.value.conversationSettings.entryDisplay
})

const resolvedWorkbenchSettings = computed(() => {
  return resolvedEntryDisplay.value.workbench
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
const showWorkbenchTitle = computed(() => resolvedWorkbenchSettings.value.titleEnabled !== false)
const showWorkbenchGenerator = computed(() => resolvedWorkbenchSettings.value.generatorEnabled !== false)
const showSiteNameInTitle = computed(() => resolvedWorkbenchSettings.value.showSiteName !== false && !!siteNamePrefix.value)
const workbenchPrefixText = computed(() => String(resolvedWorkbenchSettings.value.prefixText || '').trim() || '开启你的')
const workbenchSuffixText = computed(() => String(resolvedWorkbenchSettings.value.suffixText || '').trim() || '即刻造梦！')
const showModeSelectorInTitle = computed(() => resolvedWorkbenchSettings.value.showModeSelectorInTitle !== false)
const modeOptions = computed(() => {
  return (resolvedEntryDisplay.value.mode.options || [])
    .map(item => String(item.label || '').trim())
    .filter(Boolean)
})
const siteDescription = computed(() => String(resolvedSystemSettings.value.siteInfo.siteDescription || '').trim())
const showSiteDescription = computed(() => resolvedHeaderSettings.value.showSiteDescription !== false)
const showTaskIndicator = computed(() => {
  return resolvedWorkbenchSettings.value.taskIndicatorEnabled !== false
    && resolvedHeaderSettings.value.showTaskIndicator !== false
})
const showBanner = computed(() => {
  return resolvedWorkbenchSettings.value.bannerEnabled !== false
    && resolvedHeaderSettings.value.showBanner !== false
    && resolvedBannerSettings.value.enabled !== false
    && resolvedBannerItems.value.some(item => item.visible !== false)
})
const currentModeLabel = computed(() => {
  const defaultMode = String(resolvedEntryDisplay.value.mode.defaultMode || '').trim()
  const options = resolvedEntryDisplay.value.mode.options || []
  return options.find(item => item.value === defaultMode)?.label || options[0]?.label || 'Agent 模式'
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

.home-header-mode-label {
  display: inline-flex;
  align-items: center;
  margin: 0 8px;
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
