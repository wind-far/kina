type LogLevel = 'log' | 'info' | 'warn' | 'error'

const padLogNumber = (value: number, length = 2) => {
  return String(value).padStart(length, '0')
}

// 统一生成本地时间戳，方便和服务器上的其他业务日志对齐排查。
export const formatLogTimestamp = (date = new Date()) => {
  const year = date.getFullYear()
  const month = padLogNumber(date.getMonth() + 1)
  const day = padLogNumber(date.getDate())
  const hour = padLogNumber(date.getHours())
  const minute = padLogNumber(date.getMinutes())
  const second = padLogNumber(date.getSeconds())

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

// 统一拼接日志前缀，避免各模块重复手写时间与作用域格式。
export const buildScopedLogPrefix = (scope: string, title: string) => {
  return `[${formatLogTimestamp()}] [${scope}] ${title}`
}

// 统一输出结构化日志：标题中文，明细保持原始 JSON 或原始错误对象。
export const writeScopedLog = (level: LogLevel, scope: string, title: string, detail?: unknown) => {
  const prefix = buildScopedLogPrefix(scope, title)

  if (detail === undefined) {
    console[level](prefix)
    return
  }

  if (detail instanceof Error) {
    console[level](prefix, detail)
    return
  }

  if (typeof detail === 'string') {
    console[level](prefix, detail)
    return
  }

  console[level](prefix, JSON.stringify(detail))
}
