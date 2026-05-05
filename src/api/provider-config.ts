/**
 * AI 网关前端共享类型
 * 生成链路已统一改为只走后台模型配置，这里仅保留请求类型定义。
 */

export type {
  AiEndpointType,
  AiModelCategory,
} from '../shared/provider-endpoint-strategy'

export {
  resolveEndpointModelCategory,
} from '../shared/provider-endpoint-strategy'
