import type { GenerationRecordPayload } from '../generation-records/shared'
import type { LocalRunningGenerationTask } from './local-runtime'
import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from './shared'
import type { GenerationTaskStrategyKey } from './strategy'
import type { AgentRunState } from '../../src/types/agent'
import { GenerationTaskRequestError } from './shared'

type RunningGenerationTask = LocalRunningGenerationTask & {
  strategyKey: GenerationTaskStrategyKey
}

type ConcurrencySlot = {
  scope: 'user' | 'skill' | 'provider'
  key: string
  limit: number
  currentCount: number
}

type CreatedRecord = {
  id: string
  type: string
  prompt: string
  content: string
  error: string
  model: string
  modelKey: string
  ratio: string
  resolution: string
  duration: string
  feature: string
  skill: string
  done: boolean
  stopped?: boolean
  images?: string[]
  agentRun?: AgentRunState | null
}

type BillingDetail = {
  pointCost: number
  modelName: string
}

interface TaskLifecycleContext {
  resolveGenerationTaskStrategy: (payload: GenerationTaskStartPayload) => {
    key: GenerationTaskStrategyKey
  }
  buildTaskSubmissionIdempotencyKey: (input: {
    userId: string
    strategyKey: string
    providerId: string
    modelKey: string
    skill: string
    prompt: string
    requestMode: string
    referenceImages: string[]
    requestBody: Record<string, unknown> | null
  }) => string
  claimIdempotencyKey: <T>(key: string) => Promise<{
    state: 'completed' | 'in_progress' | 'claimed'
    data?: T
    token: string
  }>
  completeIdempotencyKey: (key: string, token: string, data: { recordId: string }) => Promise<void>
  clearPendingIdempotencyKey: (key: string, token: string) => Promise<void>
  getGenerationRecordById: (recordId: string, currentUserId: string) => Promise<CreatedRecord>
  createGenerationRecord: (payload: GenerationRecordPayload, currentUserId: string) => Promise<CreatedRecord>
  updateGenerationRecord: (recordId: string, payload: GenerationRecordPayload, currentUserId: string) => Promise<void>
  attachGenerationPointRecordId: (input: {
    associationNo: string
    userId: string
    generationRecordId: string
  }) => Promise<void>
  resolveGenerationPointCost: (input: {
    providerId: string
    modelKey: string
    endpointType: 'chat' | 'image'
  }) => Promise<BillingDetail>
  consumeGenerationPoints: (input: {
    userId: string
    pointCost: number
    sourceId: string
    associationNo: string
    endpointType: 'chat' | 'image'
    providerId: string
    modelKey: string
    modelName: string
    metaJson: Record<string, unknown>
  }) => Promise<unknown>
  acquireTaskConcurrencySlots: (input: {
    userId: string
    providerId: string
    skillKey: string
  }) => Promise<ConcurrencySlot[]>
  releaseTaskConcurrencySlots: (slots: ConcurrencySlot[]) => Promise<void>
  buildAgentPendingRun: (
    recordId: string,
    query: string,
    skill: string,
    referenceImages?: string[],
  ) => AgentRunState
  buildGatewayAssociationNo: () => string
  setLocalRunningTask: (task: RunningGenerationTask) => void
  syncSharedTaskRuntime: (
    task: RunningGenerationTask,
    status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped',
    extra?: Record<string, unknown>,
  ) => Promise<void>
  emitTaskStreamEvent: (recordId: string, event: GenerationTaskStreamEvent) => void
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
  runTaskInBackground: (task: RunningGenerationTask, payload: GenerationTaskStartPayload) => void
  resolveTaskRecordSnapshot: (recordId: string, currentUserId: string) => Promise<any>
  getLocalRunningTask: (recordId: string) => RunningGenerationTask | undefined
  getSharedTaskRuntime: (recordId: string) => Promise<{
    status?: string
  } | null>
  markSharedTaskAbortRequested: (recordId: string) => Promise<void>
  abortTaskWithReason: (task: RunningGenerationTask, reason: 'user_stop') => void
}

export const buildInitialRecordPayload = (payload: GenerationTaskStartPayload): GenerationRecordPayload => ({
  sessionId: String(payload.sessionId || '').trim() || undefined,
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
  referenceImages: Array.isArray(payload.referenceImages) ? [...payload.referenceImages] : [],
  done: false,
  stopped: false,
  images: [],
})

const buildGenerationTaskIdempotencyKey = (
  payload: GenerationTaskStartPayload,
  userId: string,
  strategyKey: string,
  providerId: string,
  modelKey: string,
  context: TaskLifecycleContext,
) => {
  return context.buildTaskSubmissionIdempotencyKey({
    userId,
    strategyKey,
    providerId,
    modelKey,
    skill: String(payload.skill || '').trim(),
    prompt: String(payload.prompt || '').trim(),
    requestMode: String(payload.requestMode || '').trim(),
    referenceImages: Array.isArray(payload.referenceImages) ? payload.referenceImages : [],
    requestBody: payload.requestBody || null,
  })
}

const resolveTaskSkillKey = (payload: GenerationTaskStartPayload, strategyKey: GenerationTaskStrategyKey) => {
  return String(payload.skill || '').trim() || strategyKey || 'general'
}

const resolveTaskBillingTarget = (
  payload: GenerationTaskStartPayload,
  strategyKey: GenerationTaskStrategyKey,
) => {
  const providerId = String((payload.requestBody || {}).providerId || '').trim()
  const modelKey = String(payload.modelKey || '').trim()
  const isImageTask = strategyKey === 'image'

  if (!providerId) {
    throw new GenerationTaskRequestError(400, '未匹配到后台模型配置，请先在后台配置可用模型')
  }

  if (!modelKey) {
    throw new GenerationTaskRequestError(400, isImageTask ? '缺少图片模型标识' : '缺少对话模型标识')
  }

  return {
    providerId,
    modelKey,
  }
}

export const startGenerationTask = async (
  payload: GenerationTaskStartPayload,
  currentUserId: string,
  context: TaskLifecycleContext,
) => {
  const strategy = context.resolveGenerationTaskStrategy(payload)
  const { providerId, modelKey } = resolveTaskBillingTarget(payload, strategy.key)
  const skillKey = resolveTaskSkillKey(payload, strategy.key)
  const idempotencyKey = buildGenerationTaskIdempotencyKey(
    payload,
    currentUserId,
    strategy.key,
    providerId,
    modelKey,
    context,
  )
  const idempotencyClaim = await context.claimIdempotencyKey<{ recordId?: string }>(idempotencyKey)

  if (idempotencyClaim.state === 'completed' && idempotencyClaim.data?.recordId) {
    return context.getGenerationRecordById(String(idempotencyClaim.data.recordId), currentUserId)
  }

  if (idempotencyClaim.state === 'in_progress') {
    throw new GenerationTaskRequestError(409, '检测到相同任务正在处理中，请稍候查看结果')
  }

  let concurrencySlots: ConcurrencySlot[] = []

  try {
    if (strategy.key === 'agent-chat') {
      concurrencySlots = await context.acquireTaskConcurrencySlots({
        userId: currentUserId,
        providerId,
        skillKey,
      })

      const billingDetail = await context.resolveGenerationPointCost({
        providerId,
        modelKey,
        endpointType: 'chat',
      })
      const associationNo = context.buildGatewayAssociationNo()
      const pointLog = billingDetail.pointCost > 0
        ? await context.consumeGenerationPoints({
          userId: currentUserId,
          pointCost: billingDetail.pointCost,
          sourceId: associationNo,
          associationNo,
          endpointType: 'chat',
          providerId,
          modelKey,
          modelName: billingDetail.modelName,
          metaJson: {
            source: 'generation-task',
            taskType: 'agent-chat',
          },
        })
        : null

      const createdRecord = await context.createGenerationRecord(buildInitialRecordPayload(payload), currentUserId)
      await context.attachGenerationPointRecordId({
        associationNo,
        userId: currentUserId,
        generationRecordId: createdRecord.id,
      })
      await context.completeIdempotencyKey(idempotencyKey, idempotencyClaim.token, {
        recordId: createdRecord.id,
      })

      const task: RunningGenerationTask = {
        recordId: createdRecord.id,
        userId: currentUserId,
        type: 'agent',
        strategyKey: strategy.key,
        abortController: new AbortController(),
        associationNo,
        billedEndpointType: 'chat',
        billedPointCost: pointLog ? billingDetail.pointCost : 0,
        billedProviderId: providerId,
        billedModelKey: modelKey,
        billedModelName: billingDetail.modelName || String(payload.model || '').trim(),
        refundCommitted: false,
        concurrencySlots,
      }

      context.setLocalRunningTask(task)
      await context.syncSharedTaskRuntime(task, 'queued', { skillKey })
      context.emitTaskStreamEvent(createdRecord.id, {
        type: 'progress',
        recordId: createdRecord.id,
        done: false,
        stopped: false,
        record: createdRecord,
        stage: 'queued',
        message: '任务已创建，等待服务端执行',
      })
      context.logGenerationTask('task_created', {
        recordId: createdRecord.id,
        userId: currentUserId,
        type: payload.type,
        strategyKey: strategy.key,
        providerId,
        modelKey,
      })
      context.runTaskInBackground(task, payload)
      return createdRecord
    }

    if (strategy.key === 'agent-workspace') {
      concurrencySlots = await context.acquireTaskConcurrencySlots({
        userId: currentUserId,
        providerId,
        skillKey,
      })

      const billingDetail = await context.resolveGenerationPointCost({
        providerId,
        modelKey,
        endpointType: 'chat',
      })
      const associationNo = context.buildGatewayAssociationNo()
      const pointLog = billingDetail.pointCost > 0
        ? await context.consumeGenerationPoints({
          userId: currentUserId,
          pointCost: billingDetail.pointCost,
          sourceId: associationNo,
          associationNo,
          endpointType: 'chat',
          providerId,
          modelKey,
          modelName: billingDetail.modelName,
          metaJson: {
            source: 'generation-task',
            taskType: 'agent-workspace',
            skill: String(payload.skill || '').trim(),
          },
        })
        : null

      const initialPayload = {
        ...buildInitialRecordPayload(payload),
        agentRun: context.buildAgentPendingRun(
          `record-${Date.now()}`,
          String(payload.prompt || '').trim(),
          String(payload.skill || '').trim() || 'general',
          Array.isArray(payload.referenceImages) ? payload.referenceImages : [],
        ),
      } satisfies GenerationRecordPayload
      const createdRecord = await context.createGenerationRecord(initialPayload, currentUserId)
      await context.attachGenerationPointRecordId({
        associationNo,
        userId: currentUserId,
        generationRecordId: createdRecord.id,
      })
      await context.completeIdempotencyKey(idempotencyKey, idempotencyClaim.token, {
        recordId: createdRecord.id,
      })

      const task: RunningGenerationTask = {
        recordId: createdRecord.id,
        userId: currentUserId,
        type: 'agent',
        strategyKey: strategy.key,
        abortController: new AbortController(),
        associationNo,
        billedEndpointType: 'chat',
        billedPointCost: pointLog ? billingDetail.pointCost : 0,
        billedProviderId: providerId,
        billedModelKey: modelKey,
        billedModelName: billingDetail.modelName || String(payload.model || '').trim(),
        refundCommitted: false,
        concurrencySlots,
      }

      context.setLocalRunningTask(task)
      await context.syncSharedTaskRuntime(task, 'queued', { skillKey })
      context.emitTaskStreamEvent(createdRecord.id, {
        type: 'progress',
        recordId: createdRecord.id,
        done: false,
        stopped: false,
        record: createdRecord,
        stage: 'queued',
        message: '技能任务已创建，等待服务端执行',
      })
      context.logGenerationTask('task_created', {
        recordId: createdRecord.id,
        userId: currentUserId,
        type: payload.type,
        strategyKey: strategy.key,
        skill: payload.skill,
        modelKey: payload.modelKey,
      })
      context.runTaskInBackground(task, payload)
      return createdRecord
    }

    concurrencySlots = await context.acquireTaskConcurrencySlots({
      userId: currentUserId,
      providerId,
      skillKey,
    })

    const billingDetail = await context.resolveGenerationPointCost({
      providerId,
      modelKey,
      endpointType: 'image',
    })
    const associationNo = context.buildGatewayAssociationNo()
    const pointLog = billingDetail.pointCost > 0
      ? await context.consumeGenerationPoints({
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

    const createdRecord = await context.createGenerationRecord(buildInitialRecordPayload(payload), currentUserId)
    await context.attachGenerationPointRecordId({
      associationNo,
      userId: currentUserId,
      generationRecordId: createdRecord.id,
    })
    await context.completeIdempotencyKey(idempotencyKey, idempotencyClaim.token, {
      recordId: createdRecord.id,
    })

    const task: RunningGenerationTask = {
      recordId: createdRecord.id,
      userId: currentUserId,
      type: 'image',
      strategyKey: strategy.key,
      abortController: new AbortController(),
      associationNo,
      billedEndpointType: 'image',
      billedPointCost: pointLog ? billingDetail.pointCost : 0,
      billedProviderId: providerId,
      billedModelKey: modelKey,
      billedModelName: billingDetail.modelName,
      refundCommitted: false,
      concurrencySlots,
    }

    context.setLocalRunningTask(task)
    await context.syncSharedTaskRuntime(task, 'queued', { skillKey })
    context.emitTaskStreamEvent(createdRecord.id, {
      type: 'progress',
      recordId: createdRecord.id,
      done: false,
      stopped: false,
      record: createdRecord,
      stage: 'queued',
      message: '任务已创建，等待服务端执行',
    })
    context.logGenerationTask('task_created', {
      recordId: createdRecord.id,
      userId: currentUserId,
      type: payload.type,
      strategyKey: strategy.key,
      providerId,
      modelKey,
    })
    context.runTaskInBackground(task, payload)
    return createdRecord
  } catch (error) {
    if (concurrencySlots.length) {
      await context.releaseTaskConcurrencySlots(concurrencySlots)
    }
    await context.clearPendingIdempotencyKey(idempotencyKey, idempotencyClaim.token)
    throw error
  }
}

export const getGenerationTaskRecord = async (
  recordId: string,
  currentUserId: string,
  context: TaskLifecycleContext,
) => {
  return context.resolveTaskRecordSnapshot(recordId, currentUserId)
}

export const stopGenerationTask = async (
  recordId: string,
  currentUserId: string,
  context: TaskLifecycleContext,
) => {
  const task = context.getLocalRunningTask(recordId)

  if (task) {
    if (task.userId !== currentUserId) {
      throw new Error('无权停止当前生成任务')
    }
    context.abortTaskWithReason(task, 'user_stop')
  } else {
    const sharedRuntime = await context.getSharedTaskRuntime(recordId)
    if (sharedRuntime?.status === 'running') {
      await context.markSharedTaskAbortRequested(recordId)
      return context.getGenerationRecordById(recordId, currentUserId)
    }

    const currentRecord = await context.getGenerationRecordById(recordId, currentUserId)
    if (currentRecord.done) {
      return currentRecord
    }

    await context.updateGenerationRecord(recordId, {
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
    const stoppedRecord = await context.getGenerationRecordById(recordId, currentUserId)
    context.emitTaskStreamEvent(recordId, {
      type: 'stopped',
      recordId,
      done: true,
      stopped: true,
      record: stoppedRecord,
      stage: 'stopped',
      message: '任务已停止',
    })
  }

  return context.getGenerationRecordById(recordId, currentUserId)
}
