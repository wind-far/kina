import { getGenerationRecordById, createGenerationRecord, updateGenerationRecord } from '../generation-records/service'
import type { GenerationRecordPayload } from '../generation-records/shared'
import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import { resolveGatewayProviderUpstream } from '../provider-config/service'
import { consumeGenerationPoints, refundGenerationPoints, resolveGenerationPointCost } from '../marketing-center/service'

interface RunningGenerationTask {
  recordId: string
  userId: string
  type: 'image'
  abortController: AbortController
  associationNo: string
  billedPointCost: number
  billedProviderId: string
  billedModelKey: string
  billedModelName: string
  refundCommitted: boolean
}

const runningGenerationTasks = new Map<string, RunningGenerationTask>()
const taskStreamSubscribers = new Map<string, Set<any>>()

// 统一输出生成任务日志，方便排查离页后任务是否仍在服务端继续执行。
const logGenerationTask = (stage: string, detail: Record<string, unknown>) => {
  console.log('[generation-tasks]', stage, JSON.stringify(detail))
}

// 统一输出生成任务异常日志。
const logGenerationTaskError = (stage: string, error: unknown, detail: Record<string, unknown>) => {
  const err = error as { message?: string; stack?: string }
  console.error('[generation-tasks][service-error]', stage, JSON.stringify({
    ...detail,
    errorMessage: err?.message || '未知异常',
    errorStack: err?.stack || null,
  }))
}

// 向当前任务的所有 SSE 订阅者广播最新状态。
const emitTaskStreamEvent = (recordId: string, event: GenerationTaskStreamEvent) => {
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

  if (!subscribers.size) {
    taskStreamSubscribers.delete(recordId)
  }
}

// 推送当前任务的业务阶段进度，让事件流更易理解。
const emitTaskProgressEvent = (recordId: string, input: {
  stage: string
  message: string
  done?: boolean
  stopped?: boolean
}) => {
  emitTaskStreamEvent(recordId, {
    type: 'progress',
    recordId,
    done: Boolean(input.done),
    stopped: Boolean(input.stopped),
    stage: input.stage,
    message: input.message,
  })
}

// 当服务端内存里已经没有运行中的任务，但数据库里仍是未完成态时，
// 说明它多半是旧实例遗留或异常中断，需要主动回收，避免前端一直订阅。
const resolveTaskRecordSnapshot = async (recordId: string, currentUserId: string) => {
  let record = await getGenerationRecordById(recordId, currentUserId)

  if (
    record.type === 'image'
    && !record.done
    && !record.stopped
    && !runningGenerationTasks.has(recordId)
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

// 注册 SSE 订阅连接，并立即推送一次当前快照。
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

  let subscribers = taskStreamSubscribers.get(recordId)
  if (!subscribers) {
    subscribers = new Set()
    taskStreamSubscribers.set(recordId, subscribers)
  }
  subscribers.add(res)

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

  // 已完成任务只需要返回一次快照，避免继续挂长连接和心跳。
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
    const currentSubscribers = taskStreamSubscribers.get(recordId)
    if (!currentSubscribers) {
      return
    }
    currentSubscribers.delete(res)
    if (!currentSubscribers.size) {
      taskStreamSubscribers.delete(recordId)
    }
  }

  res.on('close', cleanup)
  res.on('error', cleanup)
}

const buildGatewayAssociationNo = () => {
  return `GTK${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

const isChatCompletionsEndpoint = (endpoint: string) => {
  return /chat\/completions/i.test(String(endpoint || '').trim())
}

const buildInitialRecordPayload = (payload: GenerationTaskStartPayload): GenerationRecordPayload => ({
  type: payload.type,
  prompt: String(payload.prompt || '').trim(),
  content: '',
  error: '',
  model: String(payload.model || '').trim(),
  modelKey: String(payload.modelKey || '').trim(),
  ratio: String(payload.ratio || '').trim(),
  resolution: String(payload.resolution || '').trim(),
  duration: String(payload.duration || '').trim(),
  feature: String(payload.feature || '').trim(),
  skill: String(payload.skill || '').trim() || 'general',
  done: false,
  stopped: false,
  images: [],
})

const extractImageUrlsFromJsonResponse = (result: any) => {
  const urls: string[] = []

  if (!Array.isArray(result?.data)) {
    return urls
  }

  for (const item of result.data) {
    if (item?.url) {
      urls.push(item.url)
      continue
    }

    if (item?.b64_json) {
      urls.push(`data:image/png;base64,${item.b64_json}`)
    }
  }

  return urls
}

const extractImageUrlsFromStreamResponse = async (response: Response, signal: AbortSignal) => {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('图片流式响应缺少可读数据')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  const imageUrls: string[] = []

  while (!signal.aborted) {
    let readResult: ReadableStreamReadResult<Uint8Array>
    try {
      readResult = await reader.read()
    } catch {
      break
    }

    const { done, value } = readResult
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let boundaryIndex = -1
    while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
      const message = buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex + 2)

      for (const line of message.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const chunk = trimmed.slice(5).trim()
        if (chunk === '[DONE]') continue

        try {
          const parsed = JSON.parse(chunk)
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content) fullContent += delta.content
          if (Array.isArray(delta?.images)) {
            for (const img of delta.images) {
              const url = img?.image_url?.url
              if (url) imageUrls.push(url)
            }
          }
          if (delta?.inline_data?.data) {
            imageUrls.push(`data:${delta.inline_data.mime_type};base64,${delta.inline_data.data}`)
          }
        } catch {
          // 跳过无效 SSE 数据块，继续处理后续消息。
        }
      }
    }
  }

  const markdownImages = fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g)
  if (markdownImages) {
    for (const item of markdownImages) {
      const matched = item.match(/\((https?:\/\/[^\s)]+)\)/)
      if (matched?.[1]) {
        imageUrls.push(matched[1])
      }
    }
  }

  const base64Image = fullContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/)
  if (base64Image?.[0]) {
    imageUrls.push(base64Image[0])
  }

  return imageUrls
}

const executeImageGenerationTask = async (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  const modelKey = String(payload.modelKey || '').trim()
  if (!modelKey) {
    throw new Error('缺少图片模型标识')
  }

  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  if (!providerId) {
    throw new Error('缺少图片厂商配置')
  }

  const upstream = await resolveGatewayProviderUpstream({
    providerId,
    endpointType: 'image',
    modelKey,
  })
  emitTaskProgressEvent(task.recordId, {
    stage: 'resolved_provider',
    message: '已解析厂商与模型配置，准备请求上游图片接口',
  })

  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const requestBody = {
    ...(payload.requestBody || {}),
    model: modelKey,
  }
  delete (requestBody as Record<string, unknown>).providerId

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`

  logGenerationTask('image_task:request_start', {
    recordId: task.recordId,
    userId: task.userId,
    upstreamUrl,
    modelKey,
  })
  emitTaskProgressEvent(task.recordId, {
    stage: 'requesting_upstream',
    message: '已开始请求上游图片模型',
  })

  const response = await fetch(upstreamUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: task.abortController.signal,
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `图片生成失败 (${response.status})`)
  }
  emitTaskProgressEvent(task.recordId, {
    stage: 'receiving_upstream_result',
    message: '上游已返回结果，正在解析图片内容',
  })

  const imageUrls = isChatCompletionsEndpoint(upstream.endpoint)
    ? await extractImageUrlsFromStreamResponse(response, task.abortController.signal)
    : extractImageUrlsFromJsonResponse(await response.json())

  if (!imageUrls.length) {
    throw new Error('未能获取到生成的图片')
  }
  emitTaskProgressEvent(task.recordId, {
    stage: 'syncing_record',
    message: '图片结果已解析，正在同步记录与资源信息',
  })

  await updateGenerationRecord(task.recordId, {
    ...buildInitialRecordPayload(payload),
    done: true,
    stopped: false,
    images: imageUrls,
  }, task.userId)
  const completedRecord = await getGenerationRecordById(task.recordId, task.userId)
  emitTaskStreamEvent(task.recordId, {
    type: 'completed',
    recordId: task.recordId,
    done: true,
    stopped: false,
    record: completedRecord,
    stage: 'completed',
    message: '图片生成完成，结果已写入记录',
  })

  logGenerationTask('image_task:request_success', {
    recordId: task.recordId,
    userId: task.userId,
    imageCount: imageUrls.length,
  })
}

const refundTaskPointsIfNeeded = async (task: RunningGenerationTask, reason: string) => {
  if (!task.billedPointCost || task.refundCommitted) {
    return
  }

  task.refundCommitted = true
  await refundGenerationPoints({
    userId: task.userId,
    pointCost: task.billedPointCost,
    sourceId: task.associationNo,
    associationNo: task.associationNo,
    endpointType: 'image',
    providerId: task.billedProviderId,
    modelKey: task.billedModelKey,
    modelName: task.billedModelName,
    metaJson: {
      refundReason: reason,
      generationRecordId: task.recordId,
    },
  })
}

const runImageTaskInBackground = (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => {
  void (async () => {
    try {
      await executeImageGenerationTask(task, payload)
    } catch (error) {
      const isAbortError = error instanceof DOMException
        ? error.name === 'AbortError'
        : error instanceof Error && /abort/i.test(String(error.name || error.message || ''))

      if (isAbortError) {
        await refundTaskPointsIfNeeded(task, 'task_aborted')
        emitTaskProgressEvent(task.recordId, {
          stage: 'stopping',
          stopped: true,
          message: '任务已收到停止指令，正在收口状态',
        })
        await updateGenerationRecord(task.recordId, {
          ...buildInitialRecordPayload(payload),
          done: true,
          stopped: true,
          error: '',
          images: [],
        }, task.userId)
        const stoppedRecord = await getGenerationRecordById(task.recordId, task.userId)
        emitTaskStreamEvent(task.recordId, {
          type: 'stopped',
          recordId: task.recordId,
          done: true,
          stopped: true,
          record: stoppedRecord,
          stage: 'stopped',
          message: '任务已停止',
        })
        logGenerationTask('image_task:stopped', {
          recordId: task.recordId,
          userId: task.userId,
        })
      } else {
        await refundTaskPointsIfNeeded(task, 'task_failed')
        const errorMessage = error instanceof Error ? error.message : '图片生成失败'
        emitTaskProgressEvent(task.recordId, {
          stage: 'failing',
          message: '任务执行异常，正在写入失败状态',
        })
        await updateGenerationRecord(task.recordId, {
          ...buildInitialRecordPayload(payload),
          done: true,
          stopped: false,
          error: errorMessage,
          images: [],
        }, task.userId)
        const failedRecord = await getGenerationRecordById(task.recordId, task.userId)
        emitTaskStreamEvent(task.recordId, {
          type: 'failed',
          recordId: task.recordId,
          done: true,
          stopped: false,
          record: failedRecord,
          stage: 'failed',
          message: errorMessage,
        })
        logGenerationTaskError('image_task:failed', error, {
          recordId: task.recordId,
          userId: task.userId,
        })
      }
    } finally {
      runningGenerationTasks.delete(task.recordId)
    }
  })()
}

// 创建新的生成任务，并立即把运行态记录持久化。
export const startGenerationTask = async (payload: GenerationTaskStartPayload, currentUserId: string) => {
  if (String(payload.type || '').trim() !== 'image') {
    throw new Error('当前仅支持图片生成任务化')
  }

  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  const modelKey = String(payload.modelKey || '').trim()

  if (!providerId) {
    throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
  }

  if (!modelKey) {
    throw new Error('缺少图片模型标识')
  }

  const billingDetail = await resolveGenerationPointCost({
    providerId,
    modelKey,
    endpointType: 'image',
  })

  const associationNo = buildGatewayAssociationNo()
  const pointLog = billingDetail.pointCost > 0
    ? await consumeGenerationPoints({
      userId: currentUserId,
      pointCost: billingDetail.pointCost,
      sourceId: associationNo,
      associationNo,
      endpointType: 'image',
      providerId,
      modelKey,
      modelName: billingDetail.modelName,
      metaJson: {
        source: 'generation-task',
      },
    })
    : null

  const createdRecord = await createGenerationRecord(buildInitialRecordPayload(payload), currentUserId)

  const task: RunningGenerationTask = {
    recordId: createdRecord.id,
    userId: currentUserId,
    type: 'image',
    abortController: new AbortController(),
    associationNo,
    billedPointCost: pointLog ? billingDetail.pointCost : 0,
    billedProviderId: providerId,
    billedModelKey: modelKey,
    billedModelName: billingDetail.modelName,
    refundCommitted: false,
  }

  runningGenerationTasks.set(createdRecord.id, task)
  emitTaskStreamEvent(createdRecord.id, {
    type: 'progress',
    recordId: createdRecord.id,
    done: false,
    stopped: false,
    record: createdRecord as unknown as Record<string, unknown>,
    stage: 'queued',
    message: '任务已创建，等待服务端执行',
  })

  logGenerationTask('task_created', {
    recordId: createdRecord.id,
    userId: currentUserId,
    type: payload.type,
    providerId,
    modelKey,
  })

  runImageTaskInBackground(task, payload)
  return createdRecord
}

// 查询任务对应的最新生成记录。
export const getGenerationTaskRecord = async (recordId: string, currentUserId: string) => {
  return resolveTaskRecordSnapshot(recordId, currentUserId)
}

// 停止正在运行的任务；若任务已不在内存中，则尝试直接把记录落成已停止。
export const stopGenerationTask = async (recordId: string, currentUserId: string) => {
  const task = runningGenerationTasks.get(recordId)

  if (task) {
    if (task.userId !== currentUserId) {
      throw new Error('无权停止当前生成任务')
    }
    task.abortController.abort()
  } else {
    const currentRecord = await getGenerationRecordById(recordId, currentUserId)
    if (currentRecord.done) {
      return currentRecord
    }

    await updateGenerationRecord(recordId, {
      type: currentRecord.type,
      prompt: currentRecord.prompt,
      content: currentRecord.content,
      error: '',
      model: currentRecord.model,
      modelKey: currentRecord.modelKey,
      ratio: currentRecord.ratio,
      resolution: currentRecord.resolution,
      duration: currentRecord.duration,
      feature: currentRecord.feature,
      skill: currentRecord.skill,
      done: true,
      stopped: true,
      images: currentRecord.images,
      agentRun: currentRecord.agentRun,
    }, currentUserId)
    const stoppedRecord = await getGenerationRecordById(recordId, currentUserId)
    emitTaskStreamEvent(recordId, {
      type: 'stopped',
      recordId,
      done: true,
      stopped: true,
      record: stoppedRecord,
      stage: 'stopped',
      message: '任务已停止',
    })
  }

  return getGenerationRecordById(recordId, currentUserId)
}
