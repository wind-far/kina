import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import type {
  SystemConfigPayload,
  SystemHomeBannerItemConfig,
  SystemHomeSideMenuItemConfig,
} from '@/api/system-config'

export const HOME_BANNER_PRESET_OPTIONS: Array<{ value: SystemHomeBannerItemConfig['presetKey'], label: string }> = [
  { value: 'motion', label: '动作模仿默认图' },
  { value: 'image', label: '图片生成默认图' },
  { value: 'video', label: '视频生成默认图' },
  { value: 'digital-human', label: '数字人默认图' },
  { value: 'agent', label: 'Agent 默认图' },
]

export function useAdminLayoutConfig(systemForm: SystemConfigPayload) {
  const visibleHomeSideMenuCount = computed(() => {
    return systemForm.homeSideMenuSettings.items.filter(item => item.visible).length
  })

  const visibleHomeBannerCount = computed(() => {
    return systemForm.homeLayoutSettings.banner.items.filter(item => item.visible).length
  })

  const primaryBannerLayerConfiguredCount = computed(() => {
    const primaryBanner = systemForm.homeLayoutSettings.banner.items[0]
    if (!primaryBanner) {
      return 0
    }

    return [primaryBanner.backgroundImageUrl, primaryBanner.mainImageUrl, primaryBanner.overlayImageUrl]
      .filter(value => String(value || '').trim().length > 0)
      .length
  })

  const layoutEnabledSectionsLabel = computed(() => {
    return [
      systemForm.homeSideMenuSettings.showTopMenu ? '顶部' : '',
      systemForm.homeSideMenuSettings.showCenterMenu ? '中部' : '',
      systemForm.homeSideMenuSettings.showBottomMenu ? '底部' : '',
    ].filter(Boolean).join(' / ') || '全部关闭'
  })

  const homeSideMenuBaseStatus = computed(() => {
    const enabledText = systemForm.homeSideMenuSettings.enabled ? '菜单总开关已开启' : '菜单总开关已关闭'
    return `${enabledText} · 当前区块：${layoutEnabledSectionsLabel.value}`
  })

  const homeSideMenuItemsStatus = computed(() => {
    return `共 ${systemForm.homeSideMenuSettings.items.length} 项，当前显示 ${visibleHomeSideMenuCount.value} 项`
  })

  const homeHeaderStatus = computed(() => {
    const enabledItems = [
      systemForm.homeLayoutSettings.header.showSiteDescription ? '站点说明' : '',
      systemForm.homeLayoutSettings.header.showTaskIndicator ? '任务指示器' : '',
      systemForm.homeLayoutSettings.header.showBanner ? 'Banner 区域' : '',
    ].filter(Boolean)
    return enabledItems.length ? `已开启：${enabledItems.join(' / ')}` : '当前三个头部模块均已关闭'
  })

  const homeBannerStatus = computed(() => {
    const switchText = systemForm.homeLayoutSettings.banner.enabled ? '总开关开启' : '总开关关闭'
    return `${switchText} · ${visibleHomeBannerCount.value}/${systemForm.homeLayoutSettings.banner.items.length} 可见 · 首屏三层图 ${primaryBannerLayerConfiguredCount.value}/3`
  })

  const getMenuSectionLabel = (section: string) => {
    if (section === 'top') {
      return '顶部'
    }
    if (section === 'center') {
      return '中部'
    }
    if (section === 'bottom') {
      return '底部'
    }
    return section || '未设置'
  }

  const scrollToLayoutSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const normalizeHomeSideMenuSortOrder = () => {
    systemForm.homeSideMenuSettings.items = systemForm.homeSideMenuSettings.items.map((item, index) => ({
      ...item,
      iconType: item.iconSource === 'custom' ? 'image' : 'system',
      sortOrder: (index + 1) * 10,
    }))
  }

  const moveHomeSideMenuItem = (index: number, offset: number) => {
    const targetIndex = index + offset
    if (targetIndex < 0 || targetIndex >= systemForm.homeSideMenuSettings.items.length) {
      return
    }

    const nextItems = [...systemForm.homeSideMenuSettings.items]
    const [currentItem] = nextItems.splice(index, 1)
    nextItems.splice(targetIndex, 0, currentItem)
    systemForm.homeSideMenuSettings.items = nextItems
    normalizeHomeSideMenuSortOrder()
  }

  const triggerMenuIconUpload = (key: string, state: 'inactive' | 'active') => {
    const input = document.getElementById(`home-side-menu-icon-${key}-${state}`) as HTMLInputElement | null
    input?.click()
  }

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图标文件失败，请重试'))
    reader.readAsDataURL(file)
  })

  const handleMenuIconFileChange = async (
    event: Event,
    item: SystemHomeSideMenuItemConfig,
    state: 'inactive' | 'active',
  ) => {
    const target = event.target as HTMLInputElement | null
    const [file] = Array.from(target?.files || [])

    if (!file) {
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      item.iconSource = 'custom'
      item.iconType = 'image'
      if (state === 'inactive') {
        item.inactiveIconUrl = dataUrl
      } else {
        item.activeIconUrl = dataUrl
      }
    } catch (error: any) {
      ElMessage.error(error?.message || '图标上传失败')
    } finally {
      if (target) {
        target.value = ''
      }
    }
  }

  const clearMenuIcon = (item: SystemHomeSideMenuItemConfig, state: 'inactive' | 'active') => {
    if (state === 'inactive') {
      item.inactiveIconUrl = ''
      return
    }

    item.activeIconUrl = ''
  }

  const normalizeHomeBannerSortOrder = () => {
    systemForm.homeLayoutSettings.banner.items = systemForm.homeLayoutSettings.banner.items.map((item, index) => ({
      ...item,
      sortOrder: (index + 1) * 10,
    }))
  }

  const moveHomeBannerItem = (index: number, offset: number) => {
    const targetIndex = index + offset
    if (targetIndex < 0 || targetIndex >= systemForm.homeLayoutSettings.banner.items.length) {
      return
    }

    const nextItems = [...systemForm.homeLayoutSettings.banner.items]
    const [currentItem] = nextItems.splice(index, 1)
    nextItems.splice(targetIndex, 0, currentItem)
    systemForm.homeLayoutSettings.banner.items = nextItems
    normalizeHomeBannerSortOrder()
  }

  const appendHomeBannerItem = () => {
    const nextIndex = systemForm.homeLayoutSettings.banner.items.length + 1
    systemForm.homeLayoutSettings.banner.items.push({
      key: `banner-${Date.now()}`,
      title: `新 Banner ${nextIndex}`,
      subtitle: '补充横幅说明',
      imageSource: 'default',
      presetKey: 'image',
      imageUrl: '',
      backgroundImageUrl: '',
      mainImageUrl: '',
      overlayImageUrl: '',
      glowColor: '#2FE3FF',
      actionType: 'none',
      actionValue: '',
      visible: true,
      sortOrder: nextIndex * 10,
    })
  }

  const removeHomeBannerItem = (index: number) => {
    if (systemForm.homeLayoutSettings.banner.items.length <= 1) {
      ElMessage.warning('至少保留一个 Banner 项')
      return
    }

    systemForm.homeLayoutSettings.banner.items.splice(index, 1)
    normalizeHomeBannerSortOrder()
  }

  return {
    visibleHomeSideMenuCount,
    visibleHomeBannerCount,
    primaryBannerLayerConfiguredCount,
    layoutEnabledSectionsLabel,
    homeSideMenuBaseStatus,
    homeSideMenuItemsStatus,
    homeHeaderStatus,
    homeBannerStatus,
    getMenuSectionLabel,
    scrollToLayoutSection,
    moveHomeSideMenuItem,
    triggerMenuIconUpload,
    handleMenuIconFileChange,
    clearMenuIcon,
    appendHomeBannerItem,
    moveHomeBannerItem,
    removeHomeBannerItem,
  }
}
