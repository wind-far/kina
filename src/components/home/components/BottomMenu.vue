<template>
  <div v-if="sideMenuSettings.showBottomMenu" role="menu" class="lv-menu lv-menu-light lv-menu-vertical bottomMenu login-menu-wrapper">
    <div class="lv-menu-inner">
      <div
        v-if="marketingItem"
        tabindex="0"
        role="menuitem"
        :class="[
          'lv-menu-item',
          'lv-menu-item-size-default',
          'credit-display-menu-container',
          { 'is-hidden-item': marketingItem.visible === false },
        ]"
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
        :class="[
          'lv-menu-item',
          'lv-menu-item-size-default',
          { 'is-hidden-item': accountEntryItem.visible === false },
        ]"
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
        :class="[
          'lv-menu-item',
          'lv-menu-item-size-default',
          {
            'lv-menu-selected': currentPath === '/account',
            'is-hidden-item': accountEntryItem.visible === false,
          },
        ]"
        id="Personal"
        @click="navigateToAccount"
      >
        <div class="avatar-container-Od1Q_g">
          <div class="avatar-Y3FqeU">
            <div style="width:100%;height:100%">
              <div class="dreamina-component-avatar-container">
                <img
                  v-if="resolvedAvatarSrc"
                  :src="resolvedAvatarSrc"
                  class="dreamina-component-avatar"
                  :alt="loginButtonText"
                >
                <span
                  v-else
                  class="side-menu-default-avatar"
                  role="img"
                  :aria-label="loginButtonText"
                >
                  <HomeSideMenuIcon icon-key="account" />
                </span>
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
        :class="[
          'lv-menu-item',
          'lv-menu-item-size-default',
          { 'side-menu-theme-item': item.key === 'theme' },
          {
            'lv-menu-selected': isBottomItemActive(item),
            'is-hidden-item': item.visible === false,
          },
        ]"
        :id="resolveMenuItemId(item.key)"
        @click="handleBottomItemClick(item, $event)"
        @keydown.enter.prevent="handleBottomItemClick(item, $event)"
        @keydown.space.prevent="handleBottomItemClick(item, $event)"
      >
        <div class="icon-container" style="--menu-icon-size:40px">
          <span
            v-if="item.key === 'notification' && isLoggedIn && item.badgeText"
            class="notification-unread-badge"
            aria-hidden="true"
          >{{ item.badgeText }}</span>
          <div :class="resolveBottomContainerClass(item.key)">
            <div :class="['content-XAjJup', { 'active-E3Q3lq': isBottomItemActive(item) }]">
              <div :class="['icon-menu', { 'active-aFuBWS': isBottomItemActive(item) }]">
                <div class="icon-wrap-tBuhBU hide-itzP3D sf-hidden">
                  <HomeSideMenuIcon
                    :icon-key="resolveBottomIconKey(item)"
                    :icon-source="item.iconSource"
                    :inactive-icon-url="item.inactiveIconUrl"
                    :active-icon-url="item.activeIconUrl"
                    :active="true"
                  />
                </div>
                <div class="icon-wrap-tBuhBU">
                  <HomeSideMenuIcon
                    :icon-key="resolveBottomIconKey(item)"
                    :icon-source="item.iconSource"
                    :inactive-icon-url="item.inactiveIconUrl"
                    :active-icon-url="item.activeIconUrl"
                    :active="item.key === 'settings' || isBottomItemActive(item)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="themeMenuOpen"
      ref="themeMenuElement"
      class="side-menu-theme-portal"
      role="menu"
      aria-label="主题模式"
      :style="themeMenuStyle"
    >
      <button
        v-for="option in themeOptions"
        :key="option.value"
        type="button"
        class="side-menu-theme-portal__option"
        role="menuitemradio"
        :aria-checked="themeStore.themeMode.value === option.value"
        @click.stop="selectThemeMode(option.value)"
      >
        <HomeSideMenuIcon :icon-key="option.icon" />
        <span class="side-menu-theme-portal__label">{{ option.label }}</span>
        <svg
          v-if="themeStore.themeMode.value === option.value"
          class="side-menu-theme-portal__check"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRoute, useRouter } from 'vue-router'
import { useLoginModalStore } from '@/stores/login-modal'
import { useMarketingCenterStore } from '@/stores/marketing-center'
import { useMarketingModalStore } from '@/stores/marketing-modal'
import { useThemePreferenceStore } from '@/stores/theme-preference'
import { useHomeSideMenuConfig } from '@/composables/useHomeSideMenuConfig'
import HomeSideMenuIcon from './HomeSideMenuIcon.vue'
import type { SystemConfigPayload } from '@/api/system-config'
import type { ThemeMode } from '@/stores/theme-preference'

const props = withDefaults(defineProps<{
  systemSettingsOverride?: SystemConfigPayload | null
  activeMenuKeyOverride?: string
  activePathOverride?: string
  previewReadonly?: boolean
  loginStateOverride?: boolean | null
  marketingPointsTextOverride?: string
  avatarSrcOverride?: string
  includeHiddenItems?: boolean
}>(), {
  systemSettingsOverride: null,
  activeMenuKeyOverride: '',
  activePathOverride: '',
  previewReadonly: false,
  loginStateOverride: null,
  marketingPointsTextOverride: '',
  avatarSrcOverride: '',
  includeHiddenItems: false,
})

const authStore = useAuthStore()
const isLoggedIn = computed(() => props.loginStateOverride ?? authStore.isLoggedIn.value)
const loginButtonText = authStore.loginButtonText
const { openLoginModal } = useLoginModalStore()
const { openMarketingModal, isVisible: marketingModalVisible } = useMarketingModalStore()
const marketingCenterStore = useMarketingCenterStore()
const themeStore = useThemePreferenceStore()
const overrideSideMenuSettings = computed(() => props.systemSettingsOverride?.homeSideMenuSettings || null)
const { bottomItems, sideMenuSettings } = useHomeSideMenuConfig({
  settingsOverride: overrideSideMenuSettings,
  includeHidden: props.includeHiddenItems,
})

const router = useRouter()
const route = useRoute()
const currentPath = computed(() => props.activePathOverride || route.path)
const themeMenuOpen = ref(false)
const themeMenuElement = ref<HTMLElement | null>(null)
const themeAnchorElement = ref<HTMLElement | null>(null)
const themeMenuPosition = ref({ left: 86, top: 10 })

const resolvedAvatarSrc = computed(() => {
  return props.avatarSrcOverride || authStore.currentUser.value?.avatarUrl || ''
})

const marketingPointsText = computed(() => {
  if (props.marketingPointsTextOverride) {
    return props.marketingPointsTextOverride
  }

  if (!isLoggedIn.value) {
    return '福利'
  }
  return String(marketingCenterStore.pointsBalance.value || 0)
})

const marketingItem = computed(() => bottomItems.value.find(item => item.key === 'marketing') || null)
const accountEntryItem = computed(() => bottomItems.value.find(item => item.key === 'account-entry') || null)
const actionItems = computed(() => {
  return bottomItems.value.filter(item => item.key !== 'marketing' && item.key !== 'account-entry')
})

const systemThemeLabel = computed(() => {
  return themeStore.getSystemTheme() === 'dark' ? '深色' : '浅色'
})

const themeOptions = computed<Array<{ value: ThemeMode; label: string; icon: string }>>(() => {
  const options: Array<{ value: ThemeMode; label: string; icon: string }> = [
    { value: 'light', label: '浅色模式', icon: 'theme-light' },
    { value: 'dark', label: '深色模式', icon: 'theme-dark' },
  ]

  if (themeStore.supportSystemMode.value) {
    options.push({
      value: 'system',
      label: `跟随系统 · ${systemThemeLabel.value}`,
      icon: 'theme-system',
    })
  }

  return options
})

const themeMenuStyle = computed(() => ({
  left: `${themeMenuPosition.value.left}px`,
  top: `${themeMenuPosition.value.top}px`,
}))

const resolveMenuItemId = (key: string) => {
  const idMap: Record<string, string> = {
    notification: 'SiderMenuNotification',
    theme: 'SiderMenuTheme',
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

const resolveBottomIconKey = (item: { key: string; icon: string }) => {
  if (item.key !== 'theme') {
    return item.icon
  }

  return themeStore.currentTheme.value === 'dark' ? 'theme-dark' : 'theme-light'
}

const closeThemeMenu = () => {
  themeMenuOpen.value = false
  themeAnchorElement.value = null
}

const updateThemeMenuPosition = () => {
  const anchor = themeAnchorElement.value
  if (!anchor || typeof window === 'undefined') {
    return
  }

  const anchorRect = anchor.getBoundingClientRect()
  const menuWidth = 196
  const optionCount = themeOptions.value.length
  const menuHeight = 18 + optionCount * 36 + Math.max(0, optionCount - 1) * 2
  const viewportGap = 10
  const preferredLeft = anchorRect.right + 20
  const preferredTop = anchorRect.top + anchorRect.height / 2 - menuHeight / 2

  themeMenuPosition.value = {
    left: Math.max(viewportGap, Math.min(preferredLeft, window.innerWidth - menuWidth - viewportGap)),
    top: Math.max(viewportGap, Math.min(preferredTop, window.innerHeight - menuHeight - viewportGap)),
  }
}

const openThemeMenu = (event: Event) => {
  if (!themeStore.allowUserToggle.value) {
    return
  }

  const anchor = event.currentTarget
  if (!(anchor instanceof HTMLElement)) {
    return
  }

  if (themeMenuOpen.value && themeAnchorElement.value === anchor) {
    closeThemeMenu()
    return
  }

  themeAnchorElement.value = anchor
  themeMenuOpen.value = true
  updateThemeMenuPosition()
}

const selectThemeMode = (mode: ThemeMode) => {
  themeStore.setThemeMode(mode)
  closeThemeMenu()
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!themeMenuOpen.value) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    closeThemeMenu()
    return
  }

  if (themeMenuElement.value?.contains(target) || themeAnchorElement.value?.contains(target)) {
    return
  }

  closeThemeMenu()
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeThemeMenu()
  }
}

const openMarketingEntry = () => {
  if (props.previewReadonly) {
    return
  }

  openMarketingModal({
    source: 'bottom-menu',
    tab: isLoggedIn.value ? 'recharge' : 'membership',
  })
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', updateThemeMenuPosition)
  window.addEventListener('scroll', updateThemeMenuPosition, true)

  if (props.previewReadonly) {
    return
  }
  void marketingCenterStore.loadOverview()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', updateThemeMenuPosition)
  window.removeEventListener('scroll', updateThemeMenuPosition, true)
})

const navigateToAccount = () => {
  if (props.previewReadonly) {
    return
  }

  if (!isLoggedIn.value) {
    openLoginModal('account-entry')
    return
  }

  void router.push('/account')
}

const handleBottomItemClick = (item: { key?: string; actionType: string; actionValue: string }, event: Event) => {
  if (props.previewReadonly) {
    return
  }

  if (item.key === 'theme') {
    openThemeMenu(event)
    return
  }

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

const isBottomItemActive = (item: { key: string; actionType: string; actionValue: string; badgeText?: string }) => {
  if (item.key === 'notification' && isLoggedIn.value && item.badgeText) {
    return true
  }

  if (item.key === 'theme' && themeMenuOpen.value) {
    return true
  }

  if (props.activeMenuKeyOverride) {
    return props.activeMenuKeyOverride === item.key
  }

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
.login-menu-wrapper .lv-menu-inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.login-menu-wrapper .lv-menu-item {
  flex: 0 0 40px;
  height: 40px;
}

.login-menu-wrapper .credit-display-menu-container {
  flex-basis: 60px;
  height: 60px;
}

@media screen and (max-height: 719px) {
  .login-menu-wrapper .lv-menu-inner {
    gap: 4px;
  }
}

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

.side-menu-default-avatar {
  align-items: center;
  background: var(--bg-block-primary-default, #f0f1f4);
  border-radius: 50%;
  color: var(--text-secondary, #6b7280);
  display: flex;
  font-size: 18px;
  height: 100%;
  justify-content: center;
  line-height: 1;
  overflow: hidden;
  width: 100%;
}

.notification-unread-badge {
  background: var(--el-color-danger, #f56c6c);
  border-radius: 8px;
  box-sizing: border-box;
  color: #fff;
  font-size: 10px;
  height: 16px;
  line-height: 16px;
  min-width: 16px;
  padding: 0 4px;
  pointer-events: none;
  position: absolute;
  right: -4px;
  text-align: center;
  top: -2px;
  z-index: 1;
}

.side-menu-theme-item.lv-menu-selected .icon-menu {
  color: var(--text-primary);
}

.side-menu-theme-portal {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
  color: #1f1f1f;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  position: fixed;
  width: 196px;
  z-index: 10000;
}

.side-menu-theme-portal__option {
  align-items: center;
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  display: flex;
  flex: 0 0 36px;
  font: inherit;
  gap: 8px;
  height: 36px;
  padding: 8px 10px;
  text-align: left;
  width: 178px;
}

.side-menu-theme-portal__option:hover,
.side-menu-theme-portal__option:focus-visible {
  background: rgba(0, 0, 0, 0.05);
  outline: none;
}

.side-menu-theme-portal__option > :first-child {
  color: #929292;
  flex: 0 0 20px;
  font-size: 20px;
}

.side-menu-theme-portal__label {
  flex: 1;
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
}

.side-menu-theme-portal__check {
  flex: 0 0 16px;
}

</style>

<style>
html[data-theme='dark'] .side-menu-theme-portal {
  background: rgba(38, 38, 38, 0.8);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  color: #fafafa;
}

html[data-theme='dark'] .side-menu-theme-portal__option:hover,
html[data-theme='dark'] .side-menu-theme-portal__option:focus-visible {
  background: rgba(255, 255, 255, 0.08);
}
</style>
