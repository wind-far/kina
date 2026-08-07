export const formatWorkflowText = (value: string) => value
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map(line => line.replace(/[\t ]+$/g, ''))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

export const buildWorkflowMarkdownTable = (rows = 2, columns = 2) => {
  const safeRows = Math.max(1, Math.min(8, Math.floor(rows)))
  const safeColumns = Math.max(1, Math.min(8, Math.floor(columns)))
  const header = `| ${Array.from({ length: safeColumns }, (_, index) => `列 ${index + 1}`).join(' | ')} |`
  const divider = `| ${Array.from({ length: safeColumns }, () => '---').join(' | ')} |`
  const body = Array.from({ length: safeRows }, () => `| ${Array.from({ length: safeColumns }, () => '内容').join(' | ')} |`)
  return [header, divider, ...body].join('\n')
}

export const insertWorkflowTextAtSelection = (
  value: string,
  insertion: string,
  start: number,
  end = start,
) => {
  const safeStart = Math.max(0, Math.min(value.length, start))
  const safeEnd = Math.max(safeStart, Math.min(value.length, end))
  const prefix = safeStart > 0 && value[safeStart - 1] !== '\n' ? '\n\n' : ''
  const suffix = safeEnd < value.length && value[safeEnd] !== '\n' ? '\n\n' : ''
  return `${value.slice(0, safeStart)}${prefix}${insertion}${suffix}${value.slice(safeEnd)}`
}
