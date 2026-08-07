export interface WorkflowPromptSizeOption {
  label: string
  key: string
}

export interface WorkflowPromptImageParameterInput {
  ratio: string
  resolution: string
  defaultSize?: string
  baseSizeOptions?: WorkflowPromptSizeOption[]
  sizeOptions?: WorkflowPromptSizeOption[]
}

/**
 * 把画布输入栏的“比例 + 2K/4K”选择转换成具体模型的上游参数。
 * Seedream 使用像素尺寸与 standard/4k；其他模型继续使用比例键。
 */
export const resolveWorkflowPromptImageParameters = (input: WorkflowPromptImageParameterInput) => {
  const ratio = String(input.ratio || '').trim().toLowerCase()
  const resolution = String(input.resolution || '').trim().toLowerCase()
  const sizeOptions = input.sizeOptions || []

  if (!sizeOptions.length) {
    return {
      size: ratio && ratio !== 'smart' ? ratio : undefined,
      quality: resolution || undefined,
    }
  }

  const requestedLabel = ratio === 'smart'
    ? input.baseSizeOptions?.find(option => option.key === input.defaultSize)?.label
    : ratio.replace('x', ':')
  const size = sizeOptions.find(option => option.label === requestedLabel)?.key
    || sizeOptions.find(option => option.key === input.defaultSize)?.key
    || sizeOptions[0]?.key

  return {
    size,
    quality: resolution === '4k' ? '4k' : 'standard',
  }
}
