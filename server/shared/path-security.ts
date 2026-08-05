import path from 'node:path'

// 使用相对路径判断目录边界，避免 /uploads-other 通过 /uploads 的字符串前缀校验。
export const isPathInsideDirectory = (rootDirectory: string, candidatePath: string) => {
  const resolvedRoot = path.resolve(rootDirectory)
  const resolvedCandidate = path.resolve(candidatePath)
  const relativePath = path.relative(resolvedRoot, resolvedCandidate)

  return relativePath === ''
    || (!relativePath.startsWith(`..${path.sep}`)
      && relativePath !== '..'
      && !path.isAbsolute(relativePath))
}
