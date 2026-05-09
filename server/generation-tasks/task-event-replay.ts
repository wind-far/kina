// 任务事件重放：客户端断线重连时根据 lastEventId 重放遗漏事件，
// 避免 LLM 流式中间内容（content_delta）丢失。
//
// id 分配策略：
// - 在事件源头同步分配（基于 recordId 内单调递增的本地计数器）
// - id 随事件载荷一起跨实例广播，目标实例不重新分配
// - 客户端重连时通过 ?lastEventId=N 请求 N 之后的事件回放
//
// 存储策略：
// - 主存储：本地 Map（最近 100 条），单实例重连场景全覆盖
// - 备份：异步写入 Redis（fire-and-forget），多实例重连兜底
import type { GenerationTaskStreamEvent } from './shared'
import { REDIS_CONFIG, redisKeys } from '../redis'
import { getRedisClient } from '../redis/client'
import { isRedisEnabled } from '../redis/config'

export interface ReplayEventEntry {
  id: number
  event: GenerationTaskStreamEvent
}

const REPLAY_CAP = 100

const localReplayEvents = new Map<string, ReplayEventEntry[]>()
const localReplayCounters = new Map<string, number>()

// 同步分配单调递增的事件 id
export const allocateEventId = (recordId: string): number => {
  const next = (localReplayCounters.get(recordId) ?? 0) + 1
  localReplayCounters.set(recordId, next)
  return next
}

// 写入本地缓存（同步），并 fire-and-forget 备份到 Redis
export const recordReplayEvent = (
  recordId: string,
  entry: ReplayEventEntry,
) => {
  let arr = localReplayEvents.get(recordId)
  if (!arr) {
    arr = []
    localReplayEvents.set(recordId, arr)
  }
  arr.push(entry)
  if (arr.length > REPLAY_CAP) {
    arr.splice(0, arr.length - REPLAY_CAP)
  }

  // Redis 备份：失败不影响主流程
  if (isRedisEnabled()) {
    void persistReplayEventToRedis(recordId, entry).catch(() => {
      // 备份失败时本地仍可正常服务
    })
  }
}

const persistReplayEventToRedis = async (recordId: string, entry: ReplayEventEntry) => {
  const client = await getRedisClient()
  if (!client) return

  const listKey = redisKeys.taskEventReplay(recordId)
  await client.rpush(listKey, JSON.stringify(entry))
  await client.ltrim(listKey, -REPLAY_CAP, -1)
  await client.expire(listKey, REDIS_CONFIG.taskSnapshotTtlSeconds)
}

// 读取 lastEventId 之后的事件，优先本地缓存命中，未命中则查 Redis
export const getReplayEventsAfter = async (
  recordId: string,
  lastEventId: number,
): Promise<ReplayEventEntry[]> => {
  const localArr = localReplayEvents.get(recordId)
  if (localArr?.length) {
    const localFirstId = localArr[0].id
    // 本地缓存的最早 id 不大于 lastEventId 时，本地数据完整覆盖请求范围
    if (localFirstId <= lastEventId + 1) {
      return localArr.filter(item => item.id > lastEventId)
    }
  }

  if (!isRedisEnabled()) {
    return (localArr ?? []).filter(item => item.id > lastEventId)
  }

  const client = await getRedisClient()
  if (!client) return (localArr ?? []).filter(item => item.id > lastEventId)

  const listKey = redisKeys.taskEventReplay(recordId)
  const items = await client.lrange(listKey, 0, -1)
  const parsed: ReplayEventEntry[] = []
  for (const raw of items) {
    try {
      const entry = JSON.parse(raw) as ReplayEventEntry
      if (entry.id > lastEventId) parsed.push(entry)
    } catch {
      // 忽略解析失败的事件
    }
  }
  return parsed
}

export const clearReplayEvents = async (recordId: string) => {
  localReplayEvents.delete(recordId)
  localReplayCounters.delete(recordId)
  if (!isRedisEnabled()) return
  const client = await getRedisClient()
  if (!client) return
  await client.del(redisKeys.taskEventReplay(recordId))
}
