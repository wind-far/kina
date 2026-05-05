/**
 * 工作流编排共享类型
 * 统一定义工作流类型、执行上下文与执行策略接口。
 */

export const WORKFLOW_TYPES = {
  TEXT_TO_IMAGE: 'text_to_image',
  TEXT_TO_IMAGE_TO_VIDEO: 'text_to_image_to_video',
  STORYBOARD: 'storyboard',
  MULTI_ANGLE_STORYBOARD: 'multi_angle_storyboard',
} as const

export type WorkflowTypeValue = (typeof WORKFLOW_TYPES)[keyof typeof WORKFLOW_TYPES]

export interface WorkflowCanvasPosition {
  x: number
  y: number
}

export interface WorkflowExecutionLogEntry {
  type: string
  message: string
  timestamp: number
}

export interface WorkflowCharacter {
  name?: string
  description?: string
}

export interface WorkflowStoryboardShot {
  title?: string
  prompt: string
}

export interface WorkflowMultiAnglePayload {
  character_description?: string
}

export interface WorkflowIntentBase {
  workflow_type: WorkflowTypeValue
  description?: string
}

export interface TextToImageWorkflowParams extends WorkflowIntentBase {
  workflow_type: typeof WORKFLOW_TYPES.TEXT_TO_IMAGE
  image_prompt: string
}

export interface TextToImageToVideoWorkflowParams extends WorkflowIntentBase {
  workflow_type: typeof WORKFLOW_TYPES.TEXT_TO_IMAGE_TO_VIDEO
  image_prompt: string
  video_prompt: string
}

export interface StoryboardWorkflowParams extends WorkflowIntentBase {
  workflow_type: typeof WORKFLOW_TYPES.STORYBOARD
  character: WorkflowCharacter
  shots: WorkflowStoryboardShot[]
}

export interface MultiAngleStoryboardWorkflowParams extends WorkflowIntentBase {
  workflow_type: typeof WORKFLOW_TYPES.MULTI_ANGLE_STORYBOARD
  multi_angle: WorkflowMultiAnglePayload
}

export type WorkflowIntentAnalysisResult =
  | TextToImageWorkflowParams
  | TextToImageToVideoWorkflowParams
  | StoryboardWorkflowParams
  | MultiAngleStoryboardWorkflowParams

export interface WorkflowExecutionContext {
  addLog: (type: string, message: string) => void
  setCurrentStep: (step: number) => void
  setTotalSteps: (step: number) => void
  waitForConfigComplete: (configNodeId: string) => Promise<string>
  waitForOutputReady: (outputNodeId: string) => Promise<unknown>
}

export interface WorkflowExecutionStrategy {
  key: WorkflowTypeValue
  execute: (
    params: WorkflowIntentAnalysisResult,
    position: WorkflowCanvasPosition,
    context: WorkflowExecutionContext,
  ) => Promise<unknown>
}

export interface WorkflowIntentAnalysisOptions {
  systemPromptOverride?: string
}
