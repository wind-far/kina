<template>
  <div class="research-final-message">
    <details
      v-if="brainstormItems.length"
      class="research-final-brainstorm"
    >
      <summary class="research-final-brainstorm__summary">
        <el-icon><Cpu /></el-icon>
        <span>{{ isTranscriptStyle ? '推理摘录' : '头脑风暴' }}</span>
        <span class="research-final-brainstorm__chevron">›</span>
      </summary>
      <div class="research-final-brainstorm__content">
        <p
          v-for="item in brainstormItems"
          :key="item.id"
        >
          {{ item.description || item.title }}
        </p>
      </div>
    </details>

    <div
      v-if="showPostReportActions && !isTranscriptStyle"
      class="research-report-verification-banner"
    >
      <el-icon><WarningFilled /></el-icon>
      <span>
        {{ verificationBannerText }}
        <button
          type="button"
          class="research-report-verification-banner__action"
          @click="scrollToVerification"
        >
          前往核查
        </button>
      </span>
    </div>

    <div
      v-if="hasContent"
      class="research-report-content"
      :class="{ 'is-streaming': isContentStreaming }"
      v-html="renderedContent"
    ></div>
    <div v-if="!hasContent" class="research-report-empty">
      <el-icon><DataAnalysis /></el-icon>
      <span>{{ isTranscriptStyle ? '正在输出最终回答' : '正在整理研究线索与报告结构' }}</span>
    </div>
  </div>

  <footer v-if="showPostReportActions" class="research-actions">
    <button type="button" @click="handleCopyReport">
      <el-icon><CopyDocument /></el-icon>
      <span>{{ copyReportLabel }}</span>
    </button>
    <button type="button" :disabled="!hasSourceCards" @click="handleViewSources">
      <el-icon><Link /></el-icon>
      <span>查看信源</span>
    </button>
    <button
      v-if="!isVerificationRecord"
      :id="verifyReportTargetId"
      type="button"
      :disabled="verificationPending"
      :class="{ 'research-actions__promote': hasJumpedToVerifyReport }"
      @click="handleVerifyReport"
    >
      <el-icon><CircleCheck /></el-icon>
      <span>{{ verificationPending ? '正在核查报告...' : '点我核查报告，让AI替你找茬！' }}</span>
    </button>
    <span v-if="tokenUsage" class="research-token-usage">
      输入 {{ tokenUsage.inputTokens }} / 输出 {{ tokenUsage.outputTokens }}
    </span>
  </footer>

  <ResearchSourceDialog
    v-model:visible="sourceDialogVisible"
    :items="sourcePreviewList"
  />
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref, toRef } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CircleCheck,
  CopyDocument,
  Cpu,
  DataAnalysis,
  Link,
  WarningFilled,
} from '@element-plus/icons-vue'
import type {
  ResearchTokenUsage,
  ResearchVerificationResult,
} from '@/shared/research/research-types'
import type {
  ResearchSourceDialogItem,
  ResearchTimelineViewItem,
} from '../research-report-record.types'
import ResearchSourceDialog from '../ResearchSourceDialog.vue'
import { useReportTypewriter } from '@/composables/research/useReportTypewriter'
import { useReportMarkdown } from '@/composables/research/useReportMarkdown'
import { useCopyReport } from '@/composables/research/useCopyReport'

// 研究报告正文 + 操作栏 + 信源弹窗。
// 内部组合 4 个 composable，外部输入只保留必要的 props（风格/数据/回调）。
const props = defineProps<{
  recordId: string
  content: string
  done: boolean
  prompt: string
  isTranscriptStyle: boolean
  isVerificationRecord: boolean
  verification: ResearchVerificationResult | null
  verificationPending: boolean
  tokenUsage: ResearchTokenUsage | null
  brainstormItems: ResearchTimelineViewItem[]
  citationRenderer: (escapedValue: string) => string
  sourcePreviewList: ResearchSourceDialogItem[]
}>()

const emit = defineEmits<{
  jumpToVerification: [targetId: string]
  verifyReport: []
}>()

const componentUid = getCurrentInstance()?.uid || 'unknown'
const verifyReportTargetId = `research-verify-report-target-${componentUid}-${props.recordId}`
const hasJumpedToVerifyReport = ref(false)
const sourceDialogVisible = ref(false)

const contentRef = toRef(props, 'content')
const doneRef = toRef(props, 'done')

const { displayedContent } = useReportTypewriter({
  content: contentRef,
  done: doneRef,
})

const {
  visibleReportContent,
  hasContent,
  isContentStreaming,
  renderedContent,
} = useReportMarkdown({
  displayedContent,
  content: contentRef,
  getCitationRenderer: () => props.citationRenderer,
})

const { copyReportLabel, handleCopyReport } = useCopyReport({
  getReportText: () => visibleReportContent.value,
})

const showPostReportActions = computed(() => props.done && hasContent.value)
const hasSourceCards = computed(() => props.sourcePreviewList.length > 0)

const verificationBannerText = computed(() => {
  if (props.isVerificationRecord) {
    return '这是针对原报告生成的独立核查结果，您可以'
  }
  if (props.verification?.verdict === 'passed') {
    return '此报告内容已完成可信度核查，您也可以'
  }
  if (props.verification?.verdict === 'partial') {
    return '此报告内容已完成部分核查，仍建议继续'
  }
  if (props.verification?.verdict === 'blocked') {
    return '此报告内容存在未完全核查的信息，您可以'
  }
  return '此报告内容尚未进行可信度核查，您可以'
})

const scrollToVerification = () => {
  hasJumpedToVerifyReport.value = true
  emit('jumpToVerification', verifyReportTargetId)
}

const handleVerifyReport = () => {
  emit('verifyReport')
}

const handleViewSources = () => {
  if (!hasSourceCards.value) {
    ElMessage.info('当前还没有可查看的信源')
    return
  }
  sourceDialogVisible.value = true
}
</script>
