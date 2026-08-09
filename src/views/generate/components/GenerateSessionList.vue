<template>
  <div class="record-list-container">
    <div class="record-list record-virtual-list">
      <div class="virtual-list-container reverse-virtual-list">
        <div class="scroll-container-j7wUS8" style="height:100%">
          <div ref="scrollContainerRef" class="virtual-list" style="height:100%">
            <div
              :id="scrollListId"
              class="scroll-list"
            >
              <slot />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="filter-mask"></div>
    <div class="filter-container filter">
      <div class="container-ufW1eH collapsed-HB97Ck">
        <div class="lv-input-group-wrapper lv-input-group-wrapper-default search-input-ZwhOpf">
          <span class="lv-input-group">
            <span class="lv-input-inner-wrapper lv-input-inner-wrapper-has-prefix lv-input-inner-wrapper-default lv-input-clear-wrapper">
              <span class="lv-input-group-prefix">
                <svg
                  class="search-icon-rvzopq search-icon-interactive"
                  fill="none"
                  height="1em"
                  preserveAspectRatio="xMidYMid meet"
                  role="presentation"
                  viewBox="0 0 24 24"
                  width="1em"
                  xmlns="http://www.w3.org/2000/svg"
                  @click="emit('search')"
                >
                  <g>
                    <path
                      clip-rule="evenodd"
                      d="M4.563 10.75a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Zm6.5-8.5a8.5 8.5 0 1 0 5.261 15.176l3.406 3.406a1 1 0 0 0 1.415-1.414l-3.407-3.406A8.5 8.5 0 0 0 11.062 2.25Z"
                      data-follow-fill="currentColor"
                      fill="currentColor"
                      fill-rule="evenodd"
                    ></path>
                  </g>
                </svg>
              </span>
              <input
                class="lv-input lv-input-size-default"
                maxlength="100"
                placeholder="搜索"
                :value="searchValue"
                @input="handleSearchInput"
                @keydown.enter="emit('search')"
              >
            </span>
          </span>
        </div>
      </div>
      <span class="separator"></span>
      <div class="container-KL2j0F filter-trigger-menu" @click.stop="toggleFilterMenu('time')">
        <span class="trigger-AnFRb7">
          <span class="filter-text-bBfqrS filter-text-MnA06c">{{ timeFilterLabel }}</span>
          <svg
            class="dropdown-arrow-qZsXaR"
            fill="none"
            height="1em"
            preserveAspectRatio="xMidYMid meet"
            role="presentation"
            viewBox="0 0 24 24"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g>
              <path
                clip-rule="evenodd"
                d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                data-follow-fill="currentColor"
                fill="currentColor"
                fill-rule="evenodd"
              ></path>
            </g>
          </svg>
        </span>
        <div v-if="activeFilterMenu === 'time'" class="filter-popup-menu" role="menu">
          <button
            v-for="option in timeFilterOptions"
            :key="option.value"
            class="filter-popup-menu__item"
            type="button"
            @click.stop="selectFilter('time', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <span class="separator"></span>
      <div class="container-KL2j0F filter-trigger-menu" @click.stop="toggleFilterMenu('type')">
        <span class="trigger-AnFRb7">
          <span class="filter-text-bBfqrS">{{ typeFilterLabel }}</span>
          <svg
            class="dropdown-arrow-qZsXaR"
            fill="none"
            height="1em"
            preserveAspectRatio="xMidYMid meet"
            role="presentation"
            viewBox="0 0 24 24"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g>
              <path
                clip-rule="evenodd"
                d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                data-follow-fill="currentColor"
                fill="currentColor"
                fill-rule="evenodd"
              ></path>
            </g>
          </svg>
        </span>
        <div v-if="activeFilterMenu === 'type'" class="filter-popup-menu" role="menu">
          <button
            v-for="option in typeFilterOptions"
            :key="option.value"
            class="filter-popup-menu__item"
            type="button"
            @click.stop="selectFilter('type', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <span class="separator"></span>
      <div class="container-KL2j0F filter-trigger-menu" @click.stop="toggleFilterMenu('action')">
        <span class="trigger-AnFRb7">
          <span class="filter-text-bBfqrS">{{ actionFilterLabel }}</span>
          <svg
            class="dropdown-arrow-qZsXaR"
            fill="none"
            height="1em"
            preserveAspectRatio="xMidYMid meet"
            role="presentation"
            viewBox="0 0 24 24"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g>
              <path
                clip-rule="evenodd"
                d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                data-follow-fill="currentColor"
                fill="currentColor"
                fill-rule="evenodd"
              ></path>
            </g>
          </svg>
        </span>
        <div v-if="activeFilterMenu === 'action'" class="filter-popup-menu" role="menu">
          <button
            v-for="option in actionFilterOptions"
            :key="option.value"
            class="filter-popup-menu__item"
            type="button"
            @click.stop="selectFilter('action', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

withDefaults(defineProps<{
  scrollListId?: string
  searchValue?: string
  timeFilterLabel?: string
  typeFilterLabel?: string
  actionFilterLabel?: string
}>(), {
  scrollListId: 'scroll-list-generate-session',
  searchValue: '',
  timeFilterLabel: '时间',
  typeFilterLabel: '生成类型',
  actionFilterLabel: '操作类型',
})

const emit = defineEmits<{
  'update:searchValue': [value: string]
  search: []
  'create-session': []
  'time-filter-click': []
  'type-filter-click': []
  'action-filter-click': []
  'time-filter-select': [value: string]
  'type-filter-select': [value: string]
  'action-filter-select': [value: string]
  'scroll-state': [payload: { scrollTop: number; isAtBottom: boolean; isScrollingUp: boolean }]
}>()

const handleSearchInput = (event: Event) => {
  emit('update:searchValue', String((event.target as HTMLInputElement | null)?.value || ''))
}

type FilterMenuKey = 'time' | 'type' | 'action'

const activeFilterMenu = ref<FilterMenuKey | null>(null)
const timeFilterOptions = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'last7days', label: '近 7 天' },
  { value: 'thisMonth', label: '本月' },
]
const typeFilterOptions = [
  { value: 'all', label: '全部类型' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'agent', label: '智能体' },
  { value: 'research', label: '研究报告' },
]
const actionFilterOptions = [
  { value: 'all', label: '全部操作' },
  { value: 'create', label: '首次生成' },
  { value: 'regenerate', label: '再次生成' },
]

const toggleFilterMenu = (key: FilterMenuKey) => {
  activeFilterMenu.value = activeFilterMenu.value === key ? null : key
}

const selectFilter = (key: FilterMenuKey, value: string) => {
  activeFilterMenu.value = null
  if (key === 'time') emit('time-filter-select', value)
  if (key === 'type') emit('type-filter-select', value)
  if (key === 'action') emit('action-filter-select', value)
}

const closeFilterMenu = () => {
  activeFilterMenu.value = null
}

const scrollContainerRef = ref<HTMLElement | null>(null)
let lastScrollTop = 0
let touchLastY = 0

// 反向虚拟列表将最新记录视觉贴底；浏览器滚动坐标仍按未旋转的 DOM 计算，
// 因此在这里映射滚轮与触摸手势。未恢复旧版 spacer/空白占位，避免不可达留白。
const handleWheel = (event: WheelEvent) => {
  const target = scrollContainerRef.value
  if (!target) return

  event.preventDefault()
  target.scrollTop -= event.deltaY
}

const handleTouchStart = (event: TouchEvent) => {
  touchLastY = event.touches[0]?.clientY ?? 0
}

const handleTouchMove = (event: TouchEvent) => {
  const target = scrollContainerRef.value
  if (!target) return

  const currentY = event.touches[0]?.clientY ?? touchLastY
  const deltaY = touchLastY - currentY
  touchLastY = currentY
  event.preventDefault()
  target.scrollTop -= deltaY
}

const handleScroll = () => {
  const target = scrollContainerRef.value
  if (!target) return
  const currentScrollTop = target.scrollTop
  // 旋转后 DOM 顶部即视觉底部，scrollTop=0 表示最新记录已贴底。
  const isAtBottom = currentScrollTop <= 10
  const isScrollingUp = currentScrollTop > lastScrollTop
  lastScrollTop = currentScrollTop
  emit('scroll-state', { scrollTop: currentScrollTop, isAtBottom, isScrollingUp })
}

const scrollToElementById = (elementId: string) => {
  const container = scrollContainerRef.value
  if (!container || !elementId) {
    return false
  }

  const target = document.getElementById(elementId)
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const containerRect = container.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const targetCenter = targetRect.top + targetRect.height / 2
  const viewportCenter = containerRect.top + container.clientHeight / 2
  const delta = targetCenter - viewportCenter
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
  const nextTop = Math.max(0, Math.min(maxScrollTop, container.scrollTop - delta))

  container.scrollTo({
    top: nextTop,
    behavior: 'smooth',
  })

  return true
}

defineExpose({
  scrollToElementById,
})

onMounted(() => {
  const target = scrollContainerRef.value
  if (!target) return
  target.addEventListener('wheel', handleWheel, { passive: false })
  target.addEventListener('touchstart', handleTouchStart, { passive: true })
  target.addEventListener('touchmove', handleTouchMove, { passive: false })
  target.addEventListener('scroll', handleScroll, { passive: true })
  document.addEventListener('click', closeFilterMenu)
})

onBeforeUnmount(() => {
  const target = scrollContainerRef.value
  if (target) {
    target.removeEventListener('wheel', handleWheel)
    target.removeEventListener('touchstart', handleTouchStart)
    target.removeEventListener('touchmove', handleTouchMove)
    target.removeEventListener('scroll', handleScroll)
  }
  document.removeEventListener('click', closeFilterMenu)
})
</script>

<style scoped>
.filter-trigger-menu {
  position: relative;
}

.filter-popup-menu {
  background: var(--bg-elevated, #fff);
  border: 1px solid var(--stroke-secondary, rgba(0, 0, 0, 0.1));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  display: grid;
  gap: 2px;
  left: 0;
  min-width: 112px;
  padding: 4px;
  position: absolute;
  top: calc(100% + 6px);
  z-index: 30;
}

.filter-popup-menu__item {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 5px;
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  padding: 7px 8px;
  text-align: left;
  white-space: nowrap;
}

.filter-popup-menu__item:hover {
  background: var(--bg-block-secondary-hover, rgba(0, 0, 0, 0.06));
}
</style>
