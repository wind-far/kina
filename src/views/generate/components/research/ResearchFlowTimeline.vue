<template>
  <div class="research-flow">
    <div class="research-flow__rail" aria-hidden="true"></div>
    <div v-if="error" class="research-alert research-alert--danger">
      <el-icon><WarningFilled /></el-icon>
      <span>{{ error }}</span>
    </div>

    <section
      v-for="(block, blockIndex) in researchFlowBlocks"
      :key="block.id"
      class="research-flow-step"
      :class="{
        'is-active': isActiveFlowBlock(blockIndex),
        'is-complete': blockIndex < activeFlowBlockIndex,
      }"
    >
      <div class="research-flow-step__marker">
        <el-icon>
          <MagicStick v-if="block.type === 'planning'" />
          <Aim v-else-if="block.type === 'search'" />
          <CircleCheck v-else-if="block.type === 'verification'" />
          <MagicStick v-else-if="block.type === 'report'" />
          <Document v-else />
        </el-icon>
      </div>
      <div class="research-flow-step__content">
        <div class="research-flow-step__meta">
          <span>{{ block.title }} - {{ block.time }}</span>
          <button
            v-if="blockIndex === 0 && !done"
            class="research-stop-button"
            type="button"
            @click="$emit('stop')"
          >
            <el-icon><VideoPause /></el-icon>
            <span>停止</span>
          </button>
        </div>
        <div
          v-if="block.type === 'search' && block.progressText"
          class="research-flow-step__status"
        >
          {{ block.progressText }}
        </div>
        <details
          v-if="block.type !== 'planning' && block.items?.length"
          class="research-node-log"
          :open="shouldOpenNodeLog(blockIndex)"
        >
          <summary class="research-node-log__summary">
            <span>{{ isTranscriptStyle ? '事件日志' : '节点详情' }}</span>
            <span class="research-node-log__chevron">›</span>
          </summary>
          <div class="research-node-log__content">
            <ol class="research-node-log__list">
              <li
                v-for="item in block.items"
                :key="item.id"
              >
                <span class="research-node-log__time">{{ item.time }}</span>
                <span
                  class="research-node-log__badge"
                  :class="`is-${item.kind}`"
                >
                  {{ formatTimelineNodeKind(item) }}
                </span>
                <span class="research-node-log__title">{{ formatTimelineNodeTitle(item) }}</span>
                <p v-if="item.description" class="research-node-log__desc">{{ item.description }}</p>
              </li>
            </ol>
          </div>
        </details>

        <details
          v-if="block.type === 'planning'"
          class="research-process-card"
          :open="shouldOpenProcessCard(blockIndex)"
        >
          <summary class="research-process-card__summary">
            <el-icon class="research-process-card__summary-icon"><Cpu /></el-icon>
            <span>{{ block.cardTitle || block.title }}</span>
            <span class="research-process-card__chevron">›</span>
          </summary>
          <div class="research-process-card__content">
            <ol v-if="block.items?.length" class="research-process-list">
              <li
                v-for="(item, itemIndex) in block.items"
                :key="item.id"
                :style="{ animationDelay: `${itemIndex * 70}ms` }"
              >
                <span>{{ item.title }}</span>
                <p v-if="item.description">{{ item.description }}</p>
              </li>
            </ol>
            <div v-else class="research-panel-empty">等待研究事件回传</div>
          </div>
        </details>

        <div v-if="block.type === 'search'" class="research-search-grid">
          <ResearchDataSonarCard
            v-for="(group, groupIndex) in block.groups"
            :key="group.id"
            :group="group"
            :index="groupIndex"
            :is-transcript-style="isTranscriptStyle"
          />
        </div>

        <ResearchVerificationPanel
          v-else-if="block.type === 'verification'"
          :verification="verification"
        />

        <ResearchOutlinePanel
          v-else-if="block.type === 'outline'"
          :outline-sections="outlineSections"
        />

        <ResearchReportViewer
          v-else-if="block.type === 'report'"
          :record-id="recordId"
          :content="content"
          :done="done"
          :prompt="prompt"
          :is-transcript-style="isTranscriptStyle"
          :is-verification-record="isVerificationRecord"
          :verification="verification"
          :verification-pending="verificationPending"
          :token-usage="tokenUsage"
          :brainstorm-items="reportBrainstormItems"
          :citation-renderer="renderCitationReferences"
          :source-preview-list="sourcePreviewList"
          @jump-to-verification="(targetId) => $emit('jumpToVerification', targetId)"
          @verify-report="$emit('verifyReport')"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Aim,
  CircleCheck,
  Cpu,
  Document,
  MagicStick,
  VideoPause,
  WarningFilled,
} from '@element-plus/icons-vue'
import type {
  ResearchEvidence,
  ResearchFact,
  ResearchOutlineSection,
  ResearchTokenUsage,
  ResearchVerificationResult,
} from '@/shared/research/research-types'
import type {
  ResearchDataSonarCard as ResearchDataSonarCardItem,
  ResearchFlowBlock,
  ResearchSearchGroupViewItem,
  ResearchSourceDialogItem,
  ResearchTimelineViewItem,
} from '../research-report-record.types'
import ResearchDataSonarCard from './ResearchDataSonarCard.vue'
import ResearchVerificationPanel from './ResearchVerificationPanel.vue'
import ResearchOutlinePanel from './ResearchOutlinePanel.vue'
import ResearchReportViewer from './ResearchReportViewer.vue'
import { useResearchCardWheelGuard } from '@/composables/research/useResearchCardWheelGuard'
import {
  useCitationRenderer,
  readSearchCardAnchorId,
  readSearchSourceAnchorId,
} from '@/composables/research/useCitationRenderer'
import { splitReportVerificationSection, readResearchSourceDomain } from '@/composables/research/report-markdown-utils'

// 研究流程时间线：把 store 的视图模型转成可视化的 block 列表，编排其它子组件。
// hasReportSignal 由容器从 props.content 直接派生，避免 viewer 与 timeline 双向依赖。
const props = defineProps<{
  recordId: string
  prompt: string
  content: string
  done: boolean
  stopped: boolean
  error: string
  verificationPending: boolean
  hasReportSignal: boolean
  timeline: ResearchTimelineViewItem[]
  searchGroups: ResearchSearchGroupViewItem[]
  evidences: ResearchEvidence[]
  facts: ResearchFact[]
  outlineSections: ResearchOutlineSection[]
  verification: ResearchVerificationResult | null
  tokenUsage: ResearchTokenUsage | null
}>()

defineEmits<{
  stop: []
  jumpToVerification: [targetId: string]
  verifyReport: []
}>()

useResearchCardWheelGuard()

const isVerificationRecord = computed(() => String(props.prompt || '').trim().startsWith('核查报告：'))

const timelineRef = computed(() => props.timeline || [])
const evidencesRef = computed(() => props.evidences || [])
const outlineSections = computed(() => props.outlineSections || [])

// 引用渲染需要拿到"当前可见的报告正文"，用 props.content 直接拆即可（不需要打字机后的版本）。
const visibleReportContentForCitation = computed(
  () => splitReportVerificationSection(props.content || '').body,
)

const isTranscriptStyle = computed(() => {
  const hasStructuredMarkers = Boolean(
    props.verification
    || outlineSections.value.length
    || timelineRef.value.some(item => item.kind === 'verification' || item.kind === 'outline' || item.kind === 'section'),
  )
  if (hasStructuredMarkers) {
    return false
  }
  return timelineRef.value.some(item => item.kind === 'reasoning' || item.kind === 'tool_call' || item.kind === 'tool_result')
})

const displayTime = computed(() => {
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
})

const readTimelineMetaString = (item: ResearchTimelineViewItem, key: string) => {
  const value = item.meta?.[key]
  return value === undefined || value === null ? '' : String(value).trim()
}

const readTimelineMetaNumber = (item: ResearchTimelineViewItem, key: string) => {
  const value = item.meta?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const isLikelyMojibake = (value: string) => {
  const text = String(value || '')
  if (!text) {
    return false
  }
  const replacementCount = (text.match(/�/g) || []).length
  return replacementCount >= 4 && replacementCount / Math.max(text.length, 1) > 0.04
}

const cleanReaderText = (value: string) => {
  const text = String(value || '').trim()
  return isLikelyMojibake(text) ? '' : text
}

const normalizeReaderCardKey = (item: ResearchTimelineViewItem) => {
  const toolId = readTimelineMetaString(item, 'toolId')
  if (toolId) {
    return toolId
  }
  const url = readTimelineMetaString(item, 'url')
  if (url) {
    return url
  }
  return item.id
}

const visibleSearchGroups = computed<ResearchSearchGroupViewItem[]>(() => {
  const groups = (props.searchGroups || [])
    .filter(group => group.title || group.query || group.sources?.length)
    .map(group => ({
      ...group,
      title: group.title || group.query || '搜索结果',
      sources: (group.sources || []).slice(0, 12),
    }))
  if (groups.length) {
    return groups
  }

  if (!evidencesRef.value.length) {
    return []
  }

  return [{
    id: 'evidence-fallback',
    query: '已采纳信源',
    title: '已采纳信源',
    sources: evidencesRef.value.slice(0, 12).map(evidence => ({
      title: evidence.title || evidence.source?.title || '未命名信源',
      url: evidence.source?.url || '',
      siteName: evidence.source?.sourceType || '',
      snippet: evidence.summary || evidence.source?.note || '',
    })),
  }]
})

const searchCallGroups = computed<ResearchSearchGroupViewItem[]>(() => {
  const existingQueries = new Set(visibleSearchGroups.value.map(group => group.query || group.title))
  return timelineRef.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (item.kind !== 'tool_call' || item.title !== '调用网页搜索' || !item.description) {
        return false
      }
      return !existingQueries.has(item.description)
    })
    .map(({ item, index }) => ({
      id: readTimelineMetaString(item, 'toolId') || item.description || item.id,
      query: item.description || '',
      title: item.description || item.title || '搜索中',
      sources: [],
      stage: item.stage,
      time: item.time,
      pending: true,
      order: index + 1,
    }))
})

const readerCards = computed<ResearchDataSonarCardItem[]>(() => {
  const readEvents = timelineRef.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const stage = String(item.stage || '')
      return ['deep_reading', 'evidence_merge'].includes(stage)
        && (item.kind === 'tool_call' || item.kind === 'tool_result')
        && (item.title.includes('网页阅读') || readTimelineMetaString(item, 'url'))
    })

  const cardMap = new Map<string, Extract<ResearchDataSonarCardItem, { kind: 'reader' }>>()

  readEvents.forEach(({ item, index }) => {
    const description = String(item.description || '').trim()
    const [rawTitle, rawExcerpt] = description.split('｜')
    const url = readTimelineMetaString(item, 'url') || (/^https?:\/\//i.test(rawTitle) ? rawTitle : '')
    const headline = readTimelineMetaString(item, 'title')
      || rawTitle.replace(/^正在深度阅读：/, '').replace(/^网页阅读完成：/, '').trim()
      || item.title
      || '网页阅读'
    const excerpt = cleanReaderText(readTimelineMetaString(item, 'excerpt') || (rawExcerpt || '').trim())
    const content = cleanReaderText(readTimelineMetaString(item, 'content')) || excerpt
    const pending = item.kind === 'tool_call'
    const key = normalizeReaderCardKey(item)
    const existing = cardMap.get(key)
    const nextCard: Extract<ResearchDataSonarCardItem, { kind: 'reader' }> = {
      id: `reader-${key}`,
      kind: 'reader',
      query: readTimelineMetaString(item, 'query') || existing?.query || '',
      title: headline || existing?.title || '网页阅读',
      sources: [],
      stage: String(item.stage || existing?.stage || 'deep_reading'),
      time: existing?.time || item.time,
      pending: existing ? existing.pending && pending : pending,
      order: existing?.order || index + 1,
      url: url || existing?.url || '',
      headline: headline || existing?.headline || '网页阅读',
      excerpt: excerpt || existing?.excerpt || '',
      content: content || existing?.content || '',
      siteName: readTimelineMetaString(item, 'siteName') || existing?.siteName || readResearchSourceDomain(url),
      siteIcon: readTimelineMetaString(item, 'siteIcon') || existing?.siteIcon || '',
      referenceIndex: readTimelineMetaNumber(item, 'referenceIndex') || existing?.referenceIndex,
      contentLength: readTimelineMetaNumber(item, 'contentLength') || existing?.contentLength,
    }

    cardMap.set(key, nextCard)
  })

  return Array.from(cardMap.values())
})

const evidenceCards = computed<ResearchDataSonarCardItem[]>(() => {
  return timelineRef.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === 'evidence' && String(item.stage || '') === 'evidence_merge')
    .map(({ item, index }) => ({
      id: `evidence-${item.id}`,
      kind: 'evidence' as const,
      query: '',
      title: isTranscriptStyle.value ? '采纳信源' : '新增信源',
      sources: [],
      stage: item.stage,
      time: item.time,
      pending: false,
      order: 1000 + index,
      headline: readTimelineMetaString(item, 'title') || item.title,
      excerpt: readTimelineMetaString(item, 'excerpt') || item.description || '',
      siteName: readTimelineMetaString(item, 'siteName') || '',
      metaLine: item.confidence ? `置信度 ${item.confidence}` : '',
    }))
})

const factCards = computed<ResearchDataSonarCardItem[]>(() => {
  return timelineRef.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === 'fact' && String(item.stage || '') === 'evidence_merge')
    .map(({ item, index }) => ({
      id: `fact-${item.id}`,
      kind: 'fact' as const,
      query: '',
      title: isTranscriptStyle.value ? '提取事实' : '更新事实',
      sources: [],
      stage: item.stage,
      time: item.time,
      pending: false,
      order: 2000 + index,
      statement: item.description || item.title,
      metaLine: item.confidence ? `置信度 ${item.confidence}` : '',
    }))
})

const stagedSearchGroups = computed<ResearchDataSonarCardItem[]>(() => {
  return [...visibleSearchGroups.value, ...searchCallGroups.value, ...readerCards.value, ...evidenceCards.value, ...factCards.value]
    .sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999))
    .slice(0, 18)
})

// 把 timeline 中后期的 reasoning 项作为头脑风暴展示（最多取 2 项）。
const reportBrainstormItems = computed(() => {
  const lateReasoningItems = timelineRef.value
    .filter(item => item.kind === 'reasoning' && ['report_planning', 'report_writing', 'final_review', 'completed'].includes(String(item.stage || '')))
    .slice(-2)

  if (lateReasoningItems.length) {
    return lateReasoningItems
  }

  return timelineRef.value
    .filter(item => item.kind === 'reasoning')
    .slice(-2)
})

const {
  citationReferenceTargetMap,
  citationReferencePreviewMap,
  renderCitationReferences,
} = useCitationRenderer({
  readerCards,
  stagedSearchGroups,
  evidences: evidencesRef,
  visibleReportContent: visibleReportContentForCitation,
})

// 让 lint 安心：targetMap 实际由 citation tooltip 调用 detailLink 时使用，无需在此读取。
void citationReferenceTargetMap

// 报告底部"查看信源"弹窗的列表，包含 reader / search / evidence + 引用兜底。
const sourcePreviewList = computed<ResearchSourceDialogItem[]>(() => {
  const items: ResearchSourceDialogItem[] = []
  const seenKeys = new Set<string>()

  const pushItem = (item: ResearchSourceDialogItem) => {
    const dedupeKey = `${item.url}__${item.title}__${item.referenceLabel}`
    if (seenKeys.has(dedupeKey)) {
      return
    }
    seenKeys.add(dedupeKey)
    items.push(item)
  }

  const readSearchCardTag = (group: ResearchDataSonarCardItem) => {
    if (!isTranscriptStyle.value) {
      return ''
    }
    if (group.kind === 'reader') {
      return group.referenceIndex ? `已读信源 #${group.referenceIndex}` : '已读信源'
    }
    if (group.kind === 'evidence') {
      return '采纳信源'
    }
    if (group.kind === 'fact') {
      return '提取事实'
    }
    return '候选信源'
  }

  stagedSearchGroups.value.forEach((group) => {
    if (group.kind === 'reader') {
      pushItem({
        id: group.id,
        referenceLabel: group.referenceIndex ? `[${group.referenceIndex}]` : '',
        metaLabel: readSearchCardTag(group),
        title: group.headline || group.title || '未命名信源',
        siteName: group.siteName || '',
        domain: readResearchSourceDomain(group.url) || '',
        snippet: group.excerpt || group.content || '',
        url: group.url || '',
      })
      return
    }

    if (group.kind === 'evidence') {
      pushItem({
        id: group.id,
        referenceLabel: '',
        metaLabel: readSearchCardTag(group),
        title: group.headline || group.title || '未命名信源',
        siteName: group.siteName || '',
        domain: '',
        snippet: group.excerpt || '',
        url: '',
      })
      return
    }

    if (group.kind === 'fact') {
      return
    }

    group.sources.forEach((source, sourceIndex) => {
      pushItem({
        id: `${group.id}-${sourceIndex}`,
        referenceLabel: source.referenceIndex ? `[${source.referenceIndex}]` : '',
        metaLabel: group.title || group.query || '候选信源',
        title: source.title || '未命名信源',
        siteName: source.siteName || '',
        domain: readResearchSourceDomain(source.url) || '',
        snippet: source.snippet || '',
        url: source.url || '',
      })
    })
  })

  if (!items.length) {
    citationReferencePreviewMap.value.forEach((preview, referenceIndex) => {
      pushItem({
        id: `reference-${referenceIndex}`,
        referenceLabel: `[${referenceIndex}]`,
        metaLabel: '引用信源',
        title: preview.title || `参考资料 ${referenceIndex}`,
        siteName: preview.siteName || '',
        domain: preview.domain || '',
        snippet: preview.snippet || '',
        url: preview.url || '',
      })
    })
  }

  return items
})

void readSearchCardAnchorId
void readSearchSourceAnchorId

const searchStageOrder = ['parallel_search', 'targeted_search', 'deep_reading', 'evidence_merge', 'fact_verification']

const normalizeSearchStage = (stage?: string) => {
  return searchStageOrder.includes(String(stage || ''))
    ? String(stage || '')
    : 'parallel_search'
}

const sortSearchGroups = (groups: ResearchDataSonarCardItem[]) => {
  return groups.slice().sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999))
}

const makeFallbackTimelineItem = (title: string, description: string): ResearchTimelineViewItem => ({
  id: 'fallback-planning',
  kind: 'begin',
  title,
  description,
  stage: 'intake',
  time: displayTime.value,
})

const stageTitle = (stage?: string) => {
  if (isTranscriptStyle.value) {
    switch (stage) {
      case 'fact_verification':
        return '补充检索'
      case 'targeted_search':
        return '定向检索'
      case 'parallel_search':
      default:
        return '工具调用'
    }
  }

  switch (stage) {
    case 'fact_verification':
      return '核查补搜'
    case 'targeted_search':
    case 'parallel_search':
    default:
      return '数据声呐'
  }
}

const planningTitle = (stage?: string) => {
  if (isTranscriptStyle.value) {
    switch (stage) {
      case 'report_planning':
        return '准备输出'
      case 'gap_detection':
      case 'targeted_search':
      case 'initial_analysis':
        return '推理记录'
      default:
        return '研究笔记'
    }
  }

  switch (stage) {
    case 'gap_detection':
    case 'targeted_search':
    case 'initial_analysis':
      return '推理复盘'
    case 'report_planning':
      return '收口规划'
    default:
      return '头脑风暴'
  }
}

const researchFlowBlocks = computed<ResearchFlowBlock[]>(() => {
  const blocks: ResearchFlowBlock[] = []
  const planningItems: ResearchTimelineViewItem[] = []
  const searchGroupsByStage = new Map<string, ResearchDataSonarCardItem[]>()
  const searchProgressByStage = new Map<string, string>()
  const stageItemsByStage = new Map<string, ResearchTimelineViewItem[]>()
  const renderedSearchStages = new Set<string>()
  let hasDataSonar = false
  let hasVerification = false
  let hasOutline = false
  let hasReportSignalLocal = false

  const flushPlanning = () => {
    if (!planningItems.length) {
      return
    }
    const firstItem = planningItems[0]
    blocks.push({
      id: `planning-${firstItem.id}`,
      type: 'planning',
      title: isTranscriptStyle.value ? '研究转录' : '深度研究',
      cardTitle: planningTitle(String(firstItem.stage || '')),
      time: firstItem.time || displayTime.value,
      items: [...planningItems],
    })
    planningItems.length = 0
  }

  const appendSearchBlock = (stage: string, fallbackTime?: string) => {
    const normalizedStage = normalizeSearchStage(stage)
    if (renderedSearchStages.has(normalizedStage)) {
      return
    }
    const groups = sortSearchGroups(searchGroupsByStage.get(normalizedStage) || [])
    if (!groups.length) {
      return
    }
    flushPlanning()
    hasDataSonar = true
    renderedSearchStages.add(normalizedStage)
    blocks.push({
      id: `search-${normalizedStage}`,
      type: 'search',
      title: stageTitle(normalizedStage),
      time: groups.find(group => group.time)?.time || fallbackTime || displayTime.value,
      groups,
      progressText: searchProgressByStage.get(normalizedStage) || '',
      items: stageItemsByStage.get(normalizedStage) || [],
    })
  }

  const searchGroups = stagedSearchGroups.value
  searchGroups.forEach((group) => {
    const stage = normalizeSearchStage(group.stage)
    const groups = searchGroupsByStage.get(stage) || []
    groups.push(group)
    searchGroupsByStage.set(stage, groups)
  })

  if (!timelineRef.value.length) {
    planningItems.push(makeFallbackTimelineItem('研究任务已创建', '正在等待服务端执行深度研究'))
  }

  timelineRef.value.forEach((item) => {
    const stage = String(item.stage || '')
    if (stage) {
      const existing = stageItemsByStage.get(stage) || []
      if (item.kind !== 'begin') {
        existing.push(item)
        stageItemsByStage.set(stage, existing)
      }
    }

    if (item.kind === 'begin' || item.kind === 'reasoning' || (item.kind === 'stage' && !['parallel_search', 'targeted_search', 'deep_reading', 'evidence_merge', 'fact_verification', 'report_planning', 'report_writing', 'final_review', 'completed', 'failed', 'stopped'].includes(stage))) {
      planningItems.push(item)
      return
    }

    if (item.kind === 'stage' && ['parallel_search', 'targeted_search', 'deep_reading', 'evidence_merge', 'fact_verification'].includes(stage)) {
      const normalizedStage = normalizeSearchStage(stage)
      const description = String(item.description || '').trim()
      if (description) {
        searchProgressByStage.set(normalizedStage, description)
      }
    }

    if (
      (
        item.kind === 'tool_call'
        && (item.title === '调用网页搜索' || item.title === '调用网页阅读')
        && ['parallel_search', 'targeted_search', 'fact_verification', 'deep_reading', 'evidence_merge'].includes(stage)
      )
    ) {
      appendSearchBlock(stage || 'parallel_search', item.time)
      return
    }

    if (
      (
        item.kind === 'tool_result'
        && (item.title === '网页搜索完成' || item.title === '网页阅读完成')
        && ['parallel_search', 'targeted_search', 'fact_verification', 'deep_reading', 'evidence_merge'].includes(stage)
      )
    ) {
      appendSearchBlock(stage || 'parallel_search', item.time)
      return
    }

    if ((item.kind === 'verification' || stage === 'uncertainty_marking') && !hasVerification) {
      flushPlanning()
      hasVerification = true
      blocks.push({
        id: `verification-${item.id}`,
        type: 'verification',
        title: '分析核查',
        time: item.time || displayTime.value,
        items: stageItemsByStage.get(stage) || [],
      })
      return
    }

    if ((item.kind === 'outline' || stage === 'report_planning') && !hasOutline) {
      flushPlanning()
      hasOutline = true
      blocks.push({
        id: `outline-${item.id}`,
        type: 'outline',
        title: '报告规划',
        time: item.time || displayTime.value,
        items: stageItemsByStage.get(stage) || [],
      })
      return
    }

    if (item.kind === 'section' || item.kind === 'usage' || ['report_writing', 'final_review', 'completed', 'failed', 'stopped'].includes(stage)) {
      hasReportSignalLocal = true
    }
  })

  flushPlanning()

  for (const stage of searchStageOrder) {
    if (!renderedSearchStages.has(stage)) {
      appendSearchBlock(stage)
    }
  }

  hasDataSonar = hasDataSonar || blocks.some(block => block.type === 'search')
  if (hasDataSonar && (props.hasReportSignal || hasReportSignalLocal)) {
    blocks.push({
      id: 'report',
      type: 'report',
      title: isVerificationRecord.value ? '报告核查' : (isTranscriptStyle.value ? '最终回答' : '深度研究'),
      time: timelineRef.value.find(item => item.kind === 'section')?.time || displayTime.value,
      items: [
        ...(stageItemsByStage.get('report_writing') || []),
        ...(stageItemsByStage.get('final_review') || []),
        ...(stageItemsByStage.get('completed') || []),
      ],
    })
  }

  return blocks
})

const activeFlowBlockIndex = computed(() => {
  if (props.done || props.stopped || props.error || !researchFlowBlocks.value.length) {
    return -1
  }
  return researchFlowBlocks.value.length - 1
})

const isActiveFlowBlock = (blockIndex: number) => {
  return blockIndex === activeFlowBlockIndex.value
}

const shouldOpenProcessCard = (blockIndex: number) => {
  const block = researchFlowBlocks.value[blockIndex]
  if (!block || block.type !== 'planning') {
    return false
  }
  if (blockIndex === 0) {
    return true
  }
  return !props.done && blockIndex === researchFlowBlocks.value.length - 1
}

const shouldOpenNodeLog = (blockIndex: number) => {
  if (props.done || props.stopped || props.error) {
    return false
  }
  return isActiveFlowBlock(blockIndex)
}

const formatTimelineNodeTitle = (item: ResearchTimelineViewItem) => {
  if (isTranscriptStyle.value) {
    switch (item.kind) {
      case 'tool_call':
        return item.title || '工具调用'
      case 'tool_result':
        return item.title || '工具结果'
      case 'reasoning':
        return item.title || '推理记录'
      case 'usage':
        return 'Token 统计'
      default:
        return item.title || '事件'
    }
  }

  switch (item.kind) {
    case 'tool_call':
      return `调用：${item.title}`
    case 'tool_result':
      return `结果：${item.title}`
    case 'evidence':
      return '新增信源'
    case 'fact':
      return '更新事实'
    case 'verification':
      return '核查结果'
    case 'outline':
      return '报告大纲'
    case 'reasoning':
      return item.title || '研究推理'
    case 'stage':
      return item.title || '阶段更新'
    default:
      return item.title || '研究节点'
  }
}

const formatTimelineNodeKind = (item: ResearchTimelineViewItem) => {
  if (isTranscriptStyle.value) {
    switch (item.kind) {
      case 'stage':
        return '状态'
      case 'tool_call':
        return '调用'
      case 'tool_result':
        return '结果'
      case 'evidence':
        return '信源'
      case 'fact':
        return '事实'
      case 'reasoning':
        return '推理'
      case 'usage':
        return 'Tokens'
      case 'completed':
        return '结束'
      default:
        return '事件'
    }
  }

  switch (item.kind) {
    case 'stage':
      return '阶段'
    case 'tool_call':
      return '调用'
    case 'tool_result':
      return '结果'
    case 'evidence':
      return '信源'
    case 'fact':
      return '事实'
    case 'reasoning':
      return '推理'
    case 'verification':
      return '核查'
    case 'outline':
      return '大纲'
    case 'section':
      return '写作'
    case 'usage':
      return '用量'
    case 'completed':
      return '完成'
    case 'failed':
      return '失败'
    case 'stopped':
      return '停止'
    default:
      return '节点'
  }
}
</script>
