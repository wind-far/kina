<template>
  <AdminPageContainer title="主题配置" description="在后台统一控制前台首页、前台交互、前台反馈状态和前台页面骨架。">
    <template #actions>
      <button
        class="admin-button admin-button--secondary"
        type="button"
        :disabled="loading || saving"
        @click="resetThemeSettings"
      >
        恢复默认
      </button>
      <button
        class="admin-button admin-button--primary"
        type="button"
        :disabled="loading || saving"
        @click="handleSave"
      >
        {{ saving ? '保存中...' : '保存主题配置' }}
      </button>
    </template>

    <div class="admin-theme-page">
      <div v-if="loading" class="admin-empty admin-theme-loading">正在加载主题配置...</div>

      <template v-else>
        <section class="admin-theme-shell admin-card">
          <AdminThemeWorkbenchTopbar
            :preview-mode="previewMode"
            :preview-mode-options="previewModeOptions"
            @update:preview-mode="previewMode = $event"
          />

          <div
            class="admin-theme-shell__body"
            :class="{ 'is-config-collapsed': configPanelCollapsed }"
          >
            <AdminThemeWorkbenchPreview
              :system-form="systemForm"
              :preview-theme-class="previewThemeClass"
              :preview-theme-vars="previewThemeVars"
              :preview-frontstage-body-style="previewFrontstageBodyStyle"
              :preview-sidebar-style="previewSidebarStyle"
              :preview-surface-frame-style="previewSurfaceFrameStyle"
              :preview-surface-card-style="previewSurfaceCardStyle"
              :preview-banner-card-style="previewBannerCardStyle"
              :preview-banner-glow-style="previewBannerGlowStyle"
              :preview-active-menu-key="previewActiveMenuKey"
              :preview-top-menu-item="previewTopMenuItem"
              :preview-center-menu-groups="previewCenterMenuGroups"
              :preview-bottom-menu-groups="previewBottomMenuGroups"
              :preview-primary-banner="previewPrimaryBanner"
              :preview-secondary-banners="previewSecondaryBanners"
              :toggle-menu-visibility="toggleMenuItemVisible"
              :apply-menu-reorder="handlePreviewMenuReorder"
              @menu-action="handlePreviewMenuAction"
              @menu-reorder="handlePreviewMenuReorder"
            />

            <AdminThemeConfigRail
              :collapsed="configPanelCollapsed"
              :active-tab="activeConfigTab"
              :tabs="configTabs"
              @toggle="configPanelCollapsed = !configPanelCollapsed"
              @update:active-tab="activeConfigTab = $event"
            >
              <template #theme>
                <AdminThemeThemePanel
                  :system-form="systemForm"
                  :section-ids="sectionIds"
                  :section-summaries="sectionSummaries"
                  :action-color-fields="actionColorFields"
                  :accent-color-fields="accentColorFields"
                  :status-color-fields="statusColorFields"
                  @scroll-to-section="scrollToSection"
                />
              </template>

              <template #layout>
                <AdminThemeLayoutPanel
                  :form="systemForm"
                  :home-banner-preset-options="HOME_BANNER_PRESET_OPTIONS"
                  :home-side-menu-base-status="homeSideMenuBaseStatus"
                  :home-side-menu-items-status="homeSideMenuItemsStatus"
                  :home-header-status="homeHeaderStatus"
                  :home-banner-status="homeBannerStatus"
                  :on-submit="handleSave"
                  :scroll-to-layout-section="scrollToLayoutSection"
                  :get-menu-section-label="getMenuSectionLabel"
                  :move-home-side-menu-item="moveHomeSideMenuItem"
                  :trigger-menu-icon-upload="triggerMenuIconUpload"
                  :handle-menu-icon-file-change="handleMenuIconFileChange"
                  :clear-menu-icon="clearMenuIcon"
                  :append-home-banner-item="appendHomeBannerItem"
                  :move-home-banner-item="moveHomeBannerItem"
                  :remove-home-banner-item="removeHomeBannerItem"
                  :active-layout-section="activeLayoutSection"
                  :external-action="externalLayoutAction"
                />
              </template>
            </AdminThemeConfigRail>
          </div>
        </section>
      </template>
    </div>

    <AdminThemeMenuItemDialog
      :visible="menuItemDialogVisible"
      :draft="editingMenuItemDraft"
      @close="closeMenuItemDialog"
      @submit="submitMenuItemDialog"
      @trigger-icon-upload="triggerEditingMenuIconUpload"
      @icon-file-change="handleEditingMenuIconFileChange"
      @clear-icon="clearEditingMenuIcon"
    />

    <AdminThemeDeleteMenuItemDialog
      :visible="deleteMenuItemDialogVisible"
      :label="deleteMenuItemLabel"
      @close="closeDeleteMenuItemDialog"
      @confirm="confirmRemoveMenuItem"
    />
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import AdminThemeDeleteMenuItemDialog from '@/views/admin/theme/components/AdminThemeDeleteMenuItemDialog.vue'
import AdminThemeLayoutPanel from '@/views/admin/theme/components/AdminThemeLayoutPanel.vue'
import AdminThemeMenuItemDialog from '@/views/admin/theme/components/AdminThemeMenuItemDialog.vue'
import AdminThemeConfigRail from '@/views/admin/theme/components/AdminThemeConfigRail.vue'
import AdminThemeThemePanel from '@/views/admin/theme/components/AdminThemeThemePanel.vue'
import AdminThemeWorkbenchPreview from '@/views/admin/theme/components/AdminThemeWorkbenchPreview.vue'
import AdminThemeWorkbenchTopbar from '@/views/admin/theme/components/AdminThemeWorkbenchTopbar.vue'
import { useAdminThemeMenuEditor } from '@/views/admin/theme/useAdminThemeMenuEditor'
import { HOME_BANNER_PRESET_OPTIONS, useAdminLayoutConfig } from '@/views/admin/system/useAdminLayoutConfig'
import {
  createDefaultConversationSettings,
  createDefaultGenerationProgressSettings,
  createDefaultGlobalThemeSettings,
  createDefaultHomeLayoutSettings,
  createDefaultHomeSideMenuSettings,
  getAdminSystemConfig,
  saveAdminSystemConfig,
  type SystemConfigPayload,
} from '@/api/system-config'
import { useSystemSettingsStore } from '@/stores/system-settings'
import type { WorkbenchMenuActionKey } from '@/views/admin/theme/components/AdminThemeWorkbenchItemActions.vue'

const loading = ref(false)
const saving = ref(false)
const previewMode = ref<'dark' | 'light'>('dark')
const configPanelCollapsed = ref(false)
const activeConfigTab = ref<'theme' | 'layout'>('theme')
const activeLayoutSection = ref<'layout-side-menu' | 'layout-home-header' | 'layout-home-banner'>('layout-side-menu')
const externalLayoutAction = ref<
  | { type: 'edit-menu-item', menuKey: string, stamp: number }
  | { type: 'add-menu-item', stamp: number }
  | { type: 'edit-banner-item', bannerKey: string, stamp: number }
  | { type: 'add-banner-item', stamp: number }
  | null
>(null)
const { applyPublicSystemSettings } = useSystemSettingsStore()

const configTabs = [
  { key: 'theme', label: '主题配置', desc: '颜色、骨架、模式' },
  { key: 'layout', label: '布局配置', desc: '导航、首页头部、Banner 编排' },
] as const

const sectionIds = {
  banner: 'theme-section-banner',
  action: 'theme-section-action',
  status: 'theme-section-status',
  surface: 'theme-section-surface',
  mode: 'theme-section-mode',
} as const

const sectionSummaries = [
  { key: sectionIds.banner, title: '首页 Banner', desc: '控制前台首页首屏气质', areas: ['首页首屏', 'Banner 卡片'] },
  { key: sectionIds.action, title: '按钮与交互', desc: '控制主按钮、次按钮和标签', areas: ['首页 CTA', '创作按钮', '工作流操作'] },
  { key: sectionIds.status, title: '状态反馈', desc: '控制成功、处理中和失败状态', areas: ['成功反馈', '处理中', '失败提醒'] },
  { key: sectionIds.surface, title: '页面骨架', desc: '控制内容宽度与卡片圆角', areas: ['首页内容区', '创作卡片'] },
  { key: sectionIds.mode, title: '主题模式', desc: '控制前台深浅主题策略', areas: ['全局主题', '用户切换'] },
] as const

const previewModeOptions = [
  { value: 'dark', label: '深色预览' },
  { value: 'light', label: '浅色预览' },
] as const

const actionColorFields = [
  { key: 'primary', label: '主按钮默认色', placeholder: '#6f35ff' },
  { key: 'primaryHover', label: '主按钮悬浮色', placeholder: '#5b28e6' },
  { key: 'primaryActive', label: '主按钮按下色', placeholder: '#4c20c4' },
] as const

const accentColorFields = [
  { key: 'secondary', label: '辅助色', placeholder: '#00c2d6' },
  { key: 'accent', label: '强调色', placeholder: '#ff7a59' },
] as const

const statusColorFields = [
  { key: 'success', label: '成功色', placeholder: '#18b566' },
  { key: 'warning', label: '警告色', placeholder: '#ffb020' },
  { key: 'danger', label: '错误色', placeholder: '#f04438' },
] as const

const createDefaultSystemForm = (): SystemConfigPayload => ({
  siteInfo: {
    siteName: 'Canana',
    siteDescription: '',
    siteLogoUrl: '',
    siteIconUrl: '',
    icpText: '',
    icpLink: '',
    copyrightText: '',
  },
  policySettings: {
    agreementRequired: true,
    agreementTextPrefix: '已阅读并同意',
    userAgreementTitle: '用户服务协议',
    userAgreementUrl: '',
    userAgreementContent: '',
    privacyPolicyTitle: '隐私政策',
    privacyPolicyUrl: '',
    privacyPolicyContent: '',
    aiNoticeTitle: 'AI功能使用须知',
    aiNoticeUrl: '',
    aiNoticeContent: '',
  },
  loginSettings: {
    welcomeTitle: '欢迎登录',
    welcomeSubtitle: '',
  },
  generationProgressSettings: createDefaultGenerationProgressSettings(),
  conversationSettings: createDefaultConversationSettings(),
  globalThemeSettings: createDefaultGlobalThemeSettings(),
  homeSideMenuSettings: createDefaultHomeSideMenuSettings(),
  homeLayoutSettings: createDefaultHomeLayoutSettings(),
})

const cloneSystemForm = (payload: SystemConfigPayload): SystemConfigPayload => JSON.parse(JSON.stringify(payload))

const systemForm = reactive<SystemConfigPayload>(createDefaultSystemForm())

const assignSystemForm = (payload?: SystemConfigPayload | null) => {
  Object.assign(systemForm, cloneSystemForm(payload || createDefaultSystemForm()))
}

const previewBannerCardStyle = computed(() => ({
  background: systemForm.globalThemeSettings.gradients.primaryGradient,
  borderRadius: `${systemForm.globalThemeSettings.surfaces.cardRadius}px`,
}))

const previewBannerGlowStyle = computed(() => ({
  background: systemForm.globalThemeSettings.gradients.bannerGlow,
}))

const previewSurfaceFrameStyle = computed(() => ({
  maxWidth: `${Math.min(systemForm.globalThemeSettings.surfaces.contentMaxWidth, 560)}px`,
}))

const previewSurfaceCardStyle = computed(() => ({
  borderRadius: `${systemForm.globalThemeSettings.surfaces.cardRadius}px`,
}))

const previewSidebarWidth = computed(() => {
  const baseWidth = Math.min(Math.max(systemForm.homeSideMenuSettings.drawerWidth, 180), 240)
  const actionSafeWidth = Math.min(
    Math.max(systemForm.homeSideMenuSettings.collapsedWidth + 188, 260),
    320,
  )
  return Math.max(baseWidth, actionSafeWidth)
})

const previewSidebarStyle = computed(() => ({
  width: `${previewSidebarWidth.value}px`,
}))

const previewFrontstageBodyStyle = computed(() => {
  return {
    gridTemplateColumns: systemForm.homeSideMenuSettings.enabled
      ? `${previewSidebarWidth.value}px minmax(0, 1fr)`
      : 'minmax(0, 1fr)',
  }
})

const previewSortedMenuItems = computed(() => {
  return [...systemForm.homeSideMenuSettings.items]
    .sort((current, next) => current.sortOrder - next.sortOrder)
})

const previewTopMenuItem = computed(() => {
  return previewSortedMenuItems.value.find(item => item.section === 'top') || null
})

const previewCenterMenuGroups = computed(() => {
  return normalizedMenuGroups.value
    .filter(group => group.section === 'center' && group.visible)
    .map(group => ({ ...group, items: group.items }))
    .filter(group => group.items.length > 0)
})

const previewBottomMenuGroups = computed(() => {
  return normalizedMenuGroups.value
    .filter(group => group.section === 'bottom' && group.visible)
    .map(group => ({ ...group, items: group.items }))
    .filter(group => group.items.length > 0)
})

const previewActiveMenuKey = computed(() => {
  return previewSortedMenuItems.value.find(item => item.visible)?.key
    || previewSortedMenuItems.value[0]?.key
    || ''
})

const previewVisibleBanners = computed(() => {
  return [...systemForm.homeLayoutSettings.banner.items]
    .filter(item => item.visible)
    .sort((current, next) => current.sortOrder - next.sortOrder)
})

const previewPrimaryBanner = computed(() => previewVisibleBanners.value[0] || null)
const previewSecondaryBanners = computed(() => previewVisibleBanners.value.slice(1, 4))

const previewThemeClass = computed(() => {
  return previewMode.value === 'light' ? 'is-light' : 'is-dark'
})

const previewThemeVars = computed(() => {
  const theme = systemForm.globalThemeSettings
  return {
    '--brand-main-default': theme.brandColors.primary,
    '--brand-main-hover': theme.brandColors.primaryHover,
    '--brand-main-pressed': theme.brandColors.primaryActive,
    '--brand-secondary-default': theme.brandColors.secondary,
    '--brand-accent-default': theme.brandColors.accent,
    '--brand-success-default': theme.brandColors.success,
    '--brand-warning-default': theme.brandColors.warning,
    '--brand-danger-default': theme.brandColors.danger,
    '--theme-banner-glow': theme.gradients.bannerGlow,
  }
})

const scrollToSection = async (id: string) => {
  activeConfigTab.value = 'theme'
  configPanelCollapsed.value = false
  await nextTick()
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const handlePreviewMenuAction = ({ action, menuKey }: { action: WorkbenchMenuActionKey, menuKey: string }) => {
  if (action === 'edit') {
    openMenuItemDialog(menuKey)
    return
  }

  if (action === 'visible') {
    toggleMenuItemVisible(menuKey)
    return
  }

  if (action === 'delete') {
    requestRemoveMenuItem(menuKey)
  }
}

const handlePreviewMenuReorder = ({ sourceMenuKey, targetMenuKey, position }: {
  sourceMenuKey: string
  targetMenuKey: string
  position: 'before' | 'after'
}) => {
  const items = systemForm.homeSideMenuSettings.items
  const sourceItem = items.find(item => item.key === sourceMenuKey)
  const targetItem = items.find(item => item.key === targetMenuKey)
  if (!sourceItem || !targetItem) return
  if (sourceItem.key === targetItem.key) return
  if (sourceItem.section !== targetItem.section || sourceItem.groupKey !== targetItem.groupKey) return
  reorderMenuItemWithinGroup(sourceItem.groupKey, sourceMenuKey, targetMenuKey, position)
}

const {
  homeSideMenuBaseStatus,
  homeSideMenuItemsStatus,
  homeHeaderStatus,
  homeBannerStatus,
  normalizedMenuGroups,
  getMenuSectionLabel,
  scrollToLayoutSection,
  moveHomeSideMenuItem,
  reorderMenuItemWithinGroup,
  triggerMenuIconUpload,
  handleMenuIconFileChange,
  clearMenuIcon,
  appendHomeBannerItem,
  moveHomeBannerItem,
  removeHomeBannerItem,
} = useAdminLayoutConfig(systemForm)

const {
  menuItemDialogVisible,
  editingMenuItemDraft,
  deleteMenuItemDialogVisible,
  deleteMenuItemLabel,
  openMenuItemDialog,
  closeMenuItemDialog,
  submitMenuItemDialog,
  triggerEditingMenuIconUpload,
  handleEditingMenuIconFileChange,
  clearEditingMenuIcon,
  toggleMenuItemVisible,
  requestRemoveMenuItem,
  closeDeleteMenuItemDialog,
  confirmRemoveMenuItem,
} = useAdminThemeMenuEditor({
  getItems: () => systemForm.homeSideMenuSettings.items,
  handleMenuIconFileChange,
  clearMenuIcon,
})

const loadThemeSettings = async () => {
  loading.value = true
  try {
    const result = await getAdminSystemConfig()
    assignSystemForm(result || createDefaultSystemForm())
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    const result = await saveAdminSystemConfig(cloneSystemForm(systemForm))
    assignSystemForm(result || systemForm)
    applyPublicSystemSettings(result || systemForm)
  } finally {
    saving.value = false
  }
}

const resetThemeSettings = () => {
  systemForm.globalThemeSettings = createDefaultGlobalThemeSettings()
}

onMounted(() => {
  void loadThemeSettings()
})
</script>

<style scoped>
.admin-theme-page {
  display: grid;
  gap: 16px;
  height: calc(100vh - 148px);
  min-height: 860px;
  overflow: hidden;
}

.admin-theme-loading {
  min-height: 160px;
  display: grid;
  place-items: center;
}

.admin-theme-shell {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.admin-theme-shell__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  min-height: 0;
  height: 100%;
  transition: grid-template-columns 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.admin-theme-shell__body.is-config-collapsed {
  grid-template-columns: minmax(0, 1fr) 76px;
}

@media (max-width: 1280px) {
  .admin-theme-shell__body {
    grid-template-columns: 1fr;
  }
}
</style>
