// 研究报告正文渲染：把 displayedContent 拆成正文 / 核查说明，
// 再调 renderMarkdownBlocks 输出 HTML（含引用胶囊）。
// citationRenderer 用 lazy getter 注入，避免与 useCitationRenderer 形成循环依赖。

import { computed, type ComputedRef, type Ref } from 'vue'
import {
  renderMarkdownBlocks,
  splitReportVerificationSection,
} from './report-markdown-utils'

export interface UseReportMarkdownOptions {
  displayedContent: Ref<string>
  content: Ref<string>
  // lazy 返回 citation 渲染函数；当 useCitationRenderer 尚未注入时，先用 identity 兜底。
  getCitationRenderer: () => (escapedValue: string) => string
}

export const useReportMarkdown = ({
  displayedContent,
  content,
  getCitationRenderer,
}: UseReportMarkdownOptions) => {
  const visibleReportContent: ComputedRef<string> = computed(
    () => splitReportVerificationSection(displayedContent.value).body,
  )

  const finalReportVerificationNotes: ComputedRef<string> = computed(
    () => splitReportVerificationSection(displayedContent.value || content.value).verificationNotes,
  )

  const hasContent: ComputedRef<boolean> = computed(
    () => Boolean(String(visibleReportContent.value).trim()),
  )

  const isContentStreaming: ComputedRef<boolean> = computed(
    () => Boolean(content.value) && displayedContent.value.length < String(content.value || '').length,
  )

  const renderedContent: ComputedRef<string> = computed(
    () => renderMarkdownBlocks(visibleReportContent.value, getCitationRenderer()),
  )

  return {
    visibleReportContent,
    finalReportVerificationNotes,
    hasContent,
    isContentStreaming,
    renderedContent,
  }
}
