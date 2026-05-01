import { computed } from 'vue'
import { useSystemSettingsStore } from '@/stores/system-settings'

export const useHomeSideMenuConfig = () => {
  const { publicSystemSettings } = useSystemSettingsStore()

  const sideMenuSettings = computed(() => publicSystemSettings.value.homeSideMenuSettings)

  const sortedItems = computed(() => {
    return [...(sideMenuSettings.value.items || [])].sort((left, right) => left.sortOrder - right.sortOrder)
  })

  const topItems = computed(() => sortedItems.value.filter(item => item.section === 'top' && item.visible))
  const centerItems = computed(() => sortedItems.value.filter(item => item.section === 'center' && item.visible))
  const bottomItems = computed(() => sortedItems.value.filter(item => item.section === 'bottom' && item.visible))

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
