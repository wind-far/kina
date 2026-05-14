// 研究信源卡片滚轮拦截：当用户在卡片内停留 ≥160ms 后再滚轮，把滚动行为留在卡片内部，
// 避免误触整页滚动。listener 注册在 document 上、capture 模式，避免子组件重复绑定。

import { onMounted, onBeforeUnmount } from 'vue'

const RESEARCH_CARD_WHEEL_INTENT_DELAY_MS = 160
const DEFAULT_SCROLL_SELECTOR = '.research-search-card__body, .research-reader-preview__scroll'

export interface UseResearchCardWheelGuardOptions {
  selector?: string
}

export const useResearchCardWheelGuard = (options: UseResearchCardWheelGuardOptions = {}) => {
  const scrollSelector = options.selector || DEFAULT_SCROLL_SELECTOR

  let researchWheelIntentArea: HTMLElement | null = null
  let researchWheelIntentAt = 0
  let researchWheelPointerX = 0
  let researchWheelPointerY = 0

  const resetResearchWheelIntent = () => {
    researchWheelIntentArea = null
    researchWheelIntentAt = 0
  }

  const isResearchScrollArea = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) {
      return null
    }
    return target.closest<HTMLElement>(scrollSelector)
  }

  const isPointerInsideElement = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    return researchWheelPointerX >= rect.left
      && researchWheelPointerX <= rect.right
      && researchWheelPointerY >= rect.top
      && researchWheelPointerY <= rect.bottom
  }

  const handleResearchCardPointerMoveCapture = (event: MouseEvent) => {
    researchWheelPointerX = event.clientX
    researchWheelPointerY = event.clientY

    const scrollArea = isResearchScrollArea(event.target)
    if (!scrollArea) {
      resetResearchWheelIntent()
      return
    }

    if (researchWheelIntentArea !== scrollArea) {
      researchWheelIntentArea = scrollArea
      researchWheelIntentAt = performance.now()
    }
  }

  const hasResearchWheelIntent = (scrollArea: HTMLElement) => {
    return researchWheelIntentArea === scrollArea
      && performance.now() - researchWheelIntentAt >= RESEARCH_CARD_WHEEL_INTENT_DELAY_MS
      && isPointerInsideElement(scrollArea)
  }

  const normalizeResearchWheelDelta = (event: WheelEvent) => {
    const lineHeight = 18
    const pageHeight = 220
    const rawDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * lineHeight
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * pageHeight
        : event.deltaY
    const softenedDelta = rawDelta * 0.58
    const maxStep = 90

    return Math.max(-maxStep, Math.min(maxStep, softenedDelta))
  }

  const scrollResearchCardContent = (target: HTMLElement, deltaY: number) => {
    if (target.scrollHeight <= target.clientHeight) {
      return false
    }

    const previousScrollTop = target.scrollTop
    const maxScrollTop = target.scrollHeight - target.clientHeight
    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, previousScrollTop + deltaY))
    target.scrollTop = nextScrollTop

    return target.scrollTop !== previousScrollTop
  }

  const handleResearchCardWheelCapture = (event: WheelEvent) => {
    const scrollArea = isResearchScrollArea(event.target)
    if (!scrollArea || !hasResearchWheelIntent(scrollArea)) {
      return
    }

    const didScroll = scrollResearchCardContent(scrollArea, normalizeResearchWheelDelta(event))
    if (!didScroll) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }

  onMounted(() => {
    document.addEventListener('mousemove', handleResearchCardPointerMoveCapture, { capture: true, passive: true })
    document.addEventListener('wheel', handleResearchCardWheelCapture, { capture: true, passive: false })
  })

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', handleResearchCardPointerMoveCapture, true)
    document.removeEventListener('wheel', handleResearchCardWheelCapture, true)
  })
}
