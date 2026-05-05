import { getGenerationRecordById, updateGenerationRecord } from '../generation-records/service'
import type { GenerationTaskStreamEvent } from './shared'
import {
  addTaskStreamSubscriber,
  hasLocalRunningTask,
  removeTaskStreamSubscriber,
} from './local-runtime'
import { getSharedTaskRuntime } from './runtime-store'
import {
  cleanupDistributedTaskSubscriptionIfIdle,
  ensureDistributedTaskSubscription,
} from './event-bus'

// 当本地与共享运行态都显示任务已经不再执行，但记录仍停留在未完成态时，
// 这里统一补收口，避免前端刷新后长时间挂在“生成中”。
export const resolveTaskRecordSnapshot = async (recordId: string, currentUserId: string) => {
  let record = await getGenerationRecordById(recordId, currentUserId)
  const sharedRuntime = await getSharedTaskRuntime(recordId)

  if (
    !record.done
    && !record.stopped
    && !hasLocalRunningTask(recordId)
    && sharedRuntime?.status !== 'running'
    && sharedRuntime?.status !== 'queued'
  ) {
    await updateGenerationRecord(recordId, {
      type: record.type,
      prompt: record.prompt,
      content: record.content,
      error: record.error,
      model: record.model,
      modelKey: record.modelKey,
      ratio: record.ratio,
      resolution: record.resolution,
      duration: record.duration,
      feature: record.feature,
      skill: record.skill,
      done: true,
      stopped: true,
      images: record.images,
      agentRun: record.agentRun,
    }, currentUserId)

    record = await getGenerationRecordById(recordId, currentUserId)
  }

  return record
}

// 统一封装任务 SSE 订阅入口，service.ts 只保留任务生命周期编排。
export const subscribeGenerationTaskStream = async (recordId: string, currentUserId: string, res: any) => {
  const record = await resolveTaskRecordSnapshot(recordId, currentUserId)

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  addTaskStreamSubscriber(recordId, res)
  await ensureDistributedTaskSubscription(recordId)

  res.write(`event: connected\ndata: ${JSON.stringify({
    type: 'connected',
    recordId,
    done: Boolean(record.done),
    stopped: Boolean(record.stopped),
    stage: record.done ? 'connected_completed' : 'connected_running',
    message: '任务事件流已连接',
  } satisfies GenerationTaskStreamEvent)}\n\n`)
  res.write(`event: snapshot\ndata: ${JSON.stringify({
    type: 'snapshot',
    recordId,
    done: Boolean(record.done),
    stopped: Boolean(record.stopped),
    record,
    stage: record.done ? 'snapshot_completed' : 'snapshot_running',
    message: record.done ? '已返回任务最终快照' : '已返回任务当前快照',
  } satisfies GenerationTaskStreamEvent)}\n\n`)

  if (record.done) {
    res.end()
    return
  }

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      // 连接写入失败时，由 close 事件统一清理。
    }
  }, 15000)

  const cleanup = () => {
    clearInterval(heartbeatTimer)
    removeTaskStreamSubscriber(recordId, res)
    void cleanupDistributedTaskSubscriptionIfIdle(recordId)
  }

  res.on('close', cleanup)
  res.on('error', cleanup)
}
