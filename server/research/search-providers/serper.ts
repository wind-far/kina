// Serper 搜索策略。
// API：POST https://google.serper.dev/search
// 鉴权：X-API-KEY: <key>
// 文档：https://serper.dev/

import { registerSearchStrategy } from './registry'
import type { ResearchSearchStrategy } from './types'
import type { ResearchSearchResultItem } from '../tools'

const serperStrategy: ResearchSearchStrategy = {
  provider: 'serper',
  requiresModel: false,
  async runSearch(input) {
    const baseUrl = input.upstream.baseUrl.replace(/\/+$/, '') || 'https://google.serper.dev'
    const endpoint = input.upstream.endpoint || '/search'
    const apiKey = input.upstream.apiKey

    if (!apiKey) {
      throw new Error('Serper 搜索缺少 API Key')
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
          'X-API-KEY': apiKey,
          'User-Agent': input.userAgent,
        },
        body: JSON.stringify({
          q: input.query,
          num: input.count,
        }),
      })

      if (!response.ok) {
        throw new Error(`Serper 搜索请求失败 (${response.status})`)
      }

      const payload = await response.json().catch(() => null)
      const organic = Array.isArray(payload?.organic) ? payload.organic : []

      return organic
        .slice(0, input.count)
        .map((item: any, index: number) => {
          const url = String(item?.link || '').trim()
          const title = String(item?.title || '').trim()
          if (!url || !title) {
            return null
          }
          const snippet = String(item?.snippet || '').trim()
          const siteName = (() => {
            try {
              return new URL(url).hostname.replace(/^www\./i, '')
            } catch {
              return ''
            }
          })()
          const referenceIndex = Number(item?.position) > 0 ? Math.floor(Number(item.position)) : index + 1
          const publishedTime = String(item?.date || '').trim()
          return {
            title,
            url,
            snippet,
            siteName,
            siteIcon: '',
            publishedTime,
            datePublished: publishedTime,
            referenceIndex,
            provider: 'serper',
            searchSources: [{
              url,
              title,
              type: 'web',
              snippet,
              siteName,
              siteIcon: '',
              publishedTime,
              datePublished: publishedTime,
              referenceIndex,
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

registerSearchStrategy(serperStrategy)

export default serperStrategy
