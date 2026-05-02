<template>
  <div v-if="sideMenuSettings.showCenterMenu" role="menu" class="lv-menu lv-menu-light lv-menu-vertical centerMenu">
    <div class="lv-menu-inner">
      <div
        v-for="item in centerItems"
        :key="item.key"
        tabindex="0"
        role="menuitem"
        :class="['lv-menu-item', 'lv-menu-item-size-default', { 'lv-menu-selected': isItemActive(item), 'is-hidden-item': item.visible === false }]"
        :id="resolveMenuItemId(item.key)"
        @click="handleMenuClick(item)"
      >
        <div class="icon-container" style="--menu-icon-size:48px">
          <div :class="item.key === 'generate' ? 'container-juKD6_' : ''">
            <div :class="['content-XAjJup', { 'active-E3Q3lq': isItemActive(item) }]">
              <div :class="['icon-menu', { 'active-aFuBWS': isItemActive(item) }]">
                <div class="icon-wrap-tBuhBU hide-itzP3D sf-hidden">
                  <HomeSideMenuIcon
                    :icon-key="item.icon"
                    :icon-source="item.iconSource"
                    :inactive-icon-url="item.inactiveIconUrl"
                    :active-icon-url="item.activeIconUrl"
                    :active="true"
                  />
                </div>
                <div class="icon-wrap-tBuhBU">
                  <HomeSideMenuIcon
                    :icon-key="item.icon"
                    :icon-source="item.iconSource"
                    :inactive-icon-url="item.inactiveIconUrl"
                    :active-icon-url="item.activeIconUrl"
                    :active="isItemActive(item)"
                  />
                </div>
              </div>
              <div class="lv-typography text-HLQFZY">{{ item.title }}</div>
            </div>
            <span v-if="item.badgeText" class="badge-wrapper">{{ item.badgeText }}</span>
            <span v-else-if="item.key === 'generate'" class="badge-wrapper"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'
import { useHomeSideMenuConfig } from '@/composables/useHomeSideMenuConfig'
import HomeSideMenuIcon from './HomeSideMenuIcon.vue'
import type { SystemConfigPayload } from '@/api/system-config'

const props = withDefaults(defineProps<{
  systemSettingsOverride?: SystemConfigPayload | null
  activeMenuKeyOverride?: string
  activePathOverride?: string
  previewReadonly?: boolean
  includeHiddenItems?: boolean
}>(), {
  systemSettingsOverride: null,
  activeMenuKeyOverride: '',
  activePathOverride: '',
  previewReadonly: false,
  includeHiddenItems: false,
})

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const overrideSideMenuSettings = computed(() => props.systemSettingsOverride?.homeSideMenuSettings || null)
const { sideMenuSettings, centerItems } = useHomeSideMenuConfig({
  settingsOverride: overrideSideMenuSettings,
  includeHidden: props.includeHiddenItems,
})

const currentPath = computed(() => props.activePathOverride || route.path)

const resolveMenuItemId = (key: string) => {
  const idMap: Record<string, string> = {
    home: 'Home',
    generate: 'AIGeneratedRecord',
    asset: 'Asset',
    workflow: 'Workflow',
    account: 'AccountManagement',
    publish: 'PublishCenter',
  }

  return idMap[key] || key
}

const isItemActive = (item: { key: string; actionType: string; actionValue: string }) => {
  if (props.activeMenuKeyOverride) {
    return props.activeMenuKeyOverride === item.key
  }

  if (item.key === 'home') {
    return currentPath.value === '/'
  }
  if (item.key === 'account') {
    return currentPath.value === '/account'
  }
  return item.actionType === 'route' && currentPath.value === item.actionValue
}

const handleMenuClick = (item: { key: string; actionType: string; actionValue: string }) => {
  if (props.previewReadonly) {
    return
  }

  if (item.actionType !== 'route') {
    return
  }

  if (item.actionValue === '/account' && !authStore.isLoggedIn.value) {
    router.push({
      path: '/',
      query: {
        login: '1',
      },
    })
    return
  }

  router.push(item.actionValue || '/')
}
</script>
