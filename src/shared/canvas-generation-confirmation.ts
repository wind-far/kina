import { ElMessageBox } from 'element-plus'

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

/**
 * `/canvas` 的普通生成结果与插件结果采用同一条人工确认边界。
 * 任务、模型和重试参数可以先保存；媒体 URL 与文本内容只能在用户确认后落到节点。
 */
export const isCanvasGenerationConfirmationRequired = () => (
  typeof window !== 'undefined' && window.location.pathname === '/canvas'
)

const previewSummary = (input: CanvasGenerationConfirmationInput) => {
  if (input.kind === 'text') {
    const content = String(input.content || '').trim()
    return content ? `已生成文本：\n\n${content.slice(0, 800)}${content.length > 800 ? '…' : ''}` : '文本任务已完成，但没有可写入的内容。'
  }
  const label = input.kind === 'image' ? '图片' : '视频'
  const count = Math.max(1, Number(input.outputCount) || 1)
  return `任务已生成 ${count} 个${label}结果。确认后才会写入画布、撤销历史和当前版本。`
}

/** 非画布工作流保持原有自动写入行为，避免破坏已有流水线执行。 */
export const confirmCanvasGenerationResult = async (input: CanvasGenerationConfirmationInput) => {
  if (!isCanvasGenerationConfirmationRequired()) return true
  try {
    await ElMessageBox.confirm(previewSummary(input), '预览生成结果', {
      confirmButtonText: '确认写入画布',
      cancelButtonText: '暂不写入',
      type: 'info',
      distinguishCancelAndClose: true,
    })
    return true
  } catch {
    return false
  }
}

/** 由画布壳创建可回滚版本检查点；普通工作流不发出该事件。 */
export const notifyCanvasGenerationResultConfirmed = (detail: CanvasGenerationConfirmedDetail) => {
  if (!isCanvasGenerationConfirmationRequired()) return
  window.dispatchEvent(new CustomEvent<CanvasGenerationConfirmedDetail>(CANVAS_GENERATION_CONFIRMED_EVENT, { detail }))
}
