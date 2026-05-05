import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import type { GenerationRecordPayload } from '../generation-records/shared'

type AgentChatExecutionTask = {
  recordId: string
  userId: string
  abortController: AbortController
}

type AgentChatRetryState = {
  attempt: number
  waitDurationMs: number
  status: number
  errorPreview: string
  stage: string
}

type PersistState = {
  lastPersistAt: number
  lastPersistContentLength: number
}

export interface AgentChatTaskExecutorContext {
  syncSharedTaskRuntime: (task: AgentChatExecutionTask, status: 'running' | 'completed') => Promise<void>
  ensureTaskNotAborted: (task: AgentChatExecutionTask) => Promise<void>
  resolveGatewayProviderUpstream: (input: {
    providerId?: string
    endpointType?: 'chat' | 'image' | 'image-edit' | 'video'
    modelKey?: string
  }) => Promise<{
    baseUrl: string
    endpoint: string
    apiKey: string
  }>
  emitTaskProgressEvent: (recordId: string, input: {
    stage: string
    stopped?: boolean
    message?: string
  }) => void
  fetchWithBurstRateRetry: (input: {
    url: string
    init: RequestInit
    signal: AbortSignal
    stage: string
    detail: Record<string, unknown>
    onRetry?: (retryState: AgentChatRetryState) => Promise<void> | void
  }) => Promise<Response>
  markTaskRetryState: (task: AgentChatExecutionTask, input: AgentChatRetryState) => Promise<void>
  extractChatTextFromNonStreamResponse: (response: Response) => Promise<string>
  parseChatChunkError: (chunk: string) => string
  parseChatChunkText: (chunk: string) => string
  extractChatTextFromJsonPayload: (result: any) => string
  emitTaskContentDeltaEvent: (recordId: string, input: {
    stage: string
    delta: string
    content: string
  }) => void
  persistAgentTaskContentIfNeeded: (input: {
    task: AgentChatExecutionTask
    payload: GenerationTaskStartPayload
    content: string
    force?: boolean
  }, state: PersistState) => Promise<void>
  buildInitialRecordPayload: (payload: GenerationTaskStartPayload) => GenerationRecordPayload
  updateGenerationRecord: (recordId: string, payload: GenerationRecordPayload, currentUserId: string) => Promise<void>
  getGenerationRecordById: (recordId: string, currentUserId: string) => Promise<Record<string, unknown>>
  emitTaskStreamEvent: (recordId: string, event: GenerationTaskStreamEvent) => void
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
}

// 独立承接 Agent 对话执行主干，便于后续继续从中心 service 中抽离。
export const executeAgentChatTaskFlow = async (
  task: AgentChatExecutionTask,
  payload: GenerationTaskStartPayload,
  context: AgentChatTaskExecutorContext,
) => {
  await context.syncSharedTaskRuntime(task, 'running')
  await context.ensureTaskNotAborted(task)
  const modelKey = String(payload.modelKey || '').trim()
  if (!modelKey) {
    throw new Error('缺少对话模型标识')
  }

  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  if (!providerId) {
    throw new Error('未匹配到后台模型配置，请先在后台配置可用模型')
  }

  const upstream = await context.resolveGatewayProviderUpstream({
    providerId,
    endpointType: 'chat',
    modelKey,
  })
  context.emitTaskProgressEvent(task.recordId, {
    stage: 'resolved_provider',
    message: '已解析厂商与模型配置，准备请求上游对话模型',
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
    stream: true,
  }
  delete (requestBody as Record<string, unknown>).providerId

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  context.logGenerationTask('agent_task:request_start', {
    recordId: task.recordId,
    userId: task.userId,
    upstreamUrl,
    modelKey,
  })

  context.emitTaskProgressEvent(task.recordId, {
    stage: 'requesting_upstream',
    message: '已开始请求上游对话模型',
  })

  const response = await context.fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: task.abortController.signal,
    stage: 'agent_chat',
    detail: {
      recordId: task.recordId,
      userId: task.userId,
      providerId,
      modelKey,
      endpointType: 'chat',
    },
    onRetry: (retryState) => context.markTaskRetryState(task, retryState),
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `对话生成失败 (${response.status})`)
  }

  context.emitTaskProgressEvent(task.recordId, {
    stage: 'receiving_upstream_result',
    message: '上游已开始返回内容，正在持续生成对话',
  })

  const responseContentType = String(response.headers.get('content-type') || '').toLowerCase()
  context.logGenerationTask('agent_task:response_headers', {
    recordId: task.recordId,
    userId: task.userId,
    contentType: responseContentType,
  })

  if (!response.body) {
    const content = await context.extractChatTextFromNonStreamResponse(response)
    await context.updateGenerationRecord(task.recordId, {
      ...context.buildInitialRecordPayload(payload),
      content,
      done: true,
      stopped: false,
    }, task.userId)
    const completedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
    await context.syncSharedTaskRuntime(task, 'completed')
    context.emitTaskStreamEvent(task.recordId, {
      type: 'completed',
      recordId: task.recordId,
      done: true,
      stopped: false,
      record: completedRecord,
      stage: 'completed',
      message: '对话生成完成，结果已写入记录',
    })
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let rawResponseText = ''
  let hasSseDelta = false
  let streamErrorMessage = ''
  const rawDataSamples: string[] = []
  const persistState = {
    lastPersistAt: Date.now(),
    lastPersistContentLength: 0,
  }

  while (!task.abortController.signal.aborted) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    const decodedChunk = decoder.decode(value, { stream: true })
    rawResponseText += decodedChunk
    buffer += decodedChunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const chunk = trimmed.slice(5).trim()
      if (chunk === '[DONE]') {
        continue
      }

      if (rawDataSamples.length < 5) {
        rawDataSamples.push(chunk.slice(0, 500))
      }

      const chunkError = context.parseChatChunkError(chunk)
      if (chunkError) {
        streamErrorMessage = chunkError
        break
      }

      try {
        const delta = context.parseChatChunkText(chunk)
        if (!delta) continue

        hasSseDelta = true
        fullContent += delta
        context.emitTaskContentDeltaEvent(task.recordId, {
          stage: 'receiving_upstream_result',
          delta,
          content: fullContent,
        })
        await context.persistAgentTaskContentIfNeeded({
          task,
          payload,
          content: fullContent,
        }, persistState)
      } catch {
        // 跳过无效 SSE 数据块，继续处理后续消息。
      }
    }

    if (streamErrorMessage) {
      break
    }
  }

  if (streamErrorMessage) {
    throw new Error(streamErrorMessage)
  }

  if (!hasSseDelta && rawResponseText.trim()) {
    const trimmedText = rawResponseText.trim()
    const parsedFromWholeJson = (() => {
      try {
        return context.extractChatTextFromJsonPayload(JSON.parse(trimmedText))
      } catch {
        return ''
      }
    })()

    if (parsedFromWholeJson) {
      fullContent = parsedFromWholeJson
      context.emitTaskContentDeltaEvent(task.recordId, {
        stage: 'receiving_upstream_result',
        delta: parsedFromWholeJson,
        content: fullContent,
      })
    } else {
      const fallbackText = trimmedText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line) => {
          if (line.startsWith('data:')) {
            return context.parseChatChunkText(line.slice(5).trim())
          }
          return ''
        })
        .join('')

      if (fallbackText) {
        fullContent = fallbackText
        context.emitTaskContentDeltaEvent(task.recordId, {
          stage: 'receiving_upstream_result',
          delta: fallbackText,
          content: fullContent,
        })
      }
    }
  }

  if (!fullContent.trim()) {
    context.logGenerationTask('agent_task:empty_stream_debug', {
      recordId: task.recordId,
      userId: task.userId,
      sampleCount: rawDataSamples.length,
      dataSamples: rawDataSamples,
      rawResponseSnippet: rawResponseText.slice(0, 1200),
    })
    throw new Error('上游未返回有效对话内容')
  }

  context.emitTaskProgressEvent(task.recordId, {
    stage: 'syncing_record',
    message: '对话内容已生成，正在同步记录',
  })

  await context.updateGenerationRecord(task.recordId, {
    ...context.buildInitialRecordPayload(payload),
    content: fullContent,
    done: true,
    stopped: false,
  }, task.userId)
  const completedRecord = await context.getGenerationRecordById(task.recordId, task.userId)
  await context.syncSharedTaskRuntime(task, 'completed')
  context.emitTaskStreamEvent(task.recordId, {
    type: 'completed',
    recordId: task.recordId,
    done: true,
    stopped: false,
    record: completedRecord,
    stage: 'completed',
    message: '对话生成完成，结果已写入记录',
  })

  context.logGenerationTask('agent_task:request_success', {
    recordId: task.recordId,
    userId: task.userId,
    contentLength: fullContent.length,
  })
}
