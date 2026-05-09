import { getGenerationRecordById, updateGenerationRecord } from '../generation-records/service'
import type { GenerationTaskStreamEvent } from './shared'
import {
  addTaskStreamSubscriber,
  hasLocalRunningTask,
  isUserStreamSubscriberLimitReached,
  removeTaskStreamSubscriber,
  SSE_PER_USER_LIMIT,
} from './local-runtime'
import { getSharedTaskRuntime } from './runtime-store'
import {
  cleanupDistributedTaskSubscriptionIfIdle,
  ensureDistributedTaskSubscription,
} from './event-bus'
import { getReplayEventsAfter } from './task-event-replay'

// SSE 连接最长生命周期（毫秒）：到期强制关闭，防止 TCP 半开连接导致 res 既不 close 也不 error
// 触发的资源泄漏。客户端通过自动重连 + lastEventId 续上即可。默认与 Redis 任务快照 TTL 一致（30 分钟）。
const SSE_MAX_CONNECTION_MS = Number.parseInt(process.env.SSE_MAX_CONNECTION_MS || '1800000', 10)

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
export const subscribeGenerationTaskStream = async (
  recordId: string,
  currentUserId: string,
  res: any,
  options: { lastEventId?: number } = {},
) => {
  // 用户级 SSE 订阅限流，防止同一用户耗尽长连接资源
  if (isUserStreamSubscriberLimitReached(currentUserId)) {
    res.statusCode = 429
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      message: `当前用户的实时订阅数量已达上限（${SSE_PER_USER_LIMIT}），请关闭部分页面后重试`,
    }))
    return
  }

  const record = await resolveTaskRecordSnapshot(recordId, currentUserId)

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  addTaskStreamSubscriber(recordId, res, currentUserId)
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

  // 若客户端带了 lastEventId，按需重放期间错过的事件
  const lastEventId = options.lastEventId || 0
  if (lastEventId > 0 && !record.done) {
    try {
      const replayEntries = await getReplayEventsAfter(recordId, lastEventId)
      for (const entry of replayEntries) {
        const idLine = `id: ${entry.id}\n`
        res.write(`${idLine}event: ${entry.event.type}\ndata: ${JSON.stringify(entry.event)}\n\n`)
      }
    } catch {
      // 重放失败不影响后续订阅
    }
  }

  if (record.done) {
    res.end()
    return
  }

  const heartbeatTimer = setInterval(() => {
    try {
      // 显式心跳事件，前端可监听并实现 watchdog；保留 SSE 注释行作 TCP 层 keep-alive 兜底
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`)
    } catch {
      // 连接写入失败时，由 close 事件统一清理。
    }
  }, 15000)

  // 最长生命周期兜底：到期强制关闭，防 TCP 半开连接导致的资源泄漏
  const lifetimeTimer = setTimeout(() => {
    try {
      res.end()
    } catch {
      // 已断开
    }
  }, SSE_MAX_CONNECTION_MS)

  const cleanup = () => {
    clearInterval(heartbeatTimer)
    clearTimeout(lifetimeTimer)
    removeTaskStreamSubscriber(recordId, res, currentUserId)
    void cleanupDistributedTaskSubscriptionIfIdle(recordId)
  }

  res.on('close', cleanup)
  res.on('error', cleanup)
}
