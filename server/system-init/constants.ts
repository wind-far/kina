// 首次安装状态查询接口。
export const SYSTEM_INIT_STATUS_PATH = '/api/system-init/status'

// 首次安装初始化接口。
export const SYSTEM_INIT_INITIALIZE_PATH = '/api/system-init/initialize'

// 判断是否命中首次安装初始化模块。
export const isSystemInitPath = (requestPath: string) => {
  return requestPath === SYSTEM_INIT_STATUS_PATH || requestPath === SYSTEM_INIT_INITIALIZE_PATH
}
