import type { ResearchSearchResultItem } from './tools'
import type { ResearchMode, ResearchPrimaryFrame } from '../../src/shared/research/research-types'

export const dedupeSearchResults = (results: ResearchSearchResultItem[]) => {
  const seen = new Set<string>()
  return results.filter((item) => {
    const key = String(item.url || '').trim().toLowerCase()
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export const normalizeComparableUrl = (value: string) => {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return ''
  }

  try {
    const url = new URL(rawValue)
    url.hash = ''
    return url.toString()
  } catch {
    return rawValue
  }
}

const extractHostname = (value: string) => {
  try {
    return new URL(String(value || '').trim()).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

const extractGithubRepoPath = (value: string) => {
  try {
    const url = new URL(String(value || '').trim())
    if (url.hostname.replace(/^www\./i, '').toLowerCase() !== 'github.com') {
      return ''
    }

    const [owner, repo] = url.pathname
      .split('/')
      .map(item => item.trim())
      .filter(Boolean)

    if (!owner || !repo) {
      return ''
    }

    return `${owner}/${repo}`.toLowerCase()
  } catch {
    return ''
  }
}

const isGithubRepoMetaPage = (normalizedUrl: string) => {
  return /github\.com\/[^/]+\/[^/]+\/(?:issues|pulls|actions|projects|security|pulse|network|stargazers|watchers)(?:$|[/?#])/i.test(normalizedUrl)
}

const isGithubOwnerProfilePage = (normalizedUrl: string) => {
  return /github\.com\/[^/]+\/?(?:$|[?#])/i.test(normalizedUrl)
}

const NOISY_READ_HOSTS = new Set([
  't.me',
  'x.com',
  'twitter.com',
  'instagram.com',
  'www.instagram.com',
  'threads.com',
  'www.threads.com',
  'facebook.com',
  'www.facebook.com',
  'onlyfans.com',
  'www.onlyfans.com',
  'rcy1314.github.io',
  'linux.do',
  'lobehub.com',
  'reddit.com',
  'www.reddit.com',
  'youtube.com',
  'www.youtube.com',
  'bilibili.com',
  'www.bilibili.com',
  'tool.lu',
])

const LOW_PRIORITY_READ_HOSTS = new Set([
  'canvasmindapp.com',
  'canvasmind.org',
  'canvasmind.net',
])

const OPEN_TOPIC_LOW_VALUE_PATTERNS = [
  /营销|促销|爆款|攻略|手册|节点|增长|引流/u,
  /教程|函数|excel|power\s?pivot|cubset|cubevalue|sql|python/i,
]

const ACADEMIC_SIGNAL_PATTERNS = [
  /研究|框架|方法|文献|论文|学术|综述|社会|文化|历史|统计|手册/u,
]

const isDocumentationHost = (hostname: string) => {
  return hostname.endsWith('.readthedocs.io') || hostname.startsWith('docs.')
}

const buildCombinedSearchText = (item: ResearchSearchResultItem, normalizedUrl: string) => {
  return `${String(item.title || '').toLowerCase()} ${String(item.snippet || '').toLowerCase()} ${normalizedUrl}`
}

const looksLikeLowValueCommercePage = (item: ResearchSearchResultItem, normalizedUrl: string) => {
  const combined = buildCombinedSearchText(item, normalizedUrl)
  return /(?:^|[./-])order(?:[./-]|$)|toasttab|\/cart|\/checkout|\/product\//i.test(normalizedUrl)
    && /(菜单|菜單|售价|售價|price|\$\s?\d|add to cart|checkout|online order|点餐|點餐)/i.test(combined)
}

const hasAnchorHit = (combined: string, anchors?: string[]) => {
  return Boolean(anchors?.some((anchor) => {
    const normalizedAnchor = String(anchor || '').trim().toLowerCase()
    return normalizedAnchor ? combined.includes(normalizedAnchor) : false
  }))
}

const hasIdentityAnchorHit = (
  combined: string,
  input: {
    repoPath?: string
    owner?: string
    displayName?: string
  },
) => {
  const anchors = [
    input.repoPath,
    input.displayName,
    input.owner,
  ].map(item => String(item || '').trim().toLowerCase()).filter(item => item.length >= 3)

  return hasAnchorHit(combined, anchors)
}

export const scoreReadTarget = (
  item: ResearchSearchResultItem,
  input: {
    repoPath?: string
    owner?: string
    displayName?: string
    queryAnchors?: string[]
    researchMode?: ResearchMode
    primaryFrame?: ResearchPrimaryFrame
  },
) => {
  const url = String(item.url || '').trim()
  const normalizedUrl = normalizeComparableUrl(url).toLowerCase()
  const hostname = extractHostname(url)
  const githubRepoPath = extractGithubRepoPath(url)
  const titleAndSnippet = `${String(item.title || '').toLowerCase()} ${String(item.snippet || '').toLowerCase()}`
  const combined = buildCombinedSearchText(item, normalizedUrl)
  const repoPathAnchor = String(input.repoPath || '').trim().toLowerCase()
  let score = 0

  if (hostname === 'github.com') {
    score += 60
  }
  if (isDocumentationHost(hostname)) {
    score += 35
  }

  if (repoPathAnchor && normalizedUrl.includes(repoPathAnchor)) {
    score += 120
  }
  if (input.owner && titleAndSnippet.includes(input.owner.toLowerCase())) {
    score += 25
  }
  if (input.displayName && titleAndSnippet.includes(input.displayName.toLowerCase())) {
    score += 20
  }

  if (/github\.com\/[^/]+\/[^/]+\/?(?:$|readme|tree\/|blob\/master\/readme|blob\/main\/readme)/i.test(normalizedUrl)) {
    score += 80
  }
  if (/github\.com\/[^/]+\/[^/]+\/tree\//i.test(normalizedUrl)) {
    score += 30
  }
  if (/github\.com\/[^/]+\/[^/]+\/blob\//i.test(normalizedUrl)) {
    score += 10
  }
  if (/github\.com\/[^/]+\/[^/]+\/blob\/(?:main|master)\/readme\.md$/i.test(normalizedUrl)) {
    score += 90
  }
  if (/github\.com\/[^/]+\/[^/]+\/tree\/(?:main|master)(?:\/server|\/docs|\/src|\/src\/shared|\/server\/research)?(?:$|\/)/i.test(normalizedUrl)) {
    score += 75
  }
  if (/github\.com\/[^/]+\/[^/]+\/blob\/(?:main|master)\/(?:server\/|docs\/|src\/shared\/research\/|package\.json|readme\.md)/i.test(normalizedUrl)) {
    score += 55
  }
  if (isGithubRepoMetaPage(normalizedUrl)) {
    score -= 35
  }
  if (/github\.com\/[^/]+\/[^/]+\/blob\/(?:main|master)\/(?:index\.html|\.dockerignore|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|dist\/|public\/)/i.test(normalizedUrl)) {
    score -= 70
  }

  if (hostname === 'github.com' && repoPathAnchor && githubRepoPath && githubRepoPath !== repoPathAnchor) {
    score -= 160
  }

  if (NOISY_READ_HOSTS.has(hostname)) {
    score -= 120
  } else if (LOW_PRIORITY_READ_HOSTS.has(hostname)) {
    score -= 35
  }

  if (looksLikeLowValueCommercePage(item, normalizedUrl)) {
    score -= 100
  }

  if (/some-stars|telegram|我的star列表|with_replies|topic\//i.test(normalizedUrl)) {
    score -= 120
  }
  if (hostname !== 'github.com' && hostname && input.queryAnchors?.length) {
    const anchorHit = hasAnchorHit(combined, input.queryAnchors)
    if (!anchorHit) {
      score -= 45
    }
  }

  if (input.researchMode === 'open_topic') {
    if (ACADEMIC_SIGNAL_PATTERNS.some(pattern => pattern.test(titleAndSnippet))) {
      score += 35
    }

    if (OPEN_TOPIC_LOW_VALUE_PATTERNS.some(pattern => pattern.test(titleAndSnippet))) {
      score -= 40
    }

    if (input.primaryFrame === '综合框架' || input.primaryFrame === '文化历史') {
      if (/(文化|历史|社会|传统|研究|综述|框架)/u.test(titleAndSnippet)) {
        score += 25
      }
      if (/(营销|促销|电商|微商城|跨境)/u.test(titleAndSnippet)) {
        score -= 35
      }
    }

    if (input.primaryFrame === '商业营销' && /(营销|消费|品牌|电商|用户)/u.test(titleAndSnippet)) {
      score += 25
    }

    if (input.primaryFrame === '数据方法' && /(方法|指标|数据|统计|时间序列|分析)/u.test(titleAndSnippet)) {
      score += 25
    }
  }

  return score
}

export const shouldSkipReadTarget = (
  item: ResearchSearchResultItem,
  input: {
    repoPath?: string
    owner?: string
    displayName?: string
    queryAnchors?: string[]
    allowExternalWithoutAnchor?: boolean
    researchMode?: ResearchMode
  },
) => {
  const url = String(item.url || '').trim()
  const normalizedUrl = normalizeComparableUrl(url).toLowerCase()
  const hostname = extractHostname(url)
  const githubRepoPath = extractGithubRepoPath(url)
  const repoPathAnchor = String(input.repoPath || '').trim().toLowerCase()
  const combined = buildCombinedSearchText(item, normalizedUrl)
  if (NOISY_READ_HOSTS.has(hostname)) {
    return true
  }

  if (/some-stars|telegram|with_replies|topic\//i.test(normalizedUrl)) {
    return true
  }

  if (looksLikeLowValueCommercePage(item, normalizedUrl)) {
    return true
  }

  if (hostname === 'github.com' && repoPathAnchor) {
    if (isGithubOwnerProfilePage(normalizedUrl)) {
      return true
    }

    if (isGithubRepoMetaPage(normalizedUrl)) {
      return true
    }

    if (githubRepoPath && githubRepoPath !== repoPathAnchor) {
      return true
    }

    if (/github\.com\/[^/]+\/[^/]+\/blob\/(?:main|master)\/(?:index\.html|\.dockerignore|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)(?:$|[?#])/i.test(normalizedUrl)) {
      return true
    }
  }

  if (
    repoPathAnchor
    && hostname
    && hostname !== 'github.com'
    && !isDocumentationHost(hostname)
    && !input.allowExternalWithoutAnchor
    && !hasIdentityAnchorHit(combined, input)
  ) {
    return true
  }

  if (LOW_PRIORITY_READ_HOSTS.has(hostname)) {
    const anchorHit = hasAnchorHit(combined, input.queryAnchors)
    if (!anchorHit) {
      return true
    }
  }

  if (
    input.researchMode === 'open_topic'
    && OPEN_TOPIC_LOW_VALUE_PATTERNS.some(pattern => pattern.test(`${String(item.title || '')} ${String(item.snippet || '')}`))
    && !ACADEMIC_SIGNAL_PATTERNS.some(pattern => pattern.test(`${String(item.title || '')} ${String(item.snippet || '')}`))
  ) {
    return true
  }

  return false
}

export const rankReadTargets = (
  seedUrls: string[],
  initialSearchResults: ResearchSearchResultItem[],
  targetedSearchResults: ResearchSearchResultItem[],
  subject: string,
  queryAnchors: string[],
  researchMode: ResearchMode | undefined,
  primaryFrame: ResearchPrimaryFrame | undefined,
  maxSources: number,
) => {
  const repoPathAnchor = queryAnchors.find(item => item.includes('/')) || ''
  const ownerAnchor = repoPathAnchor.split('/')[0] || queryAnchors.find(item => /^[a-z0-9_-]+$/i.test(item)) || ''
  const displayNameAnchor = queryAnchors.find(item => !item.includes('/') && /[A-Za-z]/.test(item)) || subject

  return [
    ...seedUrls.map((url, index) => ({
      item: {
        title: `用户提供链接 ${index + 1}`,
        url,
        snippet: '用户输入中直接提供的研究入口',
        siteName: '',
        publishedTime: '',
      },
      allowExternalWithoutAnchor: true,
    })),
    ...dedupeSearchResults([
      ...initialSearchResults,
      ...targetedSearchResults,
    ]).map(item => ({
      item,
      allowExternalWithoutAnchor: false,
    })),
  ]
    .filter(({ item, allowExternalWithoutAnchor }) => !shouldSkipReadTarget(item, {
      repoPath: repoPathAnchor,
      owner: ownerAnchor,
      displayName: displayNameAnchor,
      queryAnchors,
      allowExternalWithoutAnchor,
      researchMode,
    }))
    .map(({ item }, index) => ({
      item,
      index,
      score: scoreReadTarget(item, {
        repoPath: repoPathAnchor,
        owner: ownerAnchor,
        displayName: displayNameAnchor,
        queryAnchors,
        researchMode,
        primaryFrame,
      }),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(entry => entry.item)
    .slice(0, maxSources)
}
