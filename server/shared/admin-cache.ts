import { invalidateAdminDashboardOverviewCache } from '../admin-dashboard/service'
import { invalidateAdminUsersCaches } from '../admin-users/service'
import { invalidateAssetItemsCaches } from '../asset-items/service'
import { invalidateGenerationRecordsCache } from '../generation-records/service'
import { invalidateGenerationSessionsCache } from '../generation-sessions/service'
import { invalidateMarketingCenterOverviewCache } from '../marketing-center/service'
import { invalidateProviderDiscoverModelsCache } from '../provider-config/model-service'
import { invalidatePublicModelCatalogCache } from '../provider-config/service'
import { clearRedisRuntimeSettingsCache } from '../redis'
import { invalidateSkillRuntimeCache } from '../skill-config/service'
import { invalidateSystemConfigCaches } from '../system-config/service'

type CacheScopeValue = boolean | string | null | undefined

export interface InvalidateAdminCachesOptions {
  dashboard?: CacheScopeValue
  users?: CacheScopeValue
  assets?: boolean
  modelCatalog?: boolean
  providerDiscover?: CacheScopeValue
  marketing?: CacheScopeValue
  skills?: CacheScopeValue
  systemConfig?: boolean
  redisRuntimeSettings?: boolean
  generationSessions?: CacheScopeValue
  generationRecords?: CacheScopeValue
}

const resolveScopedId = (value: CacheScopeValue) => {
  return typeof value === 'string' ? value.trim() : undefined
}

export const invalidateAdminCaches = async (options: InvalidateAdminCachesOptions) => {
  const tasks: Array<Promise<unknown>> = []

  if (options.dashboard) {
    tasks.push(invalidateAdminDashboardOverviewCache(resolveScopedId(options.dashboard)))
  }
  if (options.users) {
    tasks.push(invalidateAdminUsersCaches(resolveScopedId(options.users)))
  }
  if (options.assets) {
    tasks.push(invalidateAssetItemsCaches())
  }
  if (options.modelCatalog) {
    tasks.push(invalidatePublicModelCatalogCache())
  }
  if (options.providerDiscover) {
    tasks.push(invalidateProviderDiscoverModelsCache(resolveScopedId(options.providerDiscover)))
  }
  if (options.marketing) {
    tasks.push(invalidateMarketingCenterOverviewCache(resolveScopedId(options.marketing)))
  }
  if (options.skills) {
    tasks.push(invalidateSkillRuntimeCache(resolveScopedId(options.skills)))
  }
  if (options.systemConfig) {
    tasks.push(invalidateSystemConfigCaches())
  }
  if (options.generationSessions) {
    tasks.push(invalidateGenerationSessionsCache(resolveScopedId(options.generationSessions)))
  }
  if (options.generationRecords) {
    tasks.push(invalidateGenerationRecordsCache(resolveScopedId(options.generationRecords)))
  }
  if (options.redisRuntimeSettings) {
    clearRedisRuntimeSettingsCache()
  }

  await Promise.all(tasks)
}
