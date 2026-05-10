/**
 * 模型能力策略
 *
 * 用于声明某个 AiModel 支持的"扩展能力"（联网搜索、深度思考等），
 * 并提供从前端开关状态映射到上游请求字段的统一规则。
 *
 * 数据来源：AiModel.capabilityJson（数据库 Json 字段）
 *
 * 设计目标：
 * 1. 厂商差异屏蔽在数据库层，新增厂商无需改代码
 * 2. 前端 UI 完全由 capabilityJson 驱动（"模型支持就显示，不支持就隐藏"）
 * 3. 计费可联动（联网/思考通常多扣点）
 */

/** 联网搜索能力声明。 */
export interface WebSearchCapabilitySpec {
  /** 是否支持。false 时前端不显示开关。 */
  supported: boolean
  /** 上游请求体中的字段名，例如 "web_search_options" / "enable_search"。 */
  requestField: string
  /**
   * 启用时该字段的值。
   * - OpenAI 兼容: `{}` 或 `{ search_context_size: "medium" }`
   * - 阿里通义: `true`
   * - 其它结构化值: 数组、对象、字符串均可
   */
  requestValue: unknown
  /** 禁用时若需要显式发送字段，配置该值（默认不发送字段）。 */
  disabledValue?: unknown
  /** 启用时的计费倍率（默认 1，不调整）。 */
  billingMultiplier?: number
  /** UI 显示标签（可选，默认"联网搜索"）。 */
  label?: string
  /** 描述文案（可选，鼠标悬停或副标题展示）。 */
  description?: string
}

/** 深度思考能力的可选项。 */
export interface ReasoningCapabilityOption {
  /** 选项 key（前端开关存的值）。 */
  key: string
  /** UI 显示名，例如"低 / 中 / 高"。 */
  label: string
  /**
   * 启用该选项时上游字段的值。
   * - OpenAI: "low" / "medium" / "high"
   * - Claude: { type: "enabled", budget_tokens: 8192 }
   * - 简单布尔: true
   */
  value: unknown
  /** 该等级的计费倍率（默认 1）。 */
  billingMultiplier?: number
  /** 选项描述（可选，UI 副标题）。 */
  description?: string
}

/** 深度思考能力声明。 */
export interface ReasoningCapabilitySpec {
  /** 是否支持。false 时前端不显示选择器。 */
  supported: boolean
  /** 上游请求体中的字段名，例如 "reasoning_effort" / "thinking" / "enable_thinking"。 */
  requestField: string
  /** 可选等级列表（如仅是开关，配单个选项即可）。 */
  options: ReasoningCapabilityOption[]
  /** 默认选项 key（用户未主动选择时使用）。 */
  defaultKey?: string
  /** UI 显示标签（默认"深度思考"）。 */
  label?: string
  /** 描述文案。 */
  description?: string
}

/**
 * 模型能力总声明。
 * 当前只覆盖联网与深度思考；后续新增能力（如代码执行、文件检索）按需扩展。
 */
export interface ModelCapabilitySpec {
  webSearch?: WebSearchCapabilitySpec
  reasoning?: ReasoningCapabilitySpec
}

/**
 * 前端选中的能力开关状态。
 * 由前端塞入 requestBody.__capabilities__，服务端在执行器内解析并转换为上游字段。
 */
export interface ModelCapabilityFlags {
  /** 是否启用联网搜索。 */
  webSearch?: boolean
  /** 选中的深度思考等级（key），未启用时为空字符串或不传。 */
  reasoning?: string
}

/** 应用能力开关后的结果。 */
export interface AppliedCapabilityResult {
  /** 需要并入 upstream requestBody 的字段集合。 */
  upstreamFields: Record<string, unknown>
  /** 计费倍率（多个能力相乘）。 */
  billingMultiplier: number
  /** 实际生效的开关（前端可回显）。 */
  effectiveFlags: ModelCapabilityFlags
}

/** 容错读取 capabilityJson，无效结构返回 null。 */
export const parseModelCapabilitySpec = (value: unknown): ModelCapabilitySpec | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as ModelCapabilitySpec
}

/** 判断模型是否支持任一扩展能力，前端用于决定要不要渲染开关条。 */
export const hasAnyModelCapability = (spec: ModelCapabilitySpec | null | undefined) => {
  if (!spec) return false
  return Boolean(spec.webSearch?.supported || spec.reasoning?.supported)
}

/**
 * 把前端开关转换为上游字段 + 计费倍率。
 *
 * - 不支持的能力会被忽略（即使前端传了开关）
 * - 计费倍率多能力相乘（联网 1.5 × 思考-高 3 = 4.5）
 * - effectiveFlags 反映实际生效的开关，便于前端回显
 */
export const applyCapabilityFlags = (
  flags: ModelCapabilityFlags | null | undefined,
  spec: ModelCapabilitySpec | null | undefined,
): AppliedCapabilityResult => {
  const upstreamFields: Record<string, unknown> = {}
  const effectiveFlags: ModelCapabilityFlags = {}
  let billingMultiplier = 1

  if (!spec) {
    return { upstreamFields, billingMultiplier, effectiveFlags }
  }

  // 联网搜索
  if (spec.webSearch?.supported) {
    if (flags?.webSearch) {
      upstreamFields[spec.webSearch.requestField] = spec.webSearch.requestValue
      effectiveFlags.webSearch = true
      const multiplier = spec.webSearch.billingMultiplier
      if (typeof multiplier === 'number' && multiplier > 0) {
        billingMultiplier *= multiplier
      }
    } else if (spec.webSearch.disabledValue !== undefined) {
      // 部分厂商需要显式发 false 才能关闭，否则可能继承上一次状态
      upstreamFields[spec.webSearch.requestField] = spec.webSearch.disabledValue
    }
  }

  // 深度思考
  if (spec.reasoning?.supported && Array.isArray(spec.reasoning.options) && spec.reasoning.options.length) {
    const requestedKey = String(flags?.reasoning || '').trim()
    const option = requestedKey
      ? spec.reasoning.options.find(item => item.key === requestedKey)
      : null
    if (option) {
      upstreamFields[spec.reasoning.requestField] = option.value
      effectiveFlags.reasoning = option.key
      const multiplier = option.billingMultiplier
      if (typeof multiplier === 'number' && multiplier > 0) {
        billingMultiplier *= multiplier
      }
    }
  }

  return { upstreamFields, billingMultiplier, effectiveFlags }
}

/** 判断 requestBody 中是否包含能力开关字段。 */
export const CAPABILITY_FLAGS_REQUEST_FIELD = '__capabilities__' as const

/** 容错读取 requestBody 中的能力开关。 */
export const readCapabilityFlagsFromRequestBody = (
  requestBody: Record<string, unknown> | null | undefined,
): ModelCapabilityFlags | null => {
  if (!requestBody || typeof requestBody !== 'object') return null
  const raw = (requestBody as Record<string, unknown>)[CAPABILITY_FLAGS_REQUEST_FIELD]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const flags = raw as Record<string, unknown>
  return {
    webSearch: typeof flags.webSearch === 'boolean' ? flags.webSearch : undefined,
    reasoning: typeof flags.reasoning === 'string' ? flags.reasoning : undefined,
  }
}
