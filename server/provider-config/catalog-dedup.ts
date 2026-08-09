export interface PublicCatalogModelIdentity {
  providerId: string
  category: string
  modelKey: string
}

// 同一模型可能同时来自历史通用配置和环境变量启动注入。前台只能展示一个：
// 已在 .env 中显式配置的类别优先使用环境变量受管配置；没有环境变量配置的类别
// 则仍保留手动配置（例如仅手动配置的视频厂商）。
export const deduplicatePublicCatalogModels = <T extends PublicCatalogModelIdentity>(
  models: T[],
  environmentManagedProviderIds: ReadonlySet<string>,
) => {
  const uniqueModels: T[] = []
  const indexByIdentity = new Map<string, number>()

  for (const model of models) {
    const identity = `${model.category}::${String(model.modelKey || '').trim().toLocaleLowerCase('en-US')}`
    const existingIndex = indexByIdentity.get(identity)
    if (existingIndex === undefined) {
      indexByIdentity.set(identity, uniqueModels.length)
      uniqueModels.push(model)
      continue
    }

    const existing = uniqueModels[existingIndex]
    if (!environmentManagedProviderIds.has(existing.providerId) && environmentManagedProviderIds.has(model.providerId)) {
      uniqueModels[existingIndex] = model
    }
  }

  return uniqueModels
}
