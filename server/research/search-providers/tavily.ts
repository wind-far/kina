// Tavily 搜索策略。
// API：POST https://api.tavily.com/search
// 鉴权：Authorization: Bearer <api_key>
// 文档：https://docs.tavily.com/documentation/api-reference/endpoint/search

import { registerSearchStrategy } from './registry'
import type { ResearchSearchStrategy } from './types'
import type { ResearchSearchResultItem } from '../tools'

const tavilyStrategy: ResearchSearchStrategy = {
  provider: 'tavily',
  requiresModel: false,
  async runSearch(input) {
    const baseUrl = input.upstream.baseUrl.replace(/\/+$/, '') || 'https://api.tavily.com'
    const endpoint = input.upstream.endpoint || '/search'
    const apiKey = input.upstream.apiKey

    if (!apiKey) {
      throw new Error('Tavily 搜索缺少 API Key')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), input.timeoutMs)
    const handleAbort = () => controller.abort(input.signal.reason || new DOMException('Aborted', 'AbortError'))
    input.signal.addEventListener('abort', handleAbort, { once: true })

    try {
      const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': input.userAgent,
        },
        body: JSON.stringify({
          query: input.query,
          max_results: input.count,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Tavily 搜索请求失败 (${response.status})`)
      }

      const payload = await response.json().catch(() => null)
      const results = Array.isArray(payload?.results) ? payload.results : []

      return results
        .slice(0, input.count)
        .map((item: any, index: number) => {
          const url = String(item?.url || '').trim()
          const title = String(item?.title || '').trim()
          const snippet = String(item?.content || '').trim()
          if (!url || !title) {
            return null
          }
          const siteName = (() => {
            try {
              return new URL(url).hostname.replace(/^www\./i, '')
            } catch {
              return ''
            }
          })()
          const publishedTime = String(item?.published_date || '').trim()
          return {
            title,
            url,
            snippet,
            siteName,
            siteIcon: '',
            publishedTime,
            datePublished: publishedTime,
            referenceIndex: index + 1,
            provider: 'tavily',
            searchSources: [{
              url,
              title,
              type: 'web',
              snippet,
              siteName,
              siteIcon: '',
              publishedTime,
              datePublished: publishedTime,
              referenceIndex: index + 1,
            }],
          } satisfies ResearchSearchResultItem
        })
        .filter((item: ResearchSearchResultItem | null): item is ResearchSearchResultItem => Boolean(item))
    } finally {
      clearTimeout(timer)
      input.signal.removeEventListener('abort', handleAbort)
    }
  },
}

registerSearchStrategy(tavilyStrategy)

export default tavilyStrategy
