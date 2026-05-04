import type { GenerationTaskStreamEvent } from './shared'

export interface LocalRunningGenerationTask {
  recordId: string
  userId: string
  type: 'image' | 'agent'
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

export const setLocalRunningTask = (task: LocalRunningGenerationTask) => {
  runningGenerationTasks.set(task.recordId, task)
}

export const getLocalRunningTask = (recordId: string) => runningGenerationTasks.get(recordId)

export const hasLocalRunningTask = (recordId: string) => runningGenerationTasks.has(recordId)

export const deleteLocalRunningTask = (recordId: string) => {
  runningGenerationTasks.delete(recordId)
}

export const addTaskStreamSubscriber = (recordId: string, res: any) => {
  let subscribers = taskStreamSubscribers.get(recordId)
  if (!subscribers) {
    subscribers = new Set()
    taskStreamSubscribers.set(recordId, subscribers)
  }

  subscribers.add(res)
}

export const removeTaskStreamSubscriber = (recordId: string, res: any) => {
  const subscribers = taskStreamSubscribers.get(recordId)
  if (!subscribers) {
    return
  }

  subscribers.delete(res)
  if (subscribers.size === 0) {
    taskStreamSubscribers.delete(recordId)
  }
}

export const getTaskStreamSubscriberCount = (recordId: string) => taskStreamSubscribers.get(recordId)?.size || 0

// 统一向当前实例上的 SSE 连接写事件，不关心事件来自本地还是 Redis 广播。
export const emitLocalTaskStreamEvent = (recordId: string, event: GenerationTaskStreamEvent) => {
  const subscribers = taskStreamSubscribers.get(recordId)
  if (!subscribers?.size) {
    return
  }

  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  for (const res of subscribers) {
    try {
      res.write(payload)
    } catch {
      subscribers.delete(res)
    }
  }

  if (subscribers.size === 0) {
    taskStreamSubscribers.delete(recordId)
  }
}
