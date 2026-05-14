// 研究报告正文中的 [n] 引用胶囊：从 reader / search / evidence 派生预览映射，
// 渲染为带 tooltip 的 <span class="research-inline-citation">。

import { computed, type ComputedRef } from 'vue'
import type { ResearchEvidence } from '@/shared/research/research-types'
import type {
  ResearchCitationPreview,
  ResearchCitationTooltipData,
  ResearchDataSonarCard,
  ResearchSearchGroupViewItem,
  ResearchSearchSourceViewItem,
} from '@/views/generate/components/research-report-record.types'
import { escapeHtml, readResearchSourceDomain } from './report-markdown-utils'

export interface UseCitationRendererOptions {
  readerCards: ComputedRef<ResearchDataSonarCard[]>
  stagedSearchGroups: ComputedRef<ResearchDataSonarCard[]>
  evidences: ComputedRef<ResearchEvidence[]>
  visibleReportContent: ComputedRef<string>
}

// 锚点 id 计算与 ResearchDataSonarCard 模板里的 :id 必须保持一致。
export const readSearchCardAnchorId = (group: ResearchDataSonarCard): string => {
  if (group.kind === 'reader') {
    return group.referenceIndex ? `research-ref-${group.referenceIndex}` : `research-reader-${group.id}`
  }
  return `research-group-${group.id}`
}

export const readSearchSourceAnchorId = (
  group: ResearchSearchGroupViewItem | (ResearchSearchGroupViewItem & { kind?: 'search' }),
  source: ResearchSearchSourceViewItem,
  sourceIndex: number,
): string => {
  if (source.referenceIndex) {
    return `research-ref-${source.referenceIndex}`
  }
  return `research-source-${group.id}-${sourceIndex + 1}`
}

export const useCitationRenderer = (options: UseCitationRendererOptions) => {
  const { readerCards, stagedSearchGroups, evidences, visibleReportContent } = options

  // 从报告末尾的引用列表（"n. [title](url)" 形式）回填预览，作为兜底数据源。
  const reportReferenceAppendixMap = computed(() => {
    const map = new Map<number, ResearchCitationPreview>()
    const lines = String(visibleReportContent.value || '').replace(/\r\n/g, '\n').split('\n')

    lines.forEach((rawLine) => {
      const line = rawLine.trim()
      const match = line.match(/^(\d+)\.\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/)
      if (!match) {
        return
      }

      const referenceIndex = Number(match[1])
      if (!Number.isFinite(referenceIndex) || referenceIndex <= 0 || map.has(referenceIndex)) {
        return
      }

      const title = String(match[2] || '').trim()
      const url = String(match[3] || '').trim()
      const domain = readResearchSourceDomain(url)
      map.set(referenceIndex, {
        siteIcon: '',
        domain,
        siteName: domain,
        title: title || `参考资料 ${referenceIndex}`,
        snippet: '',
        url,
      })
    })

    return map
  })

  // referenceIndex -> 应跳转到的 DOM 锚点 id。
  const citationReferenceTargetMap = computed(() => {
    const map = new Map<number, string>()

    readerCards.value.forEach((group) => {
      if (group.kind === 'reader' && group.referenceIndex && !map.has(group.referenceIndex)) {
        map.set(group.referenceIndex, readSearchCardAnchorId(group))
      }
    })

    stagedSearchGroups.value.forEach((group) => {
      if ('sources' in group && Array.isArray(group.sources)) {
        group.sources.forEach((source, sourceIndex) => {
          if (!source.referenceIndex || map.has(source.referenceIndex)) {
            return
          }
          map.set(source.referenceIndex, readSearchSourceAnchorId(group, source, sourceIndex))
        })
      }
    })

    return map
  })

  // referenceIndex -> tooltip 中展示的信源预览。
  const citationReferencePreviewMap = computed(() => {
    const map = new Map<number, ResearchCitationPreview>()
    const setPreview = (referenceIndex: number | undefined, preview: ResearchCitationPreview) => {
      if (!referenceIndex || map.has(referenceIndex)) {
        return
      }
      map.set(referenceIndex, preview)
    }

    readerCards.value.forEach((group) => {
      if (group.kind !== 'reader') {
        return
      }
      setPreview(group.referenceIndex, {
        siteIcon: group.siteIcon || '',
        domain: readResearchSourceDomain(group.url) || '',
        siteName: group.siteName || '',
        title: group.headline || group.title || '',
        snippet: group.excerpt || group.content || '',
        url: group.url || '',
      })
    })

    stagedSearchGroups.value.forEach((group) => {
      if (!('sources' in group) || !Array.isArray(group.sources)) {
        return
      }
      group.sources.forEach((source) => {
        setPreview(source.referenceIndex, {
          siteIcon: source.siteIcon || '',
          domain: readResearchSourceDomain(source.url) || '',
          siteName: source.siteName || '',
          title: source.title || '',
          snippet: source.snippet || '',
          url: source.url || '',
        })
      })
    })

    evidences.value.forEach((evidence) => {
      const discoverySources = Array.isArray(evidence.discovery?.searchSources)
        ? evidence.discovery?.searchSources || []
        : []

      discoverySources.forEach((source) => {
        setPreview(source.referenceIndex, {
          siteIcon: source.siteIcon || '',
          domain: readResearchSourceDomain(source.url) || '',
          siteName: source.siteName || evidence.source?.note || '',
          title: source.title || evidence.source?.title || evidence.title || '',
          snippet: source.snippet || evidence.summary || '',
          url: source.url || evidence.source?.url || '',
        })
      })
    })

    reportReferenceAppendixMap.value.forEach((preview, referenceIndex) => {
      setPreview(referenceIndex, preview)
    })

    return map
  })

  const buildCitationTooltipData = (referenceIndex: number): ResearchCitationTooltipData | null => {
    const preview = citationReferencePreviewMap.value.get(referenceIndex)
    if (!preview) {
      return null
    }

    const targetId = citationReferenceTargetMap.value.get(referenceIndex)
    const siteName = (preview.siteName || '未命名信源').trim() || '未命名信源'
    const domain = (preview.domain || preview.siteName || '').trim()
    const title = (preview.title || '未命名信源').trim() || '未命名信源'
    const snippet = (preview.snippet || '').trim().slice(0, 140)
    const siteInitial = (siteName || domain || '未命名信源').slice(0, 1).toUpperCase()
    return {
      siteIcon: preview.siteIcon || '',
      siteName,
      domain,
      title,
      snippet,
      url: preview.url || '',
      detailLink: targetId ? `#${targetId}` : (preview.url || ''),
      detailLabel: targetId ? '定位到信源卡片' : '',
      siteInitial,
    }
  }

  const renderCitationTooltip = (referenceIndex: number) => {
    const tooltip = buildCitationTooltipData(referenceIndex)
    const pillLabel = `[${referenceIndex}]`
    if (!tooltip) {
      return `<span class="research-inline-citation" tabindex="0"><span class="research-inline-citation__pill">${pillLabel}</span></span>`
    }

    const favicon = tooltip.siteIcon
      ? `<img src="${escapeHtml(tooltip.siteIcon)}" alt="">`
      : `<span>${escapeHtml(tooltip.siteInitial)}</span>`
    const domain = tooltip.domain
      ? `<span class="research-inline-citation__domain">${escapeHtml(tooltip.domain)}</span>`
      : ''
    const title = tooltip.url
      ? `<a class="research-inline-citation__title" href="${escapeHtml(tooltip.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tooltip.title)}</a>`
      : `<span class="research-inline-citation__title">${escapeHtml(tooltip.title)}</span>`
    const snippet = tooltip.snippet
      ? `<span class="research-inline-citation__snippet">${escapeHtml(tooltip.snippet)}</span>`
      : ''
    const jump = tooltip.detailLink
      ? `<a class="research-inline-citation__jump" href="${escapeHtml(tooltip.detailLink)}">${escapeHtml(tooltip.detailLabel)}</a>`
      : ''

    return `<span class="research-inline-citation" data-reference-index="${referenceIndex}" tabindex="0"><span class="research-inline-citation__pill">${pillLabel}</span><span class="research-inline-citation__tooltip"><span class="research-inline-citation__header"><span class="research-inline-citation__favicon">${favicon}</span><span class="research-inline-citation__header-text"><span class="research-inline-citation__site">${escapeHtml(tooltip.siteName)}</span>${domain}</span></span>${title}${snippet}${jump}</span></span>`
  }

  const renderCitationReferences = (value: string) => {
    return value.replace(/\[(\d+)\]/g, (_matched, rawIndex) => {
      const referenceIndex = Number(rawIndex)
      return renderCitationTooltip(referenceIndex)
    })
  }

  return {
    citationReferenceTargetMap,
    citationReferencePreviewMap,
    reportReferenceAppendixMap,
    renderCitationReferences,
    renderCitationTooltip,
    buildCitationTooltipData,
  }
}
