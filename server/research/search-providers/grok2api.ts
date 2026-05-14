// grok2api 搜索策略：保持原行为——通过 OpenAI 兼容 chat 接口注入「请联网搜索 X」提示词，
// 让 LLM 把搜索结果以严格 JSON 形式回写，再从 search_sources 回退提取。
// 注意：grok2api 是唯一需要 modelKey 的策略，因为它实际走的是 LLM 调用。

import { joinUpstreamUrl } from '../../ai-gateway/shared'
import { extractChatTextFromJsonPayload } from '../../generation-tasks/upstream-helpers'
import { extractResearchUsageFromPayload } from '../runtime/usage-accumulator'
import { registerSearchStrategy } from './registry'
import type { ResearchSearchStrategy } from './types'
import type {
  ResearchSearchResultItem,
} from '../tools'
import type {
  ResearchSearchSource,
} from '../../../src/shared/research/research-types'

const normalizeSearchReferenceIndex = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined
}

const normalizeSearchSources = (payload: any, maxResults: number): ResearchSearchSource[] => {
  const sourceItems = Array.isArray(payload?.search_sources)
    ? payload.search_sources
    : Array.isArray(payload?.output?.[0]?.search_sources)
      ? payload.output[0].search_sources
      : []

  return sourceItems
    .map((item: any) => ({
      title: String(item?.title || item?.url || '').trim(),
      url: String(item?.url || '').trim(),
      snippet: String(item?.snippet || item?.summary || '').trim(),
      siteName: (() => {
        const explicitSite = String(item?.siteName || item?.site || '').trim()
        if (explicitSite) {
          return explicitSite
        }
        try {
          return new URL(String(item?.url || '')).hostname.replace(/^www\./i, '')
        } catch {
          return ''
        }
      })(),
      publishedTime: String(item?.publishedTime || item?.published_at || '').trim(),
      datePublished: String(item?.datePublished || item?.date_published || item?.publishedTime || item?.published_at || '').trim(),
      siteIcon: String(item?.siteIcon || item?.favicon || item?.icon || '').trim(),
      referenceIndex: normalizeSearchReferenceIndex(item?.referenceIndex),
      type: String(item?.type || 'web').trim(),
    }))
    .filter((item: ResearchSearchSource) => item.title && item.url)
    .slice(0, maxResults)
}

const extractJsonBlock = (text: string) => {
  const normalized = String(text || '').trim()
  if (!normalized) {
    return ''
  }

  const fencedMatch = normalized.match(/```json\s*([\s\S]*?)```/i) || normalized.match(/```\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const firstBraceIndex = normalized.indexOf('{')
  const lastBraceIndex = normalized.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return normalized.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  return normalized
}

const extractSearchResponseText = (payload: any): string => {
  const upstreamText = extractChatTextFromJsonPayload(payload)
  if (upstreamText.trim()) {
    return upstreamText.trim()
  }

  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : []
  const chunks: string[] = []

  for (const item of outputItems) {
    const contentItems = Array.isArray(item?.content) ? item.content : []
    for (const contentItem of contentItems) {
      if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
        chunks.push(contentItem.text)
      }
      if (typeof contentItem?.content === 'string' && contentItem.content.trim()) {
        chunks.push(contentItem.content)
      }
    }
  }

  return chunks.join('\n').trim()
}

const normalizeProviderSearchResults = (payload: any, maxResults: number): ResearchSearchResultItem[] => {
  const searchSources = normalizeSearchSources(payload, maxResults)

  const text = extractSearchResponseText(payload)
  const jsonText = extractJsonBlock(text)
  let resultItems: any[] = []
  try {
    const parsed = JSON.parse(jsonText)
    resultItems = Array.isArray(parsed?.results) ? parsed.results : []
  } catch {
    resultItems = []
  }

  if (!resultItems.length && searchSources.length) {
    return searchSources.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet || '',
      siteName: item.siteName || '',
      siteIcon: item.siteIcon || '',
      publishedTime: item.publishedTime || '',
      datePublished: item.datePublished || item.publishedTime || '',
      referenceIndex: item.referenceIndex,
      provider: 'grok2api',
      searchSources,
    }))
  }

  return resultItems
    .map((item: any) => ({
      title: String(item?.title || '').trim(),
      url: String(item?.url || '').trim(),
      snippet: String(item?.snippet || '').trim(),
      siteName: String(item?.siteName || item?.site || '').trim(),
      publishedTime: String(item?.publishedTime || item?.published_at || '').trim(),
      datePublished: String(item?.datePublished || item?.date_published || item?.publishedTime || item?.published_at || '').trim(),
      siteIcon: String(item?.siteIcon || item?.favicon || item?.icon || '').trim(),
      referenceIndex: normalizeSearchReferenceIndex(item?.referenceIndex),
      provider: 'grok2api',
      searchSources: searchSources.length ? searchSources : [{
        url: String(item?.url || '').trim(),
        title: String(item?.title || '').trim(),
        type: 'web',
        snippet: String(item?.snippet || '').trim(),
        siteName: String(item?.siteName || item?.site || '').trim(),
        publishedTime: String(item?.publishedTime || item?.published_at || '').trim(),
        datePublished: String(item?.datePublished || item?.date_published || item?.publishedTime || item?.published_at || '').trim(),
        siteIcon: String(item?.siteIcon || item?.favicon || item?.icon || '').trim(),
        referenceIndex: normalizeSearchReferenceIndex(item?.referenceIndex),
      }],
    }))
    .filter((item: ResearchSearchResultItem) => item.title && item.url)
    .slice(0, maxResults)
}

const grok2ApiStrategy: ResearchSearchStrategy = {
  provider: 'grok2api',
  requiresModel: true,
  async runSearch(input) {
    const baseUrl = input.upstream.baseUrl.replace(/\/+$/, '')
    const apiKey = input.upstream.apiKey
    const model = String(input.upstream.model || '').trim()
    const endpoint = input.upstream.endpoint || '/chat/completions'

    if (!baseUrl || !apiKey || !model) {
      throw new Error('grok2api 搜索缺少 Base URL、API Key 或模型配置')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), input.timeoutMs)
    const handleAbort = () => controller.abort(input.signal.reason || new DOMException('Aborted', 'AbortError'))
    input.signal.addEventListener('abort', handleAbort, { once: true })

    try {
      const prompt = [
        `请使用联网搜索能力搜索：${input.query}`,
        `返回最多 ${input.count} 条结果。`,
        '优先返回带来源的结果，并保留可追踪的 search_sources 或等价引用信息。',
        '你必须返回严格 JSON，不要输出 Markdown，不要补充解释。',
        'JSON 结构如下：',
        '{',
        '  "results": [',
        '    {',
        '      "title": "字符串",',
        '      "url": "字符串",',
        '      "snippet": "字符串",',
        '      "siteName": "字符串",',
        '      "publishedTime": "字符串"',
        '    }',
        '  ]',
        '}',
      ].join('\n')

      const response = await fetch(joinUpstreamUrl(baseUrl, endpoint), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': input.userAgent,
        },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.2,
          messages: [
            { role: 'user', content: prompt },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`Grok2API 搜索请求失败 (${response.status})`)
      }

      const payload = await response.json().catch(() => null)
      const usage = extractResearchUsageFromPayload(payload)
      if (usage) {
        input.onUsage?.(usage)
      }
      return normalizeProviderSearchResults(payload, input.count)
    } finally {
      clearTimeout(timer)
      input.signal.removeEventListener('abort', handleAbort)
    }
  },
}

registerSearchStrategy(grok2ApiStrategy)

export default grok2ApiStrategy
