<template>
  <div class="admin-theme-front-menu-preview" :style="styleVars">
    <div class="admin-theme-front-menu-preview__frame sideMenu dreamina-side-menu-container side-menu visible-DXQYqc">
      <div v-if="showTopMenu && topItem" role="menu" class="lv-menu lv-menu-light lv-menu-vertical topMenu">
        <div class="lv-menu-inner">
        <div
          tabindex="0"
          role="menuitem"
          class="lv-menu-item lv-menu-item-size-default admin-theme-front-menu-preview__item-shell"
          :class="{
            'is-hidden-item': !topItem.visible,
            'is-dragging': draggingMenuKey === topItem.key,
            'is-drop-target': dropTargetMenuKey === topItem.key,
            'is-drop-before': dropTargetMenuKey === topItem.key && dropPosition === 'before',
            'is-drop-after': dropTargetMenuKey === topItem.key && dropPosition === 'after',
            'is-settling': settlingMenuKey === topItem.key,
          }"
          id="Logo"
          :data-menu-key="topItem.key"
          :data-menu-section="topItem.section"
          :data-menu-group-key="topItem.groupKey || ''"
          @pointerdown="handlePointerStart($event, topItem)"
        >
            <div class="admin-theme-front-menu-preview__item-main">
              <div class="container-aVP6Vy">
                <img
                  v-if="resolvedSiteLogoUrl"
                  :src="resolvedSiteLogoUrl"
                  class="side-menu-logo-image"
                  :alt="resolvedSiteName"
                >
                <div v-else class="side-menu-logo-fallback">
                  <HomeSideMenuIcon
                    :icon-key="topItem.icon"
                    :icon-source="topItem.iconSource"
                    :inactive-icon-url="topItem.inactiveIconUrl"
                    :active-icon-url="topItem.activeIconUrl"
                    :active="topItem.key === activeMenuKey"
                  />
                </div>
              </div>
              <span v-if="!topItem.visible" class="admin-theme-front-menu-preview__hidden-badge">已隐藏</span>
            </div>
            <div class="admin-theme-front-menu-preview__row-actions">
              <AdminThemeWorkbenchItemActions
                :visible="topItem.visible"
                :sort-armed="dragArmedMenuKey === topItem.key"
                @sort-press="handleSortPress($event, topItem)"
                @action="handleAction($event, topItem.key, topItem)"
              />
            </div>
          </div>
        </div>
      </div>

    <div v-if="showCenterMenu" role="menu" class="lv-menu lv-menu-light lv-menu-vertical centerMenu">
      <div class="lv-menu-inner center-menu-groups">
        <div v-for="group in centerGroups" :key="group.key" class="center-menu-group">
          <div
            v-for="item in group.items"
            :key="item.key"
            tabindex="0"
            role="menuitem"
            :class="[
              'lv-menu-item',
              'lv-menu-item-size-default',
              'admin-theme-front-menu-preview__item-shell',
              {
                'lv-menu-selected': item.key === activeMenuKey,
                'is-hidden-item': !item.visible,
                'is-dragging': draggingMenuKey === item.key,
                'is-drop-target': dropTargetMenuKey === item.key,
                'is-drop-before': dropTargetMenuKey === item.key && dropPosition === 'before',
                'is-drop-after': dropTargetMenuKey === item.key && dropPosition === 'after',
                'is-settling': settlingMenuKey === item.key,
              },
            ]"
            :data-menu-key="item.key"
            :data-menu-section="item.section"
            :data-menu-group-key="item.groupKey || ''"
            @pointerdown="handlePointerStart($event, item)"
          >
            <div class="admin-theme-front-menu-preview__item-main">
              <div class="icon-container" style="--menu-icon-size:48px">
                <div :class="item.key === 'generate' ? 'container-juKD6_' : ''">
                  <div :class="['content-XAjJup', { 'active-E3Q3lq': item.key === activeMenuKey }]">
                    <div :class="['icon-menu', { 'active-aFuBWS': item.key === activeMenuKey }]">
                      <div class="icon-wrap-tBuhBU hide-itzP3D sf-hidden">
                        <HomeSideMenuIcon
                          :icon-key="item.icon"
                          :icon-source="item.iconSource"
                          :inactive-icon-url="item.inactiveIconUrl"
                          :active-icon-url="item.activeIconUrl"
                          :active="true"
                        />
                      </div>
                      <div class="icon-wrap-tBuhBU">
                        <HomeSideMenuIcon
                          :icon-key="item.icon"
                          :icon-source="item.iconSource"
                          :inactive-icon-url="item.inactiveIconUrl"
                          :active-icon-url="item.activeIconUrl"
                          :active="item.key === activeMenuKey"
                        />
                      </div>
                    </div>
                    <div class="lv-typography text-HLQFZY">{{ item.title }}</div>
                  </div>
                  <span v-if="item.badgeText" class="badge-wrapper">{{ item.badgeText }}</span>
                  <span v-else-if="item.key === 'generate'" class="badge-wrapper"></span>
                </div>
              </div>
              <span v-if="!item.visible" class="admin-theme-front-menu-preview__hidden-badge">已隐藏</span>
            </div>
            <div class="admin-theme-front-menu-preview__row-actions">
              <AdminThemeWorkbenchItemActions
                :visible="item.visible"
                :sort-armed="dragArmedMenuKey === item.key"
                @sort-press="handleSortPress($event, item)"
                @action="handleAction($event, item.key, item)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showBottomMenu" role="menu" class="lv-menu lv-menu-light lv-menu-vertical bottomMenu login-menu-wrapper">
      <div class="lv-menu-inner bottom-menu-groups">
        <div v-for="group in bottomGroups" :key="group.key" class="bottom-menu-group">
          <template v-for="item in group.items" :key="item.key">
            <div
              v-if="item.key === 'marketing'"
              tabindex="0"
              role="menuitem"
              :class="[
                'lv-menu-item',
                'lv-menu-item-size-default',
                'credit-display-menu-container',
                'admin-theme-front-menu-preview__item-shell',
                {
                  'is-dragging': draggingMenuKey === item.key,
                  'is-hidden-item': !item.visible,
                  'is-drop-target': dropTargetMenuKey === item.key,
                  'is-drop-before': dropTargetMenuKey === item.key && dropPosition === 'before',
                  'is-drop-after': dropTargetMenuKey === item.key && dropPosition === 'after',
                  'is-settling': settlingMenuKey === item.key,
                },
              ]"
              :data-menu-key="item.key"
              :data-menu-section="item.section"
              :data-menu-group-key="item.groupKey || ''"
              @pointerdown="handlePointerStart($event, item)"
            >
              <div class="admin-theme-front-menu-preview__item-main">
                <div class="credit-container-vI5rYU">
                  <div class="credit-display-container-EgNfse column-mode-GFlEE0">
                    <div class="credit-amount-container-SnxCra">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 25 24">
                        <path fill="currentColor" d="M22.044 12.695a.77.77 0 0 0-.596-.734c-4.688-1.152-7.18-3.92-7.986-9.924l-.006-.033a.573.573 0 0 0-1.137 0l-.007.033c-.805 6.004-3.298 8.772-7.986 9.924a.77.77 0 0 0-.596.734v.033a.82.82 0 0 0 .625.796c3.3.859 6.851 2.872 7.9 6.022.086.26.332.443.613.454h.037a.67.67 0 0 0 .614-.454c1.048-3.15 4.598-5.163 7.9-6.021a.82.82 0 0 0 .625-.797z"></path>
                      </svg>
                      <div class="credit-amount-text-H7jPQp column-mode-SHz9kD">105</div>
                    </div>
                    <div class="upgrade-text-JHUaIS column-mode-vnmqXA">{{ item.title || '会员中心' }}</div>
                  </div>
                </div>
              </div>
              <div class="admin-theme-front-menu-preview__row-actions">
                <AdminThemeWorkbenchItemActions
                  :visible="item.visible"
                  :sort-armed="dragArmedMenuKey === item.key"
                  @sort-press="handleSortPress($event, item)"
                  @action="handleAction($event, item.key, item)"
                />
              </div>
            </div>

            <div
              v-else-if="item.key === 'account-entry'"
              tabindex="0"
              role="menuitem"
              :class="[
                'lv-menu-item',
                'lv-menu-item-size-default',
                'admin-theme-front-menu-preview__item-shell',
                {
                  'is-dragging': draggingMenuKey === item.key,
                  'is-hidden-item': !item.visible,
                  'is-drop-target': dropTargetMenuKey === item.key,
                  'is-drop-before': dropTargetMenuKey === item.key && dropPosition === 'before',
                  'is-drop-after': dropTargetMenuKey === item.key && dropPosition === 'after',
                  'is-settling': settlingMenuKey === item.key,
                },
              ]"
              :data-menu-key="item.key"
              :data-menu-section="item.section"
              :data-menu-group-key="item.groupKey || ''"
              @pointerdown="handlePointerStart($event, item)"
            >
              <div class="admin-theme-front-menu-preview__item-main">
                <div class="icon-container" style="--menu-icon-size:40px">
                  <div class="login-button">{{ item.title || '登录' }}</div>
                </div>
              </div>
              <div class="admin-theme-front-menu-preview__row-actions">
                <AdminThemeWorkbenchItemActions
                  :visible="item.visible"
                  :sort-armed="dragArmedMenuKey === item.key"
                  @sort-press="handleSortPress($event, item)"
                  @action="handleAction($event, item.key, item)"
                />
              </div>
            </div>

            <div
              v-else-if="item.key === 'account'"
              tabindex="0"
              role="menuitem"
              :class="[
                'lv-menu-item',
                'lv-menu-item-size-default',
                'admin-theme-front-menu-preview__item-shell',
                {
                  'lv-menu-selected': item.key === activeMenuKey,
                  'is-hidden-item': !item.visible,
                  'is-dragging': draggingMenuKey === item.key,
                  'is-drop-target': dropTargetMenuKey === item.key,
                  'is-drop-before': dropTargetMenuKey === item.key && dropPosition === 'before',
                  'is-drop-after': dropTargetMenuKey === item.key && dropPosition === 'after',
                  'is-settling': settlingMenuKey === item.key,
                },
              ]"
              :data-menu-key="item.key"
              :data-menu-section="item.section"
              :data-menu-group-key="item.groupKey || ''"
              @pointerdown="handlePointerStart($event, item)"
            >
              <div class="admin-theme-front-menu-preview__item-main">
                <div class="avatar-container-Od1Q_g">
                  <div class="avatar-Y3FqeU">
                    <div style="width:100%;height:100%">
                      <div class="dreamina-component-avatar-container">
                        <div class="admin-theme-front-menu-preview__avatar"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="admin-theme-front-menu-preview__row-actions">
                <AdminThemeWorkbenchItemActions
                  :visible="item.visible"
                  :sort-armed="dragArmedMenuKey === item.key"
                  @sort-press="handleSortPress($event, item)"
                  @action="handleAction($event, item.key, item)"
                />
              </div>
            </div>

            <div
              v-else
              tabindex="0"
              role="menuitem"
              :class="[
                'lv-menu-item',
                'lv-menu-item-size-default',
                'admin-theme-front-menu-preview__item-shell',
                {
                  'lv-menu-selected': item.key === activeMenuKey,
                  'is-hidden-item': !item.visible,
                  'is-dragging': draggingMenuKey === item.key,
                  'is-drop-target': dropTargetMenuKey === item.key,
                  'is-drop-before': dropTargetMenuKey === item.key && dropPosition === 'before',
                  'is-drop-after': dropTargetMenuKey === item.key && dropPosition === 'after',
                  'is-settling': settlingMenuKey === item.key,
                },
              ]"
              :data-menu-key="item.key"
              :data-menu-section="item.section"
              :data-menu-group-key="item.groupKey || ''"
              @pointerdown="handlePointerStart($event, item)"
            >
              <div class="admin-theme-front-menu-preview__item-main">
                <div class="icon-container" style="--menu-icon-size:40px">
                  <div :class="resolveBottomContainerClass(item.key)">
                    <div :class="['content-XAjJup', { 'active-E3Q3lq': item.key === activeMenuKey }]">
                      <div :class="['icon-menu', { 'active-aFuBWS': item.key === activeMenuKey }]">
                        <div class="icon-wrap-tBuhBU hide-itzP3D sf-hidden">
                          <HomeSideMenuIcon
                            :icon-key="item.icon"
                            :icon-source="item.iconSource"
                            :inactive-icon-url="item.inactiveIconUrl"
                            :active-icon-url="item.activeIconUrl"
                            :active="true"
                          />
                        </div>
                        <div class="icon-wrap-tBuhBU">
                          <HomeSideMenuIcon
                            :icon-key="item.icon"
                            :icon-source="item.iconSource"
                            :inactive-icon-url="item.inactiveIconUrl"
                            :active-icon-url="item.activeIconUrl"
                            :active="item.key === activeMenuKey"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="admin-theme-front-menu-preview__row-actions">
                <AdminThemeWorkbenchItemActions
                  :visible="item.visible"
                  :sort-armed="dragArmedMenuKey === item.key"
                  @sort-press="handleSortPress($event, item)"
                  @action="handleAction($event, item.key, item)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import HomeSideMenuIcon from '@/components/home/components/HomeSideMenuIcon.vue'
import AdminThemeWorkbenchItemActions, { type WorkbenchMenuActionKey } from './AdminThemeWorkbenchItemActions.vue'
import type {
  SystemSiteInfoConfig,
  SystemHomeSideMenuGroupConfig,
  SystemHomeSideMenuItemConfig,
  SystemHomeSideMenuSettingsConfig,
} from '@/api/system-config'

interface MenuGroupView extends SystemHomeSideMenuGroupConfig {
  items: SystemHomeSideMenuItemConfig[]
}

const props = defineProps<{
  settings: SystemHomeSideMenuSettingsConfig
  siteInfo: SystemSiteInfoConfig
  activeMenuKey?: string
  topItem?: SystemHomeSideMenuItemConfig | null
  centerGroups: MenuGroupView[]
  bottomGroups: MenuGroupView[]
  toggleMenuVisibility?: (menuKey: string) => void
  applyMenuReorder?: (payload: { sourceMenuKey: string, targetMenuKey: string, position: 'before' | 'after' }) => void
}>()

const emit = defineEmits<{
  'menu-action': [payload: { action: WorkbenchMenuActionKey, menuKey: string }]
  'menu-reorder': [payload: { sourceMenuKey: string, targetMenuKey: string, position: 'before' | 'after' }]
}>()

const resolvedSiteLogoUrl = computed(() => String(props.siteInfo.siteLogoUrl || '').trim())
const resolvedSiteName = computed(() => String(props.siteInfo.siteName || 'Canana').trim() || 'Canana')
const showTopMenu = computed(() => props.settings.showTopMenu)
const showCenterMenu = computed(() => props.settings.showCenterMenu)
const showBottomMenu = computed(() => props.settings.showBottomMenu)
const dragArmedMenuKey = ref('')
const draggingMenuKey = ref('')
const dropTargetMenuKey = ref('')
const dropPosition = ref<'before' | 'after'>('before')
const settlingMenuKey = ref('')
let settlingTimer: ReturnType<typeof setTimeout> | null = null
let pointerSession: {
  pointerId: number
  sourceMenuKey: string
  startX: number
  startY: number
  activated: boolean
} | null = null

const POINTER_DRAG_THRESHOLD = 6

const styleVars = computed(() => ({
  '--side-menu-width': `${Math.min(Math.max(props.settings.collapsedWidth, 76), 96)}px`,
}))

const resolveBottomContainerClass = (key: string) => {
  const classMap: Record<string, string> = {
    notification: 'notice-y3FxAc',
    'app-download': 'trigger-JEmSlm',
    'api-entry': 'trigger-BIU_ST',
    settings: 'dropdown-trigger-ZZ27H7',
  }
  return classMap[key] || ''
}

const handleAction = (
  action: WorkbenchMenuActionKey,
  menuKey: string,
  item?: SystemHomeSideMenuItemConfig,
) => {
  if (action === 'visible') {
    if (props.toggleMenuVisibility) {
      props.toggleMenuVisibility(menuKey)
      return
    }
    if (item) {
      item.visible = !item.visible
    }
    return
  }
  emit('menu-action', { action, menuKey })
}

const startPointerSession = (event: PointerEvent, item: SystemHomeSideMenuItemConfig) => {
  if (event.button !== 0) {
    return
  }

  event.preventDefault()
  dragArmedMenuKey.value = item.key
  clearPointerSession()
  resetPointerDragState()
  pointerSession = {
    pointerId: event.pointerId,
    sourceMenuKey: item.key,
    startX: event.clientX,
    startY: event.clientY,
    activated: false,
  }
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerCancel)
}

const handleSortPress = (event: PointerEvent, item: SystemHomeSideMenuItemConfig) => {
  if (dragArmedMenuKey.value === item.key) {
    finishPointerDrag(false)
    return
  }

  startPointerSession(event, item)
}

const canReorder = (sourceItem: SystemHomeSideMenuItemConfig, targetItem: SystemHomeSideMenuItemConfig) => {
  return sourceItem.section === targetItem.section && sourceItem.groupKey === targetItem.groupKey
}

const allPreviewItems = computed(() => {
  const topItems = props.topItem ? [props.topItem] : []
  const centerItems = props.centerGroups.flatMap(group => group.items)
  const bottomItems = props.bottomGroups.flatMap(group => group.items)
  return [...topItems, ...centerItems, ...bottomItems]
})

const getPreviewItemByKey = (menuKey: string) => allPreviewItems.value.find(item => item.key === menuKey)

const resetPointerDragState = () => {
  draggingMenuKey.value = ''
  dropTargetMenuKey.value = ''
  dropPosition.value = 'before'
}

const removePointerListeners = () => {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerCancel)
}

const clearPointerSession = () => {
  pointerSession = null
  removePointerListeners()
}

const updateDropTargetByPoint = (clientX: number, clientY: number, sourceItem: SystemHomeSideMenuItemConfig) => {
  const rawElement = document.elementFromPoint(clientX, clientY)
  const targetElement = rawElement?.closest('[data-menu-key]') as HTMLElement | null
  const targetMenuKey = String(targetElement?.dataset.menuKey || '')

  if (!targetElement || !targetMenuKey || targetMenuKey === sourceItem.key) {
    dropTargetMenuKey.value = ''
    return
  }

  const targetItem = getPreviewItemByKey(targetMenuKey)
  if (!targetItem || !canReorder(sourceItem, targetItem)) {
    dropTargetMenuKey.value = ''
    return
  }

  const rect = targetElement.getBoundingClientRect()
  const isHorizontal = rect.width > rect.height * 1.25
  dropTargetMenuKey.value = targetMenuKey
  dropPosition.value = isHorizontal
    ? (clientX <= rect.left + rect.width / 2 ? 'before' : 'after')
    : (clientY <= rect.top + rect.height / 2 ? 'before' : 'after')
}

const applyResolvedReorder = (sourceMenuKey: string, targetMenuKey: string, position: 'before' | 'after') => {
  const payload = { sourceMenuKey, targetMenuKey, position } as const
  if (props.applyMenuReorder) {
    props.applyMenuReorder(payload)
  } else {
    emit('menu-reorder', payload)
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
    return
  }

  const sourceItem = getPreviewItemByKey(pointerSession.sourceMenuKey)
  if (!sourceItem) {
    resetPointerDragState()
    clearPointerSession()
    return
  }

  event.preventDefault()

  if (!pointerSession.activated) {
    const deltaX = event.clientX - pointerSession.startX
    const deltaY = event.clientY - pointerSession.startY
    if (Math.hypot(deltaX, deltaY) < POINTER_DRAG_THRESHOLD) {
      return
    }
    pointerSession.activated = true
    draggingMenuKey.value = pointerSession.sourceMenuKey
  }

  updateDropTargetByPoint(event.clientX, event.clientY, sourceItem)
}

const finishPointerDrag = (shouldCommit: boolean) => {
  const session = pointerSession
  const sourceMenuKey = session?.sourceMenuKey || ''
  const targetMenuKey = dropTargetMenuKey.value
  const canCommit = Boolean(
    shouldCommit
    && session?.activated
    && sourceMenuKey
    && targetMenuKey
    && sourceMenuKey !== targetMenuKey,
  )

  if (canCommit) {
    applyResolvedReorder(sourceMenuKey, targetMenuKey, dropPosition.value)
    startSettlingAnimation(sourceMenuKey)
  }

  dragArmedMenuKey.value = ''
  resetPointerDragState()
  clearPointerSession()
}

function handlePointerUp(event: PointerEvent) {
  if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
    return
  }

  event.preventDefault()
  finishPointerDrag(true)
}

function handlePointerCancel(event: PointerEvent) {
  if (!pointerSession || event.pointerId !== pointerSession.pointerId) {
    return
  }

  finishPointerDrag(false)
}

const handlePointerStart = (event: PointerEvent, item: SystemHomeSideMenuItemConfig) => {
  if (dragArmedMenuKey.value !== item.key) {
    return
  }

  if (event.button !== 0) {
    return
  }

  const target = event.target as HTMLElement | null
  const isActionArea = Boolean(target?.closest('.admin-theme-front-menu-preview__row-actions'))
  const isSortHandle = Boolean(target?.closest('.admin-theme-workbench-item-actions__button.is-drag'))
  if (isActionArea && !isSortHandle) {
    return
  }

  startPointerSession(event, item)
}

const startSettlingAnimation = (menuKey: string) => {
  settlingMenuKey.value = menuKey
  if (settlingTimer) {
    clearTimeout(settlingTimer)
  }
  settlingTimer = setTimeout(() => {
    settlingMenuKey.value = ''
    settlingTimer = null
  }, 320)
}

onBeforeUnmount(() => {
  if (settlingTimer) {
    clearTimeout(settlingTimer)
  }
  clearPointerSession()
})
</script>

<style scoped>
.admin-theme-front-menu-preview {
  position: relative;
  width: calc(var(--side-menu-width) + 152px);
  height: var(--admin-theme-side-preview-height, 1220px);
  min-height: var(--admin-theme-side-preview-height, 1220px);
  margin: 0 auto;
  overflow: visible;
}

.admin-theme-front-menu-preview__frame {
  position: relative;
  width: var(--side-menu-width);
  height: 100%;
  min-height: 100%;
  background: #111218;
  border-radius: 24px;
  overflow: visible;
}

.admin-theme-front-menu-preview :deep(.topMenu) {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  z-index: 8;
}

.admin-theme-front-menu-preview :deep(.centerMenu) {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  margin-top: 0;
  z-index: 18;
}

.admin-theme-front-menu-preview :deep(.bottomMenu) {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 18px;
  margin-top: 0;
  z-index: 8;
}

.admin-theme-front-menu-preview :deep(.lv-menu-inner) {
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: visible !important;
}


.admin-theme-front-menu-preview :deep(.lv-menu-item) {
  display: flex;
  justify-content: center;
  width: 100%;
  cursor: default;
}

.admin-theme-front-menu-preview :deep(.topMenu .lv-menu-item),
.admin-theme-front-menu-preview :deep(.centerMenu .lv-menu-item),
.admin-theme-front-menu-preview :deep(.bottomMenu .lv-menu-item) {
  margin-bottom: 12px;
  padding: 0;
  background: transparent;
}

.admin-theme-front-menu-preview :deep(.bottomMenu .lv-menu-item:last-child),
.admin-theme-front-menu-preview :deep(.centerMenu .lv-menu-item:last-child),
.admin-theme-front-menu-preview :deep(.topMenu .lv-menu-item:last-child) {
  margin-bottom: 0;
}

.admin-theme-front-menu-preview :deep(.centerMenu .lv-menu-item.lv-menu-selected),
.admin-theme-front-menu-preview :deep(.bottomMenu .lv-menu-item.lv-menu-selected) {
  background: transparent;
}

.side-menu-logo-image {
  display: block;
  max-width: 32px;
  max-height: 32px;
  object-fit: contain;
}

.side-menu-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--text-primary);
  font-size: 24px;
}

.admin-theme-front-menu-preview__avatar {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(180deg, #f4f5f8 0%, #d6dbe4 100%);
  position: relative;
}

.admin-theme-front-menu-preview__avatar::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 26%;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #a9b1be;
  transform: translateX(-50%);
}

.admin-theme-front-menu-preview__avatar::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 18%;
  width: 26px;
  height: 14px;
  border-radius: 14px 14px 8px 8px;
  background: #a9b1be;
  transform: translateX(-50%);
}

.center-menu-groups,
.bottom-menu-groups {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.center-menu-group,
.bottom-menu-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
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

.admin-theme-front-menu-preview :deep(.credit-display-menu-container) {
  margin-bottom: 14px;
}

.admin-theme-front-menu-preview__item-shell {
  position: relative;
  display: flex !important;
  align-items: center;
  justify-content: flex-start;
  width: var(--side-menu-width) !important;
  padding-right: 132px;
  box-sizing: content-box;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.admin-theme-front-menu-preview__item-shell:has(.admin-theme-workbench-item-actions__button.is-drag-armed) {
  cursor: grab;
}

.admin-theme-front-menu-preview__item-shell:has(.admin-theme-workbench-item-actions__button.is-drag-armed):active {
  cursor: grabbing;
}

.admin-theme-front-menu-preview__item-shell:has(.admin-theme-front-menu-preview__row-actions .admin-theme-workbench-item-actions__button.is-drag-armed) .admin-theme-front-menu-preview__item-main {
  filter: drop-shadow(0 0 0.6rem rgba(111, 53, 255, 0.26));
}

.admin-theme-front-menu-preview__item-shell.is-dragging {
  opacity: 0.42;
}

.admin-theme-front-menu-preview :deep(.lv-menu-item.is-hidden-item),
.admin-theme-front-menu-preview__item-shell.is-hidden-item {
  opacity: 0.48;
}

.admin-theme-front-menu-preview :deep(.lv-menu-item.is-hidden-item) .text-HLQFZY,
.admin-theme-front-menu-preview__item-shell.is-hidden-item :deep(.text-HLQFZY),
.admin-theme-front-menu-preview__item-shell.is-hidden-item .login-button,
.admin-theme-front-menu-preview__item-shell.is-hidden-item .upgrade-text-JHUaIS,
.admin-theme-front-menu-preview__item-shell.is-hidden-item .credit-amount-text-H7jPQp {
  color: rgba(255, 255, 255, 0.42) !important;
}

.admin-theme-front-menu-preview__item-shell.is-hidden-item .admin-theme-front-menu-preview__item-main,
.admin-theme-front-menu-preview :deep(.lv-menu-item.is-hidden-item .container-aVP6Vy) {
  filter: grayscale(0.28);
}

.admin-theme-front-menu-preview__item-shell.is-settling .admin-theme-front-menu-preview__item-main {
  animation: admin-theme-front-menu-preview-settle 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.admin-theme-front-menu-preview__item-shell.is-drop-target .admin-theme-front-menu-preview__item-main {
  position: relative;
}

.admin-theme-front-menu-preview__item-shell.is-drop-target .admin-theme-front-menu-preview__item-main::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px dashed rgba(111, 53, 255, 0.72);
  border-radius: 18px;
  box-shadow: 0 0 0 4px rgba(111, 53, 255, 0.12);
  pointer-events: none;
}

.admin-theme-front-menu-preview__item-shell.is-drop-before .admin-theme-front-menu-preview__item-main::before,
.admin-theme-front-menu-preview__item-shell.is-drop-after .admin-theme-front-menu-preview__item-main::before {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(111, 53, 255, 0.96), rgba(47, 227, 255, 0.96));
  box-shadow: 0 0 0 3px rgba(111, 53, 255, 0.12);
  pointer-events: none;
}

.admin-theme-front-menu-preview__item-shell.is-drop-before .admin-theme-front-menu-preview__item-main::before {
  top: -7px;
}

.admin-theme-front-menu-preview__item-shell.is-drop-after .admin-theme-front-menu-preview__item-main::before {
  bottom: -7px;
}

.admin-theme-front-menu-preview__item-main {
  width: var(--side-menu-width);
  min-width: var(--side-menu-width);
  display: flex;
  justify-content: center;
  position: relative;
}

.admin-theme-front-menu-preview__hidden-badge {
  position: absolute;
  top: -6px;
  right: 8px;
  min-height: 18px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255, 176, 32, 0.18);
  color: #ffd27a;
  font-size: 10px;
  font-weight: 700;
  line-height: 18px;
  letter-spacing: 0.02em;
  pointer-events: none;
}

.admin-theme-front-menu-preview__row-actions {
  position: absolute;
  top: 50%;
  left: calc(var(--side-menu-width) + 8px);
  transform: translateY(-50%);
  display: flex;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 12;
}

.admin-theme-front-menu-preview__item-shell:hover .admin-theme-front-menu-preview__row-actions,
.admin-theme-front-menu-preview__item-shell:focus-within .admin-theme-front-menu-preview__row-actions,
.admin-theme-front-menu-preview__item-shell:has(.admin-theme-workbench-item-actions__button.is-drag-armed) .admin-theme-front-menu-preview__row-actions,
.admin-theme-front-menu-preview__row-actions:hover,
.admin-theme-front-menu-preview__row-actions:focus-within {
  opacity: 1;
  pointer-events: auto;
  transform: translate(0, -50%);
}

@keyframes admin-theme-front-menu-preview-settle {
  0% {
    transform: translateX(18px) scale(0.97);
    filter: drop-shadow(0 0 0 rgba(111, 53, 255, 0));
  }
  55% {
    transform: translateX(-2px) scale(1.015);
    filter: drop-shadow(0 8px 18px rgba(111, 53, 255, 0.22));
  }
  100% {
    transform: translateX(0) scale(1);
    filter: drop-shadow(0 0 0 rgba(111, 53, 255, 0));
  }
}
</style>
