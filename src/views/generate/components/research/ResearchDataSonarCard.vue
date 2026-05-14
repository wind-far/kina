<template>
  <article
    class="research-search-card"
    :class="{ 'is-pending': group.pending, 'is-reading': group.kind === 'reader' }"
    :style="{ animationDelay: `${index * 100}ms` }"
  >
    <div class="research-search-card__title">
      <el-icon>
        <Pointer v-if="group.kind === 'reader'" />
        <Search v-else />
      </el-icon>
      <span>{{ formatSearchCardTitle(group) }}</span>
      <span
        v-if="readSearchCardTag(group)"
        class="research-search-card__tag"
      >
        {{ readSearchCardTag(group) }}
      </span>
    </div>
    <div v-if="group.kind === 'reader'" class="research-search-card__body research-search-card__body--reader">
      <a
        :id="readSearchCardAnchorId(group)"
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
        :id="readSearchSourceAnchorId(group, source, sourceIndex)"
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
</template>

<script setup lang="ts">
import { Pointer, Search } from '@element-plus/icons-vue'
import type {
  ResearchDataSonarCard,
  ResearchSearchGroupViewItem,
  ResearchSearchSourceViewItem,
} from '../research-report-record.types'
import {
  readSearchCardAnchorId,
  readSearchSourceAnchorId,
} from '@/composables/research/useCitationRenderer'

// 单张数据声呐卡片，支持 search / reader / evidence / fact 四种类型。
// 文案展示由 isTranscriptStyle prop 决定（"研究转录" vs "研究流程"两套用语）。
const props = defineProps<{
  group: ResearchDataSonarCard
  index: number
  isTranscriptStyle: boolean
}>()

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

const formatSearchCardTitle = (group: ResearchDataSonarCard) => {
  if (!props.isTranscriptStyle) {
    return group.title
  }
  if (group.kind === 'reader') {
    return group.headline || group.title || '网页阅读'
  }
  if (group.kind === 'evidence') {
    return group.headline || group.title || '采纳信源'
  }
  if (group.kind === 'fact') {
    return group.title || '提取事实'
  }
  return group.query || group.title || '搜索结果'
}

const readSearchCardTag = (group: ResearchDataSonarCard) => {
  if (!props.isTranscriptStyle) {
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

const readSourceInitial = (source: { siteName?: string; title?: string }) => {
  const text = String(source.siteName || source.title || '').trim()
  return text.slice(0, 1).toUpperCase() || '链'
}

const formatSourceMeta = (source: ResearchSearchSourceViewItem) => {
  const parts = [
    source.referenceIndex ? (props.isTranscriptStyle ? `候选 #${source.referenceIndex}` : `#${source.referenceIndex}`) : '',
    source.publishedTime || '',
  ].filter(Boolean)
  return parts.join(' · ')
}

const formatReaderMeta = (item: Extract<ResearchDataSonarCard, { kind: 'reader' }>) => {
  const parts = [
    item.siteName,
    item.referenceIndex ? (props.isTranscriptStyle ? `引用 #${item.referenceIndex}` : `#${item.referenceIndex}`) : '',
    item.contentLength ? `${item.contentLength} 字符` : '',
  ].filter(Boolean)
  return parts.join(' · ') || (props.isTranscriptStyle ? '网页读取结果' : '网页阅读')
}

const readReaderEmptyState = (item: Extract<ResearchDataSonarCard, { kind: 'reader' }>) => {
  if (item.pending) {
    return props.isTranscriptStyle ? '等待网页返回正文' : '正在读取网页内容'
  }
  return readReaderFailureReason(item) || (props.isTranscriptStyle ? '该次读取没有返回可展示正文' : '暂无可展示的网页摘要')
}

const formatSearchEmptyState = (group: ResearchSearchGroupViewItem) => {
  if (group.pending) {
    return props.isTranscriptStyle ? '等待搜索结果返回' : '搜索中'
  }
  if (group.diagnostics) {
    return props.isTranscriptStyle ? '该次搜索没有返回可用结果' : '搜索上游未返回可用链接'
  }
  return props.isTranscriptStyle ? '该次搜索没有命中可展示结果' : '未搜索到相关信息'
}
</script>
