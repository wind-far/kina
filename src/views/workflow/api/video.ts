/**
 * 视频生成 API（异步轮询）
 */

import { request } from './request'
import { resolveRequestModelKey, resolveRequestProviderId } from '@/config/models'

const DEFAULT_VIDEO_ENDPOINT = '/videos'

export const createVideoTask = (data: any, options: any = {}) => {
  const { endpoint } = options
  const originalModel = String(data instanceof FormData ? data.get('model') || '' : data?.model || '').trim()
  const providerId = resolveRequestProviderId(originalModel, 'VIDEO')
  const modelKey = resolveRequestModelKey(originalModel, 'VIDEO')
  return request({
    url: endpoint || DEFAULT_VIDEO_ENDPOINT,
    method: 'post',
    data,
    providerId,
    modelKey,
    headers: { 'Content-Type': 'multipart/form-data' }
  }, 'video')
}

export const getVideoTaskStatus = (taskId: string, providerId: string) =>
  request({ url: `/videos/${taskId}`, method: 'get', providerId }, 'video')

export const pollVideoTask = async (taskId: string, providerId: string, maxAttempts: number = 120, interval: number = 5000) => {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getVideoTaskStatus(taskId, providerId)
    if (result.status === 'completed' || result.data) return result
    if (result.status === 'failed') {
      throw new Error(result.error?.message || '视频生成失败')
    }
    await new Promise((resolve: any) => setTimeout(resolve, interval))
  }
  throw new Error('视频生成超时')
}
