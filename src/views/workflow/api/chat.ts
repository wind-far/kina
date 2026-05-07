/**
 * 工作流聊天流适配层
 * 统一复用 generate 页的 generation-tasks + SSE 任务通道，
 * 对上仍保持 async generator 文本流接口，避免节点组件改动视觉层。
 */

import {
  createGenerationTask,
  getGenerationTask,
  resolveGenerationTaskModel,
  subscribeGenerationTaskEvents,
} from '@/api/generation-tasks'

interface WorkflowChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface WorkflowChatStreamPayload {
  model?: string
  messages?: WorkflowChatMessage[]
  [key: string]: unknown
}

interface StreamQueueItem {
  type: 'chunk' | 'done' | 'error'
  value?: string
  error?: unknown
}

const readMessageContent = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value
}

/**
 * 兼容旧的 async generator 调用方式，但底层统一走服务端任务事件流。
 */
export async function* streamChatCompletions(
  data: WorkflowChatStreamPayload,
  signal?: AbortSignal,
) {
  const controller = new AbortController()
  const abortWithExternalSignal = () => {
    if (!controller.signal.aborted) {
      controller.abort(signal?.reason)
    }
  }
  signal?.addEventListener('abort', abortWithExternalSignal, { once: true })

  const messages = Array.isArray(data.messages) ? data.messages : []
  const { providerId, modelKey } = resolveGenerationTaskModel({
    modelKey: typeof data.model === 'string' ? data.model : '',
    category: 'CHAT',
    missingModelMessage: '缺少对话模型标识',
  })

  const savedTask = await createGenerationTask({
    source: 'workflow',
    type: 'agent',
    prompt: readMessageContent(messages[messages.length - 1]?.content) || '请根据上下文生成内容',
    model: typeof data.model === 'string' ? data.model : modelKey,
    modelKey,
    skill: 'general',
    requestBody: {
      providerId,
      model: modelKey,
      messages,
      stream: true,
    },
  }, { signal: controller.signal })

  const taskRecordId = String(savedTask.id || '').trim()
  if (!taskRecordId) {
    throw new Error('工作流对话任务创建失败')
  }

  const queue: StreamQueueItem[] = []
  let resume: (() => void) | null = null
  let streamClosed = false
  let terminalEventReceived = false
  let aggregatedContent = ''

  const pushQueue = (item: StreamQueueItem) => {
    queue.push(item)
    if (resume) {
      const notify = resume
      resume = null
      notify()
    }
  }

  const emitContentSuffix = (nextContent: string) => {
    if (!nextContent) {
      return
    }
    if (nextContent.startsWith(aggregatedContent)) {
      const suffix = nextContent.slice(aggregatedContent.length)
      aggregatedContent = nextContent
      if (suffix) {
        pushQueue({ type: 'chunk', value: suffix })
      }
      return
    }

    aggregatedContent = nextContent
    pushQueue({ type: 'chunk', value: nextContent })
  }

  const subscribePromise = subscribeGenerationTaskEvents(taskRecordId, {
    signal: controller.signal,
    onEvent: (event) => {
      if (event.type === 'content_delta') {
        const delta = typeof event.delta === 'string'
          ? event.delta
          : ''
        if (delta) {
          aggregatedContent += delta
          pushQueue({ type: 'chunk', value: delta })
          return
        }

        if (typeof event.content === 'string') {
          emitContentSuffix(event.content)
        }
        return
      }

      if (event.type === 'snapshot' || event.type === 'completed') {
        emitContentSuffix(readMessageContent(event.record?.content))
      }

      if (event.type === 'failed') {
        pushQueue({
          type: 'error',
          error: new Error(String(event.message || event.record?.error || '工作流对话任务执行失败').trim() || '工作流对话任务执行失败'),
        })
        return
      }

      if (event.type === 'stopped') {
        pushQueue({
          type: 'error',
          error: new Error('任务已停止'),
        })
        return
      }

      if (event.done) {
        terminalEventReceived = true
        streamClosed = true
        pushQueue({ type: 'done' })
        if (!controller.signal.aborted) {
          controller.abort('workflow_chat_task_completed')
        }
      }
    },
  }).catch((error: unknown) => {
    if (controller.signal.aborted) {
      streamClosed = true
      if (!terminalEventReceived) {
        pushQueue({ type: 'done' })
      }
      return
    }

    pushQueue({ type: 'error', error })
  })

  void subscribePromise.then(async () => {
    if (streamClosed || controller.signal.aborted) {
      return
    }

    try {
      const latestRecord = await getGenerationTask(taskRecordId, { signal: controller.signal })
      const latestContent = readMessageContent(latestRecord?.content)
      if (latestContent) {
        emitContentSuffix(latestContent)
      }
    } catch (error: unknown) {
      if (!terminalEventReceived && !controller.signal.aborted) {
        pushQueue({ type: 'error', error })
        return
      }
    }

    streamClosed = true
    pushQueue({ type: 'done' })
  })

  try {
    while (true) {
      if (!queue.length) {
        if (streamClosed) {
          break
        }

        await new Promise<void>((resolve) => {
          resume = resolve
        })
        continue
      }

      const item = queue.shift()
      if (!item) {
        continue
      }

      if (item.type === 'chunk' && item.value) {
        yield item.value
        continue
      }

      if (item.type === 'error') {
        throw item.error instanceof Error ? item.error : new Error('工作流对话流订阅失败')
      }

      if (item.type === 'done') {
        break
      }
    }
  } finally {
    streamClosed = true
    signal?.removeEventListener('abort', abortWithExternalSignal)
    if (!controller.signal.aborted) {
      controller.abort('workflow_chat_task_cleanup')
    }
    await subscribePromise.catch(() => undefined)
  }
}
