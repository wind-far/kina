<template>
  <AdminPageContainer description="">
    <div class="admin-theme-page">
      <div v-if="loading" class="admin-empty admin-theme-loading">正在加载主题配置...</div>

      <template v-else>
        <section class="admin-theme-shell admin-card">
          <AdminThemeWorkbenchTopbar
            :preview-theme-class="previewThemeClass"
            :loading="loading"
            :saving="saving"
            @reset="resetThemeSettings"
            @save="handleSave"
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
              :active-theme-section-id="activeThemeSectionId"
              :active-theme-field-id="activeThemeFieldId"
              @menu-action="handlePreviewMenuAction"
              @menu-reorder="handlePreviewMenuReorder"
              @content-block-action="handleWorkbenchContentAction"
              @banner-item-action="handleBannerItemAction"
              @banner-item-reorder="handleBannerItemReorder"
              @theme-section-select="handleThemeSectionSelect"
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
                  :active-preview-section="activeThemeSectionId"
                  :active-preview-field="activeThemeFieldId"
                  @scroll-to-section="scrollToSection"
                  @preview-focus-change="activeThemeSectionId = $event"
                  @preview-field-change="activeThemeFieldId = $event"
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

    <AdminThemeWorkbenchContentDialog
      :visible="workbenchContentDialogVisible"
      :draft="editingWorkbenchContentDraft"
      @close="closeWorkbenchContentDialog"
      @submit="submitWorkbenchContentDialog"
    />

    <AdminThemeBannerItemDialog
      :visible="bannerItemDialogVisible"
      :draft="editingBannerItemDraft"
      :preset-options="HOME_BANNER_PRESET_OPTIONS"
      @close="closeBannerItemDialog"
      @submit="submitBannerItemDialog"
    />
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import AdminThemeBannerItemDialog, { type ThemeBannerItemDialogDraft } from '@/views/admin/theme/components/AdminThemeBannerItemDialog.vue'
import AdminThemeDeleteMenuItemDialog from '@/views/admin/theme/components/AdminThemeDeleteMenuItemDialog.vue'
import AdminThemeLayoutPanel from '@/views/admin/theme/components/AdminThemeLayoutPanel.vue'
import AdminThemeMenuItemDialog from '@/views/admin/theme/components/AdminThemeMenuItemDialog.vue'
import AdminThemeWorkbenchContentDialog, { type WorkbenchContentDialogDraft } from '@/views/admin/theme/components/AdminThemeWorkbenchContentDialog.vue'
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
import { useThemePreferenceStore } from '@/stores/theme-preference'
import type { WorkbenchMenuActionKey } from '@/views/admin/theme/components/AdminThemeWorkbenchItemActions.vue'
import type { WorkbenchContentBlockKey } from '@/views/admin/theme/components/AdminThemeFrontHomeHeaderPreview.vue'

const loading = ref(false)
const saving = ref(false)
const configPanelCollapsed = ref(false)
const activeConfigTab = ref<'theme' | 'layout'>('theme')
const activeThemeSectionId = ref<string | null>(null)
const activeThemeFieldId = ref<string | null>(null)
const activeLayoutSection = ref<'layout-side-menu' | 'layout-home-header' | 'layout-home-banner'>('layout-side-menu')
const workbenchContentDialogVisible = ref(false)
const editingWorkbenchContentDraft = ref<WorkbenchContentDialogDraft | null>(null)
const bannerItemDialogVisible = ref(false)
const editingBannerItemDraft = ref<ThemeBannerItemDialogDraft | null>(null)
const externalLayoutAction = ref<
  | { type: 'edit-menu-item', menuKey: string, stamp: number }
  | { type: 'add-menu-item', stamp: number }
  | { type: 'edit-banner-item', bannerKey: string, stamp: number }
  | { type: 'add-banner-item', stamp: number }
  | null
>(null)
const { applyPublicSystemSettings } = useSystemSettingsStore()
const themeStore = useThemePreferenceStore()

const configTabs = [
  { key: 'theme', label: '主题配置', desc: '颜色、骨架、模式' },
  { key: 'layout', label: '布局配置', desc: '导航、首页头部、Banner 编排' },
] as const

const sectionIds = {
  banner: 'theme-section-banner',
  background: 'theme-section-background',
  action: 'theme-section-action',
  status: 'theme-section-status',
  surface: 'theme-section-surface',
  mode: 'theme-section-mode',
} as const

const sectionSummaries = [
  { key: sectionIds.banner, title: '首页 Banner', desc: '控制前台首页首屏气质', areas: ['首页首屏', 'Banner 卡片'] },
  { key: sectionIds.background, title: '页面背景', desc: '控制页面底色、输入面板与侧栏底色', areas: ['首页大背景', '输入面板', '左侧导航'] },
  { key: sectionIds.action, title: '按钮与交互', desc: '控制主按钮、次按钮和标签', areas: ['首页 CTA', '创作按钮', '工作流操作'] },
  { key: sectionIds.status, title: '状态反馈', desc: '控制成功、处理中和失败状态', areas: ['成功反馈', '处理中', '失败提醒'] },
  { key: sectionIds.surface, title: '页面骨架', desc: '控制内容宽度与卡片圆角', areas: ['首页内容区', '创作卡片'] },
  { key: sectionIds.mode, title: '主题模式', desc: '控制前台深浅主题策略', areas: ['全局主题', '用户切换'] },
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

const DEFAULT_DARK_BACKGROUNDS = {
  page: '#0f0f12',
  surface: '#15161a',
  sideMenu: '#111218',
} as const

const DEFAULT_LIGHT_BACKGROUNDS = {
  page: '#f8f9fa',
  surface: '#ffffff',
  sideMenu: '#ffffff',
} as const

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
  const collapsedWidth = Math.max(systemForm.homeSideMenuSettings.collapsedWidth, 0)
  const horizontalPadding = 16
  return Math.min(Math.max(collapsedWidth + horizontalPadding, 92), 120)
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
  return themeStore.currentTheme.value === 'light' ? 'is-light' : 'is-dark'
})

const previewResolvedBackgrounds = computed(() => {
  const backgrounds = systemForm.globalThemeSettings.backgrounds

  if (themeStore.currentTheme.value !== 'light') {
    return backgrounds
  }

  return {
    page: backgrounds.page === DEFAULT_DARK_BACKGROUNDS.page
      ? DEFAULT_LIGHT_BACKGROUNDS.page
      : backgrounds.page,
    surface: backgrounds.surface === DEFAULT_DARK_BACKGROUNDS.surface
      ? DEFAULT_LIGHT_BACKGROUNDS.surface
      : backgrounds.surface,
    sideMenu: backgrounds.sideMenu === DEFAULT_DARK_BACKGROUNDS.sideMenu
      ? DEFAULT_LIGHT_BACKGROUNDS.sideMenu
      : backgrounds.sideMenu,
  }
})

const previewThemeVars = computed(() => {
  const theme = systemForm.globalThemeSettings
  const backgrounds = previewResolvedBackgrounds.value
  const isLight = themeStore.currentTheme.value === 'light'

  return {
    '--bg-body': backgrounds.page,
    '--bg-surface': backgrounds.surface,
    '--bg-float': backgrounds.surface,
    '--bg-muted': isLight ? '#f1f2f3' : '#1c1e22',
    '--theme-page-background': backgrounds.page,
    '--theme-surface-background': backgrounds.surface,
    '--theme-side-menu-background': backgrounds.sideMenu,
    '--bg-dropdown-menu': isLight ? '#ffffff' : '#1c1e22',
    '--canvas-bg': isLight ? '#f1f2f3' : backgrounds.page,
    '--canvas-sidebar-bg': isLight ? backgrounds.sideMenu : backgrounds.page,
    '--text-primary': isLight ? '#0f1419' : '#f5fbff',
    '--text-secondary': isLight ? '#536471' : '#e0f5ff99',
    '--text-tertiary': isLight ? '#72808a' : '#e0f5ff7a',
    '--text-placeholder': isLight ? '#536471a3' : '#e0f5ff59',
    '--text-disabled': isLight ? '#5364715c' : '#e0f5ff33',
    '--text-link': '#3686ad',
    '--stroke-primary': isLight ? '#00000012' : '#ccddff1a',
    '--stroke-secondary': isLight ? '#0000000d' : '#ccddff0f',
    '--stroke-tertiary': isLight ? '#00000008' : '#ccddff14',
    '--line-divider': isLight ? 'rgba(15, 20, 25, 0.12)' : 'rgba(224, 245, 255, 0.16)',
    '--bg-block-primary-default': isLight ? '#0000000d' : '#ccddff14',
    '--bg-block-primary-hover': isLight ? '#00000012' : '#ccddff1f',
    '--bg-block-primary-pressed': isLight ? '#0000001a' : '#ccddff29',
    '--bg-block-secondary-default': isLight ? '#00000008' : '#ccddff0a',
    '--bg-block-secondary-hover': isLight ? '#0000000d' : '#ccddff14',
    '--bg-block-secondary-pressed': isLight ? '#00000012' : '#ccddff1f',
    '--component-input-bg': isLight ? '#ffffffeb' : '#202127b8',
    '--component-input-bg-tab': isLight ? '#0000000d' : '#0000004d',
    '--component-secondary-button-bg-default': isLight ? '#0000000d' : '#ccddff14',
    '--component-secondary-button-bg-hover': isLight ? '#00000012' : '#ccddff1f',
    '--component-secondary-button-bg-pressed': isLight ? '#0000001a' : '#ccddff29',
    '--component-secondary-button-text-default': isLight ? '#0f1419' : '#f5fbff',
    '--component-secondary-button-text-disabled': isLight ? '#a5acb8' : '#e0f5ff33',
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
  activeThemeSectionId.value = id
  await nextTick()
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const handleThemeSectionSelect = (sectionId: string) => {
  void scrollToSection(sectionId)
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

const createWorkbenchContentDraft = (blockKey: WorkbenchContentBlockKey): WorkbenchContentDialogDraft => {
  const workbench = systemForm.conversationSettings.entryDisplay.workbench
  const input = systemForm.conversationSettings.entryDisplay.input
  const header = systemForm.homeLayoutSettings.header
  const draftMap: Record<WorkbenchContentBlockKey, string> = {
    title: '标题块',
    generator: '创作面板块',
    'task-indicator': '任务状态块',
    banner: 'Banner 块',
  }

  return {
    blockKey,
    label: draftMap[blockKey],
    settings: {
      enabled: blockKey === 'title'
        ? workbench.titleEnabled !== false
        : blockKey === 'generator'
          ? workbench.generatorEnabled !== false
          : blockKey === 'task-indicator'
            ? workbench.taskIndicatorEnabled !== false
            : workbench.bannerEnabled !== false,
      showSiteName: workbench.showSiteName !== false,
      prefixText: String(workbench.prefixText || ''),
      suffixText: String(workbench.suffixText || ''),
      showModeSelectorInTitle: workbench.showModeSelectorInTitle !== false,
      showSubmitButton: workbench.showSubmitButton !== false,
      showSiteDescription: header.showSiteDescription !== false,
      placeholder: String(input.placeholder || ''),
      maxWidth: Number(input.maxWidth || 960),
    },
  }
}

const openWorkbenchContentDialog = (blockKey: WorkbenchContentBlockKey) => {
  editingWorkbenchContentDraft.value = createWorkbenchContentDraft(blockKey)
  workbenchContentDialogVisible.value = true
}

const closeWorkbenchContentDialog = () => {
  workbenchContentDialogVisible.value = false
  editingWorkbenchContentDraft.value = null
}

const submitWorkbenchContentDialog = () => {
  const draft = editingWorkbenchContentDraft.value
  if (!draft) return

  const workbench = systemForm.conversationSettings.entryDisplay.workbench
  const header = systemForm.homeLayoutSettings.header

  if (draft.blockKey === 'title') {
    Object.assign(workbench, {
      titleEnabled: draft.settings.enabled,
      showSiteName: draft.settings.showSiteName,
      prefixText: draft.settings.prefixText,
      suffixText: draft.settings.suffixText,
      showModeSelectorInTitle: draft.settings.showModeSelectorInTitle,
    })
  }

  if (draft.blockKey === 'generator') {
    Object.assign(workbench, {
      generatorEnabled: draft.settings.enabled,
      showSubmitButton: draft.settings.showSubmitButton,
    })
    Object.assign(systemForm.conversationSettings.entryDisplay.input, {
      placeholder: draft.settings.placeholder,
      maxWidth: Math.max(320, Math.min(1600, Number(draft.settings.maxWidth) || 960)),
    })
    header.showSiteDescription = draft.settings.showSiteDescription
  }

  if (draft.blockKey === 'task-indicator') {
    workbench.taskIndicatorEnabled = draft.settings.enabled
    header.showTaskIndicator = draft.settings.enabled
  }

  if (draft.blockKey === 'banner') {
    workbench.bannerEnabled = draft.settings.enabled
    header.showBanner = draft.settings.enabled
  }

  closeWorkbenchContentDialog()
}

const toggleWorkbenchContentVisibility = (blockKey: WorkbenchContentBlockKey) => {
  const workbench = systemForm.conversationSettings.entryDisplay.workbench
  const header = systemForm.homeLayoutSettings.header

  if (blockKey === 'title') {
    workbench.titleEnabled = !(workbench.titleEnabled !== false)
    return
  }

  if (blockKey === 'generator') {
    workbench.generatorEnabled = !(workbench.generatorEnabled !== false)
    return
  }

  if (blockKey === 'task-indicator') {
    const nextVisible = !(workbench.taskIndicatorEnabled !== false)
    workbench.taskIndicatorEnabled = nextVisible
    header.showTaskIndicator = nextVisible
    return
  }

  const nextVisible = !(workbench.bannerEnabled !== false)
  workbench.bannerEnabled = nextVisible
  header.showBanner = nextVisible
}

const handleWorkbenchContentAction = ({ action, blockKey }: { action: WorkbenchMenuActionKey, blockKey: WorkbenchContentBlockKey }) => {
  if (action === 'edit') {
    openWorkbenchContentDialog(blockKey)
    return
  }

  if (action === 'visible') {
    toggleWorkbenchContentVisibility(blockKey)
  }
}

const normalizeBannerSortOrder = () => {
  systemForm.homeLayoutSettings.banner.items = systemForm.homeLayoutSettings.banner.items.map((item, index) => ({
    ...item,
    sortOrder: (index + 1) * 10,
  }))
}

const createBannerItemDraft = (bannerKey: string): ThemeBannerItemDialogDraft | null => {
  const items = systemForm.homeLayoutSettings.banner.items
  const index = items.findIndex(item => item.key === bannerKey)
  if (index < 0) {
    return null
  }

  return {
    ...items[index],
    index,
  }
}

const openBannerItemDialog = (bannerKey: string) => {
  const draft = createBannerItemDraft(bannerKey)
  if (!draft) return
  editingBannerItemDraft.value = draft
  bannerItemDialogVisible.value = true
}

const closeBannerItemDialog = () => {
  bannerItemDialogVisible.value = false
  editingBannerItemDraft.value = null
}

const submitBannerItemDialog = () => {
  const draft = editingBannerItemDraft.value
  if (!draft) return

  const currentItem = systemForm.homeLayoutSettings.banner.items[draft.index]
  if (!currentItem) {
    closeBannerItemDialog()
    return
  }

  systemForm.homeLayoutSettings.banner.items.splice(draft.index, 1, {
    ...currentItem,
    key: String(draft.key || currentItem.key).trim() || currentItem.key,
    title: String(draft.title || '').trim(),
    subtitle: String(draft.subtitle || '').trim(),
    imageSource: draft.imageSource,
    presetKey: draft.presetKey,
    imageUrl: String(draft.imageUrl || '').trim(),
    backgroundImageUrl: String(draft.backgroundImageUrl || '').trim(),
    mainImageUrl: String(draft.mainImageUrl || '').trim(),
    overlayImageUrl: String(draft.overlayImageUrl || '').trim(),
    glowColor: String(draft.glowColor || '').trim() || '#2FE3FF',
    actionType: draft.actionType,
    actionValue: String(draft.actionValue || '').trim(),
    visible: draft.visible !== false,
  })

  normalizeBannerSortOrder()
  closeBannerItemDialog()
}

const toggleBannerItemVisible = (bannerKey: string) => {
  const item = systemForm.homeLayoutSettings.banner.items.find(current => current.key === bannerKey)
  if (!item) return
  item.visible = item.visible === false
}

const reorderBannerItem = (payload: { sourceBannerKey: string, targetBannerKey: string, position: 'before' | 'after' }) => {
  const items = [...systemForm.homeLayoutSettings.banner.items]
  const sourceIndex = items.findIndex(item => item.key === payload.sourceBannerKey)
  const targetIndex = items.findIndex(item => item.key === payload.targetBannerKey)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return
  }

  const [currentItem] = items.splice(sourceIndex, 1)
  const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  const insertIndex = payload.position === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex
  items.splice(insertIndex, 0, currentItem)
  systemForm.homeLayoutSettings.banner.items = items
  normalizeBannerSortOrder()
}

const handleBannerItemAction = ({ action, bannerKey }: { action: WorkbenchMenuActionKey, bannerKey: string }) => {
  if (action === 'edit') {
    openBannerItemDialog(bannerKey)
    return
  }

  if (action === 'visible') {
    toggleBannerItemVisible(bannerKey)
  }
}

const handleBannerItemReorder = (payload: { sourceBannerKey: string, targetBannerKey: string, position: 'before' | 'after' }) => {
  reorderBannerItem(payload)
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
