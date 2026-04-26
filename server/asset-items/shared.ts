import { readJsonBody, sendJson } from '../ai-gateway/shared'

export type AssetScope = 'feed' | 'mine'
export type AssetKind = 'image' | 'video'

export interface AssetListQuery {
  scope: AssetScope
  assetType: AssetKind
  take: number
}

export type AssetActionType = 'delete' | 'publish' | 'unpublish' | 'favorite' | 'view' | 'download'

export interface AssetActionPayload {
  action: AssetActionType
  ids: string[]
}

// 解析资源查询参数。
export const readAssetListQuery = (requestUrl: string) => {
  const url = new URL(requestUrl, 'http://localhost')
  const scope = url.searchParams.get('scope') === 'mine' ? 'mine' : 'feed'
  const assetType = url.searchParams.get('assetType') === 'video' ? 'video' : 'image'
  const rawTake = Number(url.searchParams.get('take') || 0)

  return {
    scope,
    assetType,
    take: Number.isFinite(rawTake) && rawTake > 0 ? Math.min(rawTake, 120) : 60,
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
  } satisfies AssetActionPayload
}
