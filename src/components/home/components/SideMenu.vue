<template>
  <div v-if="sideMenuSettings.enabled" class="sideMenu dreamina-side-menu-container side-menu visible-DXQYqc">
    <!-- 顶部菜单 -->
    <div v-if="sideMenuSettings.showTopMenu && topItems.length" role="menu" class="lv-menu lv-menu-light lv-menu-vertical topMenu">
      <div class="lv-menu-inner">
        <div
          tabindex="0"
          role="menuitem"
          class="lv-menu-item lv-menu-item-size-default"
          :class="{ 'is-hidden-item': topItems[0]?.visible === false }"
          id="Logo"
          @click="handleTopItemClick(topItems[0])"
        >
          <div class="container-aVP6Vy">
            <img
              v-if="resolvedSiteLogoUrl"
              :src="resolvedSiteLogoUrl"
              class="side-menu-logo-image"
              :alt="resolvedSiteName"
            >
            <div v-else class="side-menu-logo-fallback">
              <HomeSideMenuIcon
                :icon-key="topItems[0].icon"
                :icon-source="topItems[0].iconSource"
                :inactive-icon-url="topItems[0].inactiveIconUrl"
                :active-icon-url="topItems[0].activeIconUrl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 中间菜单 -->
    <CenterMenu
      :system-settings-override="systemSettingsOverride"
      :active-menu-key-override="activeMenuKeyOverride"
      :active-path-override="activePathOverride"
      :preview-readonly="previewReadonly"
      :include-hidden-items="includeHiddenItems"
    />

    <!-- 底部菜单 -->
    <BottomMenu
      :system-settings-override="systemSettingsOverride"
      :active-menu-key-override="activeMenuKeyOverride"
      :active-path-override="activePathOverride"
      :preview-readonly="previewReadonly"
      :include-hidden-items="includeHiddenItems"
      :login-state-override="loginStateOverride"
      :marketing-points-text-override="marketingPointsTextOverride"
      :avatar-src-override="avatarSrcOverride"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useHomeSideMenuConfig } from '@/composables/useHomeSideMenuConfig'
import { useSystemSettingsStore } from '@/stores/system-settings'
import CenterMenu from './CenterMenu.vue'
import BottomMenu from './BottomMenu.vue'
import HomeSideMenuIcon from './HomeSideMenuIcon.vue'
import type { SystemConfigPayload } from '@/api/system-config'

const props = withDefaults(defineProps<{
  systemSettingsOverride?: SystemConfigPayload | null
  activeMenuKeyOverride?: string
  activePathOverride?: string
  previewReadonly?: boolean
  includeHiddenItems?: boolean
  loginStateOverride?: boolean | null
  marketingPointsTextOverride?: string
  avatarSrcOverride?: string
}>(), {
  systemSettingsOverride: null,
  activeMenuKeyOverride: '',
  activePathOverride: '',
  previewReadonly: false,
  includeHiddenItems: false,
  loginStateOverride: null,
  marketingPointsTextOverride: '',
  avatarSrcOverride: '',
})

const overrideSideMenuSettings = computed(() => props.systemSettingsOverride?.homeSideMenuSettings || null)
const { sideMenuSettings, topItems } = useHomeSideMenuConfig({
  settingsOverride: overrideSideMenuSettings,
  includeHidden: props.includeHiddenItems,
})
const { publicSystemSettings } = useSystemSettingsStore()
const router = useRouter()

const resolvedSiteLogoUrl = computed(() => {
  return String(
    props.systemSettingsOverride?.siteInfo.siteLogoUrl
    || publicSystemSettings.value.siteInfo.siteLogoUrl
    || '',
  ).trim()
})

const resolvedSiteName = computed(() => {
  return String(
    props.systemSettingsOverride?.siteInfo.siteName
    || publicSystemSettings.value.siteInfo.siteName
    || 'Canana',
  ).trim() || 'Canana'
})

const handleTopItemClick = (item?: { actionType?: string; actionValue?: string }) => {
  if (props.previewReadonly) {
    return
  }

  if (!item) {
    return
  }

  if (item.actionType === 'route' && item.actionValue) {
    void router.push(item.actionValue)
    return
  }

  if (item.actionType === 'url' && item.actionValue) {
    window.open(item.actionValue, '_blank', 'noopener,noreferrer')
  }
}
</script>

<style scoped>
.sideMenu {
  background: var(--theme-side-menu-background, #111218);
  border-radius: 24px;
}

.side-menu-logo-image {
  display: block;
  max-width: 32px;
  max-height: 32px;
  object-fit: contain;
}

.side-menu-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--text-primary);
  font-size: 24px;
}
</style>
