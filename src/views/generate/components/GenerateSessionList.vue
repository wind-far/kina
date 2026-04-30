<template>
  <div class="record-list-container">
    <div class="record-list record-virtual-list" :style="`--content-generator-height:${contentGeneratorHeight}px`">
      <div
        class="virtual-list-container"
        style="--virtual-list-rotate:rotate(180deg);--virtual-list-direction:rtl;--virtual-list-justify-content:flex-end"
      >
        <div class="scroll-container-j7wUS8" style="height:100%">
          <div ref="scrollContainerRef" class="virtual-list" style="height:100%">
            <div :style="`height:${spacerHeight}`"></div>
            <div
              :id="scrollListId"
              class="scroll-list"
              style="transform:translate3d(0px,0px,0px)"
            >
              <div class="scroll-slot"></div>
              <div class="top-placeholder-fTCjHC">
                <div class="top-placeholder-aEry7y">
                  <div class="clean-agent-context-wrapper">
                    <span
                      class="clean-agent-context-text"
                      @click="emit('create-session')"
                    >
                      {{ createSessionText }}
                    </span>
                  </div>
                  <div class="empty-placeholder"></div>
                </div>
              </div>
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
  contentGeneratorHeight?: number
  spacerHeight?: string
  scrollListId?: string
  createSessionText?: string
  searchValue?: string
  timeFilterLabel?: string
  typeFilterLabel?: string
  actionFilterLabel?: string
}>(), {
  contentGeneratorHeight: 174,
  spacerHeight: '1056.88px',
  scrollListId: 'scroll-list-generate-session',
  createSessionText: '创建新会话',
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

// 列表外层使用 transform: rotate(180deg) 实现「最新消息贴底」的对话布局，
// 浏览器原生滚动不感知 transform，默认方向因此与视觉相反。
// 这里统一接管 wheel / touchmove，按视觉方向反向写入 scrollTop，让滚轮、触摸手势与画面方向一致。
const scrollContainerRef = ref<HTMLElement | null>(null)
let lastScrollTop = 0
let touchLastY = 0

const handleWheel = (event: WheelEvent) => {
  const target = scrollContainerRef.value
  if (!target) return
  event.stopImmediatePropagation()
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
  event.stopImmediatePropagation()
  event.preventDefault()
  target.scrollTop -= deltaY
}

const handleScroll = () => {
  const target = scrollContainerRef.value
  if (!target) return
  const currentScrollTop = target.scrollTop
  // 容器旋转 180°：DOM 顶部即视觉底部，scrollTop 接近 0 表示已贴近最新消息一侧。
  const isAtBottom = currentScrollTop <= 10
  // scrollTop 增大表示视口在 DOM 上向下移，对应视觉上向上回看旧消息。
  const isScrollingUp = currentScrollTop > lastScrollTop
  lastScrollTop = currentScrollTop
  emit('scroll-state', { scrollTop: currentScrollTop, isAtBottom, isScrollingUp })
}

onMounted(() => {
  const target = scrollContainerRef.value
  if (!target) return
  target.addEventListener('wheel', handleWheel, { passive: false, capture: true })
  target.addEventListener('touchstart', handleTouchStart, { passive: true })
  target.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
  target.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  const target = scrollContainerRef.value
  if (!target) return
  target.removeEventListener('wheel', handleWheel, true)
  target.removeEventListener('touchstart', handleTouchStart)
  target.removeEventListener('touchmove', handleTouchMove, true)
  target.removeEventListener('scroll', handleScroll)
})
</script>
