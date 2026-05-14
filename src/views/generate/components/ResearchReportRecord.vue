<template>
  <div class="responsive-container-msS_cP responsive-container-Nivf0N">
    <div class="content-DPogfx ai-generated-record-content-hg5EL8">
      <article class="research-chat-record">
        <ResearchUserMessage :prompt="prompt" />

        <section class="research-assistant-message">
          <div class="research-assistant-message__avatar">
            <el-icon><DataAnalysis /></el-icon>
          </div>
          <div class="research-assistant-message__body">
            <ResearchFlowTimeline
              :record-id="recordId"
              :prompt="prompt"
              :content="content"
              :done="done"
              :stopped="Boolean(stopped)"
              :error="error || ''"
              :verification-pending="Boolean(verificationPending)"
              :has-report-signal="hasReportSignal"
              :timeline="timeline || []"
              :search-groups="searchGroups || []"
              :evidences="evidences || []"
              :facts="facts || []"
              :outline-sections="outlineSections || []"
              :verification="verification || null"
              :token-usage="tokenUsage || null"
              @stop="$emit('stop')"
              @jump-to-verification="(targetId) => $emit('jumpToVerification', targetId)"
              @verify-report="$emit('verifyReport')"
            />
          </div>
        </section>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'
import { DataAnalysis } from '@element-plus/icons-vue'
import type {
  ResearchEvidence,
  ResearchFact,
  ResearchOutlineSection,
  ResearchTokenUsage,
  ResearchVerificationResult,
} from '@/shared/research/research-types'
import type {
  ResearchSearchGroupViewItem,
  ResearchTimelineViewItem,
} from './research-report-record.types'
import ResearchUserMessage from './research/ResearchUserMessage.vue'
import ResearchFlowTimeline from './research/ResearchFlowTimeline.vue'
import { useResearchReportStore } from '@/stores/research-report'
import { splitReportVerificationSection } from '@/composables/research/report-markdown-utils'
import './research/research-report.css'

// 研究报告记录容器：保持原 props 形状（generate.vue 模板零改动）+ 新增 recordId。
// 单点 watch 把 props 同步到 Pinia store，子组件 / composable 全部从 store 读视图模型。
const props = defineProps<{
  recordId: string
  prompt: string
  content: string
  done: boolean
  stopped?: boolean
  error?: string
  progressStage?: string
  progressMessage?: string
  progressPercent?: number
  timeline?: ResearchTimelineViewItem[]
  searchGroups?: ResearchSearchGroupViewItem[]
  evidences?: ResearchEvidence[]
  facts?: ResearchFact[]
  outlineSections?: ResearchOutlineSection[]
  verification?: ResearchVerificationResult | null
  tokenUsage?: ResearchTokenUsage | null
  verificationPending?: boolean
}>()

defineEmits<{
  stop: []
  jumpToVerification: [targetId: string]
  verifyReport: []
}>()

const store = useResearchReportStore()

// 报告生成完成（或正在生成有正文）就视作有 report 信号——timeline 据此决定是否插入 report 块。
const hasReportSignal = computed(
  () => Boolean(splitReportVerificationSection(props.content || '').body.trim()),
)

watch(
  () => [
    props.recordId,
    props.timeline,
    props.searchGroups,
    props.evidences,
    props.facts,
    props.outlineSections,
    props.verification,
    props.tokenUsage,
    props.verificationPending,
  ],
  () => {
    if (!props.recordId) {
      return
    }
    store.syncFromRecord({
      recordId: props.recordId,
      researchTimeline: props.timeline,
      researchSearchGroups: props.searchGroups,
      researchEvidences: props.evidences,
      researchFacts: props.facts,
      researchOutlineSections: props.outlineSections,
      researchVerification: props.verification,
      researchTokenUsage: props.tokenUsage,
      researchVerificationPending: props.verificationPending,
    })
  },
  { deep: true, immediate: true },
)

onBeforeUnmount(() => {
  if (props.recordId) {
    store.drop(props.recordId)
  }
})
</script>
