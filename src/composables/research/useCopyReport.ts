// 复制研究报告正文：navigator.clipboard 优先，旧浏览器回退 textarea + execCommand。
// 复制成功后按钮文案切换为"已复制"并 1.8s 后自动复位。

import { computed, ref, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'

export interface UseCopyReportOptions {
  // 容器层提供一个取当前可见报告正文的 getter，避免直接依赖 markdown 模块。
  getReportText: () => string
}

export const useCopyReport = ({ getReportText }: UseCopyReportOptions) => {
  const copyReportFeedback = ref<'idle' | 'success'>('idle')
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

  const clearCopyFeedbackTimer = () => {
    if (!copyFeedbackTimer) {
      return
    }
    clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = null
  }

  const copyReportLabel = computed(() => copyReportFeedback.value === 'success' ? '已复制' : '复制')

  const scheduleCopyFeedbackReset = () => {
    clearCopyFeedbackTimer()
    copyFeedbackTimer = setTimeout(() => {
      copyReportFeedback.value = 'idle'
      copyFeedbackTimer = null
    }, 1800)
  }

  const writeClipboardText = async (text: string) => {
    const normalized = String(text || '')
    if (!normalized) {
      throw new Error('EMPTY_TEXT')
    }

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(normalized)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = normalized
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    try {
      const copied = document.execCommand('copy')
      if (!copied) {
        throw new Error('COPY_FAILED')
      }
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const handleCopyReport = async () => {
    const reportText = String(getReportText() || '').trim()
    if (!reportText) {
      ElMessage.warning('当前还没有可复制的报告内容')
      return
    }

    try {
      await writeClipboardText(reportText)
      copyReportFeedback.value = 'success'
      scheduleCopyFeedbackReset()
      ElMessage.success('报告内容已复制')
    } catch {
      ElMessage.error('复制失败，请稍后重试')
    }
  }

  onBeforeUnmount(() => {
    clearCopyFeedbackTimer()
  })

  return {
    copyReportLabel,
    copyReportFeedback,
    handleCopyReport,
  }
}
