// 任务事件流共享协议（前后端共用）
//
// 设计要点：
// - 用泛型 TRecord 适配前后端对 record 字段的不同类型期望（前端是 PersistedGenerationRecord，
//   服务端是 Record<string, unknown>），但其余字段强类型对齐
// - 定义标准化的失败码 GenerationTaskFailureCode，用于 failed 事件，
//   前端可据此区分错误类型并给出准确的用户反馈
import type { AgentWorkspaceEvent } from './agent-workspace'

export type GenerationTaskStreamEventType =
  | 'connected'
  | 'snapshot'
  | 'progress'
  | 'content_delta'
  | 'thinking_delta'
  | 'agent_event'
  | 'completed'
  | 'failed'
  | 'stopped'

// 任务失败的标准化原因，前端可据此决定提示文案与是否提示重试
export type GenerationTaskFailureCode =
  | 'upstream_error'        // 上游 AI 厂商返回错误
  | 'upstream_timeout'      // 上游响应超时
  | 'upstream_disconnected' // 上游连接中断
  | 'rate_limit_exceeded'   // 触发限流
  | 'concurrency_exceeded'  // 并发数超限
  | 'authentication_failed' // 鉴权失败
  | 'insufficient_quota'    // 余额或配额不足
  | 'invalid_input'         // 输入参数非法
  | 'task_aborted'          // 任务被主动中止
  | 'internal_error'        // 内部错误（兜底）

// 通用事件载荷，TRecord 用于桥接前后端 record 字段的差异
export interface GenerationTaskStreamEventBase<TRecord = unknown> {
  type: GenerationTaskStreamEventType
  recordId: string
  done: boolean
  stopped?: boolean
  record?: TRecord | null
  stage?: string
  message?: string
  delta?: string
  content?: string
  /** thinking_delta 事件用：本次新增的思考片段。 */
  thinkingDelta?: string
  /** thinking_delta / completed 事件用：累计完整思考内容。 */
  thinkingContent?: string
  agentEvent?: AgentWorkspaceEvent
  // 单调递增的事件 id，用于客户端断线重连时通过 lastEventId 定位重放起点
  id?: number
  // 仅 failed 事件使用：标准化错误码 + 详细原因
  errorCode?: GenerationTaskFailureCode
  errorReason?: string
}

// 默认导出：record 用 unknown，由前后端各自收紧
export type GenerationTaskStreamEvent = GenerationTaskStreamEventBase
