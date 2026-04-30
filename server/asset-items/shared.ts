import { readJsonBody, sendJson } from '../ai-gateway/shared'

export type AssetScope = 'feed' | 'mine' | 'all'
export type AssetKind = 'image' | 'video'
export type AssetPublishState = 'all' | 'published' | 'draft'

export interface AssetListQuery {
  scope: AssetScope
  assetType: AssetKind
  take: number
  page: number
  pageSize: number
  publishState: AssetPublishState
  ownerKeyword: string
}

export interface AssetListResult<TItem = Record<string, unknown>> {
  items: TItem[]
  summary: {
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
  }
}

export type AssetActionType = 'delete' | 'publish' | 'unpublish' | 'favorite' | 'view' | 'download'

export interface AssetActionPayload {
  action: AssetActionType
  ids: string[]
  scope: AssetScope
}

// 解析资源查询参数。
export const readAssetListQuery = (requestUrl: string) => {
  const url = new URL(requestUrl, 'http://localhost')
  const rawScope = String(url.searchParams.get('scope') || '').trim().toLowerCase()
  const scope = rawScope === 'mine'
    ? 'mine'
    : rawScope === 'all'
      ? 'all'
      : 'feed'
  const assetType = url.searchParams.get('assetType') === 'video' ? 'video' : 'image'
  const rawTake = Number(url.searchParams.get('take') || 0)
  const rawPage = Number(url.searchParams.get('page') || 1)
  const rawPageSize = Number(url.searchParams.get('pageSize') || 0)
  const rawPublishState = String(url.searchParams.get('publishState') || '').trim().toLowerCase()
  const ownerKeyword = String(url.searchParams.get('ownerKeyword') || '').trim()
  const normalizedTake = Number.isFinite(rawTake) && rawTake > 0 ? Math.min(rawTake, 120) : 60
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(rawPageSize, 120)
    : normalizedTake
  const publishState = rawPublishState === 'published'
    ? 'published'
    : rawPublishState === 'draft'
      ? 'draft'
      : 'all'

  return {
    scope,
    assetType,
    take: normalizedTake,
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
    pageSize,
    publishState,
    ownerKeyword,
  } satisfies AssetListQuery
}

// 返回统一的资源接口错误。
export const sendAssetItemsError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'asset_items_error',
      message,
    },
  })
}

// 读取批量资源动作请求体。
export const readAssetActionBody = async (req: any) => {
  const payload = await readJsonBody(req)

  return {
    action: String((payload as any)?.action || '').trim() as AssetActionType,
    ids: Array.isArray((payload as any)?.ids)
      ? (payload as any).ids.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [],
    scope: String((payload as any)?.scope || '').trim().toLowerCase() === 'all'
      ? 'all'
      : String((payload as any)?.scope || '').trim().toLowerCase() === 'feed'
        ? 'feed'
        : 'mine',
  } satisfies AssetActionPayload
}
