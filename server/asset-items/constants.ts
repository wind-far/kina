export const ASSET_ITEMS_BASE_PATH = '/api/asset-items'

export const isAssetItemsPath = (requestPath: string) => {
  return requestPath === ASSET_ITEMS_BASE_PATH || requestPath.startsWith(`${ASSET_ITEMS_BASE_PATH}/`)
}
