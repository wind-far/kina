<template>
  <div v-if="sideMenuSettings.showBottomMenu" role="menu" class="lv-menu lv-menu-light lv-menu-vertical bottomMenu login-menu-wrapper">
    <div class="lv-menu-inner">
      <div
        v-if="marketingItem"
        tabindex="0"
        role="menuitem"
        class="lv-menu-item lv-menu-item-size-default credit-display-menu-container"
        id="SiderMenuCredit"
        @click="openMarketingEntry"
      >
        <div class="credit-container-vI5rYU">
          <div class="credit-display-container-EgNfse column-mode-GFlEE0">
            <div class="credit-amount-container-SnxCra">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 25 24">
                <path fill="currentColor" d="M22.044 12.695a.77.77 0 0 0-.596-.734c-4.688-1.152-7.18-3.92-7.986-9.924l-.006-.033a.573.573 0 0 0-1.137 0l-.007.033c-.805 6.004-3.298 8.772-7.986 9.924a.77.77 0 0 0-.596.734v.033a.82.82 0 0 0 .625.796c3.3.859 6.851 2.872 7.9 6.022.086.26.332.443.613.454h.037a.67.67 0 0 0 .614-.454c1.048-3.15 4.598-5.163 7.9-6.021a.82.82 0 0 0 .625-.797z" data-follow-fill="currentColor"></path>
              </svg>
              <div class="credit-amount-text-H7jPQp column-mode-SHz9kD">{{ marketingPointsText }}</div>
            </div>
            <div class="upgrade-text-JHUaIS column-mode-vnmqXA">{{ isLoggedIn ? '会员中心' : (marketingItem.title || '1元会员') }}</div>
          </div>
        </div>
      </div>

      <div
        v-if="accountEntryItem && !isLoggedIn"
        tabindex="0"
        role="menuitem"
        class="lv-menu-item lv-menu-item-size-default"
        id="SiderMenuLogin"
        @click="openLoginModal('bottom-menu')"
      >
        <div class="icon-container" style="--menu-icon-size:40px">
          <div class="login-button">
            {{ accountEntryItem.title || loginButtonText }}
          </div>
        </div>
      </div>

      <div
        v-if="accountEntryItem && isLoggedIn"
        tabindex="0"
        role="menuitem"
        :class="['lv-menu-item', 'lv-menu-item-size-default', { 'lv-menu-selected': currentPath === '/account' }]"
        id="Personal"
        @click="navigateToAccount"
      >
        <div class="avatar-container-Od1Q_g">
          <div class="avatar-Y3FqeU">
            <div style="width:100%;height:100%">
              <div class="dreamina-component-avatar-container">
                <img
                  :src="resolvedAvatarSrc"
                  class="dreamina-component-avatar"
                  :alt="loginButtonText"
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-for="item in actionItems"
        :key="item.key"
        tabindex="0"
        role="menuitem"
        :class="['lv-menu-item', 'lv-menu-item-size-default', { 'lv-menu-selected': isBottomItemActive(item) }]"
        :id="resolveMenuItemId(item.key)"
        @click="handleBottomItemClick(item)"
      >
        <div class="icon-container" style="--menu-icon-size:40px">
          <div :class="resolveBottomContainerClass(item.key)">
            <div :class="['content-XAjJup', { 'active-E3Q3lq': isBottomItemActive(item) }]">
              <div :class="['icon-menu', { 'active-aFuBWS': isBottomItemActive(item) }]">
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
                    :active="isBottomItemActive(item)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRoute, useRouter } from 'vue-router'
import { useLoginModalStore } from '@/stores/login-modal'
import { useMarketingCenterStore } from '@/stores/marketing-center'
import { useMarketingModalStore } from '@/stores/marketing-modal'
import { useHomeSideMenuConfig } from '@/composables/useHomeSideMenuConfig'
import HomeSideMenuIcon from './HomeSideMenuIcon.vue'

const EMPTY_AVATAR_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' rx='100' fill='%23E5E7EB'/%3E%3Ccircle cx='100' cy='76' r='30' fill='%239CA3AF'/%3E%3Cpath d='M52 154c8-24 28-38 48-38s40 14 48 38' fill='%239CA3AF'/%3E%3C/svg%3E"

const authStore = useAuthStore()
const isLoggedIn = authStore.isLoggedIn
const loginButtonText = authStore.loginButtonText
const { openLoginModal } = useLoginModalStore()
const { openMarketingModal, isVisible: marketingModalVisible } = useMarketingModalStore()
const marketingCenterStore = useMarketingCenterStore()
const { bottomItems, sideMenuSettings } = useHomeSideMenuConfig()

const router = useRouter()
const route = useRoute()
const currentPath = computed(() => route.path)

const resolvedAvatarSrc = computed(() => {
  return authStore.currentUser.value?.avatarUrl || EMPTY_AVATAR_DATA_URI
})

const marketingPointsText = computed(() => {
  if (!authStore.isLoggedIn.value) {
    return '福利'
  }
  return String(marketingCenterStore.pointsBalance.value || 0)
})

const marketingItem = computed(() => bottomItems.value.find(item => item.key === 'marketing') || null)
const accountEntryItem = computed(() => bottomItems.value.find(item => item.key === 'account-entry') || null)
const actionItems = computed(() => {
  return bottomItems.value.filter(item => item.key !== 'marketing' && item.key !== 'account-entry')
})

const resolveMenuItemId = (key: string) => {
  const idMap: Record<string, string> = {
    notification: 'SiderMenuNotification',
    'app-download': 'SiderMenuAppDownload',
    'api-entry': 'SiderMenuApiInvokeEntrance',
    settings: 'SiderMenuSetting',
  }
  return idMap[key] || key
}

const resolveBottomContainerClass = (key: string) => {
  const classMap: Record<string, string> = {
    notification: 'notice-y3FxAc',
    'app-download': 'trigger-JEmSlm',
    'api-entry': 'trigger-BIU_ST',
    settings: 'dropdown-trigger-ZZ27H7',
  }
  return classMap[key] || ''
}

const openMarketingEntry = () => {
  openMarketingModal({
    source: 'bottom-menu',
    tab: authStore.isLoggedIn.value ? 'recharge' : 'membership',
  })
}

onMounted(() => {
  void marketingCenterStore.loadOverview()
})

const navigateToAccount = () => {
  if (!authStore.isLoggedIn.value) {
    openLoginModal('account-entry')
    return
  }

  void router.push('/account')
}

const handleBottomItemClick = (item: { actionType: string; actionValue: string }) => {
  if (item.actionType === 'route' && item.actionValue) {
    void router.push(item.actionValue)
    return
  }

  if (item.actionType === 'dialog' && item.actionValue === 'marketing') {
    openMarketingEntry()
    return
  }

  if (item.actionType === 'url' && item.actionValue) {
    window.open(item.actionValue, '_blank', 'noopener,noreferrer')
  }
}

const isBottomItemActive = (item: { key: string; actionType: string; actionValue: string }) => {
  if (item.actionType === 'route' && item.actionValue) {
    return currentPath.value === item.actionValue
  }

  if (item.actionType === 'dialog' && item.actionValue === 'marketing') {
    return marketingModalVisible.value
  }

  return false
}
</script>

<style scoped>
.login-button {
  background: transparent;
  border: 1px solid var(--stroke-tertiary);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  padding: 6px 11px;
}

.login-menu-wrapper .login-button:hover {
  background: transparent;
  border: 1px solid var(--stroke-tertiary);
}

.login-button:active {
  background: var(--bg-block-secondary-pressed);
  border: 1px solid transparent;
}

.avatar-container-Od1Q_g {
  align-items: center;
  display: flex;
  height: 30px;
  justify-content: center;
  width: 30px;
}

.avatar-Y3FqeU {
  align-items: center;
  border-radius: 50%;
  display: flex;
  height: 30px;
  justify-content: center;
  overflow: hidden;
  width: 30px;
}
</style>
