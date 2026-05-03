<template>
  <AdminSystemLayoutPanel
    :form="form"
    :home-banner-preset-options="[...homeBannerPresetOptions]"
    :home-side-menu-base-status="homeSideMenuBaseStatus"
    :home-side-menu-items-status="homeSideMenuItemsStatus"
    :home-banner-status="homeBannerStatus"
    :on-submit="onSubmit"
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
    :external-action="externalAction"
  />
</template>

<script setup lang="ts">
import type { SystemConfigPayload, SystemHomeSideMenuItemConfig } from '@/api/system-config'
import AdminSystemLayoutPanel from '@/views/admin/system/components/AdminSystemLayoutPanel.vue'

type LayoutSectionKey = 'layout-side-menu' | 'layout-home-banner'

type ExternalLayoutAction =
  | { type: 'edit-menu-item', menuKey: string, stamp: number }
  | { type: 'add-menu-item', stamp: number }
  | { type: 'edit-banner-item', bannerKey: string, stamp: number }
  | { type: 'add-banner-item', stamp: number }
  | null

defineProps<{
  form: SystemConfigPayload
  homeBannerPresetOptions: ReadonlyArray<{ value: string, label: string }>
  homeSideMenuBaseStatus: string
  homeSideMenuItemsStatus: string
  homeBannerStatus: string
  onSubmit: () => void | Promise<void>
  scrollToLayoutSection: (sectionId: string) => void
  getMenuSectionLabel: (section: string) => string
  moveHomeSideMenuItem: (index: number, offset: number) => void
  triggerMenuIconUpload: (key: string, state: 'inactive' | 'active') => void
  handleMenuIconFileChange: (
    event: Event,
    item: SystemHomeSideMenuItemConfig,
    state: 'inactive' | 'active',
  ) => void | Promise<void>
  clearMenuIcon: (item: SystemHomeSideMenuItemConfig, state: 'inactive' | 'active') => void
  appendHomeBannerItem: () => void
  moveHomeBannerItem: (index: number, offset: number) => void
  removeHomeBannerItem: (index: number) => void
  activeLayoutSection: LayoutSectionKey
  externalAction: ExternalLayoutAction
}>()
</script>
