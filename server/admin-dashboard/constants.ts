export const ADMIN_DASHBOARD_OVERVIEW_PATH = '/api/admin/dashboard/overview'

// 判断当前路径是否命中后台仪表盘统计接口。
export const isAdminDashboardPath = (requestPath: string) => requestPath === ADMIN_DASHBOARD_OVERVIEW_PATH
