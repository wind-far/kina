/**
 * AI 网关前端共享类型
 * 生成链路已统一改为只走后台模型配置，这里仅保留请求类型定义。
 */

export type AiEndpointType = 'chat' | 'image' | 'image-edit' | 'video'

export type AiModelCategory = 'CHAT' | 'IMAGE' | 'VIDEO'

export const resolveEndpointModelCategory = (endpointType: AiEndpointType): AiModelCategory => {
  if (endpointType === 'chat') return 'CHAT'
  if (endpointType === 'video') return 'VIDEO'
  return 'IMAGE'
}
