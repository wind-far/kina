interface ResearchFetchCacheEntry<TValue> {
  value: TValue
  createdAt: number
}

const DEFAULT_RESEARCH_FETCH_CACHE_TTL_MS = Number.parseInt(
  process.env.RESEARCH_FETCH_CACHE_TTL_MS || `${15 * 60 * 1000}`,
  10,
)

const MAX_RESEARCH_FETCH_CACHE_ENTRIES = Number.parseInt(
  process.env.RESEARCH_FETCH_CACHE_MAX_ENTRIES || '120',
  10,
)

export class ResearchFetchCache<TValue> {
  private readonly ttlMs: number

  private readonly maxEntries: number

  private readonly cache = new Map<string, ResearchFetchCacheEntry<TValue>>()

  constructor(input?: { ttlMs?: number; maxEntries?: number }) {
    this.ttlMs = input?.ttlMs || DEFAULT_RESEARCH_FETCH_CACHE_TTL_MS
    this.maxEntries = input?.maxEntries || MAX_RESEARCH_FETCH_CACHE_ENTRIES
  }

  get(key: string) {
    const entry = this.cache.get(key)
    if (!entry) {
      return undefined
    }

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  set(key: string, value: TValue) {
    if (this.cache.size >= this.maxEntries) {
      let oldestKey = ''
      let oldestAt = Number.POSITIVE_INFINITY

      for (const [entryKey, entryValue] of this.cache.entries()) {
        if (entryValue.createdAt < oldestAt) {
          oldestKey = entryKey
          oldestAt = entryValue.createdAt
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
    })
  }
}

const searchCache = new ResearchFetchCache<unknown[]>()
const readerCache = new ResearchFetchCache<unknown>()

export const getResearchSearchCache = () => searchCache

export const getResearchReaderCache = () => readerCache
