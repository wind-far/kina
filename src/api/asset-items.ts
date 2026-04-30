import { buildApiUrl } from './http'
import { readApiData, type ApiMessageOptions } from './response'

export type AssetScope = 'feed' | 'mine' | 'all'
export type AssetKind = 'image' | 'video'
export type AssetPublishState = 'all' | 'published' | 'draft'
export type AssetActionType = 'delete' | 'publish' | 'unpublish' | 'favorite' | 'view' | 'download'

export interface PersistedAssetItem {
  id: string
  assetType: AssetKind
  title: string
  description: string
  fileUrl: string
  previewUrl: string
  coverUrl: string
  thumbnailUrl: string
  promptText: string
  modelLabel: string
  aspectRatio: string
  favoriteCount: number
  viewCount: number
  downloadCount: number
  width?: number
  height?: number
  durationSeconds?: number
  visibility: string
  publishStatus: string
  reviewStatus: string
  createdAt: string
  publishedAt?: string
  owner: {
    id: string
    name: string
    email?: string
    avatarSrc: string
  }
  sourceMeta?: Record<string, unknown>
}

export interface AssetListSummary {
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
}

export interface AssetListResult {
  items: PersistedAssetItem[]
  summary: AssetListSummary
}

interface ListAssetItemsOptions {
  scope?: AssetScope
  assetType?: AssetKind
  take?: number
  page?: number
  pageSize?: number
  publishState?: AssetPublishState
  ownerKeyword?: string
}

const ASSET_ITEMS_API_PATH = '/api/asset-items'

// 统一兼容旧数组结构和新分页结构。
const normalizeAssetListResult = (payload: PersistedAssetItem[] | AssetListResult | null | undefined): AssetListResult => {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      summary: {
        totalCount: payload.length,
        totalPages: 1,
        page: 1,
        pageSize: payload.length,
      },
    }
  }

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    summary: {
      totalCount: Number(payload?.summary?.totalCount || 0),
      totalPages: Number(payload?.summary?.totalPages || 1),
      page: Number(payload?.summary?.page || 1),
      pageSize: Number(payload?.summary?.pageSize || 0),
    },
  }
}

const buildAssetListQuery = (options: ListAssetItemsOptions = {}) => {
  const query = new URLSearchParams()
  query.set('scope', options.scope || 'feed')
  query.set('assetType', options.assetType || 'image')
  query.set('take', String(options.take || 60))
  query.set('publishState', options.publishState || 'all')
  if (options.page) {
    query.set('page', String(options.page))
  }
  if (options.pageSize) {
    query.set('pageSize', String(options.pageSize))
  }
  if (options.ownerKeyword) {
    query.set('ownerKeyword', options.ownerKeyword)
  }
  return query
}

// 查询资源列表。
export const listAssetItems = async (options: ListAssetItemsOptions = {}) => {
  const query = buildAssetListQuery(options)

  const response = await fetch(buildApiUrl(`${ASSET_ITEMS_API_PATH}?${query.toString()}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const payload = await readApiData<PersistedAssetItem[] | AssetListResult>(response)
  return normalizeAssetListResult(payload).items
}

// 查询带分页摘要的资源列表，供后台管理页使用。
export const listAdminAssetItems = async (options: ListAssetItemsOptions = {}) => {
  const query = buildAssetListQuery(options)
  const response = await fetch(buildApiUrl(`${ASSET_ITEMS_API_PATH}?${query.toString()}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  const payload = await readApiData<PersistedAssetItem[] | AssetListResult>(response)
  return normalizeAssetListResult(payload)
}

// 批量执行资源动作。
export const applyAssetAction = async (
  action: AssetActionType,
  ids: string[],
  scopeOrMessageOptions?: AssetScope | ApiMessageOptions,
  messageOptions?: ApiMessageOptions,
) => {
  const scope = typeof scopeOrMessageOptions === 'string' ? scopeOrMessageOptions : 'mine'
  const resolvedMessageOptions = typeof scopeOrMessageOptions === 'string' ? messageOptions : scopeOrMessageOptions
  const response = await fetch(buildApiUrl(`${ASSET_ITEMS_API_PATH}/actions`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      ids,
      scope,
    }),
  })

  return readApiData<{ action: AssetActionType; affectedCount: number }>(response, resolvedMessageOptions)
}
