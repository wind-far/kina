import { resolveGatewayProviderUpstream } from '../provider-config/service'
import { joinUpstreamUrl } from '../ai-gateway/shared'
import { extractChatTextFromJsonPayload } from '../generation-tasks/upstream-helpers'
import { getResearchReaderCache, getResearchSearchCache } from './fetch-cache'
import type { ResearchSearchSource } from '../../src/shared/research/research-types'

export interface ResearchSearchResultItem {
  title: string
  url: string
  snippet: string
  siteName: string
  siteIcon?: string
  publishedTime: string
  datePublished?: string
  referenceIndex?: number
  query?: string
  provider?: string
  searchSources?: ResearchSearchSource[]
}

export type ResearchSearchProvider = 'grok2api'

export interface ResearchReadResult {
  url: string
  title: string
  excerpt: string
  content: string
  contentLength: number
  redirected: boolean
  contentType: string
}

const RESEARCH_FETCH_USER_AGENT = String(
  process.env.RESEARCH_FETCH_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
).trim()
const DEFAULT_SEARCH_TIMEOUT_MS = Number.parseInt(process.env.RESEARCH_SEARCH_TIMEOUT_MS || '15000', 10)
const DEFAULT_READER_TIMEOUT_MS = Number.parseInt(process.env.RESEARCH_READER_TIMEOUT_MS || '20000', 10)
const DEFAULT_MAX_SEARCH_RESULTS = Number.parseInt(process.env.RESEARCH_MAX_SEARCH_RESULTS || '8', 10)
const DEFAULT_MAX_PAGE_CHARS = Number.parseInt(process.env.RESEARCH_MAX_PAGE_CHARS || '40000', 10)

type ResearchSearchUpstreamConfig = {
  baseUrl: string
  apiKey: string
  model: string
  endpoint: string
}

type ResearchSearchProviderErrorHandler = (input: {
  provider: string
  error: unknown
}) => void

const handleSearchProviderError = (
  handler: ResearchSearchProviderErrorHandler | undefined,
  provider: string,
  error: unknown,
): ResearchSearchResultItem[] => {
  try {
    handler?.({ provider, error })
  } catch {
    // 错误上报不能影响主流程状态更新。
  }
  return []
}

const sleepWithAbort = async (signal: AbortSignal, timeoutMs: number) => {
  if (timeoutMs <= 0) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, timeoutMs)

    const handleAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', handleAbort)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

const withTimeoutSignal = (sourceSignal: AbortSignal, timeoutMs: number) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), timeoutMs)

  const handleAbort = () => {
    controller.abort(sourceSignal.reason || new DOMException('Aborted', 'AbortError'))
  }

  sourceSignal.addEventListener('abort', handleAbort, { once: true })

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer)
      sourceSignal.removeEventListener('abort', handleAbort)
    },
  }
}

const decodeHtmlEntities = (value: string) => {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&#x27;/gi, '\'')
  .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
}

const normalizeCharset = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/^["']|["']$/g, '')
  if (!normalized) {
    return ''
  }

  if (['gb2312', 'gbk', 'gb18030'].includes(normalized)) {
    return normalized === 'gb2312' ? 'gbk' : normalized
  }

  if (['utf8', 'utf-8'].includes(normalized)) {
    return 'utf-8'
  }

  return normalized
}

const extractCharsetFromContentType = (contentType: string) => {
  const match = String(contentType || '').match(/charset\s*=\s*([^;\s]+)/i)
  return normalizeCharset(match?.[1] || '')
}

const extractCharsetFromHtmlHead = (buffer: ArrayBuffer) => {
  const head = new TextDecoder('latin1').decode(buffer.slice(0, Math.min(buffer.byteLength, 4096)))
  const explicitMatch = head.match(/<meta[^>]+charset=["']?\s*([^"'\s/>]+)/i)
  if (explicitMatch?.[1]) {
    return normalizeCharset(explicitMatch[1])
  }

  const httpEquivMatch = head.match(/<meta[^>]+http-equiv=["']content-type["'][^>]+content=["'][^"']*charset\s*=\s*([^"'\s;>]+)/i)
    || head.match(/<meta[^>]+content=["'][^"']*charset\s*=\s*([^"'\s;>]+)[^"']*["'][^>]+http-equiv=["']content-type["']/i)

  return normalizeCharset(httpEquivMatch?.[1] || '')
}

const decodeResearchResponseText = (buffer: ArrayBuffer, contentType: string) => {
  const charset = extractCharsetFromContentType(contentType) || extractCharsetFromHtmlHead(buffer) || 'utf-8'

  try {
    return new TextDecoder(charset).decode(buffer)
  } catch {
    return new TextDecoder('utf-8').decode(buffer)
  }
}

const stripTags = (html: string) => {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<img[^>]*>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  )
}

const extractTitle = (html: string, url: string) => {
  const titleMatch = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch?.[1]) {
    return decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim()
  }

  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

const extractMetaDescription = (html: string) => {
  const metaMatch = String(html || '').match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
  ) || String(html || '').match(
    /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i,
  )

  return metaMatch?.[1] ? decodeHtmlEntities(metaMatch[1]).replace(/\s+/g, ' ').trim() : ''
}

const pickExcerpt = (text: string, maxLength = 240) => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trim()}...`
}

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

const resolveProviderBackedSearchUpstream = async (input: {
  providerId?: string
  model?: string
}): Promise<ResearchSearchUpstreamConfig | null> => {
  const providerId = String(input.providerId || '').trim()
  if (!providerId) {
    return null
  }

  const modelKey = String(input.model || '').trim()
  if (!modelKey) {
    throw new Error('深度搜索需要在后台技能配置中选择搜索模型')
  }

  const upstream = await resolveGatewayProviderUpstream({
    providerId,
    endpointType: 'chat',
    modelKey,
  })

  return {
    baseUrl: upstream.baseUrl,
    apiKey: upstream.apiKey,
    endpoint: upstream.endpoint,
    model: modelKey,
  }
}

const runGrok2ApiSearch = async (input: {
  query: string
  count: number
  signal: AbortSignal
  providerId?: string
  model?: string
}): Promise<ResearchSearchResultItem[]> => {
  const providerBackedUpstream = await resolveProviderBackedSearchUpstream({
    providerId: input.providerId,
    model: input.model,
  })
  if (!providerBackedUpstream) {
    throw new Error('深度搜索需要在后台技能配置中选择搜索供应商')
  }

  const baseUrl = String(providerBackedUpstream.baseUrl).trim().replace(/\/+$/, '')
  const apiKey = String(providerBackedUpstream.apiKey).trim()
  const model = String(providerBackedUpstream.model).trim()
  const endpoint = String(providerBackedUpstream?.endpoint || '/chat/completions').trim() || '/chat/completions'

  if (!baseUrl || !apiKey || !model) {
    throw new Error('深度搜索供应商缺少 Base URL、API Key 或模型配置')
  }

  const { signal, cleanup } = withTimeoutSignal(input.signal, DEFAULT_SEARCH_TIMEOUT_MS)
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

    const requestBody: Record<string, unknown> = {
      model,
      stream: false,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }

    const response = await fetch(joinUpstreamUrl(baseUrl, endpoint), {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'User-Agent': RESEARCH_FETCH_USER_AGENT,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`Grok2API 搜索请求失败 (${response.status})`)
    }

    const payload = await response.json().catch(() => null)
    return normalizeProviderSearchResults(payload, input.count)
  } finally {
    cleanup()
  }
}

export const runWebSearch = async (input: {
  query: string
  count?: number
  signal: AbortSignal
  providerId?: string
  model?: string
  onProviderError?: ResearchSearchProviderErrorHandler
}): Promise<ResearchSearchResultItem[]> => {
  const query = String(input.query || '').trim()
  if (!query) {
    return []
  }

  const count = Math.min(Math.max(Number(input.count || DEFAULT_MAX_SEARCH_RESULTS), 1), 20)
  const provider: ResearchSearchProvider = 'grok2api'
  const cacheKey = [
    provider,
    String(input.providerId || '').trim(),
    String(input.model || '').trim(),
    query,
    String(count),
  ].join('::')
  const cached = getResearchSearchCache().get(cacheKey)
  if (Array.isArray(cached)) {
    return cached as ResearchSearchResultItem[]
  }

  const results = await runGrok2ApiSearch({
    query,
    count,
    signal: input.signal,
    providerId: input.providerId,
    model: input.model,
  }).catch((error) => handleSearchProviderError(input.onProviderError, 'grok2api', error))

  const normalizedResults = results.map((item) => ({
    ...item,
    provider: item.provider || provider,
  }))

  getResearchSearchCache().set(cacheKey, normalizedResults)
  return normalizedResults
}

export const runWebReader = async (input: {
  url: string
  signal: AbortSignal
  maxChars?: number
}): Promise<ResearchReadResult> => {
  const url = String(input.url || '').trim()
  if (!url) {
    throw new Error('网页地址不能为空')
  }

  const cached = getResearchReaderCache().get(url)
  if (cached && typeof cached === 'object') {
    return cached as ResearchReadResult
  }

  const { signal, cleanup } = withTimeoutSignal(input.signal, DEFAULT_READER_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal,
      redirect: 'follow',
      headers: {
        'User-Agent': RESEARCH_FETCH_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
      },
    })

    if (!response.ok) {
      throw new Error(`网页读取失败 (${response.status})`)
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error(`暂不支持的网页内容类型：${contentType || 'unknown'}`)
    }

    const rawBuffer = await response.arrayBuffer()
    const rawText = decodeResearchResponseText(rawBuffer, contentType)
    const title = extractTitle(rawText, response.url || url)
    const metaDescription = extractMetaDescription(rawText)
    const plainText = contentType.includes('text/plain')
      ? rawText
      : stripTags(rawText)
    const maxChars = Math.max(4000, Number(input.maxChars || DEFAULT_MAX_PAGE_CHARS))
    const content = plainText.length > maxChars ? `${plainText.slice(0, maxChars).trim()}...` : plainText
    const excerpt = pickExcerpt(metaDescription || content)

    const result: ResearchReadResult = {
      url: response.url || url,
      title,
      excerpt,
      content,
      contentLength: content.length,
      redirected: String(response.url || url).trim() !== url,
      contentType,
    }

    getResearchReaderCache().set(url, result)
    return result
  } finally {
    cleanup()
  }
}

export const waitResearchToolGap = async (signal: AbortSignal, durationMs = 120) => {
  await sleepWithAbort(signal, durationMs)
}
