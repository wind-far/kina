export interface WorkflowGridUploadedFile {
  publicUrl?: string | null
}

export const requireCompleteWorkflowGridUpload = <T extends WorkflowGridUploadedFile>(
  uploadedFiles: T[],
  expectedCount: number,
): Array<T & { publicUrl: string }> => {
  const completedFiles = uploadedFiles.filter(
    (file): file is T & { publicUrl: string } => Boolean(file?.publicUrl?.trim()),
  )

  if (uploadedFiles.length !== expectedCount || completedFiles.length !== expectedCount) {
    throw new Error('宫格图片未全部上传成功，未创建结果节点')
  }

  return completedFiles
}

export const commitWorkflowGridNodesAtomically = <T>(input: {
  items: T[]
  createNode: (item: T, index: number) => string
  connectNode: (nodeId: string, item: T, index: number) => void
  rollbackNode: (nodeId: string) => void
}) => {
  const createdNodeIds: string[] = []

  try {
    input.items.forEach((item, index) => {
      const nodeId = input.createNode(item, index)
      if (!nodeId) throw new Error(`第 ${index + 1} 个宫格节点创建失败`)
      createdNodeIds.push(nodeId)
      input.connectNode(nodeId, item, index)
    })
    return createdNodeIds
  } catch (error) {
    createdNodeIds.reverse().forEach((nodeId) => {
      try {
        input.rollbackNode(nodeId)
      } catch {
        // 回滚必须尽力完成；保留原始错误供调用方展示。
      }
    })
    throw error
  }
}
