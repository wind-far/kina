<template>
  <div class="record-list-container">
    <div class="record-list record-virtual-list">
      <div class="virtual-list-container">
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
      <div class="container-KL2j0F" @click="emit('time-filter-click')">
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
      </div>
      <span class="separator"></span>
      <div class="container-KL2j0F" @click="emit('type-filter-click')">
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
      </div>
      <span class="separator"></span>
      <div class="container-KL2j0F" @click="emit('action-filter-click')">
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
  'scroll-state': [payload: { scrollTop: number; isAtBottom: boolean; isScrollingUp: boolean }]
}>()

const handleSearchInput = (event: Event) => {
  emit('update:searchValue', String((event.target as HTMLInputElement | null)?.value || ''))
}

const scrollContainerRef = ref<HTMLElement | null>(null)
let lastScrollTop = 0

const handleScroll = () => {
  const target = scrollContainerRef.value
  if (!target) return
  const currentScrollTop = target.scrollTop
  const maxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight)
  const isAtBottom = currentScrollTop >= maxScrollTop - 10
  const isScrollingUp = currentScrollTop < lastScrollTop
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
  const nextTop = Math.max(0, Math.min(maxScrollTop, container.scrollTop + delta))

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
  target.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  const target = scrollContainerRef.value
  if (!target) return
  target.removeEventListener('scroll', handleScroll)
})
</script>
