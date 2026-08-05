/**
 * 视频生成 API（异步轮询）
 */

import { request } from './request'

const DEFAULT_VIDEO_ENDPOINT = '/videos'

export interface WorkflowVideoTaskOptions {
  endpoint?: string
  signal?: AbortSignal
}

export interface WorkflowVideoTaskStatusResult {
  status?: string
  data?: Array<{ url?: string }> | Record<string, unknown> | null
  url?: string
  task_id?: string
  id?: string
  error?: {
    message?: string
  } | null
}

export const createVideoTask = (data: FormData, options: WorkflowVideoTaskOptions = {}) => {
  const { endpoint, signal } = options
  return request({
    url: endpoint || DEFAULT_VIDEO_ENDPOINT,
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
  }, 'video')
}

export const getVideoTaskStatus = (taskId: string, providerId: string, signal?: AbortSignal) =>
  request({ url: `/videos/${taskId}`, method: 'get', providerId, signal }, 'video')

const waitForNextPoll = (interval: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('视频任务轮询已取消', 'AbortError'))
    return
  }
  const handleAbort = () => {
    clearTimeout(timeout)
    reject(new DOMException('视频任务轮询已取消', 'AbortError'))
  }
  const timeout = setTimeout(() => {
    signal?.removeEventListener('abort', handleAbort)
    resolve()
  }, interval)
  signal?.addEventListener('abort', handleAbort, { once: true })
})

export const pollVideoTask = async (
  taskId: string,
  providerId: string,
  maxAttempts: number = 120,
  interval: number = 5000,
  signal?: AbortSignal,
): Promise<WorkflowVideoTaskStatusResult> => {
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new DOMException('视频任务轮询已取消', 'AbortError')
    const result = await getVideoTaskStatus(taskId, providerId, signal) as WorkflowVideoTaskStatusResult
    if (result.status === 'completed' || result.data) return result
    if (result.status === 'failed') {
      throw new Error(result.error?.message || '视频生成失败')
    }
    await waitForNextPoll(interval, signal)
  }
  throw new Error('视频生成超时')
}
