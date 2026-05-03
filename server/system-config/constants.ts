// 系统设置公开读取接口。
export const SYSTEM_CONFIG_PUBLIC_PATH = '/api/system-config/public'

// 系统设置后台管理接口。
export const SYSTEM_CONFIG_ADMIN_PATH = '/api/system-config/admin'

// Redis 健康检查接口，供后台确认缓存与任务运行态能力是否可用。
export const SYSTEM_CONFIG_REDIS_HEALTH_PATH = '/api/system-config/admin/redis-health'
export const SYSTEM_CONFIG_REDIS_OVERVIEW_PATH = '/api/system-config/admin/redis-overview'
export const SYSTEM_CONFIG_REDIS_ACTIONS_PATH = '/api/system-config/admin/redis-actions'
export const SYSTEM_CONFIG_REDIS_TASK_DETAIL_PATH = '/api/system-config/admin/redis-task-detail'
export const SYSTEM_CONFIG_REDIS_SETTINGS_PATH = '/api/system-config/admin/redis-settings'

// 判断当前请求是否命中系统设置接口。
export const isSystemConfigPath = (requestPath: string) => {
  return requestPath === SYSTEM_CONFIG_PUBLIC_PATH
    || requestPath === SYSTEM_CONFIG_ADMIN_PATH
    || requestPath === SYSTEM_CONFIG_REDIS_HEALTH_PATH
    || requestPath === SYSTEM_CONFIG_REDIS_OVERVIEW_PATH
    || requestPath === SYSTEM_CONFIG_REDIS_ACTIONS_PATH
    || requestPath === SYSTEM_CONFIG_REDIS_TASK_DETAIL_PATH
    || requestPath === SYSTEM_CONFIG_REDIS_SETTINGS_PATH
}
