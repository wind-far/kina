import { buildApiUrl } from './http'

export type AssetScope = 'feed' | 'mine'
export type AssetKind = 'image' | 'video'
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
    name: string
    avatarSrc: string
  }
  sourceMeta?: Record<string, unknown>
}

interface ListAssetItemsOptions {
  scope?: AssetScope
  assetType?: AssetKind
  take?: number
}

const ASSET_ITEMS_API_PATH = '/api/asset-items'

const readJson = async <T>(response: Response) => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || '请求失败')
  }
  return payload?.data as T
}

// 查询资源列表。
export const listAssetItems = async (options: ListAssetItemsOptions = {}) => {
  const query = new URLSearchParams()
  query.set('scope', options.scope || 'feed')
  query.set('assetType', options.assetType || 'image')
  query.set('take', String(options.take || 60))

  const response = await fetch(buildApiUrl(`${ASSET_ITEMS_API_PATH}?${query.toString()}`), {
    method: 'GET',
  })

  return readJson<PersistedAssetItem[]>(response)
}

// 批量执行资源动作。
export const applyAssetAction = async (action: AssetActionType, ids: string[]) => {
  const response = await fetch(buildApiUrl(`${ASSET_ITEMS_API_PATH}/actions`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      ids,
    }),
  })

  return readJson<{ action: AssetActionType; affectedCount: number }>(response)
}
