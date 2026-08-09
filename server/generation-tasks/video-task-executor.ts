import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import type { GenerationRecordPayload } from '../generation-records/shared'
import { legacyImagesToSkillMediaReferences, normalizeSkillMediaReferences } from '../../src/shared/skill-runtime'
import type { VideoGenerationUpstreamInput, VideoGenerationUpstreamResult } from './video-upstream'

type VideoExecutionTask = {
  recordId: string
  userId: string
  type: string
  strategyKey: string
  abortController: AbortController
}

export interface VideoTaskExecutorContext {
  syncSharedTaskRuntime: (task: VideoExecutionTask, status: 'running' | 'completed') => Promise<void>
  ensureTaskNotAborted: (task: VideoExecutionTask) => Promise<void>
  emitTaskProgressEvent: (recordId: string, input: { stage: string; message: string }) => void
  requestVideoGeneration: (input: VideoGenerationUpstreamInput) => Promise<VideoGenerationUpstreamResult>
  buildInitialRecordPayload: (payload: GenerationTaskStartPayload) => GenerationRecordPayload
  updateGenerationRecord: (recordId: string, payload: GenerationRecordPayload, currentUserId: string) => Promise<unknown>
  getGenerationRecordById: (recordId: string, currentUserId: string) => Promise<Record<string, unknown>>
  emitTaskStreamEvent: (recordId: string, event: GenerationTaskStreamEvent) => void
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
}

const readReferenceImageRoles = (payload: GenerationTaskStartPayload) => {
  const value = payload.requestBody?.referenceImageRoles
  return Array.isArray(value) ? value.map(item => String(item || '').trim()) : []
}

const readDurationSeconds = (value: unknown) => {
  const parsed = Number.parseFloat(String(value || ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export const executeVideoTask = async (
  task: VideoExecutionTask,
  payload: GenerationTaskStartPayload,
  context: VideoTaskExecutorContext,
) => {
  await context.syncSharedTaskRuntime(task, 'running')
  await context.ensureTaskNotAborted(task)
  const modelKey = String(payload.modelKey || '').trim()
  if (!modelKey) throw new Error('缺少视频模型标识')
  const providerId = String(payload.requestBody?.providerId || '').trim()
  if (!providerId) throw new Error('缺少视频厂商配置')

  const referenceImages = Array.isArray(payload.referenceImages)
    ? payload.referenceImages.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const referenceImageRoles = readReferenceImageRoles(payload)
  const mediaReferences = normalizeSkillMediaReferences(payload.mediaReferences)
  const normalizedMediaReferences = mediaReferences.length
    ? mediaReferences
    : legacyImagesToSkillMediaReferences(referenceImages).map((item, index) => ({
      ...item,
      role: referenceImageRoles[index] === 'first_frame_image'
        ? 'first_frame' as const
        : referenceImageRoles[index] === 'last_frame_image'
          ? 'last_frame' as const
          : 'reference' as const,
    }))
  context.emitTaskProgressEvent(task.recordId, {
    stage: 'resolved_provider',
    message: '已解析厂商与模型配置，准备请求上游视频接口',
  })
  context.logGenerationTask('video_task:request_start', {
    recordId: task.recordId,
    userId: task.userId,
    modelKey,
    referenceImageCount: referenceImages.length,
  })
  context.emitTaskProgressEvent(task.recordId, {
    stage: 'requesting_upstream',
    message: '已创建视频生成任务，正在等待上游结果',
  })

  const result = await context.requestVideoGeneration({
    signal: task.abortController.signal,
    userId: task.userId,
    providerId,
    modelKey,
    prompt: String(payload.prompt || payload.requestBody?.prompt || '').trim(),
    ratio: String(payload.ratio || payload.requestBody?.ratio || '').trim() || undefined,
    resolution: String(payload.resolution || payload.requestBody?.quality || '').trim() || undefined,
    duration: String(payload.duration || payload.requestBody?.duration || '').trim() || undefined,
    referenceImages,
    referenceImageRoles,
    mediaReferences: normalizedMediaReferences,
  })
  await context.ensureTaskNotAborted(task)
  context.emitTaskProgressEvent(task.recordId, {
    stage: 'syncing_record',
    message: '视频结果已返回，正在写入生成记录与资源库',
  })

  await context.updateGenerationRecord(task.recordId, {
    ...context.buildInitialRecordPayload(payload),
    done: true,
    stopped: false,
    outputs: [{
      outputType: 'video',
      url: result.videoUrl,
      mimeType: result.mimeType || (result.videoUrl.toLowerCase().includes('.webm') ? 'video/webm' : 'video/mp4'),
      durationSeconds: readDurationSeconds(payload.duration),
      metaJson: {
        upstreamTaskId: result.taskId || null,
        upstreamUrl: result.upstreamUrl,
      },
    }],
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
    message: '视频生成完成，结果已写入记录',
  })
  context.logGenerationTask('video_task:request_success', {
    recordId: task.recordId,
    userId: task.userId,
    upstreamTaskId: result.taskId || null,
  })
}
