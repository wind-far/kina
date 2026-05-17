import { buildApiUrl } from './http'
import { readApiData, type ApiMessageOptions } from './response'

// 后台查询参数允许的基础值类型。
type AdminQueryValue = string | number | boolean | null | undefined

// 后台请求的统一配置，额外承接接口提示选项。
interface AdminRequestOptions extends ApiMessageOptions {
  query?: Record<string, AdminQueryValue>
  body?: unknown
  headers?: Record<string, string>
}

// 统一拼接后台接口 URL，自动忽略 null / undefined 查询参数。
const buildAdminRequestUrl = (path: string, query?: Record<string, AdminQueryValue>) => {
  const params = new URLSearchParams()
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    params.set(key, String(value))
  })

  const queryString = params.toString()
  return buildApiUrl(queryString ? `${path}${path.includes('?') ? '&' : '?'}${queryString}` : path)
}

// 统一构造后台请求初始化参数，确保后台接口默认携带 Cookie 且不走浏览器缓存。
const buildAdminRequestInit = (method: string, options: AdminRequestOptions = {}) => {
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  }
  const init: RequestInit = {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers,
  }

  if (options.body !== undefined) {
    // 后台管理接口默认走 JSON；少数自定义 header 场景仍允许调用方覆盖。
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  }

  return init
}

// 后台请求核心入口，统一接入 readApiData 的成功/失败提示与 401 处理。
const adminRequest = async <T>(method: string, path: string, options: AdminRequestOptions = {}) => {
  const response = await fetch(
    buildAdminRequestUrl(path, options.query),
    buildAdminRequestInit(method, options),
  )

  return readApiData<T>(response, {
    showSuccessMessage: options.showSuccessMessage,
    showErrorMessage: options.showErrorMessage,
    successMessage: options.successMessage,
    errorMessage: options.errorMessage,
    successMessageType: options.successMessageType,
  })
}

// 后台 GET 请求。
export const adminGet = <T>(path: string, options: AdminRequestOptions = {}) => {
  return adminRequest<T>('GET', path, options)
}

// 后台 POST 请求。
export const adminPost = <T>(path: string, body?: unknown, options: AdminRequestOptions = {}) => {
  return adminRequest<T>('POST', path, {
    ...options,
    body,
  })
}

// 后台 PUT 请求。
export const adminPut = <T>(path: string, body?: unknown, options: AdminRequestOptions = {}) => {
  return adminRequest<T>('PUT', path, {
    ...options,
    body,
  })
}

// 后台 PATCH 请求。
export const adminPatch = <T>(path: string, body?: unknown, options: AdminRequestOptions = {}) => {
  return adminRequest<T>('PATCH', path, {
    ...options,
    body,
  })
}

// 后台 DELETE 请求。
export const adminDelete = <T>(path: string, options: AdminRequestOptions = {}) => {
  return adminRequest<T>('DELETE', path, options)
}
