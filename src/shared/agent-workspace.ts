import type {
  AgentImageResult,
  AgentProcessSection,
  AgentProcessTaskItem,
  AgentRunState,
  AgentTaskStep,
} from '../types/agent'

export type AgentWorkspaceEvent =
  | {
      type: 'run_started'
      taskId: string
    }
  | {
      type: 'run_stopped'
      taskId: string
      message: string
    }
  | {
      type: 'reasoning_delta'
      taskId: string
      stageKey: string
      stageLabel: string
      text: string
    }
  | {
      type: 'assistant_text_delta'
      taskId: string
      stageKey: string
      stageLabel: string
      text: string
    }
  | {
      type: 'tool_call_started'
      taskId: string
      toolName: string
      argumentsText?: string
      sectionKey?: string
      label?: string
    }
  | {
      type: 'skill_activated'
      taskId: string
      skillLabel: string
      sectionKey?: string
    }
  | {
      type: 'skill_loaded'
      taskId: string
      skillLabel: string
      dependencySkillLabel?: string
      sectionKey?: string
      label?: string
    }
  | {
      type: 'workflow_planned'
      taskId: string
      workflowLabel: string
      workflowParams: Record<string, unknown>
      expectedImageCount: number
      planItems?: string[]
    }
  | {
      type: 'submission_started'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      attempt?: number
      resolution?: string
    }
  | {
      type: 'submission_failed'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      attempt: number
      resolution: string
      errorMessage: string
      fallbackResolution?: string
    }
  | {
      type: 'submission_retrying'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      attempt: number
      resolution: string
    }
  | {
      type: 'image_completed'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      completedCount: number
      image: AgentImageResult
    }
  | {
      type: 'run_completed'
      taskId: string
      workflowLabel: string
      expectedImageCount: number
      summary: string
      title?: string
    }
  | {
      type: 'run_failed'
      taskId: string
      errorMessage: string
    }

type AgentStepStatus = AgentTaskStep['status']

export const buildExecutionSteps = (options: {
  workflowLabel: string
  expectedImageCount: number
  finishedImageCount: number
  phase: 'analyzing' | 'activating_skill' | 'loading_skill' | 'planning' | 'submitting' | 'generating' | 'completed'
}): AgentTaskStep[] => {
  const { workflowLabel, expectedImageCount, finishedImageCount, phase } = options

  const submitDescription = expectedImageCount
    ? `已提交 ${Math.min(finishedImageCount, expectedImageCount)}/${expectedImageCount} 个生成任务。`
    : '已提交生成任务。'

  const generateDescription = expectedImageCount
    ? `已完成 ${Math.min(finishedImageCount, expectedImageCount)}/${expectedImageCount} 个结果生成。`
    : '正在生成结果。'

  const planStatus: AgentStepStatus =
    phase === 'planning'
      ? 'running'
      : phase === 'analyzing' || phase === 'activating_skill' || phase === 'loading_skill'
        ? 'pending'
        : 'completed'

  const submitStatus: AgentStepStatus =
    phase === 'submitting'
      ? 'running'
      : phase === 'analyzing' || phase === 'activating_skill' || phase === 'loading_skill' || phase === 'planning'
        ? 'pending'
        : 'completed'

  const generateStatus: AgentStepStatus =
    phase === 'completed'
      ? 'completed'
      : phase === 'generating'
        ? 'running'
        : 'pending'

  const imageSteps: AgentTaskStep[] = expectedImageCount
    ? Array.from({ length: expectedImageCount }, (_, index) => {
        const imageIndex = index + 1
        let status: AgentStepStatus = 'pending'

        if (phase === 'completed' || imageIndex <= finishedImageCount) {
          status = 'completed'
        } else if (phase === 'generating' && imageIndex === finishedImageCount + 1) {
          status = 'running'
        }

        return {
          id: `step-image-${imageIndex}`,
          title: `生成第 ${imageIndex} 张`,
          status,
          description:
            status === 'completed'
              ? `第 ${imageIndex} 张结果已生成。`
              : status === 'running'
                ? `正在生成第 ${imageIndex} 张结果。`
                : `等待生成第 ${imageIndex} 张结果。`,
        }
      })
    : []

  return [
    {
      id: 'step-analyze',
      title: '解析需求',
      status: phase === 'analyzing' ? 'running' : 'completed',
      description: phase === 'analyzing'
        ? '正在理解你的意图，并匹配合适的技能与工作流。'
        : '已完成任务理解与技能匹配。',
    },
    {
      id: 'step-activate-skill',
      title: '激活技能',
      status:
        phase === 'activating_skill'
          ? 'running'
          : phase === 'analyzing'
            ? 'pending'
            : 'completed',
      description:
        phase === 'analyzing'
          ? '等待激活匹配技能。'
          : '已激活当前任务所需技能。',
    },
    {
      id: 'step-load-skill',
      title: '读取技能指南',
      status:
        phase === 'loading_skill'
          ? 'running'
          : phase === 'analyzing' || phase === 'activating_skill'
            ? 'pending'
            : 'completed',
      description:
        phase === 'analyzing' || phase === 'activating_skill'
          ? '等待加载技能说明与依赖。'
          : '已读取技能说明，并完成依赖技能准备。',
    },
    {
      id: 'step-plan',
      title: '确定工作流',
      status: planStatus,
      description: phase === 'analyzing'
        ? '等待生成任务规划。'
        : `已确定工作流：${workflowLabel}。`,
    },
    {
      id: 'step-submit',
      title: '提交生成任务',
      status: submitStatus,
      description: phase === 'analyzing' || phase === 'planning'
        ? '等待提交生成任务。'
        : submitDescription,
    },
    {
      id: 'step-generate',
      title: '结果生成中...',
      status: generateStatus,
      description: phase === 'completed' || phase === 'generating'
        ? generateDescription
        : '等待结果输出。',
    },
    ...imageSteps,
  ]
}

export const buildAgentPendingRun = (id: number | string, message: string, skill: string): AgentRunState => ({
  id: `agent-run-${id}`,
  query: message,
  skill,
  status: 'thinking',
  user: {
    name: 'Canana Agent',
  },
  steps: buildExecutionSteps({
    workflowLabel: '任务规划中',
    expectedImageCount: 0,
    finishedImageCount: 0,
    phase: 'analyzing',
  }),
  indicator: {
    status: 'thinking',
    title: '再思考片刻...',
    description: '正在理解你的意图，并匹配合适的技能与工作流。',
  },
  result: {
    title: '',
    summary: '',
    images: [],
    expectedImageCount: 0,
    outputVisible: false,
  },
  processSections: [],
})

export const upsertProcessSection = (
  sections: AgentProcessSection[],
  nextSection: AgentProcessSection,
) => {
  const next = [...sections]
  const index = next.findIndex(section => section.key === nextSection.key)

  if (index === -1) {
    next.push(nextSection)
    return next
  }

  next[index] = {
    ...next[index],
    ...nextSection,
  }
  return next
}

export const appendProcessParagraph = (
  sections: AgentProcessSection[],
  key: string,
  label: string,
  text: string,
  kind: AgentProcessSection['kind'] = 'reasoning',
) => {
  const normalized = text.trim()
  if (!normalized) return sections

  const next = [...sections]
  const index = next.findIndex(section => section.key === key)

  if (index === -1) {
    next.push({
      key,
      kind,
      label,
      paragraphs: [normalized],
    })
    return next
  }

  const current = next[index]
  next[index] = {
    ...current,
    kind,
    label,
    paragraphs: [...(current.paragraphs || []), normalized],
  }
  return next
}

export const appendProcessInlineText = (
  sections: AgentProcessSection[],
  key: string,
  label: string,
  text: string,
  kind: AgentProcessSection['kind'] = 'reasoning',
) => {
  if (!text) return sections

  const next = [...sections]
  const index = next.findIndex(section => section.key === key)

  if (index === -1) {
    next.push({
      key,
      kind,
      label,
      paragraphs: [text],
    })
    return next
  }

  const current = next[index]
  const currentParagraphs = current.paragraphs || ['']
  const lastParagraphIndex = Math.max(currentParagraphs.length - 1, 0)
  const nextParagraphs = [...currentParagraphs]
  nextParagraphs[lastParagraphIndex] = `${nextParagraphs[lastParagraphIndex] || ''}${text}`

  next[index] = {
    ...current,
    kind,
    label,
    paragraphs: nextParagraphs,
  }
  return next
}

export const updateProcessTaskItems = (
  sections: AgentProcessSection[],
  key: string,
  label: string,
  taskItems: AgentProcessTaskItem[],
) => {
  return upsertProcessSection(sections, {
    key,
    kind: 'reasoning',
    label,
    taskItems,
  })
}

export const buildPlanTaskItems = (planItems: string[], status: AgentProcessTaskItem['status']) => {
  return planItems.map((item, index) => ({
    id: `task-plan-${index + 1}`,
    title: item,
    status,
  }))
}

export const updatePlanTaskItemStatuses = (
  currentItems: AgentProcessTaskItem[],
  updater: (item: AgentProcessTaskItem, index: number) => AgentProcessTaskItem,
) => {
  return currentItems.map(updater)
}

export const buildAgentErrorRun = (currentRun: AgentRunState, errorMessage: string): AgentRunState => ({
  ...currentRun,
  status: 'error',
  steps: [
    {
      id: 'step-error',
      title: '任务执行失败',
      status: 'error',
      description: errorMessage,
    },
  ],
  indicator: {
    status: 'error',
    title: '任务执行失败',
    description: errorMessage,
  },
  result: {
    title: currentRun.result?.title || '',
    summary: '当前任务未能完成分析，你可以修改需求后再次发送。',
    images: [],
    expectedImageCount: currentRun.result?.expectedImageCount || 0,
    outputVisible: true,
  },
  processSections: appendProcessParagraph(
    currentRun.processSections || [],
    'task-error',
    '执行失败',
    errorMessage,
  ),
})

export const buildAgentStoppedRun = (currentRun: AgentRunState, message = '任务已停止'): AgentRunState => ({
  ...currentRun,
  status: 'stopped',
  steps: [
    ...currentRun.steps.map(step => {
      if (step.status === 'running') {
        return {
          ...step,
          status: 'error' as const,
          description: `${step.description || step.title}（已停止）`,
        }
      }
      return step
    }),
    {
      id: 'step-stopped',
      title: '任务已停止',
      status: 'error',
      description: message,
    },
  ],
  indicator: {
    status: 'stopped',
    title: '已停止生成',
    description: message,
  },
  result: {
    title: currentRun.result?.title || '',
    summary: currentRun.result?.images?.length
      ? '已停止后续生成，当前已返回的结果已保留。'
      : '任务已停止，未继续执行后续步骤。',
    images: currentRun.result?.images || [],
    expectedImageCount: currentRun.result?.expectedImageCount || 0,
    outputVisible: true,
  },
  processSections: appendProcessParagraph(
    (currentRun.processSections || []).map(section => ({
      ...section,
      taskItems: section.taskItems?.map(item => (
        item.status === 'completed' || item.status === 'generated'
          ? item
          : { ...item, status: 'error' as const }
      )),
    })),
    'task-stopped',
    '任务已停止',
    message,
  ),
})

export const applyAgentWorkspaceEvent = (
  currentRun: AgentRunState,
  event: AgentWorkspaceEvent,
): AgentRunState => {
  if (event.type === 'run_failed') {
    return buildAgentErrorRun(currentRun, event.errorMessage)
  }

  if (event.type === 'run_stopped') {
    return buildAgentStoppedRun(currentRun, event.message)
  }

  switch (event.type) {
    case 'run_started':
      return {
        ...currentRun,
        status: 'thinking',
        indicator: {
          status: 'thinking',
          title: '再思考片刻...',
          description: '正在理解你的意图，并匹配合适的技能与工作流。',
        },
        steps: buildExecutionSteps({
          workflowLabel: '任务规划中',
          expectedImageCount: 0,
          finishedImageCount: 0,
          phase: 'analyzing',
        }),
        result: {
          title: '',
          summary: '',
          images: [],
          expectedImageCount: 0,
          outputVisible: false,
        },
        processSections: [],
      }
    case 'reasoning_delta':
      return {
        ...currentRun,
        processSections: appendProcessInlineText(
          currentRun.processSections || [],
          event.stageKey,
          event.stageLabel,
          event.text,
        ),
      }
    case 'assistant_text_delta':
      return {
        ...currentRun,
      }
    case 'tool_call_started':
      return {
        ...currentRun,
        processSections: upsertProcessSection(currentRun.processSections || [], {
          key: event.sectionKey || `tool-call-${event.toolName}`,
          kind: 'skill',
          label: event.label || `调用工具：${event.toolName}`,
          paragraphs: event.argumentsText ? [event.argumentsText] : [],
        }),
      }
    case 'skill_activated':
      return {
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '激活技能',
          description: `已匹配并激活技能：${event.skillLabel}。`,
        },
        steps: buildExecutionSteps({
          workflowLabel: '任务规划中',
          expectedImageCount: 0,
          finishedImageCount: 0,
          phase: 'activating_skill',
        }),
        result: {
          ...currentRun.result,
          title: currentRun.result?.title || '',
          summary: '',
          images: [],
          expectedImageCount: 0,
          outputVisible: false,
        },
        processSections: upsertProcessSection(currentRun.processSections || [], {
          key: event.sectionKey || 'skill-activated',
          kind: 'skill',
          label: `使用技能：${event.skillLabel}`,
          paragraphs: [],
        }),
      }
    case 'skill_loaded':
      return {
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '读取技能指南',
          description: event.dependencySkillLabel
            ? `已加载 ${event.skillLabel} 技能说明，并准备依赖技能 ${event.dependencySkillLabel}。`
            : `已加载 ${event.skillLabel} 技能说明，正在准备生成方案。`,
        },
        steps: buildExecutionSteps({
          workflowLabel: '任务规划中',
          expectedImageCount: 0,
          finishedImageCount: 0,
          phase: 'loading_skill',
        }),
        result: {
          ...currentRun.result,
          title: currentRun.result?.title || '',
          summary: '',
          images: [],
          expectedImageCount: 0,
          outputVisible: false,
        },
        processSections: upsertProcessSection(currentRun.processSections || [], {
          key: event.sectionKey || 'skill-guide',
          kind: 'skill',
          label: event.label || (event.dependencySkillLabel
            ? `已加载技能：${event.skillLabel}（依赖 ${event.dependencySkillLabel}）`
            : `已加载技能：${event.skillLabel}`),
          paragraphs: [],
        }),
      }
    case 'workflow_planned': {
      let nextRun: AgentRunState = {
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '准备生成方案',
          description: `已根据技能指南确定工作流：${event.workflowLabel}。`,
        },
        steps: buildExecutionSteps({
          workflowLabel: event.workflowLabel,
          expectedImageCount: event.expectedImageCount,
          finishedImageCount: 0,
          phase: 'planning',
        }),
        result: {
          title: currentRun.result?.title || '',
          summary: '',
          images: [],
          expectedImageCount: currentRun.result?.expectedImageCount || 0,
          outputVisible: false,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          'workflow-planned',
          `任务计划（${event.expectedImageCount} 项）`,
          `已确定工作流：${event.workflowLabel}。`,
        ),
      }

      if (event.planItems?.length) {
        nextRun = {
          ...nextRun,
          processSections: updateProcessTaskItems(
            nextRun.processSections || [],
            'workflow-planned',
            `任务计划（${event.planItems.length} 项）`,
            buildPlanTaskItems(event.planItems, 'pending'),
          ),
        }
      }
      return nextRun
    }
    case 'submission_started': {
      let nextRun: AgentRunState = {
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: event.attempt && event.attempt > 1 ? `重新提交任务（第 ${event.attempt} 轮）` : '提交生成任务',
          description: event.expectedImageCount
            ? `正在提交 ${event.expectedImageCount} 个生成任务${event.resolution ? `，当前分辨率 ${event.resolution.toUpperCase()}` : ''}。`
            : '正在提交生成任务。',
        },
        steps: buildExecutionSteps({
          workflowLabel: event.workflowLabel,
          expectedImageCount: event.expectedImageCount,
          finishedImageCount: 0,
          phase: 'submitting',
        }),
        result: {
          ...currentRun.result,
          title: currentRun.result?.title || '',
          images: [],
          expectedImageCount: event.expectedImageCount,
          outputVisible: true,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          `submission-log-attempt-${event.attempt || 1}`,
          `任务提交记录（第 ${event.attempt || 1} 轮）`,
          event.expectedImageCount
            ? `${event.attempt && event.attempt > 1 ? `第 ${event.attempt} 轮` : '当前'}已提交 ${event.expectedImageCount} 个生成任务${event.resolution ? `（${event.resolution.toUpperCase()}）` : ''}，请等待结果返回。`
            : '已提交生成任务。',
        ),
      }

      const section = (nextRun.processSections || []).find(item => item.key === 'workflow-planned')
      const currentItems = section?.taskItems || []
      if (!currentItems.length) {
        return nextRun
      }

      nextRun = {
        ...nextRun,
        processSections: updateProcessTaskItems(
          nextRun.processSections || [],
          'workflow-planned',
          section?.label || `任务计划（${currentItems.length} 项）`,
          updatePlanTaskItemStatuses(currentItems, item => ({
            ...item,
            status: 'running',
          })),
        ),
      }
      return nextRun
    }
    case 'submission_failed': {
      let nextRun: AgentRunState = {
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '修正生成参数',
          description: event.fallbackResolution
            ? `检测到 ${event.resolution.toUpperCase()} 不可用，已准备切换为 ${event.fallbackResolution.toUpperCase()} 重试。`
            : event.errorMessage,
        },
        processSections: appendProcessParagraph(
          appendProcessParagraph(
            currentRun.processSections || [],
            `submission-log-attempt-${event.attempt}`,
            `任务提交记录（第 ${event.attempt} 轮）`,
            event.errorMessage,
          ),
          'parameter-adjustment',
          '参数修正记录',
          event.fallbackResolution
            ? `已自动降级为 ${event.fallbackResolution.toUpperCase()}，保留原有任务计划继续重试。`
            : '准备重新提交生成任务。',
        ),
      }

      const section = (nextRun.processSections || []).find(item => item.key === 'workflow-planned')
      const currentItems = section?.taskItems || []
      if (!currentItems.length) {
        return nextRun
      }

      nextRun = {
        ...nextRun,
        processSections: updateProcessTaskItems(
          nextRun.processSections || [],
          'workflow-planned',
          section?.label || `任务计划（${currentItems.length} 项）`,
          updatePlanTaskItemStatuses(currentItems, item => ({
            ...item,
            status: 'error',
          })),
        ),
      }
      return nextRun
    }
    case 'submission_retrying': {
      let nextRun: AgentRunState = {
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: '重新提交生成任务',
          description: `已切换为 ${event.resolution.toUpperCase()}，开始第 ${event.attempt} 轮提交。`,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          `submission-log-attempt-${event.attempt}`,
          `任务提交记录（第 ${event.attempt} 轮）`,
          `开始第 ${event.attempt} 轮提交，当前分辨率 ${event.resolution.toUpperCase()}。`,
        ),
      }

      const section = (nextRun.processSections || []).find(item => item.key === 'workflow-planned')
      const currentItems = section?.taskItems || []
      if (!currentItems.length) {
        return nextRun
      }

      nextRun = {
        ...nextRun,
        processSections: updateProcessTaskItems(
          nextRun.processSections || [],
          'workflow-planned',
          section?.label || `任务计划（${currentItems.length} 项）`,
          updatePlanTaskItemStatuses(currentItems, item => ({
            ...item,
            status: 'running',
          })),
        ),
      }
      return nextRun
    }
    case 'image_completed': {
      let nextRun: AgentRunState = {
        ...currentRun,
        status: 'running',
        indicator: {
          status: 'running',
          title: `结果生成中 ${event.completedCount}/${event.expectedImageCount}`,
          description: event.completedCount < event.expectedImageCount
            ? `第 ${event.completedCount} 个结果已完成，继续生成剩余内容。`
            : '最后一个结果正在收尾。',
        },
        steps: buildExecutionSteps({
          workflowLabel: event.workflowLabel,
          expectedImageCount: event.expectedImageCount,
          finishedImageCount: event.completedCount,
          phase: 'generating',
        }),
        result: {
          title: currentRun.result?.title || '',
          summary: currentRun.result?.summary || '',
          images: [...(currentRun.result?.images || []), event.image],
          expectedImageCount: event.expectedImageCount,
          outputVisible: true,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          'image-progress',
          '结果回传',
          `第 ${event.completedCount} 张结果已返回。`,
        ),
      }

      const section = (nextRun.processSections || []).find(item => item.key === 'workflow-planned')
      const currentItems = section?.taskItems || []
      if (!currentItems.length) {
        return nextRun
      }

      nextRun = {
        ...nextRun,
        processSections: updateProcessTaskItems(
          nextRun.processSections || [],
          'workflow-planned',
          section?.label || `任务计划（${currentItems.length} 项）`,
          updatePlanTaskItemStatuses(currentItems, (item, index) => {
            if (index < event.completedCount) {
              return {
                ...item,
                status: 'generated',
              }
            }
            return {
              ...item,
              status: 'running',
            }
          }),
        ),
      }
      return nextRun
    }
    case 'run_completed': {
      let nextRun: AgentRunState = {
        ...currentRun,
        status: 'completed',
        indicator: {
          status: 'completed',
          title: '任务已完成',
          description: '当前结果已更新，你可以继续补充要求发起下一轮任务。',
        },
        steps: [
          ...buildExecutionSteps({
            workflowLabel: event.workflowLabel,
            expectedImageCount: event.expectedImageCount,
            finishedImageCount: event.expectedImageCount,
            phase: 'completed',
          }),
          {
            id: 'step-finish',
            title: '任务已完成',
            status: 'completed',
            description: '当前结果已写回 generate 页记录流，可继续补充要求发起下一轮任务。',
          },
        ],
        result: {
          title: event.title || currentRun.result?.title || '',
          summary: event.summary,
          images: currentRun.result?.images || [],
          expectedImageCount: event.expectedImageCount,
          outputVisible: true,
        },
        processSections: appendProcessParagraph(
          currentRun.processSections || [],
          'completion-log',
          '任务完成',
          '当前技能工作流已执行完成，结果已同步到记录流。',
        ),
      }

      const section = (nextRun.processSections || []).find(item => item.key === 'workflow-planned')
      const currentItems = section?.taskItems || []
      if (!currentItems.length) {
        return nextRun
      }

      nextRun = {
        ...nextRun,
        processSections: updateProcessTaskItems(
          nextRun.processSections || [],
          'workflow-planned',
          section?.label || `任务计划（${currentItems.length} 项）`,
          updatePlanTaskItemStatuses(currentItems, item => ({
            ...item,
            status: 'completed',
          })),
        ),
      }
      return nextRun
    }
  }
}
