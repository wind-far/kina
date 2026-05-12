<template>
  <div class="responsive-container-msS_cP responsive-container-Nivf0N">
    <div class="content-DPogfx ai-generated-record-content-hg5EL8">
      <article class="research-chat-record">
        <header class="research-user-message">
          <div class="research-user-message__bubble">{{ prompt }}</div>
        </header>

        <section class="research-assistant-message">
          <div class="research-assistant-message__avatar">
            <el-icon><DataAnalysis /></el-icon>
          </div>
          <div class="research-assistant-message__body">
            <div class="research-flow">
              <div class="research-flow__rail" aria-hidden="true"></div>

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
                  >
                    <summary class="research-node-log__summary">
                      <span>节点详情</span>
                      <span class="research-node-log__chevron">›</span>
                    </summary>
                    <div class="research-node-log__content">
                      <ol class="research-node-log__list">
                        <li
                          v-for="item in block.items"
                          :key="item.id"
                        >
                          <span class="research-node-log__time">{{ item.time }}</span>
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

                  <div v-if="error" class="research-alert research-alert--danger">
                    <el-icon><WarningFilled /></el-icon>
                    <span>{{ error }}</span>
                  </div>

                  <div v-else-if="block.type === 'search'" class="research-search-grid">
                    <article
                      v-for="(group, groupIndex) in block.groups"
                      :key="group.id"
                      class="research-search-card"
                      :class="{ 'is-pending': group.pending, 'is-reading': group.kind === 'reader' }"
                      :style="{ animationDelay: `${groupIndex * 100}ms` }"
                    >
                      <div class="research-search-card__title">
                        <el-icon>
                          <Pointer v-if="group.kind === 'reader'" />
                          <Search v-else />
                        </el-icon>
                        <span>{{ group.title }}</span>
                      </div>
                      <div v-if="group.kind === 'reader'" class="research-search-card__body research-search-card__body--reader">
                        <a
                          class="research-reader-preview__header"
                          :href="group.url || undefined"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div class="research-reader-preview__meta">
                            <span v-if="group.siteIcon" class="research-reader-preview__favicon">
                              <img :src="group.siteIcon" alt="">
                            </span>
                            <span>{{ formatReaderMeta(group) }}</span>
                          </div>
                          <strong v-if="group.headline">{{ group.headline }}</strong>
                        </a>
                        <div class="research-reader-preview__scroll">
                          <p v-if="group.content">{{ group.content }}</p>
                          <p v-else class="research-panel-empty">
                            {{ readReaderEmptyState(group) }}
                          </p>
                        </div>
                      </div>
                      <div v-else-if="group.kind === 'evidence'" class="research-search-card__body">
                        <div class="research-search-source">
                          <span class="research-search-source__favicon">
                            <span>{{ readSourceInitial({ title: group.siteName || group.title }) }}</span>
                          </span>
                          <span class="research-search-source__content">
                            <span v-if="group.siteName" class="research-search-source__site">
                              {{ group.siteName }}
                            </span>
                            <span class="research-search-source__text">{{ group.headline }}</span>
                            <span v-if="group.metaLine" class="research-search-source__meta">
                              {{ group.metaLine }}
                            </span>
                            <span v-if="group.excerpt" class="research-search-source__snippet">
                              {{ group.excerpt }}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div v-else-if="group.kind === 'fact'" class="research-search-card__body">
                        <div class="research-search-source">
                          <span class="research-search-source__favicon">
                            <span>F</span>
                          </span>
                          <span class="research-search-source__content">
                            <span v-if="group.metaLine" class="research-search-source__meta">
                              {{ group.metaLine }}
                            </span>
                            <span class="research-search-source__text research-search-source__text--multiline">
                              {{ group.statement }}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div v-else class="research-search-card__body">
                        <a
                          v-for="(source, sourceIndex) in group.sources"
                          :key="`${group.id}-${source.url || source.title}-${sourceIndex}`"
                          class="research-search-source"
                          :href="source.url || undefined"
                          target="_blank"
                          rel="noopener noreferrer"
                          :style="{ animationDelay: `${sourceIndex * 100}ms` }"
                        >
                          <span class="research-search-source__favicon">
                            <img v-if="source.siteIcon" :src="source.siteIcon" alt="">
                            <span v-else>{{ readSourceInitial(source) }}</span>
                          </span>
                          <span class="research-search-source__content">
                            <span v-if="source.siteName" class="research-search-source__site">
                              {{ source.siteName }}
                            </span>
                            <span class="research-search-source__text">{{ source.title }}</span>
                            <span v-if="formatSourceMeta(source)" class="research-search-source__meta">
                              {{ formatSourceMeta(source) }}
                            </span>
                            <span v-if="source.snippet" class="research-search-source__snippet">
                              {{ source.snippet }}
                            </span>
                          </span>
                        </a>
                        <div v-if="!group.sources.length" class="research-panel-empty">
                          {{ formatSearchEmptyState(group) }}
                        </div>
                      </div>
                    </article>
                  </div>

                  <div v-else-if="block.type === 'verification'" class="research-review-grid">
                    <article class="research-review-card">
                      <div class="research-review-card__title">
                        <el-icon><CircleCheck /></el-icon>
                        <span>事实核查</span>
                      </div>
                      <div v-if="verification" class="research-verification">
                        <div class="research-verification__verdict" :class="`is-${verification.verdict}`">
                          {{ verificationVerdictText }}
                        </div>
                        <div class="research-verification__grid">
                          <span>已核查 {{ verification.checkedFacts }}</span>
                          <span>通过 {{ verification.passedFacts.length }}</span>
                          <span>弱证据 {{ verification.weakFacts.length }}</span>
                          <span>冲突 {{ verification.conflictFacts.length }}</span>
                        </div>
                        <div v-if="verification.unresolvedItems?.length" class="research-verification__issues">
                          <p
                            v-for="(item, index) in verification.unresolvedItems.slice(0, 4)"
                            :key="`${index}-${item}`"
                          >
                            {{ item }}
                          </p>
                        </div>
                      </div>
                      <div v-else class="research-panel-empty">正在核查事实链</div>
                    </article>
                  </div>

                  <div v-else-if="block.type === 'outline'" class="research-review-grid">
                    <article class="research-review-card">
                      <div class="research-review-card__title">
                        <el-icon><Document /></el-icon>
                        <span>报告大纲</span>
                      </div>
                      <ol v-if="outlineSections.length" class="research-outline">
                        <li v-for="section in outlineSections" :key="section.id">
                          <span>{{ section.title }}</span>
                          <p v-if="section.objective">{{ section.objective }}</p>
                        </li>
                      </ol>
                      <div v-else class="research-panel-empty">正在规划报告结构</div>
                    </article>
                  </div>

                  <div v-else-if="block.type === 'report'" class="research-final-message">
                    <details
                      v-if="reportBrainstormItems.length"
                      class="research-final-brainstorm"
                    >
                      <summary class="research-final-brainstorm__summary">
                        <el-icon><Cpu /></el-icon>
                        <span>头脑风暴</span>
                        <span class="research-final-brainstorm__chevron">›</span>
                      </summary>
                      <div class="research-final-brainstorm__content">
                        <p
                          v-for="item in reportBrainstormItems"
                          :key="item.id"
                        >
                          {{ item.description || item.title }}
                        </p>
                      </div>
                    </details>

                    <div class="research-report-verification-banner">
                      <el-icon><WarningFilled /></el-icon>
                      <span>
                        {{ reportVerificationBannerText }}
                        <button type="button">前往核查</button>
                      </span>
                    </div>

                    <div
                      v-if="hasContent"
                      class="research-report-content"
                      :class="{ 'is-streaming': isContentStreaming }"
                      v-html="renderedContent"
                    ></div>
                    <div v-else class="research-report-empty">
                      <el-icon><DataAnalysis /></el-icon>
                      <span>正在整理研究线索与报告结构</span>
                    </div>
                  </div>

                  <footer v-if="block.type === 'report'" class="research-actions">
                    <button type="button">
                      <el-icon><Share /></el-icon>
                      <span>分享</span>
                    </button>
                    <button type="button">
                      <el-icon><CopyDocument /></el-icon>
                      <span>复制</span>
                    </button>
                    <button type="button">
                      <el-icon><Download /></el-icon>
                      <span>导出PDF</span>
                    </button>
                    <button type="button">
                      <el-icon><Files /></el-icon>
                      <span>导出Word</span>
                    </button>
                    <button type="button">
                      <el-icon><Link /></el-icon>
                      <span>查看信源</span>
                    </button>
                    <button type="button" class="research-actions__promote">
                      <el-icon><Promotion /></el-icon>
                      <span>推广公域</span>
                    </button>
                    <button type="button">
                      <el-icon><CircleCheck /></el-icon>
                      <span>点我核查报告，让AI替你找茬！</span>
                    </button>
                    <span v-if="tokenUsage" class="research-token-usage">
                      输入 {{ tokenUsage.inputTokens }} / 输出 {{ tokenUsage.outputTokens }}
                    </span>
                  </footer>
                </div>
              </section>
            </div>
          </div>
        </section>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Aim,
  CircleCheck,
  CopyDocument,
  Cpu,
  DataAnalysis,
  Document,
  Download,
  Files,
  Link,
  MagicStick,
  Pointer,
  Promotion,
  Search,
  Share,
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
  ResearchSearchGroupViewItem,
  ResearchSearchSourceViewItem,
  ResearchTimelineViewItem,
} from './research-report-record.types'

const props = defineProps<{
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
}>()

defineEmits<{
  stop: []
}>()

const displayedContent = ref(props.done ? String(props.content || '') : '')
let typewriterTimer: ReturnType<typeof setTimeout> | null = null

const clearTypewriterTimer = () => {
  if (!typewriterTimer) {
    return
  }
  clearTimeout(typewriterTimer)
  typewriterTimer = null
}

const isResearchScrollArea = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) {
    return null
  }

  return target.closest<HTMLElement>('.research-search-card__body, .research-reader-preview__scroll')
}

const RESEARCH_CARD_WHEEL_INTENT_DELAY_MS = 160
let researchWheelIntentArea: HTMLElement | null = null
let researchWheelIntentAt = 0
let researchWheelPointerX = 0
let researchWheelPointerY = 0

const resetResearchWheelIntent = () => {
  researchWheelIntentArea = null
  researchWheelIntentAt = 0
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

const syncDisplayedContent = () => {
  clearTypewriterTimer()
  const target = String(props.content || '')

  if (!target) {
    displayedContent.value = ''
    return
  }

  if (props.done && !displayedContent.value) {
    displayedContent.value = target
    return
  }

  if (!target.startsWith(displayedContent.value)) {
    displayedContent.value = props.done ? target : ''
  }

  const tick = () => {
    const latestTarget = String(props.content || '')
    if (!latestTarget.startsWith(displayedContent.value)) {
      displayedContent.value = props.done ? latestTarget : ''
    }

    const remaining = latestTarget.length - displayedContent.value.length
    if (remaining <= 0) {
      typewriterTimer = null
      return
    }

    const step = Math.max(1, Math.min(36, Math.ceil(remaining / 24)))
    displayedContent.value = latestTarget.slice(0, displayedContent.value.length + step)
    typewriterTimer = setTimeout(tick, props.done ? 8 : 18)
  }

  tick()
}

watch(() => props.content, syncDisplayedContent, { immediate: true })
watch(() => props.done, syncDisplayedContent)

onMounted(() => {
  document.addEventListener('mousemove', handleResearchCardPointerMoveCapture, { capture: true, passive: true })
  document.addEventListener('wheel', handleResearchCardWheelCapture, { capture: true, passive: false })
})

onBeforeUnmount(() => {
  clearTypewriterTimer()
  document.removeEventListener('mousemove', handleResearchCardPointerMoveCapture, true)
  document.removeEventListener('wheel', handleResearchCardWheelCapture, true)
})

const stripReportHeading = (value: string) => {
  return value.replace(/^\s*#\s*Deep Research\s*执行结果\s*\n+/i, '')
}

const splitReportVerificationSection = (value: string) => {
  const normalized = stripReportHeading(String(value || '').replace(/\r\n/g, '\n')).trim()
  const markerMatch = normalized.match(/\n##\s*核查说明\s*\n/i)

  if (!markerMatch || markerMatch.index === undefined) {
    return {
      body: normalized,
      verificationNotes: '',
    }
  }

  return {
    body: normalized.slice(0, markerMatch.index).trim(),
    verificationNotes: normalized.slice(markerMatch.index + markerMatch[0].length).trim(),
  }
}

const visibleReportContent = computed(() => splitReportVerificationSection(displayedContent.value).body)
const finalReportVerificationNotes = computed(() => splitReportVerificationSection(displayedContent.value || props.content).verificationNotes)

const hasContent = computed(() => Boolean(String(visibleReportContent.value).trim()))
const isContentStreaming = computed(() => {
  return Boolean(props.content) && displayedContent.value.length < String(props.content || '').length
})

const escapeHtml = (value: string) => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const renderInlineMarkdown = (value: string) => {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

const renderedContent = computed(() => {
  const lines = String(visibleReportContent.value || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let listItems: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br>')}</p>`)
    paragraph = []
  }

  const flushList = () => {
    if (!listItems.length) return
    blocks.push(`<ul>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`)
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const level = Math.min(4, heading[1].length)
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const list = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/)
    if (list) {
      flushParagraph()
      listItems.push(list[1])
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  return blocks.join('')
})

const evidences = computed(() => props.evidences || [])
const timeline = computed(() => props.timeline || [])
const outlineSections = computed(() => props.outlineSections || [])
const verification = computed(() => props.verification || null)
const tokenUsage = computed(() => props.tokenUsage || null)

const reportBrainstormItems = computed(() => {
  const lateReasoningItems = timeline.value
    .filter(item => item.kind === 'reasoning' && ['report_planning', 'report_writing', 'final_review', 'completed'].includes(String(item.stage || '')))
    .slice(-2)

  if (lateReasoningItems.length) {
    return lateReasoningItems
  }

  return timeline.value
    .filter(item => item.kind === 'reasoning')
    .slice(-2)
})

const reportVerificationBannerText = computed(() => {
  if (verification.value?.verdict === 'passed') {
    return '此报告内容已完成可信度核查，您也可以'
  }

  if (verification.value?.verdict === 'partial') {
    return '此报告内容已完成部分核查，仍建议继续'
  }

  if (verification.value?.verdict === 'blocked' || finalReportVerificationNotes.value) {
    return '此报告内容存在未完全核查的信息，您可以'
  }

  return '此报告内容尚未进行可信度核查，您可以'
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

const readReaderFailureReason = (item: Extract<ResearchDataSonarCard, { kind: 'reader' }>) => {
  const title = String(item.headline || item.title || '').trim().toLowerCase()
  const excerpt = String(item.excerpt || '').trim()
  const content = String(item.content || '').trim()
  const combined = `${excerpt}\n${content}`.trim()
  const contentLength = typeof item.contentLength === 'number' ? item.contentLength : combined.length

  if (/^\{"_waf_/u.test(combined) || title === 'xueqiu.com') {
    return '页面触发站点安全拦截，已跳过'
  }

  if (title === 'www.binance.com' || title === 'www.toutiao.com' || !contentLength) {
    return '页面没有返回有效正文，已跳过'
  }

  if (contentLength < 120) {
    return '页面内容过少，已跳过'
  }

  return ''
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

type ResearchDataSonarCard =
  | (ResearchSearchGroupViewItem & { kind?: 'search' })
  | {
      id: string
      kind: 'reader'
      query: string
      title: string
      sources: ResearchSearchSourceViewItem[]
      stage?: string
      time?: string
      pending?: boolean
      order?: number
      url: string
      headline: string
      excerpt: string
      content: string
      siteName: string
      siteIcon: string
      referenceIndex?: number
      contentLength?: number
    }
  | {
      id: string
      kind: 'evidence'
      query: string
      title: string
      sources: ResearchSearchSourceViewItem[]
      stage?: string
      time?: string
      pending?: boolean
      order?: number
      headline: string
      excerpt: string
      siteName: string
      metaLine: string
    }
  | {
      id: string
      kind: 'fact'
      query: string
      title: string
      sources: ResearchSearchSourceViewItem[]
      stage?: string
      time?: string
      pending?: boolean
      order?: number
      statement: string
      metaLine: string
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

  if (!evidences.value.length) {
    return []
  }

  return [{
    id: 'evidence-fallback',
    query: '已采纳信源',
    title: '已采纳信源',
    sources: evidences.value.slice(0, 12).map(evidence => ({
      title: evidence.title || evidence.source?.title || '未命名信源',
      url: evidence.source?.url || '',
      siteName: evidence.source?.sourceType || '',
      snippet: evidence.summary || evidence.source?.note || '',
    })),
  }]
})

const searchCallGroups = computed<ResearchSearchGroupViewItem[]>(() => {
  const existingQueries = new Set(visibleSearchGroups.value.map(group => group.query || group.title))
  return timeline.value
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

const readerCards = computed<ResearchDataSonarCard[]>(() => {
  const readEvents = timeline.value
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        const stage = String(item.stage || '')
        return ['deep_reading', 'evidence_merge'].includes(stage)
          && (item.kind === 'tool_call' || item.kind === 'tool_result')
          && (item.title.includes('网页阅读') || readTimelineMetaString(item, 'url'))
      })

  const cardMap = new Map<string, Extract<ResearchDataSonarCard, { kind: 'reader' }>>()

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
    const nextCard: Extract<ResearchDataSonarCard, { kind: 'reader' }> = {
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

const evidenceCards = computed<ResearchDataSonarCard[]>(() => {
  return timeline.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === 'evidence' && String(item.stage || '') === 'evidence_merge')
    .map(({ item, index }) => ({
      id: `evidence-${item.id}`,
      kind: 'evidence' as const,
      query: '',
      title: '新增信源',
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

const factCards = computed<ResearchDataSonarCard[]>(() => {
  return timeline.value
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === 'fact' && String(item.stage || '') === 'evidence_merge')
    .map(({ item, index }) => ({
      id: `fact-${item.id}`,
      kind: 'fact' as const,
      query: '',
      title: '更新事实',
      sources: [],
      stage: item.stage,
      time: item.time,
      pending: false,
      order: 2000 + index,
      statement: item.description || item.title,
      metaLine: item.confidence ? `置信度 ${item.confidence}` : '',
    }))
})

const stagedSearchGroups = computed<ResearchDataSonarCard[]>(() => {
  return [...visibleSearchGroups.value, ...searchCallGroups.value, ...readerCards.value, ...evidenceCards.value, ...factCards.value]
      .sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999))
      .slice(0, 18)
})

const searchStageOrder = ['parallel_search', 'targeted_search', 'deep_reading', 'evidence_merge', 'fact_verification']

const normalizeSearchStage = (stage?: string) => {
  return searchStageOrder.includes(String(stage || ''))
    ? String(stage || '')
    : 'parallel_search'
}

const sortSearchGroups = (groups: ResearchDataSonarCard[]) => {
  return groups.slice().sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999))
}

type ResearchFlowBlock =
  | {
      id: string
      type: 'planning'
      title: string
      cardTitle: string
      time: string
      items: ResearchTimelineViewItem[]
    }
  | {
      id: string
      type: 'search'
      title: string
      time: string
      groups: ResearchDataSonarCard[]
      progressText?: string
      items: ResearchTimelineViewItem[]
    }
  | {
      id: string
      type: 'verification' | 'outline' | 'report'
      title: string
      time: string
      items: ResearchTimelineViewItem[]
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
  const searchGroupsByStage = new Map<string, ResearchDataSonarCard[]>()
  const searchProgressByStage = new Map<string, string>()
  const stageItemsByStage = new Map<string, ResearchTimelineViewItem[]>()
  const renderedSearchStages = new Set<string>()
  let hasDataSonar = false
  let hasVerification = false
  let hasOutline = false
  let hasReportSignal = false

  const flushPlanning = () => {
    if (!planningItems.length) {
      return
    }
    const firstItem = planningItems[0]
    blocks.push({
      id: `planning-${firstItem.id}`,
      type: 'planning',
      title: '深度研究',
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

  if (!timeline.value.length) {
    planningItems.push(makeFallbackTimelineItem('研究任务已创建', '正在等待服务端执行深度研究'))
  }

  timeline.value.forEach((item) => {
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
      hasReportSignal = true
    }
  })

  flushPlanning()

  for (const stage of searchStageOrder) {
    if (!renderedSearchStages.has(stage)) {
      appendSearchBlock(stage)
    }
  }

  if (!hasVerification && verification.value) {
    blocks.push({
      id: 'verification-result',
      type: 'verification',
      title: '分析核查',
      time: displayTime.value,
      items: stageItemsByStage.get('fact_verification') || stageItemsByStage.get('final_review') || [],
    })
  }

  if (!hasOutline && outlineSections.value.length) {
    blocks.push({
      id: 'outline-ready',
      type: 'outline',
      title: '报告规划',
      time: displayTime.value,
      items: stageItemsByStage.get('report_planning') || [],
    })
  }

  hasDataSonar = hasDataSonar || blocks.some(block => block.type === 'search')
  if (hasDataSonar && (hasContent.value || hasReportSignal)) {
    blocks.push({
      id: 'report',
      type: 'report',
      title: '深度研究',
      time: timeline.value.find(item => item.kind === 'section')?.time || displayTime.value,
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

const verificationVerdictText = computed(() => {
  switch (verification.value?.verdict) {
    case 'passed':
      return '核查通过'
    case 'partial':
      return '部分通过'
    case 'blocked':
      return '核查受阻'
    default:
      return '等待核查'
  }
})

const formatTimelineNodeTitle = (item: ResearchTimelineViewItem) => {
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

const readSourceInitial = (source: ResearchSearchSourceViewItem) => {
  const text = String(source.siteName || source.title || '').trim()
  return text.slice(0, 1).toUpperCase() || '链'
}

const readResearchSourceDomain = (url?: string) => {
  const value = String(url || '').trim()
  if (!value) {
    return ''
  }

  try {
    return new URL(value).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

const formatSourceMeta = (source: ResearchSearchSourceViewItem) => {
  const parts = [
    source.referenceIndex ? `#${source.referenceIndex}` : '',
    source.publishedTime || '',
  ].filter(Boolean)
  return parts.join(' · ')
}

const formatReaderMeta = (item: Extract<ResearchDataSonarCard, { kind: 'reader' }>) => {
  const parts = [
    item.siteName,
    item.referenceIndex ? `#${item.referenceIndex}` : '',
    item.contentLength ? `${item.contentLength} 字符` : '',
  ].filter(Boolean)
  return parts.join(' · ') || '网页阅读'
}

const readReaderEmptyState = (item: Extract<ResearchDataSonarCard, { kind: 'reader' }>) => {
  if (item.pending) {
    return '正在读取网页内容'
  }

  return readReaderFailureReason(item) || '暂无可展示的网页摘要'
}

const formatSearchEmptyState = (group: ResearchSearchGroupViewItem) => {
  if (group.pending) {
    return '搜索中'
  }

  if (group.diagnostics) {
    return '搜索上游未返回可用链接'
  }

  return '未搜索到相关信息'
}

const displayTime = computed(() => {
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
})

</script>

<style scoped>
.research-chat-record {
  --research-text-primary: var(--text-primary, #0f1419);
  --research-text-secondary: var(--text-secondary, #536471);
  --research-text-tertiary: var(--text-tertiary, #72808a);
  --research-text-disabled: var(--text-disabled, rgba(83, 100, 113, 0.36));
  --research-link: var(--text-link, var(--brand-main-default, #00a1c2));
  --research-brand: var(--brand-main-default, #00a1c2);
  --research-brand-hover: var(--brand-main-hover, #0996b2);
  --research-brand-soft: var(--brand-main-block-default, rgba(0, 161, 194, 0.12));
  --research-page: var(--theme-page-background, var(--bg-body, #f8f9fa));
  --research-surface: var(--theme-surface-background, var(--bg-surface, #ffffff));
  --research-float: var(--bg-float, var(--research-surface));
  --research-block: var(--bg-block-secondary-default, rgba(0, 0, 0, 0.05));
  --research-block-hover: var(--bg-block-secondary-hover, rgba(0, 0, 0, 0.08));
  --research-block-pressed: var(--bg-block-secondary-pressed, rgba(0, 0, 0, 0.12));
  --research-border: var(--stroke-primary, rgba(0, 0, 0, 0.12));
  --research-border-soft: var(--stroke-secondary, rgba(0, 0, 0, 0.08));
  --research-border-faint: var(--stroke-tertiary, rgba(0, 0, 0, 0.06));
  --research-card: color-mix(in srgb, var(--research-surface) 92%, var(--research-brand) 8%);
  --research-card-strong: color-mix(in srgb, var(--research-surface) 86%, var(--research-brand) 14%);
  --research-shadow: color-mix(in srgb, var(--research-text-primary) 12%, transparent);
  --research-warning: var(--brand-warning-default, #b7791f);
  --research-danger: var(--brand-danger-default, #dc2626);
  width: min(1120px, calc(100vw - 96px));
  margin: 0 auto;
  color: var(--research-text-primary);
}

.research-user-message {
  display: flex;
  justify-content: flex-end;
  margin: 0 0 42px;
}

.research-user-message__bubble {
  max-width: min(620px, 80%);
  padding: 12px 18px;
  border: 1px solid var(--research-border-soft);
  border-radius: 8px;
  color: var(--research-text-primary);
  background: var(--research-block-hover);
  font-size: 14px;
  line-height: 22px;
  word-break: break-word;
}

.research-assistant-message {
  display: block;
}

.research-assistant-message__avatar {
  display: none;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--research-border-soft);
  border-radius: 999px;
  color: var(--research-brand);
  background: var(--research-surface);
  box-shadow: 0 0 0 4px var(--research-page);
}

.research-assistant-message__body {
  min-width: 0;
}

.research-flow {
  position: relative;
  padding-left: 96px;
}

.research-flow__rail {
  position: absolute;
  top: 2px;
  bottom: 0;
  left: 40px;
  width: 1px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--research-brand) 42%, transparent),
    color-mix(in srgb, var(--research-brand) 18%, transparent)
  );
}

.research-flow-step {
  position: relative;
  margin-bottom: 40px;
  animation: researchFadeIn 0.28s ease both;
}

.research-flow-step:last-child {
  margin-bottom: 0;
}

.research-flow-step__marker {
  position: absolute;
  z-index: 2;
  top: -8px;
  left: -80px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 1px solid color-mix(in srgb, var(--research-brand) 48%, var(--research-border));
  border-radius: 999px;
  color: var(--research-brand);
  background: var(--research-surface);
  /*box-shadow:
    0 0 0 8px var(--research-page),
    0 0 22px color-mix(in srgb, var(--research-brand) 20%, transparent);
*/  font-size: 18px;
  transition: border-color 0.24s ease, color 0.24s ease, box-shadow 0.24s ease, transform 0.24s ease;
}

.research-flow-step__marker::before,
.research-flow-step__marker::after {
  position: absolute;
  inset: -8px;
  border-radius: inherit;
  pointer-events: none;
  content: '';
}

.research-flow-step__marker::before {
  border: 1px solid color-mix(in srgb, var(--research-brand) 28%, transparent);
  opacity: 0;
}

.research-flow-step__marker::after {
  inset: -15px;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--research-brand) 20%, transparent) 0%,
    transparent 68%
  );
  opacity: 0;
}

.research-flow-step.is-active .research-flow-step__marker {
  border-color: color-mix(in srgb, var(--research-brand) 76%, var(--research-border));
  /*box-shadow:
    0 0 0 8px var(--research-page),
    0 0 28px color-mix(in srgb, var(--research-brand) 34%, transparent);
*/  animation: researchMarkerBreath 1.8s ease-in-out infinite;
}

.research-flow-step.is-active .research-flow-step__marker::before {
  animation: researchMarkerRing 1.8s ease-out infinite;
}

.research-flow-step.is-active .research-flow-step__marker::after {
  animation: researchMarkerGlow 1.8s ease-in-out infinite;
}

.research-flow-step.is-complete .research-flow-step__marker {
  opacity: 0.82;
}

.research-flow-step__content {
  min-width: 0;
}

.research-flow-step__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  margin-bottom: 10px;
  color: var(--research-text-tertiary);
  font-size: 14px;
  line-height: 22px;
}

.research-process-card {
  overflow: hidden;
  border: 1px solid var(--research-border);
  border-radius: 6px;
  background: var(--research-surface);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--research-shadow) 56%, transparent);
}

.research-process-card__summary {
  display: flex;
  align-items: center;
  min-height: 36px;
  gap: 8px;
  padding: 0 12px;
  color: var(--research-text-primary);
  background: var(--research-card-strong);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  list-style: none;
}

.research-process-card__summary-icon {
  color: var(--research-text-secondary);
  font-size: 16px;
}

.research-process-card__summary::-webkit-details-marker {
  display: none;
}

.research-process-card__chevron {
  margin-left: auto;
  color: var(--research-text-secondary);
  transform: rotate(90deg);
  transition: transform 0.2s ease;
}

.research-process-card[open] .research-process-card__chevron {
  transform: rotate(-90deg);
}

.research-process-card__content {
  max-height: 250px;
  overflow: auto;
  padding: 12px 14px;
  color: var(--research-text-secondary);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--research-surface) 96%, var(--research-brand) 4%),
    color-mix(in srgb, var(--research-surface) 90%, var(--research-brand) 10%)
  );
}

.research-flow-step__status {
  margin: 6px 0 10px;
  color: var(--research-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.research-node-log {
  margin-bottom: 10px;
  border: 1px solid var(--research-border-soft);
  border-radius: 6px;
  background: var(--research-surface);
}

.research-node-log__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  color: var(--research-text-primary);
  font-size: 12px;
  line-height: 18px;
  list-style: none;
}

.research-node-log__summary::-webkit-details-marker {
  display: none;
}

.research-node-log__chevron {
  color: var(--research-text-tertiary);
  transition: transform 0.2s ease;
}

.research-node-log[open] .research-node-log__chevron {
  transform: rotate(90deg);
}

.research-node-log__content {
  padding: 0 12px 10px;
}

.research-node-log__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.research-node-log__list li + li {
  margin-top: 8px;
}

.research-node-log__time {
  display: inline-block;
  margin-right: 8px;
  color: var(--research-text-tertiary);
  font-size: 11px;
}

.research-node-log__title {
  color: var(--research-text-primary);
  font-size: 12px;
  font-weight: 600;
}

.research-node-log__desc {
  margin: 4px 0 0 0;
  color: var(--research-text-secondary);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.research-process-list {
  margin: 0;
  padding-left: 18px;
}

.research-process-list li {
  margin: 0 0 9px;
  padding-left: 2px;
  font-size: 12px;
  line-height: 18px;
  animation: researchFadeIn 0.3s ease both;
}

.research-process-list li:last-child {
  margin-bottom: 0;
}

.research-process-list span {
  color: var(--research-text-primary);
  font-weight: 600;
}

.research-process-list p {
  margin: 2px 0 0;
  color: var(--research-text-secondary);
}

.research-search-grid {
  display: flex;
  flex-flow: row wrap;
  align-items: flex-start;
  gap: 5px;
}

.research-search-card {
  display: flex;
  width: 250px;
  min-width: 250px;
  height: 320px;
  min-height: 320px;
  max-height: 320px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--research-border);
  border-radius: 6px;
  background: var(--research-card);
  animation: researchFadeIn 0.36s ease both;
  transition: border-color 0.24s ease, transform 0.24s ease, box-shadow 0.24s ease;
}

.research-search-card:hover {
  border-color: color-mix(in srgb, var(--research-brand) 52%, var(--research-border));
  box-shadow: 0 12px 24px var(--research-shadow);
  transform: translateY(-1px);
}

.research-search-card.is-pending {
  border-color: color-mix(in srgb, var(--research-brand) 44%, var(--research-border));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--research-brand) 16%, transparent);
}

.research-search-card.is-reading {
  height: 320px;
  min-height: 320px;
  max-height: 320px;
}

.research-search-card__title {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 12px;
  border-bottom: 1px solid var(--research-border-soft);
  color: var(--research-text-primary);
  font-size: 12px;
  line-height: 18px;
}

.research-search-card__title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.research-search-card__body {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 12px;
  scrollbar-color: color-mix(in srgb, var(--research-text-tertiary) 58%, transparent) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.research-search-card__body::-webkit-scrollbar,
.research-reader-preview__scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.research-search-card__body::-webkit-scrollbar-corner,
.research-reader-preview__scroll::-webkit-scrollbar-corner {
  background: transparent;
}

.research-search-card__body::-webkit-scrollbar-track,
.research-reader-preview__scroll::-webkit-scrollbar-track {
  background: transparent;
}

.research-search-card__body::-webkit-scrollbar-thumb,
.research-reader-preview__scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--research-text-tertiary) 48%, transparent);
}

.research-search-card__body:hover::-webkit-scrollbar-thumb,
.research-reader-preview__scroll:hover::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--research-text-tertiary) 70%, transparent);
}

.research-search-card__body--reader {
  gap: 0;
  overflow: hidden;
  padding: 0;
}

.research-search-card__body > .research-panel-empty {
  display: flex;
  min-height: 88px;
  flex: 1;
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 26px;
  color: var(--research-text-tertiary);
}

.research-search-source {
  display: flex;
  flex: 0 0 auto;
  min-width: 0;
  align-items: flex-start;
  gap: 8px;
  color: var(--research-link);
  text-decoration: none;
  font-size: 13px;
  line-height: 20px;
  animation: researchFadeIn 0.32s ease both;
}

.research-search-source:hover .research-search-source__text {
  text-decoration: underline;
}

.research-search-source__favicon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  color: var(--research-brand);
  background: var(--research-brand-soft);
  font-size: 10px;
  font-weight: 700;
}

.research-search-source__favicon img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.research-search-source__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.research-search-source__site {
  overflow: hidden;
  color: var(--research-text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 16px;
}

.research-search-source__text {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.research-search-source__text--multiline {
  display: -webkit-box;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}

.research-search-source__meta {
  overflow: hidden;
  color: var(--research-text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 15px;
}

.research-search-source__snippet {
  display: -webkit-box;
  overflow: hidden;
  color: var(--research-text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 17px;
}

.research-reader-preview__header {
  display: block;
  flex: 0 0 auto;
  padding: 12px 14px 10px;
  color: var(--research-text-secondary);
  text-decoration: none;
}

.research-reader-preview__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--research-text-tertiary);
  font-size: 11px;
  line-height: 16px;
}

.research-reader-preview__favicon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--research-brand-soft);
}

.research-reader-preview__favicon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.research-reader-preview__header strong {
  display: block;
  color: var(--research-text-primary);
  font-size: 14px;
  line-height: 22px;
}

.research-reader-preview__scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 14px 18px;
  border-top: 1px solid var(--research-border-soft);
  mask-image: linear-gradient(black 86%, transparent 100%);
  scrollbar-color: color-mix(in srgb, var(--research-text-tertiary) 58%, transparent) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.research-reader-preview__scroll p {
  margin: 0;
  color: var(--research-text-secondary);
  font-size: 12px;
  line-height: 20px;
  white-space: pre-wrap;
}

.research-search-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 104px;
  padding: 18px;
  border: 1px dashed var(--research-border);
  border-radius: 6px;
  color: var(--research-text-tertiary);
  background: var(--research-block);
  font-size: 13px;
}

@keyframes researchFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes researchMarkerBreath {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.06);
  }
}

@keyframes researchMarkerRing {
  0% {
    opacity: 0.72;
    transform: scale(0.82);
  }

  70% {
    opacity: 0;
    transform: scale(1.38);
  }

  100% {
    opacity: 0;
    transform: scale(1.38);
  }
}

@keyframes researchMarkerGlow {
  0%,
  100% {
    opacity: 0.16;
    transform: scale(0.92);
  }

  50% {
    opacity: 0.34;
    transform: scale(1.08);
  }
}

.research-review-grid {
  display: block;
  gap: 8px;
}

.research-review-card {
  width: min(620px, 100%);
  min-width: 0;
  min-height: 188px;
  padding: 12px;
  border: 1px solid var(--research-border);
  border-radius: 6px;
  background: var(--research-surface);
}

.research-review-card__title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--research-text-primary);
  font-size: 13px;
  font-weight: 650;
  line-height: 20px;
}

.research-stop-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 26px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--research-danger) 36%, var(--research-border));
  border-radius: 7px;
  color: var(--research-danger);
  background: color-mix(in srgb, var(--research-danger) 12%, transparent);
  cursor: pointer;
  font-size: 12px;
}

.research-stop-button:hover {
  background: color-mix(in srgb, var(--research-danger) 18%, transparent);
}

.research-progress-strip {
  margin: 12px 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--research-brand) 22%, var(--research-border));
  border-radius: 8px;
  background: var(--research-brand-soft);
}

.research-progress-strip__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--research-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.research-progress-strip__track {
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--research-block);
}

.research-progress-strip__track div {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--research-brand), var(--research-brand-hover));
  transition: width 0.24s ease;
}

.research-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 18px;
}

.research-alert--warning {
  border: 1px solid color-mix(in srgb, var(--research-warning) 32%, var(--research-border));
  color: var(--research-warning);
  background: color-mix(in srgb, var(--research-warning) 12%, transparent);
}

.research-alert--danger {
  border: 1px solid color-mix(in srgb, var(--research-danger) 32%, var(--research-border));
  color: var(--research-danger);
  background: color-mix(in srgb, var(--research-danger) 12%, transparent);
}

.research-final-message {
  max-width: min(100%, 920px);
}

.research-final-brainstorm {
  margin: 0 0 10px;
}

.research-final-brainstorm__summary {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  border: 1px solid var(--research-border);
  border-radius: 6px;
  color: var(--research-text-secondary);
  background: var(--research-block);
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  cursor: pointer;
  list-style: none;
  transition: color 0.2s ease, background 0.2s ease;
}

.research-final-brainstorm__summary::-webkit-details-marker {
  display: none;
}

.research-final-brainstorm__summary:hover {
  color: var(--research-text-primary);
  background: var(--research-block-hover);
}

.research-final-brainstorm__chevron {
  margin-left: auto;
  color: var(--research-text-tertiary);
  font-size: 18px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

.research-final-brainstorm[open] .research-final-brainstorm__chevron {
  transform: rotate(90deg);
}

.research-final-brainstorm__content {
  padding: 10px 12px;
  border: 1px solid var(--research-border-soft);
  border-top: 0;
  border-radius: 0 0 6px 6px;
  color: var(--research-text-secondary);
  background: color-mix(in srgb, var(--research-surface) 88%, transparent);
  font-size: 12px;
  line-height: 1.7;
}

.research-final-brainstorm__content p {
  margin: 0 0 8px;
}

.research-final-brainstorm__content p:last-child {
  margin-bottom: 0;
}

.research-report-verification-banner {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 14px 0;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--research-warning) 36%, var(--research-border));
  border-radius: 6px;
  color: var(--research-warning);
  background: color-mix(in srgb, var(--research-warning) 13%, transparent);
  font-size: 12px;
  line-height: 18px;
}

.research-report-verification-banner button {
  padding: 0;
  border: 0;
  color: var(--research-link);
  background: transparent;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.research-report-content {
  color: var(--research-text-primary);
  font-size: 14px;
  line-height: 1.86;
  word-break: break-word;
}

.research-report-content.is-streaming::after {
  display: inline-block;
  width: 7px;
  height: 1.15em;
  margin-left: 3px;
  vertical-align: -0.18em;
  border-radius: 999px;
  background: var(--research-brand);
  animation: researchCursorBlink 0.9s steps(2, start) infinite;
  content: '';
}

@keyframes researchCursorBlink {
  50% {
    opacity: 0;
  }
}

.research-report-content :deep(h1),
.research-report-content :deep(h2),
.research-report-content :deep(h3),
.research-report-content :deep(h4) {
  color: var(--research-text-primary);
  margin: 20px 0 10px;
  line-height: 1.35;
}

.research-report-content :deep(h1) {
  font-size: 23px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--research-border-soft);
}

.research-report-content :deep(h2) {
  font-size: 18px;
}

.research-report-content :deep(h3) {
  font-size: 16px;
}

.research-report-content :deep(p) {
  margin: 10px 0;
}

.research-report-content :deep(ul) {
  margin: 10px 0;
  padding-left: 20px;
}

.research-report-content :deep(li) {
  margin: 5px 0;
}

.research-report-content :deep(a) {
  color: var(--research-link);
  text-decoration: none;
}

.research-report-content :deep(a:hover) {
  text-decoration: underline;
}

.research-report-content :deep(code) {
  padding: 2px 5px;
  border-radius: 5px;
  color: var(--research-danger);
  background: var(--research-block);
}

.research-report-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  color: var(--research-text-tertiary);
  font-size: 14px;
}

.research-outline {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.research-outline li {
  padding: 8px 0;
  border-bottom: 1px dashed var(--research-border-soft);
}

.research-outline li:last-child {
  border-bottom: 0;
}

.research-outline span {
  color: var(--research-text-primary);
  font-size: 12px;
  font-weight: 600;
}

.research-outline p,
.research-verification p {
  margin: 3px 0 0;
  color: var(--research-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.research-verification {
  margin-top: 10px;
}

.research-verification__verdict {
  display: inline-flex;
  padding: 4px 9px;
  border-radius: 6px;
  color: var(--research-text-primary);
  background: var(--research-block);
  font-size: 12px;
  line-height: 18px;
}

.research-verification__verdict.is-passed {
  color: var(--brand-success-default, #16a34a);
  background: color-mix(in srgb, var(--brand-success-default, #16a34a) 14%, transparent);
}

.research-verification__verdict.is-partial {
  color: var(--research-warning);
  background: color-mix(in srgb, var(--research-warning) 14%, transparent);
}

.research-verification__verdict.is-blocked {
  color: var(--research-danger);
  background: color-mix(in srgb, var(--research-danger) 14%, transparent);
}

.research-verification__grid,
.research-token-usage {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}

.research-verification__grid span,
.research-token-usage span {
  padding: 7px;
  border-radius: 7px;
  color: var(--research-text-secondary);
  background: var(--research-block);
  font-size: 12px;
  line-height: 16px;
}

.research-verification__issues {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.research-verification__issues p {
  margin: 0;
  padding: 9px 10px;
  border-radius: 7px;
  color: var(--research-text-secondary);
  background: var(--research-block);
}

.research-panel-empty {
  margin-top: 10px;
  color: var(--research-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.research-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.research-actions button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--research-border-soft);
  border-radius: 7px;
  color: var(--research-text-secondary);
  background: var(--research-block);
  cursor: pointer;
  font-size: 12px;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.research-actions button:hover {
  color: var(--research-text-primary);
  background: var(--research-block-hover);
}

.research-actions__promote {
  border-color: color-mix(in srgb, var(--research-warning) 34%, var(--research-border)) !important;
  color: var(--research-warning) !important;
  background: color-mix(in srgb, var(--research-warning) 12%, transparent) !important;
  font-weight: 700;
}

.research-token-usage {
  display: inline-flex;
  margin-left: auto;
  color: var(--research-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}

:global(html[data-theme='dark']) .research-chat-record,
:global(body[lv-theme='dark']) .research-chat-record {
  --research-card: color-mix(in srgb, var(--bg-surface, #15161a) 82%, var(--brand-main-default, #00cae0) 8%);
  --research-card-strong: color-mix(in srgb, var(--bg-surface, #15161a) 72%, var(--brand-main-default, #00cae0) 10%);
  --research-shadow: rgba(0, 0, 0, 0.28);
}

@media (prefers-reduced-motion: reduce) {
  .research-flow-step,
  .research-search-card,
  .research-search-source,
  .research-report-content.is-streaming::after,
  .research-flow-step.is-active .research-flow-step__marker,
  .research-flow-step.is-active .research-flow-step__marker::before,
  .research-flow-step.is-active .research-flow-step__marker::after {
    animation: none;
  }
}

@media (max-width: 760px) {
  .research-chat-record {
    width: 100%;
  }

  .research-user-message {
    margin-bottom: 24px;
  }

  .research-user-message__bubble {
    max-width: 100%;
  }

  .research-assistant-message {
    display: block;
  }

  .research-assistant-message__avatar {
    display: none;
  }

  .research-flow {
    padding-left: 58px;
  }

  .research-flow__rail {
    left: 22px;
  }

  .research-flow-step__marker {
    top: -5px;
    left: -55px;
    width: 38px;
    height: 38px;
    box-shadow:
      0 0 0 6px var(--research-page),
      0 0 18px color-mix(in srgb, var(--research-brand) 18%, transparent);
  }

  .research-flow-step__meta {
    align-items: flex-start;
    flex-direction: column;
  }

  .research-review-grid,
  .research-report-header {
    grid-template-columns: minmax(0, 1fr);
  }

  .research-search-grid {
    flex-direction: column;
  }

  .research-search-card {
    width: 100%;
    min-width: 0;
    height: 320px;
    min-height: 320px;
    max-height: 320px;
  }

  .research-report-header {
    flex-direction: column;
  }

  .research-actions {
    align-items: stretch;
  }

  .research-token-usage {
    width: 100%;
    margin-left: 0;
  }
}
</style>
