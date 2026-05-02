import { computed, ref } from 'vue'
import type { SystemHomeSideMenuItemConfig } from '@/api/system-config'

interface UseAdminThemeMenuEditorOptions {
  getItems: () => SystemHomeSideMenuItemConfig[]
  handleMenuIconFileChange: (
    event: Event,
    item: SystemHomeSideMenuItemConfig,
    state: 'inactive' | 'active',
  ) => void | Promise<void>
  clearMenuIcon: (item: SystemHomeSideMenuItemConfig, state: 'inactive' | 'active') => void
}

const createMenuItemDraft = (item: SystemHomeSideMenuItemConfig): SystemHomeSideMenuItemConfig => ({
  key: item.key,
  title: item.title,
  section: item.section,
  groupKey: item.groupKey,
  iconSource: item.iconSource,
  iconType: item.iconType,
  icon: item.icon,
  inactiveIconUrl: item.inactiveIconUrl,
  activeIconUrl: item.activeIconUrl,
  visible: item.visible,
  badgeText: item.badgeText,
  badgeTone: item.badgeTone,
  actionType: item.actionType,
  actionValue: item.actionValue,
  sortOrder: item.sortOrder,
})

export function useAdminThemeMenuEditor(options: UseAdminThemeMenuEditorOptions) {
  const menuItemDialogVisible = ref(false)
  const editingMenuItemIndex = ref(-1)
  const editingMenuItemDraft = ref<SystemHomeSideMenuItemConfig | null>(null)
  const deleteMenuItemDialogVisible = ref(false)
  const pendingDeleteMenuItemKey = ref('')

  const openMenuItemDialog = (menuKey: string) => {
    const items = options.getItems()
    const index = items.findIndex(item => item.key === menuKey)
    if (index < 0) return
    const target = items[index]
    editingMenuItemIndex.value = index
    editingMenuItemDraft.value = createMenuItemDraft(target)
    menuItemDialogVisible.value = true
  }

  const closeMenuItemDialog = () => {
    menuItemDialogVisible.value = false
    editingMenuItemIndex.value = -1
    editingMenuItemDraft.value = null
  }

  const submitMenuItemDialog = () => {
    const items = options.getItems()
    if (!editingMenuItemDraft.value || editingMenuItemIndex.value < 0) {
      closeMenuItemDialog()
      return
    }

    const target = items[editingMenuItemIndex.value]
    if (!target) {
      closeMenuItemDialog()
      return
    }

    Object.assign(target, createMenuItemDraft(editingMenuItemDraft.value))
    closeMenuItemDialog()
  }

  const triggerEditingMenuIconUpload = (state: 'inactive' | 'active') => {
    if (typeof document === 'undefined') return
    const input = document.getElementById(`theme-menu-item-dialog-icon-${state}`) as HTMLInputElement | null
    input?.click()
  }

  const handleEditingMenuIconFileChange = async (event: Event, state: 'inactive' | 'active') => {
    if (!editingMenuItemDraft.value) return
    await options.handleMenuIconFileChange(event, editingMenuItemDraft.value, state)
  }

  const clearEditingMenuIcon = (state: 'inactive' | 'active') => {
    if (!editingMenuItemDraft.value) return
    options.clearMenuIcon(editingMenuItemDraft.value, state)
  }

  const toggleMenuItemVisible = (menuKey: string) => {
    const items = options.getItems()
    const index = items.findIndex(item => item.key === menuKey)
    if (index < 0) return
    const target = items[index]
    items.splice(index, 1, {
      ...target,
      visible: !target.visible,
    })
  }

  const requestRemoveMenuItem = (menuKey: string) => {
    const target = options.getItems().find(item => item.key === menuKey)
    if (!target) return
    pendingDeleteMenuItemKey.value = menuKey
    deleteMenuItemDialogVisible.value = true
  }

  const closeDeleteMenuItemDialog = () => {
    deleteMenuItemDialogVisible.value = false
    pendingDeleteMenuItemKey.value = ''
  }

  const deleteMenuItemLabel = computed(() => {
    const target = options.getItems().find(item => item.key === pendingDeleteMenuItemKey.value)
    return target?.title || target?.key || ''
  })

  const confirmRemoveMenuItem = () => {
    const menuKey = pendingDeleteMenuItemKey.value
    const items = options.getItems()
    const index = items.findIndex(item => item.key === menuKey)
    if (index < 0) {
      closeDeleteMenuItemDialog()
      return
    }
    items.splice(index, 1)
    if (editingMenuItemDraft.value?.key === menuKey) {
      closeMenuItemDialog()
    }
    closeDeleteMenuItemDialog()
  }

  return {
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
  }
}
