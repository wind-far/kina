// Brave Search 策略。
// API：GET https://api.search.brave.com/res/v1/web/search?q=...&count=...
// 鉴权：X-Subscription-Token: <key>
// 文档：https://api-dashboard.search.brave.com/api-reference/web/search/get

import { registerSearchStrategy } from './registry'
import type { ResearchSearchStrategy } from './types'
import type { ResearchSearchResultItem } from '../tools'

const braveSearchStrategy: ResearchSearchStrategy = {
  provider: 'brave-search',
  requiresModel: false,
  async runSearch(input) {
    const baseUrl = input.upstream.baseUrl.replace(/\/+$/, '') || 'https://api.search.brave.com'
    const endpoint = input.upstream.endpoint || '/res/v1/web/search'
    const apiKey = input.upstream.apiKey

    if (!apiKey) {
      throw new Error('Brave Search 搜索缺少订阅 Token')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'AbortError')), input.timeoutMs)
    const handleAbort = () => controller.abort(input.signal.reason || new DOMException('Aborted', 'AbortError'))
    input.signal.addEventListener('abort', handleAbort, { once: true })

    try {
      const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
      const url = new URL(`${baseUrl}${path}`)
      url.searchParams.set('q', input.query)
      url.searchParams.set('count', String(input.count))

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
          'User-Agent': input.userAgent,
        },
      })

      if (!response.ok) {
        throw new Error(`Brave Search 请求失败 (${response.status})`)
      }

      const payload = await response.json().catch(() => null)
      const webResults = Array.isArray(payload?.web?.results) ? payload.web.results : []

      return webResults
        .slice(0, input.count)
        .map((item: any, index: number) => {
          const url = String(item?.url || '').trim()
          const title = String(item?.title || '').trim()
          if (!url || !title) {
            return null
          }
          const snippet = String(item?.description || item?.snippet || '').trim()
          const siteName = (() => {
            const explicit = String(item?.profile?.name || '').trim()
            if (explicit) {
              return explicit
            }
            try {
              return new URL(url).hostname.replace(/^www\./i, '')
            } catch {
              return ''
            }
          })()
          const publishedTime = String(item?.age || item?.page_age || '').trim()
          return {
            title,
            url,
            snippet,
            siteName,
            siteIcon: '',
            publishedTime,
            datePublished: publishedTime,
            referenceIndex: index + 1,
            provider: 'brave-search',
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

registerSearchStrategy(braveSearchStrategy)

export default braveSearchStrategy
