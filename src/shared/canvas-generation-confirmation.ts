export type CanvasGenerationConfirmationKind = 'image' | 'video' | 'text'

export interface CanvasGenerationConfirmationInput {
  kind: CanvasGenerationConfirmationKind
  outputCount?: number
  content?: string
}

export interface CanvasGenerationConfirmedDetail {
  kind: CanvasGenerationConfirmationKind
  taskId: string
  outputCount?: number
}

export const CANVAS_GENERATION_CONFIRMED_EVENT = 'canvas-generation-confirmed'

/** `/canvas` 的普通生成结果自动写回，保持与目标无限画布一致的连续创作流程。 */
export const isCanvasGenerationConfirmationRequired = () => false

const isCanvasGenerationCheckpointRequired = () => (
  typeof window !== 'undefined' && window.location.pathname === '/canvas'
)

/** 保留异步签名，节点无需分叉两套完成态逻辑。 */
export const confirmCanvasGenerationResult = async (_input: CanvasGenerationConfirmationInput) => true

/** 自动写回后仍由画布壳创建可回滚版本检查点。 */
export const notifyCanvasGenerationResultConfirmed = (detail: CanvasGenerationConfirmedDetail) => {
  if (!isCanvasGenerationCheckpointRequired()) return
  window.dispatchEvent(new CustomEvent<CanvasGenerationConfirmedDetail>(CANVAS_GENERATION_CONFIRMED_EVENT, { detail }))
}
