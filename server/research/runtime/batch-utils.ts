// 批处理通用工具：分块与批大小常量。

export const RESEARCH_SEARCH_BATCH_SIZE = 4
export const RESEARCH_READER_BATCH_SIZE = 4

export const chunkQueryPlans = <T>(items: T[], chunkSize: number) => {
  const result: T[][] = []
  const size = Math.max(1, chunkSize)
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}
