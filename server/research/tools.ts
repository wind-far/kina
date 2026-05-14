import { getResearchReaderCache, getResearchSearchCache } from './fetch-cache'
import {
  resolveSearchProviderUpstream,
  resolveSearchStrategy,
} from './search-providers'
// 副作用 import 确保所有内置策略已注册。
import './search-providers'
import type { ResearchSearchProvider } from './search-providers'
import type { ResearchModelUsage } from './runtime/usage-accumulator'
import type { ResearchSearchSource } from '../../src/shared/research/research-types'

export type ResearchSearchResultItem = {
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

export type { ResearchSearchProvider }

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

// 通过 search-providers 注册表执行搜索；
// 旧调用方仍可只传 query，provider 默认走 grok2api 保持向后兼容。
export const runWebSearch = async (input: {
  query: string
  count?: number
  signal: AbortSignal
  provider?: string
  providerId?: string
  model?: string
  onProviderError?: ResearchSearchProviderErrorHandler
  onUsage?: (usage: ResearchModelUsage) => void
}): Promise<ResearchSearchResultItem[]> => {
  const query = String(input.query || '').trim()
  if (!query) {
    return []
  }

  const count = Math.min(Math.max(Number(input.count || DEFAULT_MAX_SEARCH_RESULTS), 1), 20)
  const providerKey = String(input.provider || 'grok2api').trim() as ResearchSearchProvider
  const cacheKey = [
    providerKey,
    String(input.providerId || '').trim(),
    String(input.model || '').trim(),
    query,
    String(count),
  ].join('::')
  const cached = getResearchSearchCache().get(cacheKey)
  if (Array.isArray(cached)) {
    return cached as ResearchSearchResultItem[]
  }

  let results: ResearchSearchResultItem[] = []
  try {
    const strategy = resolveSearchStrategy(providerKey)
    const upstream = await resolveSearchProviderUpstream({
      providerId: String(input.providerId || ''),
      modelKey: input.model,
      requireModel: strategy.requiresModel,
    })

    results = await strategy.runSearch({
      query,
      count,
      signal: input.signal,
      upstream,
      userAgent: RESEARCH_FETCH_USER_AGENT,
      timeoutMs: DEFAULT_SEARCH_TIMEOUT_MS,
      onUsage: input.onUsage,
    })
  } catch (error) {
    return handleSearchProviderError(input.onProviderError, providerKey, error)
  }

  const normalizedResults = results.map((item) => ({
    ...item,
    provider: item.provider || providerKey,
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
