interface ParsedUpstreamErrorDetail {
  type: string
  code: string
  message: string
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
