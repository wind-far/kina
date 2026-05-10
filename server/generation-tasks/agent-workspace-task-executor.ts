import type { GenerationTaskStartPayload } from './shared'
import type { AgentWorkspaceEvent } from '../../src/shared/agent-workspace'
import type { AgentRunState } from '../../src/types/agent'
import { readCapabilityFlagsFromRequestBody } from '../../src/shared/provider-capability'

type AgentWorkspaceExecutionTask = {
  recordId: string
  userId: string
  abortController: AbortController
}

type AgentWorkspaceSkillMeta = {
  workspaceSkillKey: string
  dependencySkillKeys: string[]
  skillLabel: string
  imageModelBinding?: {
    providerId: string
    modelKey: string
  }
}

type AgentWorkspacePlan = {
  workflowLabel: string
  workflowParams?: Record<string, unknown>
  planItems: string[]
  imageTasks: Array<{
    label: string
    promptText: string
  }>
}

type AgentWorkspaceImageModel = {
  providerId: string
  modelKey: string
  defaultParamsJson?: Record<string, unknown> | null
}

type AgentWorkspaceRetryState = {
  attempt: number
  waitDurationMs: number
  status: number
  errorPreview: string
  stage: string
}

type AgentWorkspacePersistedRecord = Record<string, unknown> | null

export interface AgentWorkspaceTaskExecutorContext {
  syncSharedTaskRuntime: (task: AgentWorkspaceExecutionTask, status: 'running' | 'completed' | 'failed' | 'stopped') => Promise<void>
  ensureTaskNotAborted: (task: AgentWorkspaceExecutionTask) => Promise<void>
  getAgentWorkspaceSkillMeta: (skill: string) => Promise<AgentWorkspaceSkillMeta>
  buildAgentPendingRun: (
    recordId: string,
    query: string,
    skill: string,
    referenceImages?: string[],
  ) => AgentRunState
  applyAgentWorkspaceEvent: (
    currentRun: AgentRunState,
    agentEvent: AgentWorkspaceEvent,
  ) => AgentRunState
  persistAgentWorkspaceRecord: (input: {
    task: AgentWorkspaceExecutionTask
    payload: GenerationTaskStartPayload
    agentRun: AgentRunState
    done?: boolean
    stopped?: boolean
    error?: string
  }) => Promise<AgentWorkspacePersistedRecord>
  emitTaskProgressEvent: (recordId: string, input: {
    stage: string
    message?: string
    record?: Record<string, unknown> | null
  }) => void
  emitTaskAgentEvent: (recordId: string, input: {
    agentEvent: AgentWorkspaceEvent
    record?: Record<string, unknown> | null
    done?: boolean
    stopped?: boolean
    stage?: string
    message?: string
  }) => void
  sleepWithWorkspaceAbort: (signal: AbortSignal, durationMs: number) => Promise<void>
  getWorkspaceRandomDelay: (range: [number, number]) => number
  workspaceTimingProfile: {
    preAnalyzeDelay: number
    reasoningChunkDelayRange: [number, number]
    toolCallDelayRange: [number, number]
    analyzeDelayRange: [number, number]
    postPlanDelayRange: [number, number]
    preSubmitDelay: number
    betweenImageDelayRange: [number, number]
    completionDelayRange: [number, number]
  }
  planAgentWorkspace: (input: {
    prompt: string
    skill: string
  }) => Promise<AgentWorkspacePlan>
  requestAgentWorkspaceModelPlan: (input: {
    signal: AbortSignal
    providerId: string
    modelKey: string
    skill: string
    skillLabel: string
    workspaceSkillKey: string
    dependencySkillKeys?: string[]
    prompt: string
    referenceImages?: string[]
  }) => Promise<{
    analysisLines: string[]
    workflowLabel?: string
    workflowParams?: Record<string, unknown>
    planItems: string[]
    imageTasks: Array<{
      label: string
      promptText: string
    }>
    submitLines: string[]
    rawTextPreview?: string
  }>
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
  logGenerationTaskError: (stage: string, error: unknown, detail: Record<string, unknown>) => void
  resolveWorkspaceImageModel: (binding?: {
    providerId: string
    modelKey: string
  }) => Promise<AgentWorkspaceImageModel>
  requestImageEdit: (input: {
    signal: AbortSignal
    providerId: string
    modelKey: string
    prompt: string
    size?: string
    referenceImages: string[]
    onRetry?: (retryState: AgentWorkspaceRetryState) => Promise<void> | void
  }) => Promise<{
    upstreamUrl: string
    imageUrls: string[]
  }>
  requestImageGeneration: (input: {
    signal: AbortSignal
    providerId: string
    modelKey: string
    requestBody: Record<string, unknown>
    onRetry?: (retryState: AgentWorkspaceRetryState) => Promise<void> | void
  }) => Promise<{
    upstreamUrl: string
    imageUrls: string[]
  }>
  markTaskRetryState: (task: AgentWorkspaceExecutionTask, input: AgentWorkspaceRetryState) => Promise<void>
  refundTaskPointsIfNeeded: (task: AgentWorkspaceExecutionTask, reason: string) => Promise<void>
  normalizeGenerationErrorMessage: (error: unknown, fallbackMessage: string) => string
  buildWorkspaceCompletionSummary: (input: {
    prompt: string
    planItems: string[]
  }) => string
  AgentWorkspaceStoppedError: typeof Error
}

// 承接技能工作台任务的执行主干，先把长流程从 service.ts 中剥离出来。
export const executeAgentWorkspaceTaskFlow = async (
  task: AgentWorkspaceExecutionTask,
  payload: GenerationTaskStartPayload,
  context: AgentWorkspaceTaskExecutorContext,
) => {
  await context.syncSharedTaskRuntime(task, 'running')
  await context.ensureTaskNotAborted(task)
  const skill = String(payload.skill || '').trim() || 'general'
  const skillPrompt = String(payload.prompt || '').trim()
  const skillMeta = await context.getAgentWorkspaceSkillMeta(skill)
  const workspaceSkillKey = skillMeta.workspaceSkillKey
  const dependencySkillKeys = skillMeta.dependencySkillKeys
  const plannerProviderId = String((payload.requestBody || {}).providerId || '').trim()
  const plannerModelKey = String(payload.modelKey || '').trim()
  const referenceImages = Array.isArray(payload.referenceImages)
    ? payload.referenceImages.map(item => String(item || '').trim()).filter(Boolean)
    : []
  let currentRun = context.buildAgentPendingRun(
    task.recordId,
    String(payload.prompt || '').trim(),
    skill,
    referenceImages,
  )

  const initialRecord = await context.persistAgentWorkspaceRecord({
    task,
    payload,
    agentRun: currentRun,
    done: false,
    stopped: false,
  })

  context.emitTaskProgressEvent(task.recordId, {
    stage: 'queued',
    message: '技能任务已创建，等待服务端执行',
    record: initialRecord,
  })

  const emitWorkspaceEvent = async (agentEvent: AgentWorkspaceEvent) => {
    currentRun = context.applyAgentWorkspaceEvent(currentRun, agentEvent)
    const isTerminalEvent = agentEvent.type === 'run_completed'
      || agentEvent.type === 'run_failed'
      || agentEvent.type === 'run_stopped'
    const currentError = agentEvent.type === 'run_failed' ? agentEvent.errorMessage : ''
    const persistedRecord = await context.persistAgentWorkspaceRecord({
      task,
      payload,
      agentRun: currentRun,
      done: isTerminalEvent,
      stopped: agentEvent.type === 'run_stopped',
      error: currentError,
    })

    context.emitTaskAgentEvent(task.recordId, {
      agentEvent,
      record: persistedRecord,
      done: isTerminalEvent,
      stopped: agentEvent.type === 'run_stopped',
      stage: isTerminalEvent
        ? (agentEvent.type === 'run_completed'
          ? 'completed'
          : agentEvent.type === 'run_stopped'
            ? 'stopped'
            : 'failed')
        : 'agent_workspace_running',
      message: isTerminalEvent
        ? (agentEvent.type === 'run_completed'
          ? '技能任务已完成'
          : agentEvent.type === 'run_stopped'
            ? agentEvent.message
            : agentEvent.errorMessage)
        : '技能任务执行中',
    })
  }

  const emitWorkspaceReasoningBatch = async (input: {
    stageKey: string
    stageLabel: string
    lines: string[]
  }) => {
    for (const line of input.lines) {
      await context.ensureTaskNotAborted(task)
      const text = line.trim()
      if (!text) {
        continue
      }
      await emitWorkspaceEvent({
        type: 'reasoning_delta',
        taskId: task.recordId,
        stageKey: input.stageKey,
        stageLabel: input.stageLabel,
        text,
      })
      await context.sleepWithWorkspaceAbort(
        task.abortController.signal,
        context.getWorkspaceRandomDelay(context.workspaceTimingProfile.reasoningChunkDelayRange),
      )
    }
  }

  const emitActivateSkillToolCall = async (skillKey: string, label: string, sectionKey: string) => {
    await emitWorkspaceEvent({
      type: 'tool_call_started',
      taskId: task.recordId,
      toolName: 'activate_skill',
      argumentsText: `技能标识：${skillKey}`,
      sectionKey,
      label,
    })
    await context.sleepWithWorkspaceAbort(
      task.abortController.signal,
      context.getWorkspaceRandomDelay(context.workspaceTimingProfile.toolCallDelayRange),
    )
  }

  try {
    await context.sleepWithWorkspaceAbort(task.abortController.signal, context.workspaceTimingProfile.preAnalyzeDelay)
    await emitWorkspaceEvent({ type: 'run_started', taskId: task.recordId })

    const skillLabel = skillMeta.skillLabel
    await emitWorkspaceReasoningBatch({
      stageKey: 'reasoning-analyze',
      stageLabel: '需求分析',
      lines: [
        `正在分析你的需求：“${skillPrompt || '当前主题'}”。`,
        referenceImages.length ? `同时收到了 ${referenceImages.length} 张参考图，我会把这些图一起纳入后续理解与生成约束。` : '当前没有附带参考图，本次按纯文本需求执行。',
        workspaceSkillKey !== skill
          ? `根据当前技能规则，这类任务优先匹配技能 ${workspaceSkillKey}，对应前台展示为“${skillLabel}”。`
          : `根据当前技能规则，这类任务匹配“${skillLabel}”技能。`,
        `为了按照技能规范执行，我会先调用 activate_skill 加载 ${workspaceSkillKey} 的完整指南。`,
      ],
    })

    await emitActivateSkillToolCall(
      workspaceSkillKey,
      `调用技能：${workspaceSkillKey}`,
      'tool-call-primary-skill',
    )

    await context.sleepWithWorkspaceAbort(task.abortController.signal, 900)
    await emitWorkspaceEvent({
      type: 'skill_activated',
      taskId: task.recordId,
      skillLabel,
    })

    await context.sleepWithWorkspaceAbort(
      task.abortController.signal,
      context.getWorkspaceRandomDelay([1200, 1800]),
    )
    await emitWorkspaceEvent({
      type: 'skill_loaded',
      taskId: task.recordId,
      skillLabel,
      dependencySkillLabel: dependencySkillKeys[0] || '',
      sectionKey: 'skill-guide-primary',
      label: `已加载技能：${workspaceSkillKey}`,
    })

    if (dependencySkillKeys.length) {
      await emitWorkspaceReasoningBatch({
        stageKey: 'reasoning-dependency',
        stageLabel: '依赖技能',
        lines: [
          `已完成 ${workspaceSkillKey} 技能加载。`,
          `根据技能依赖规则，还需要继续加载 ${dependencySkillKeys.join('、')}，这样后续的图片生成策略、提示词结构和结果数量才能保持完整。`,
          '接下来继续调用 activate_skill，补齐依赖技能链。',
        ],
      })

      for (const dependencySkillKey of dependencySkillKeys) {
        await emitActivateSkillToolCall(
          dependencySkillKey,
          `调用技能：${dependencySkillKey}`,
          'tool-call-dependency-skill',
        )

        await emitWorkspaceEvent({
          type: 'skill_loaded',
          taskId: task.recordId,
          skillLabel: dependencySkillKey,
          sectionKey: 'skill-guide-dependency',
          label: `已加载依赖技能：${dependencySkillKey}`,
        })
      }
    }

    await context.sleepWithWorkspaceAbort(
      task.abortController.signal,
      context.getWorkspaceRandomDelay(context.workspaceTimingProfile.analyzeDelayRange),
    )
    let plan = await context.planAgentWorkspace({
      prompt: skillPrompt,
      skill,
    })

    let planningReasoningLines = [
      `现在我已经具备主技能${dependencySkillKeys.length ? '与依赖技能' : ''}的执行上下文，开始整理最终工作流。`,
      plan.imageTasks.length > 1
        ? `本次会默认生成 ${plan.imageTasks.length} 张结果，确保方向差异、构图变化和传播可选性。`
        : '本次将生成单张结果，并优先保证主题聚焦与完成度。',
      `工作流会按“${plan.workflowLabel}”执行，并为每一张结果分别构建独立提示词。`,
    ]
    let submitReasoningLines = [
      `即将把 ${plan.imageTasks.length} 个子任务提交到图片生成服务。`,
      '服务端会逐张回传结果，并实时同步到当前记录流。',
    ]

    if (plannerProviderId && plannerModelKey) {
      await emitWorkspaceEvent({
        type: 'tool_call_started',
        taskId: task.recordId,
        toolName: 'chat.completions',
        argumentsText: `模型：${plannerModelKey}`,
        sectionKey: 'tool-call-model-planner',
        label: `调用模型规划：${plannerModelKey}`,
      })

      try {
        const capabilityFlags = readCapabilityFlagsFromRequestBody(payload.requestBody)
        const modelPlan = await context.requestAgentWorkspaceModelPlan({
          signal: task.abortController.signal,
          providerId: plannerProviderId,
          modelKey: plannerModelKey,
          capabilityFlags,
          skill,
          skillLabel,
          workspaceSkillKey,
          dependencySkillKeys,
          prompt: skillPrompt,
          referenceImages,
        })

        context.logGenerationTask('agent_workspace:model_plan_success', {
          recordId: task.recordId,
          userId: task.userId,
          skill,
          plannerModelKey,
          analysisLineCount: modelPlan.analysisLines.length,
          planItemCount: modelPlan.planItems?.length || 0,
          imageTaskCount: modelPlan.imageTasks?.length || 0,
          workflowLabel: modelPlan.workflowLabel || '',
        })

        if (modelPlan.workflowLabel || modelPlan.workflowParams || modelPlan.planItems?.length || modelPlan.imageTasks?.length) {
          plan = {
            workflowLabel: modelPlan.workflowLabel || plan.workflowLabel,
            workflowParams: modelPlan.workflowParams || plan.workflowParams,
            planItems: modelPlan.planItems?.length ? modelPlan.planItems : plan.planItems,
            imageTasks: modelPlan.imageTasks?.length ? modelPlan.imageTasks : plan.imageTasks,
          }
        }

        if (modelPlan.analysisLines.length) {
          planningReasoningLines = modelPlan.analysisLines
        }
        if (modelPlan.submitLines.length) {
          submitReasoningLines = modelPlan.submitLines
        }
      } catch (error) {
        context.logGenerationTaskError('agent_workspace:model_plan_failed', error, {
          recordId: task.recordId,
          userId: task.userId,
          skill,
          plannerModelKey,
        })
        planningReasoningLines = [
          '规划模型调用失败，当前已自动回退到本地工作流规划。',
          ...planningReasoningLines,
        ]
      }
    }

    await emitWorkspaceReasoningBatch({
      stageKey: 'reasoning-plan',
      stageLabel: '任务规划',
      lines: planningReasoningLines,
    })

    await emitWorkspaceEvent({
      type: 'workflow_planned',
      taskId: task.recordId,
      workflowLabel: plan.workflowLabel,
      workflowParams: plan.workflowParams,
      expectedImageCount: plan.imageTasks.length,
      planItems: plan.planItems,
    })

    await context.sleepWithWorkspaceAbort(
      task.abortController.signal,
      context.getWorkspaceRandomDelay(context.workspaceTimingProfile.postPlanDelayRange),
    )
    await context.sleepWithWorkspaceAbort(task.abortController.signal, context.workspaceTimingProfile.preSubmitDelay)

    await emitWorkspaceReasoningBatch({
      stageKey: 'reasoning-submit',
      stageLabel: '提交任务',
      lines: submitReasoningLines,
    })

    await emitWorkspaceEvent({
      type: 'submission_started',
      taskId: task.recordId,
      workflowLabel: plan.workflowLabel,
      expectedImageCount: plan.imageTasks.length,
    })

    const imageModel = await context.resolveWorkspaceImageModel(skillMeta.imageModelBinding)
    const defaultRequestBody = imageModel.defaultParamsJson && typeof imageModel.defaultParamsJson === 'object'
      ? { ...imageModel.defaultParamsJson }
      : {}
    const hasWorkspaceReferenceImages = referenceImages.length > 0

    for (const [index, imageTask] of plan.imageTasks.entries()) {
      await context.ensureTaskNotAborted(task)
      await context.sleepWithWorkspaceAbort(
        task.abortController.signal,
        context.getWorkspaceRandomDelay(context.workspaceTimingProfile.betweenImageDelayRange),
      )

      const requestBody = {
        ...defaultRequestBody,
        prompt: imageTask.promptText,
        n: 1,
      } as Record<string, unknown>

      const { imageUrls } = hasWorkspaceReferenceImages
        ? await context.requestImageEdit({
          signal: task.abortController.signal,
          providerId: imageModel.providerId,
          modelKey: imageModel.modelKey,
          prompt: imageTask.promptText,
          size: String(requestBody.size || '').trim() || undefined,
          referenceImages,
          onRetry: (retryState) => context.markTaskRetryState(task, retryState),
        })
        : await context.requestImageGeneration({
          signal: task.abortController.signal,
          providerId: imageModel.providerId,
          modelKey: imageModel.modelKey,
          requestBody,
          onRetry: (retryState) => context.markTaskRetryState(task, retryState),
        })

      await emitWorkspaceEvent({
        type: 'image_completed',
        taskId: task.recordId,
        workflowLabel: plan.workflowLabel,
        expectedImageCount: plan.imageTasks.length,
        completedCount: index + 1,
        image: {
          id: `workspace-image-${index + 1}`,
          imageSrc: imageUrls[0],
          promptText: imageTask.promptText,
        },
      })
    }

    await context.sleepWithWorkspaceAbort(
      task.abortController.signal,
      context.getWorkspaceRandomDelay(context.workspaceTimingProfile.completionDelayRange),
    )
    await context.syncSharedTaskRuntime(task, 'completed')
    await emitWorkspaceEvent({
      type: 'run_completed',
      taskId: task.recordId,
      workflowLabel: plan.workflowLabel,
      expectedImageCount: plan.imageTasks.length,
      summary: context.buildWorkspaceCompletionSummary({
        prompt: String(payload.prompt || '').trim(),
        planItems: plan.planItems,
      }),
    })
  } catch (error) {
    if (error instanceof context.AgentWorkspaceStoppedError) {
      await context.refundTaskPointsIfNeeded(task, 'task_aborted')
      await context.syncSharedTaskRuntime(task, 'stopped')
      await emitWorkspaceEvent({
        type: 'run_stopped',
        taskId: task.recordId,
        message: error.message || '任务已停止',
      })
      return
    }

    const errorMessage = context.normalizeGenerationErrorMessage(error, '技能任务执行失败')
    await context.refundTaskPointsIfNeeded(task, 'task_failed')
    await context.syncSharedTaskRuntime(task, 'failed')
    await emitWorkspaceEvent({
      type: 'run_failed',
      taskId: task.recordId,
      errorMessage,
    })
  }
}
