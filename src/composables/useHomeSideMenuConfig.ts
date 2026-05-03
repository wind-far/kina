import { computed, unref, type MaybeRef } from 'vue'
import { useSystemSettingsStore } from '@/stores/system-settings'
import type { SystemHomeSideMenuSettingsConfig } from '@/api/system-config'

export const useHomeSideMenuConfig = (options?: {
  settingsOverride?: MaybeRef<SystemHomeSideMenuSettingsConfig | null | undefined>
  includeHidden?: boolean
}) => {
  const { publicSystemSettings } = useSystemSettingsStore()

  const sideMenuSettings = computed(() => {
    return unref(options?.settingsOverride) || publicSystemSettings.value.homeSideMenuSettings
  })

  const sortedItems = computed(() => {
    return [...(sideMenuSettings.value.items || [])].sort((left, right) => left.sortOrder - right.sortOrder)
  })

  const shouldIncludeItem = (visible?: boolean) => {
    if (options?.includeHidden) {
      return true
    }
    return visible
  }

  const topItems = computed(() => sortedItems.value.filter(item => item.section === 'top' && shouldIncludeItem(item.visible)))
  const centerItems = computed(() => sortedItems.value.filter(item => item.section === 'center' && shouldIncludeItem(item.visible)))
  const bottomItems = computed(() => sortedItems.value.filter(item => item.section === 'bottom' && shouldIncludeItem(item.visible)))

  const sideMenuStyleVars = computed(() => {
    const settings = sideMenuSettings.value
    const width = settings.enabled === false ? 0 : settings.collapsedWidth

    return {
      '--side-menu-width': `${width}px`,
      '--side-drawer-width': `${settings.drawerWidth}px`,
      '--side-drawer-float-limit-width': `${settings.drawerFloatLimitWidth}px`,
    }
  })

  return {
    sideMenuSettings,
    topItems,
    centerItems,
    bottomItems,
    sideMenuStyleVars,
  }
}
