import { buildApiUrl } from './http'
import { readApiData, type ApiMessageOptions } from './response'

export type AssetScope = 'feed' | 'mine'
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
    avatarSrc: string
  }
  sourceMeta?: Record<string, unknown>
}

interface ListAssetItemsOptions {
  scope?: AssetScope
  assetType?: AssetKind
  take?: number
  publishState?: AssetPublishState
}

const ASSET_ITEMS_API_PATH = '/api/asset-items'

// 查询资源列表。
export const listAssetItems = async (options: ListAssetItemsOptions = {}) => {
  const query = new URLSearchParams()
  query.set('scope', options.scope || 'feed')
  query.set('assetType', options.assetType || 'image')
  query.set('take', String(options.take || 60))
  query.set('publishState', options.publishState || 'all')

  const response = await fetch(buildApiUrl(`${ASSET_ITEMS_API_PATH}?${query.toString()}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<PersistedAssetItem[]>(response)
}

// 批量执行资源动作。
export const applyAssetAction = async (
  action: AssetActionType,
  ids: string[],
  messageOptions?: ApiMessageOptions,
) => {
  const response = await fetch(buildApiUrl(`${ASSET_ITEMS_API_PATH}/actions`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      ids,
    }),
  })

  return readApiData<{ action: AssetActionType; affectedCount: number }>(response, messageOptions)
}
