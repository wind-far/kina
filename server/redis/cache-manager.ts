import { deleteJsonCache } from './json-cache'

// 统一批量失效缓存，后续各模块只需要给出 key 列表，不再重复手写 Promise.all。
export const invalidateRedisCaches = async (keys: Array<string | null | undefined>) => {
  const normalizedKeys = keys
    .map(key => String(key || '').trim())
    .filter(Boolean)

  if (!normalizedKeys.length) {
    return
  }

  await Promise.all(normalizedKeys.map(key => deleteJsonCache(key)))
}
