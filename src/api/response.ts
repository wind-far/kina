import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useLoginModalStore } from '@/stores/login-modal'

// 后端统一响应包结构。
export interface ApiResponseEnvelope<T> {
  data?: T
  message?: string
  error?: {
    type?: string
    message?: string
  }
}

// 接口提示输出选项。
export interface ApiMessageOptions {
  showSuccessMessage?: boolean
  showErrorMessage?: boolean
  successMessage?: string
  errorMessage?: string
  successMessageType?: 'success' | 'warning' | 'info'
}

// 统一的接口异常对象，便于上层按状态码做进一步处理。
export class ApiResponseError extends Error {
  status: number
  type: string
  payload: ApiResponseEnvelope<unknown>

  constructor(input: {
    status: number
    type?: string
    message: string
    payload: ApiResponseEnvelope<unknown>
  }) {
    super(input.message)
    this.name = 'ApiResponseError'
    this.status = input.status
    this.type = String(input.type || 'api_error')
    this.payload = input.payload
  }
}

// 读取后端响应体。
const readResponsePayload = async <T>(response: Response) => {
  return await response.json().catch(() => ({})) as ApiResponseEnvelope<T>
}

// 统一处理 401 登录失效场景，自动拉起登录弹窗。
export const handleUnauthorizedResponse = (status: number, source = '') => {
  if (status !== 401) {
    return
  }

  const authStore = useAuthStore()
  const { openLoginModal } = useLoginModalStore()

  void authStore.loadSession(true)
  openLoginModal(source || 'api-401')
}

// 统一解析后端响应，并按需输出 message 提示。
export const readApiData = async <T>(
  response: Response,
  options: ApiMessageOptions = {},
) => {
  const payload = await readResponsePayload<T>(response)

  if (!response.ok) {
    handleUnauthorizedResponse(response.status, 'read-api-data')

    const errorMessage = String(
      options.errorMessage
      || payload?.error?.message
      || payload?.message
      || `请求失败 (${response.status})`,
    ).trim()

    if (options.showErrorMessage !== false) {
      ElMessage.error(errorMessage)
    }

    throw new ApiResponseError({
      status: response.status,
      type: payload?.error?.type,
      message: errorMessage,
      payload,
    })
  }

  const successMessage = String(
    options.successMessage || payload?.message || '',
  ).trim()

  if (options.showSuccessMessage && successMessage) {
    ElMessage({
      type: options.successMessageType || 'success',
      message: successMessage,
    })
  }

  return payload?.data as T
}
