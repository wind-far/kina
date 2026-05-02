import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import type {
  SystemConfigPayload,
  SystemHomeBannerItemConfig,
  SystemHomeSideMenuGroupConfig,
  SystemHomeSideMenuItemConfig,
} from '@/api/system-config'

export const HOME_BANNER_PRESET_OPTIONS: Array<{ value: SystemHomeBannerItemConfig['presetKey'], label: string }> = [
  { value: 'motion', label: '动作模仿默认图' },
  { value: 'image', label: '图片生成默认图' },
  { value: 'video', label: '视频生成默认图' },
  { value: 'digital-human', label: '数字人默认图' },
  { value: 'agent', label: 'Agent 默认图' },
]

const DEFAULT_CENTER_GROUP_KEY = 'group-center-main'
const DEFAULT_BOTTOM_GROUP_KEY = 'group-bottom-system'

const createFallbackGroups = (): SystemHomeSideMenuGroupConfig[] => ([
  {
    key: DEFAULT_CENTER_GROUP_KEY,
    title: '主菜单',
    section: 'center',
    visible: true,
    sortOrder: 10,
  },
  {
    key: DEFAULT_BOTTOM_GROUP_KEY,
    title: '底部功能',
    section: 'bottom',
    visible: true,
    sortOrder: 20,
  },
])

export function useAdminLayoutConfig(systemForm: SystemConfigPayload) {
  const ensureHomeSideMenuGroups = () => {
    if (!Array.isArray(systemForm.homeSideMenuSettings.groups) || systemForm.homeSideMenuSettings.groups.length === 0) {
      systemForm.homeSideMenuSettings.groups = createFallbackGroups()
    }

    systemForm.homeSideMenuSettings.items = systemForm.homeSideMenuSettings.items.map(item => ({
      ...item,
      groupKey: item.section === 'center'
        ? (item.groupKey || DEFAULT_CENTER_GROUP_KEY)
        : item.section === 'bottom'
          ? (item.groupKey || DEFAULT_BOTTOM_GROUP_KEY)
          : '',
    }))
  }

  ensureHomeSideMenuGroups()

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

  const homeBannerStatus = computed(() => {
    const switchText = systemForm.homeLayoutSettings.banner.enabled ? '总开关开启' : '总开关关闭'
    return `${switchText} · ${visibleHomeBannerCount.value}/${systemForm.homeLayoutSettings.banner.items.length} 可见 · 首屏三层图 ${primaryBannerLayerConfiguredCount.value}/3`
  })

  const normalizedMenuGroups = computed(() => {
    ensureHomeSideMenuGroups()
    return [...systemForm.homeSideMenuSettings.groups]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(group => ({
        ...group,
        items: [...systemForm.homeSideMenuSettings.items]
          .filter(item => item.section === group.section && item.groupKey === group.key)
          .sort((left, right) => left.sortOrder - right.sortOrder),
      }))
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
    ensureHomeSideMenuGroups()
    systemForm.homeSideMenuSettings.groups = systemForm.homeSideMenuSettings.groups
      .map((group, index) => ({
        ...group,
        sortOrder: (index + 1) * 10,
      }))

    const itemsByGroup = new Map<string, SystemHomeSideMenuItemConfig[]>()
    for (const item of systemForm.homeSideMenuSettings.items) {
      const list = itemsByGroup.get(item.groupKey) || []
      list.push(item)
      itemsByGroup.set(item.groupKey, list)
    }

    const normalizedItems: SystemHomeSideMenuItemConfig[] = []
    const topItems = systemForm.homeSideMenuSettings.items
      .filter(item => item.section === 'top')
      .map((item, index): SystemHomeSideMenuItemConfig => ({
        ...item,
        groupKey: '',
        iconType: item.iconSource === 'custom' ? 'image' : 'system',
        sortOrder: (index + 1) * 10,
      }))

    normalizedItems.push(...topItems)

    for (const group of [...systemForm.homeSideMenuSettings.groups].sort((left, right) => left.sortOrder - right.sortOrder)) {
      const groupItems = (itemsByGroup.get(group.key) || [])
        .map((item, index): SystemHomeSideMenuItemConfig => ({
          ...item,
          section: group.section,
          groupKey: group.key,
          iconType: item.iconSource === 'custom' ? 'image' : 'system',
          sortOrder: (index + 1) * 10,
        }))
      normalizedItems.push(...groupItems)
    }

    systemForm.homeSideMenuSettings.items = normalizedItems
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

  const moveMenuGroup = (groupKey: string, offset: number) => {
    ensureHomeSideMenuGroups()
    const index = systemForm.homeSideMenuSettings.groups.findIndex(group => group.key === groupKey)
    const targetIndex = index + offset
    if (index < 0 || targetIndex < 0 || targetIndex >= systemForm.homeSideMenuSettings.groups.length) {
      return
    }

    const nextGroups = [...systemForm.homeSideMenuSettings.groups]
    const [currentGroup] = nextGroups.splice(index, 1)
    nextGroups.splice(targetIndex, 0, currentGroup)
    systemForm.homeSideMenuSettings.groups = nextGroups
    normalizeHomeSideMenuSortOrder()
  }

  const moveMenuItemWithinGroup = (groupKey: string, itemKey: string, offset: number) => {
    const group = normalizedMenuGroups.value.find(item => item.key === groupKey)
    if (!group) {
      return
    }

    const index = group.items.findIndex(item => item.key === itemKey)
    const targetIndex = index + offset
    if (index < 0 || targetIndex < 0 || targetIndex >= group.items.length) {
      return
    }

    const nextItems = [...group.items]
    const [currentItem] = nextItems.splice(index, 1)
    nextItems.splice(targetIndex, 0, currentItem)

    const reorderedGroupItems = nextItems.map((item, itemIndex): SystemHomeSideMenuItemConfig => ({
      ...item,
      sortOrder: (itemIndex + 1) * 10,
      section: group.section,
      groupKey: group.key,
      iconType: item.iconSource === 'custom' ? 'image' : 'system',
    }))

    const untouchedItems = systemForm.homeSideMenuSettings.items.filter(item => item.groupKey !== groupKey)
    systemForm.homeSideMenuSettings.items = [...untouchedItems, ...reorderedGroupItems]
  }

  const reorderMenuItemWithinGroup = (
    groupKey: string,
    sourceItemKey: string,
    targetItemKey: string,
    position: 'before' | 'after' = 'before',
  ) => {
    const group = normalizedMenuGroups.value.find(item => item.key === groupKey)
    if (!group) {
      return
    }

    const sourceIndex = group.items.findIndex(item => item.key === sourceItemKey)
    const targetIndex = group.items.findIndex(item => item.key === targetItemKey)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return
    }

    const nextItems = [...group.items]
    const [currentItem] = nextItems.splice(sourceIndex, 1)
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    const insertIndex = position === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex
    nextItems.splice(insertIndex, 0, currentItem)

    const reorderedGroupItems = nextItems.map((item, itemIndex): SystemHomeSideMenuItemConfig => ({
      ...item,
      sortOrder: (itemIndex + 1) * 10,
      section: group.section,
      groupKey: group.key,
      iconType: item.iconSource === 'custom' ? 'image' : 'system',
    }))

    const untouchedItems = systemForm.homeSideMenuSettings.items.filter(item => item.groupKey !== groupKey)
    systemForm.homeSideMenuSettings.items = [...untouchedItems, ...reorderedGroupItems]
  }

  const appendMenuGroup = (section: 'center' | 'bottom') => {
    ensureHomeSideMenuGroups()
    const nextIndex = systemForm.homeSideMenuSettings.groups.filter(group => group.section === section).length + 1
    systemForm.homeSideMenuSettings.groups.push({
      key: `group-${section}-${Date.now()}`,
      title: section === 'center' ? `主菜单组 ${nextIndex}` : `底部功能组 ${nextIndex}`,
      section,
      visible: true,
      sortOrder: systemForm.homeSideMenuSettings.groups.length * 10 + 10,
    })
    normalizeHomeSideMenuSortOrder()
  }

  const updateMenuGroup = (groupKey: string, payload: Partial<SystemHomeSideMenuGroupConfig>) => {
    const target = systemForm.homeSideMenuSettings.groups.find(group => group.key === groupKey)
    if (!target) {
      return
    }

    Object.assign(target, payload)
    normalizeHomeSideMenuSortOrder()
  }

  const removeMenuGroup = (groupKey: string) => {
    if (systemForm.homeSideMenuSettings.groups.length <= 1) {
      ElMessage.warning('至少保留一个导航分组')
      return
    }

    const target = systemForm.homeSideMenuSettings.groups.find(group => group.key === groupKey)
    if (!target) {
      return
    }

    const fallbackGroup = systemForm.homeSideMenuSettings.groups.find(group => group.section === target.section && group.key !== groupKey)
    if (!fallbackGroup) {
      ElMessage.warning(`请先在${getMenuSectionLabel(target.section)}创建至少一个备用分组`)
      return
    }

    systemForm.homeSideMenuSettings.items = systemForm.homeSideMenuSettings.items.map(item => {
      if (item.groupKey === groupKey) {
        return {
          ...item,
          groupKey: fallbackGroup.key,
          section: fallbackGroup.section,
        }
      }
      return item
    })
    systemForm.homeSideMenuSettings.groups = systemForm.homeSideMenuSettings.groups.filter(group => group.key !== groupKey)
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
    homeBannerStatus,
    normalizedMenuGroups,
    ensureHomeSideMenuGroups,
    getMenuSectionLabel,
    scrollToLayoutSection,
    moveHomeSideMenuItem,
    moveMenuGroup,
    moveMenuItemWithinGroup,
    reorderMenuItemWithinGroup,
    appendMenuGroup,
    updateMenuGroup,
    removeMenuGroup,
    triggerMenuIconUpload,
    handleMenuIconFileChange,
    clearMenuIcon,
    appendHomeBannerItem,
    moveHomeBannerItem,
    removeHomeBannerItem,
  }
}
