import { computed } from 'vue'
import { useSystemSettingsStore } from '@/stores/system-settings'

// 统一封装首页头部与 Banner 的公共布局配置，避免多个组件各自读取系统设置。
export const useHomeLayoutConfig = () => {
  const { publicSystemSettings } = useSystemSettingsStore()

  const homeLayoutSettings = computed(() => publicSystemSettings.value.homeLayoutSettings)
  const headerSettings = computed(() => homeLayoutSettings.value.header)
  const bannerSettings = computed(() => homeLayoutSettings.value.banner)

  const bannerItems = computed(() => {
    return [...(bannerSettings.value.items || [])]
      .filter(item => item.visible)
      .sort((left, right) => left.sortOrder - right.sortOrder)
  })

  const bannerGridStyle = computed(() => {
    const itemCount = bannerItems.value.length
    if (itemCount <= 1) {
      return {
        '--banner-grid': '1fr',
      }
    }

    return {
      '--banner-grid': `1.53fr repeat(${Math.max(0, itemCount - 1)}, 1fr)`,
    }
  })

  return {
    homeLayoutSettings,
    headerSettings,
    bannerSettings,
    bannerItems,
    bannerGridStyle,
  }
}
