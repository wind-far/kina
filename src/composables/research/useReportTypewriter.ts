// 研究报告打字机效果：随 content 增长把 displayedContent 推进到目标，done 后一次性补齐。
// 仅服务于 ResearchReportViewer 的报告正文渲染。

import { ref, watch, onBeforeUnmount, type Ref } from 'vue'

export interface UseReportTypewriterOptions {
  content: Ref<string>
  done: Ref<boolean>
}

export const useReportTypewriter = ({ content, done }: UseReportTypewriterOptions) => {
  const displayedContent = ref(done.value ? String(content.value || '') : '')
  let typewriterTimer: ReturnType<typeof setTimeout> | null = null

  const clearTypewriterTimer = () => {
    if (!typewriterTimer) {
      return
    }
    clearTimeout(typewriterTimer)
    typewriterTimer = null
  }

  const syncDisplayedContent = () => {
    clearTypewriterTimer()
    const target = String(content.value || '')

    if (!target) {
      displayedContent.value = ''
      return
    }

    if (done.value && !displayedContent.value) {
      displayedContent.value = target
      return
    }

    if (!target.startsWith(displayedContent.value)) {
      displayedContent.value = done.value ? target : ''
    }

    const tick = () => {
      const latestTarget = String(content.value || '')
      if (!latestTarget.startsWith(displayedContent.value)) {
        displayedContent.value = done.value ? latestTarget : ''
      }

      const remaining = latestTarget.length - displayedContent.value.length
      if (remaining <= 0) {
        typewriterTimer = null
        return
      }

      const step = Math.max(1, Math.min(36, Math.ceil(remaining / 24)))
      displayedContent.value = latestTarget.slice(0, displayedContent.value.length + step)
      typewriterTimer = setTimeout(tick, done.value ? 8 : 18)
    }

    tick()
  }

  watch(content, syncDisplayedContent, { immediate: true })
  watch(done, syncDisplayedContent)

  onBeforeUnmount(() => {
    clearTypewriterTimer()
  })

  return {
    displayedContent,
  }
}
