// 研究执行流程的共享上下文与类型契约。
// 每个 step 文件接收同一份 ctx 对象，避免在文件之间互传一长串参数。

import type { GenerationRecordPayload } from '../../generation-records/shared'
import type { GenerationTaskStartPayload, GenerationTaskStreamEvent } from '../../generation-tasks/shared'
import type {
  ResearchPlanSnapshot,
  ResearchTaskConfig,
} from '../../../src/shared/research/research-types'
import type { ResearchEvidenceStore } from '../evidence-store'
import type { ResearchUsageAccumulator } from './usage-accumulator'

export type ResearchExecutionTask = {
  recordId: string
  userId: string
  abortController: AbortController
}

export interface ResearchTaskExecutorContext {
  syncSharedTaskRuntime: (task: ResearchExecutionTask, status: 'running' | 'completed') => Promise<void>
  ensureTaskNotAborted: (task: ResearchExecutionTask) => Promise<void>
  buildInitialRecordPayload: (payload: GenerationTaskStartPayload) => GenerationRecordPayload
  updateGenerationRecord: (recordId: string, payload: GenerationRecordPayload, currentUserId: string) => Promise<void>
  getGenerationRecordById: (recordId: string, currentUserId: string) => Promise<Record<string, unknown>>
  emitTaskStreamEvent: (recordId: string, event: GenerationTaskStreamEvent) => void
  emitTaskProgressEvent: (recordId: string, input: {
    stage: string
    stopped?: boolean
    message?: string
  }) => void
  logGenerationTask: (stage: string, detail: Record<string, unknown>) => void
}

export interface ResearchSearchRuntimeConfig {
  provider: string
  providerId: string
  model: string
}

// 研究执行步骤的聚合上下文。
// snapshot / evidenceStore 是可变共享对象——禁止 step 重新赋值，只允许字段级 mutation。
export interface ResearchStepContext {
  task: ResearchExecutionTask
  payload: GenerationTaskStartPayload
  executor: ResearchTaskExecutorContext
  config: ResearchTaskConfig
  snapshot: ResearchPlanSnapshot
  evidenceStore: ResearchEvidenceStore
  modelKey: string
  subject: string
  goal: string
  searchRuntime: ResearchSearchRuntimeConfig
  usageAccumulator: ResearchUsageAccumulator
}
