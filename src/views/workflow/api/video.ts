/**
 * 视频生成 API（异步轮询）
 */

import { request } from './request'

const DEFAULT_VIDEO_ENDPOINT = '/videos'

export interface WorkflowVideoTaskOptions {
  endpoint?: string
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
  const { endpoint } = options
  return request({
    url: endpoint || DEFAULT_VIDEO_ENDPOINT,
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' }
  }, 'video')
}

export const getVideoTaskStatus = (taskId: string, providerId: string) =>
  request({ url: `/videos/${taskId}`, method: 'get', providerId }, 'video')

export const pollVideoTask = async (
  taskId: string,
  providerId: string,
  maxAttempts: number = 120,
  interval: number = 5000,
): Promise<WorkflowVideoTaskStatusResult> => {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getVideoTaskStatus(taskId, providerId) as WorkflowVideoTaskStatusResult
    if (result.status === 'completed' || result.data) return result
    if (result.status === 'failed') {
      throw new Error(result.error?.message || '视频生成失败')
    }
    await new Promise<void>((resolve) => setTimeout(resolve, interval))
  }
  throw new Error('视频生成超时')
}
