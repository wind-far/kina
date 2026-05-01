<template>
  <div v-if="sideMenuSettings.enabled" class="sideMenu dreamina-side-menu-container side-menu visible-DXQYqc">
    <!-- 顶部菜单 -->
    <div v-if="sideMenuSettings.showTopMenu && topItems.length" role="menu" class="lv-menu lv-menu-light lv-menu-vertical topMenu">
      <div class="lv-menu-inner">
        <div tabindex="0" role="menuitem" class="lv-menu-item lv-menu-item-size-default" id="Logo" @click="handleTopItemClick(topItems[0])">
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
    <CenterMenu />

    <!-- 底部菜单 -->
    <BottomMenu />
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

const { sideMenuSettings, topItems } = useHomeSideMenuConfig()
const { publicSystemSettings } = useSystemSettingsStore()
const router = useRouter()

const resolvedSiteLogoUrl = computed(() => {
  return String(publicSystemSettings.value.siteInfo.siteLogoUrl || '').trim()
})

const resolvedSiteName = computed(() => {
  return String(publicSystemSettings.value.siteInfo.siteName || 'Canana').trim() || 'Canana'
})

const handleTopItemClick = (item?: { actionType?: string; actionValue?: string }) => {
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
