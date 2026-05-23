interface ParsedUpstreamErrorDetail {
  type: string
  code: string
  message: string
}

interface FastApiValidationItem {
  type: string
  loc: string[]
  msg: string
  input?: unknown
  ctx?: Record<string, unknown>
}

const tryParseJson = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

const extractErrorObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

// FastAPI / Pydantic 校验错统一返回 { detail: [{ type, loc, msg, input?, ctx? }] }。
// 提取第一条用于翻译；非该结构返回 null。
const extractFastApiValidationItem = (input: string): FastApiValidationItem | null => {
  const trimmed = String(input || '').trim()
  if (!trimmed || !trimmed.includes('"detail"')) return null

  const stripped = trimmed.replace(/^Error:\s*/, '')
  const parsed = tryParseJson(stripped)
  const detail = parsed?.detail
  if (!Array.isArray(detail) || detail.length === 0) return null

  const first = detail[0]
  if (!first || typeof first !== 'object') return null

  const candidate = first as Record<string, unknown>
  const loc = Array.isArray(candidate.loc) ? candidate.loc.map(item => String(item)) : []
  return {
    type: String(candidate.type || '').trim(),
    loc,
    msg: String(candidate.msg || '').trim(),
    input: candidate.input,
    ctx: candidate.ctx && typeof candidate.ctx === 'object' ? candidate.ctx as Record<string, unknown> : undefined,
  }
}

// 把单条 FastAPI 校验错翻译成用户能看懂的中文。
const buildFastApiValidationMessage = (item: FastApiValidationItem) => {
  const lastLoc = item.loc.length ? String(item.loc[item.loc.length - 1]) : ''
  const inputDisplay = item.input === undefined || item.input === null ? '' : String(item.input)

  // n 参数超上限：图片接口最常见的 422，直接告诉用户上限和当前值
  if (item.type === 'less_than_equal' && lastLoc === 'n') {
    const upper = item.ctx?.le !== undefined ? String(item.ctx.le) : ''
    if (upper && inputDisplay) {
      return `该模型单次最多生成 ${upper} 张图，当前请求 ${inputDisplay} 张超出上限，请减少数量后重试。`
    }
    if (upper) {
      return `该模型单次最多生成 ${upper} 张图，请减少数量后重试。`
    }
    return '生成数量超过该模型的单次上限，请减少数量后重试。'
  }

  if (item.type === 'greater_than_equal' && lastLoc === 'n') {
    return '生成数量至少为 1，请重新设置。'
  }

  // 通用回退：把字段名和原始消息拼起来，尽量给点定位线索
  if (lastLoc && item.msg) {
    return `参数 ${lastLoc} 不合法：${item.msg}`
  }
  if (item.msg) {
    return `请求参数不合法：${item.msg}`
  }
  return '请求参数不合法，请检查后重试。'
}

const extractUpstreamErrorDetail = (input: string): ParsedUpstreamErrorDetail => {
  const normalizedText = String(input || '').trim()
  if (!normalizedText) {
    return {
      type: '',
      code: '',
      message: '',
    }
  }

  const parsedRoot = tryParseJson(normalizedText)
  const rootError = extractErrorObject(parsedRoot?.error)
  if (rootError) {
    return {
      type: String(rootError.type || '').trim(),
      code: String(rootError.code || '').trim(),
      message: String(rootError.message || '').trim(),
    }
  }

  const parsedNested = tryParseJson(normalizedText.replace(/^Error:\s*/, ''))
  const nestedError = extractErrorObject(parsedNested?.error)
  if (nestedError) {
    return {
      type: String(nestedError.type || '').trim(),
      code: String(nestedError.code || '').trim(),
      message: String(nestedError.message || '').trim(),
    }
  }

  return {
    type: '',
    code: '',
    message: '',
  }
}

const buildContentPolicyViolationMessage = () => {
  return '图片生成请求触发内容安全限制，请避免使用具体影视或动漫 IP、角色名、官方海报描述，或高度可识别的受版权保护形象后重试。'
}

const buildProviderSecretDecryptMessage = () => {
  return '厂商 API Key 解密失败，请检查环境变量 PROVIDER_CONFIG_SECRET 是否与录入厂商密钥时一致；如已变更，请重新保存对应厂商的 API Key。'
}

const buildProviderCipherFormatMessage = () => {
  return '厂商 API Key 密文格式不正确，请检查数据库中的厂商密钥配置，必要时重新保存对应厂商的 API Key。'
}

const buildInvalidApiKeyMessage = () => {
  return '厂商 API Key 无效或已失效，请在后台厂商配置中检查并重新保存有效密钥。'
}

const buildInsufficientQuotaMessage = () => {
  return '上游厂商额度不足或账户欠费，请检查对应厂商账户余额、套餐额度或计费状态。'
}

const buildBurstRateLimitMessage = () => {
  return '当前请求提交过快，已触发上游限流保护。请稍后重试，或降低短时间内的连续提交频率。'
}

// 统一格式化生成链路中的异常，避免把原始 JSON、密文解密异常直接暴露给前端。
export const normalizeGenerationErrorMessage = (input: unknown, fallback = '任务执行失败') => {
  const rawMessage = typeof input === 'string'
    ? input.trim()
    : input instanceof Error
      ? String(input.message || '').trim()
      : ''

  if (!rawMessage) {
    return fallback
  }

  if (/Unsupported state or unable to authenticate data/i.test(rawMessage)) {
    return buildProviderSecretDecryptMessage()
  }

  if (/API Key 密文格式不正确/i.test(rawMessage)) {
    return buildProviderCipherFormatMessage()
  }

  // FastAPI / Pydantic 校验错（如上游对 n 参数硬上限）：优先识别，转成可读中文
  const validationItem = extractFastApiValidationItem(rawMessage)
  if (validationItem) {
    return buildFastApiValidationMessage(validationItem)
  }

  const detail = extractUpstreamErrorDetail(rawMessage)

  if (detail.code === 'content_policy_violation' || /content_policy_violation/i.test(rawMessage)) {
    return buildContentPolicyViolationMessage()
  }

  if (
    detail.code === 'invalid_api_key'
    || /invalid[_ ]api[_ ]key/i.test(detail.message)
    || /invalid[_ ]api[_ ]key/i.test(rawMessage)
  ) {
    return buildInvalidApiKeyMessage()
  }

  if (
    detail.code === 'insufficient_quota'
    || /insufficient[_ ]quota/i.test(detail.message)
    || /insufficient[_ ]quota/i.test(rawMessage)
  ) {
    return buildInsufficientQuotaMessage()
  }

  if (
    detail.code === 'limit_burst_rate'
    || /limit_burst_rate/i.test(detail.message)
    || /limit_burst_rate/i.test(rawMessage)
    || /Request rate increased too quickly/i.test(detail.message)
    || /Request rate increased too quickly/i.test(rawMessage)
  ) {
    return buildBurstRateLimitMessage()
  }

  return rawMessage
}
