import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import type { GenerationRecordPayload } from '../generation-records/shared'

type ImageExecutionTask = {
  recordId: string
  userId: string
  abortController: AbortController
}

type ImageTaskRetryState = {
  attempt: number
  waitDurationMs: number
  status: number
  errorPreview: string
  stage: string
}

export interface ImageTaskExecutorContext {
  syncSharedTaskRuntime: (task: ImageExecutionTask, status: 'running' | 'completed') => Promise<void>
  ensureTaskNotAborted: (task: ImageExecutionTask) => Promise<void>
  emitTaskProgressEvent: (recordId: string, input: {
    stage: string
    stopped?: boolean
    message?: string
  }) => void
  markTaskRetryState: (task: ImageExecutionTask, input: ImageTaskRetryState) => Promise<void>
  requestImageGeneration: (input: {
    signal: AbortSignal
    providerId: string
    modelKey: string
    requestBody: Record<string, unknown>
    onRetry?: (retryState: ImageTaskRetryState) => Promise<void> | void
  }) => Promise<{ upstreamUrl: string; imageUrls: string[] }>
  requestImageEdit: (input: {
    signal: AbortSignal
    providerId: string
    modelKey: string
    prompt: string
    size?: string
    referenceImages: string[]
    onRetry?: (retryState: ImageTaskRetryState) => Promise<void> | void
  }) => Promise<{ upstreamUrl: string; imageUrls: string[] }>
  buildInitialRecordPayload: (payload: GenerationTaskStartPayload) => GenerationRecordPayload
  updateGenerationRecord: (recordId: string, payload: GenerationRecordPayload, currentUserId: string) => Promise<void>
  getGenerationRecordById: (recordId: string, currentUserId: string) => Promise<Record<string, unknown>>
  emitTaskStreamEvent: (recordId: string, event: GenerationTaskStreamEvent) => void
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
}

// 独立承接图片任务执行主干，便于后续继续把图片链路从 service.ts 中抽离。
export const executeImageTask = async (
  task: ImageExecutionTask,
  payload: GenerationTaskStartPayload,
  context: ImageTaskExecutorContext,
) => {
  await context.syncSharedTaskRuntime(task, 'running')
  await context.ensureTaskNotAborted(task)
  const modelKey = String(payload.modelKey || '').trim()
  if (!modelKey) {
    throw new Error('缺少图片模型标识')
  }

  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  if (!providerId) {
    throw new Error('缺少图片厂商配置')
  }

  context.emitTaskProgressEvent(task.recordId, {
    stage: 'resolved_provider',
    message: '已解析厂商与模型配置，准备请求上游图片接口',
  })

  const requestMode = String(payload.requestMode || '').trim() === 'image-edit'
    ? 'image-edit'
    : 'image-generation'
  const referenceImages = Array.isArray(payload.referenceImages)
    ? payload.referenceImages.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const requestBody = {
    ...(payload.requestBody || {}),
    model: modelKey,
  }

  context.logGenerationTask('image_task:request_start', {
    recordId: task.recordId,
    userId: task.userId,
    modelKey,
    requestMode,
    referenceImageCount: referenceImages.length,
  })
  context.emitTaskProgressEvent(task.recordId, {
    stage: 'requesting_upstream',
    message: '已开始请求上游图片模型',
  })

  const { upstreamUrl, imageUrls } = requestMode === 'image-edit'
    ? await context.requestImageEdit({
      signal: task.abortController.signal,
      providerId,
      modelKey,
      prompt: String(requestBody.prompt || payload.prompt || '').trim(),
      size: String(requestBody.size || '').trim() || undefined,
      referenceImages,
      onRetry: (retryState) => context.markTaskRetryState(task, retryState),
    })
    : await context.requestImageGeneration({
      signal: task.abortController.signal,
      providerId,
      modelKey,
      requestBody,
      onRetry: (retryState) => context.markTaskRetryState(task, retryState),
    })
  await context.ensureTaskNotAborted(task)

  context.logGenerationTask('image_task:request_upstream', {
    recordId: task.recordId,
    userId: task.userId,
    upstreamUrl,
    modelKey,
  })
  context.emitTaskProgressEvent(task.recordId, {
    stage: 'receiving_upstream_result',
    message: '上游已返回结果，正在解析图片内容',
  })
  context.emitTaskProgressEvent(task.recordId, {
    stage: 'syncing_record',
    message: '图片结果已解析，正在同步记录与资源信息',
  })

  await context.updateGenerationRecord(task.recordId, {
    ...context.buildInitialRecordPayload(payload),
    done: true,
    stopped: false,
    images: imageUrls,
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
    message: '图片生成完成，结果已写入记录',
  })

  context.logGenerationTask('image_task:request_success', {
    recordId: task.recordId,
    userId: task.userId,
    imageCount: imageUrls.length,
  })
}
