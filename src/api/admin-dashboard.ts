import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface DashboardTrendPoint {
  label: string
  value: number
}

export interface AdminDashboardOverview {
  asset: {
    total: number
    published: number
    draft: number
    trend: DashboardTrendPoint[]
  }
  generation: {
    total: number
    completed: number
    failed: number
    today: number
    trend: DashboardTrendPoint[]
  }
  runtime: {
    enabledStorageName: string
    enabledStorageCode: string
    totalStorageConfigs: number
    providerBaseUrl: string
    providerName: string
  }
}

const ADMIN_DASHBOARD_OVERVIEW_PATH = '/api/admin/dashboard/overview'

// 查询后台仪表盘概览数据。
export const getAdminDashboardOverview = async () => {
  const response = await fetch(buildApiUrl(ADMIN_DASHBOARD_OVERVIEW_PATH), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminDashboardOverview>(response)
}
