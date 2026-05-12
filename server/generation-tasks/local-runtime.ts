import type { GenerationTaskStreamEvent } from './shared'

export interface LocalRunningGenerationTask {
  recordId: string
  userId: string
  type: 'image' | 'agent' | 'research'
  strategyKey: string
  abortController: AbortController
  associationNo: string
  billedEndpointType: 'chat' | 'image' | 'video'
  billedPointCost: number
  billedProviderId: string
  billedModelKey: string
  billedModelName: string
  refundCommitted: boolean
  // 任务创建时占用的并发槽位，结束后需要统一释放。
  concurrencySlots?: Array<{
    scope: 'user' | 'skill' | 'provider'
    key: string
    limit: number
    currentCount: number
  }>
}

const runningGenerationTasks = new Map<string, LocalRunningGenerationTask>()
const taskStreamSubscribers = new Map<string, Set<any>>()
// 用户级订阅计数：防止同一用户开过多 SSE 连接耗尽资源
const userStreamSubscribers = new Map<string, Set<any>>()
// 每用户最多并发 SSE 订阅数（典型场景：多标签页 + 工作流多节点同时执行）
export const SSE_PER_USER_LIMIT = Number.parseInt(process.env.SSE_PER_USER_LIMIT || '20', 10)

export const setLocalRunningTask = (task: LocalRunningGenerationTask) => {
  runningGenerationTasks.set(task.recordId, task)
}

export const getLocalRunningTask = (recordId: string) => runningGenerationTasks.get(recordId)

export const hasLocalRunningTask = (recordId: string) => runningGenerationTasks.has(recordId)

export const deleteLocalRunningTask = (recordId: string) => {
  runningGenerationTasks.delete(recordId)
}

// 检查用户当前的 SSE 并发订阅数是否已达上限
export const isUserStreamSubscriberLimitReached = (userId: string) => {
  const set = userStreamSubscribers.get(userId)
  return (set?.size || 0) >= SSE_PER_USER_LIMIT
}

export const addTaskStreamSubscriber = (recordId: string, res: any, userId?: string) => {
  let subscribers = taskStreamSubscribers.get(recordId)
  if (!subscribers) {
    subscribers = new Set()
    taskStreamSubscribers.set(recordId, subscribers)
  }
  subscribers.add(res)

  if (userId) {
    let userSet = userStreamSubscribers.get(userId)
    if (!userSet) {
      userSet = new Set()
      userStreamSubscribers.set(userId, userSet)
    }
    userSet.add(res)
  }
}

export const removeTaskStreamSubscriber = (recordId: string, res: any, userId?: string) => {
  const subscribers = taskStreamSubscribers.get(recordId)
  if (subscribers) {
    subscribers.delete(res)
    if (subscribers.size === 0) {
      taskStreamSubscribers.delete(recordId)
    }
  }

  if (userId) {
    const userSet = userStreamSubscribers.get(userId)
    if (userSet) {
      userSet.delete(res)
      if (userSet.size === 0) {
        userStreamSubscribers.delete(userId)
      }
    }
  }
}

export const getTaskStreamSubscriberCount = (recordId: string) => taskStreamSubscribers.get(recordId)?.size || 0

// 统一向当前实例上的 SSE 连接写事件，不关心事件来自本地还是 Redis 广播。
//
// backpressure 策略：当 res.write 返回 false 表示 socket 写入缓冲已满
// （客户端处理太慢），主动断开该连接，让客户端通过自动重连 + lastEventId
// 重放遗漏事件，避免内存被慢客户端撑爆。
export const emitLocalTaskStreamEvent = (recordId: string, event: GenerationTaskStreamEvent) => {
  const subscribers = taskStreamSubscribers.get(recordId)
  if (!subscribers?.size) {
    return
  }

  // 写入 SSE 标准 id 字段，让客户端跟踪 lastEventId 用于断线重连定位
  const idLine = event.id !== undefined ? `id: ${event.id}\n` : ''
  const payload = `${idLine}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  const slowSubscribers: any[] = []
  for (const res of subscribers) {
    try {
      const ok = res.write(payload)
      if (ok === false) {
        // 缓冲已满：标记为待断开，避免后续事件继续堆积内存
        slowSubscribers.push(res)
      }
    } catch {
      subscribers.delete(res)
    }
  }

  // 慢订阅者断开连接，触发客户端通过自动重连 + lastEventId 恢复
  for (const res of slowSubscribers) {
    subscribers.delete(res)
    try {
      res.end()
    } catch {
      // 已经断开就忽略
    }
  }

  if (subscribers.size === 0) {
    taskStreamSubscribers.delete(recordId)
  }
}
