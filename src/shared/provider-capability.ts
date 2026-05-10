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
 * 4. 注入策略可组合：set / append / merge-object / multi / custom
 *    覆盖单字段赋值、tools 数组追加、嵌套对象合并、多字段联动等场景
 */

// ----------------------------------------------------------------------------
// 注入策略：把能力开关映射为对上游 requestBody 的修改
// ----------------------------------------------------------------------------

/** 单字段覆盖赋值。`requestBody[field] = value`。 */
export interface SetInjection {
  type: 'set'
  field: string
  value: unknown
}

/** 数组追加。`requestBody[field] = [...existing, ...value]`。用于 tools 数组场景。 */
export interface AppendInjection {
  type: 'append'
  field: string
  value: unknown[]
}

/** 嵌套对象浅合并。`requestBody[field] = { ...existing, ...value }`。 */
export interface MergeObjectInjection {
  type: 'merge-object'
  field: string
  value: Record<string, unknown>
}

/** 多注入组合。按顺序依次应用。 */
export interface MultiInjection {
  type: 'multi'
  injections: CapabilityInjection[]
}

/** 命名 handler 兜底。极端厂商的特殊逻辑通过 server 端注册命名函数实现。 */
export interface CustomInjection {
  type: 'custom'
  /** 已注册的 handler 名，未注册时跳过并打印警告。 */
  handler: string
  /** 透传给 handler 的额外配置。 */
  config?: unknown
}

export type CapabilityInjection =
  | SetInjection
  | AppendInjection
  | MergeObjectInjection
  | MultiInjection
  | CustomInjection

// ----------------------------------------------------------------------------
// 能力声明
// ----------------------------------------------------------------------------

/** 联网搜索能力声明。 */
export interface WebSearchCapabilitySpec {
  /** 是否支持。false 时前端不显示开关。 */
  supported: boolean
  /** UI 显示标签（默认"联网搜索"）。 */
  label?: string
  /** 描述文案（鼠标悬停或副标题展示）。 */
  description?: string
  /** 启用时的注入策略。 */
  enabledInjection: CapabilityInjection
  /** 禁用时若需显式注入（如 enable_search: false），配置该字段。 */
  disabledInjection?: CapabilityInjection
  /** 启用时的计费倍率（默认 1，不调整）。 */
  billingMultiplier?: number
}

/** 深度思考的可选项（"低 / 中 / 高" / "标准 / 扩展"）。 */
export interface ReasoningCapabilityOption {
  /** 选项 key（前端开关存的值）。 */
  key: string
  /** UI 显示名。 */
  label: string
  /** 选项描述（UI 副标题）。 */
  description?: string
  /** 选中该选项时的注入策略（每个等级独立，便于不同等级走不同字段）。 */
  injection: CapabilityInjection
  /** 该等级的计费倍率（默认 1）。 */
  billingMultiplier?: number
}

/** 深度思考能力声明。 */
export interface ReasoningCapabilitySpec {
  /** 是否支持。false 时前端不显示选择器。 */
  supported: boolean
  /** UI 显示标签（默认"深度思考"）。 */
  label?: string
  /** 描述文案。 */
  description?: string
  /** 可选等级列表（如仅是开关，配单个选项即可）。 */
  options: ReasoningCapabilityOption[]
  /** 默认选项 key（用户未主动选择时使用）。 */
  defaultKey?: string
  /** 禁用时若需显式注入（如 enable_thinking: false），配置该字段。 */
  disabledInjection?: CapabilityInjection
}

/**
 * 模型能力总声明。
 * 当前覆盖联网与深度思考；后续新增能力（如代码执行、文件检索）按需扩展。
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

// ----------------------------------------------------------------------------
// 命名 handler 注册中心（custom injection 兜底）
// ----------------------------------------------------------------------------

export type CapabilityHandler = (
  upstreamFields: Record<string, unknown>,
  config: unknown,
) => Record<string, unknown>

const capabilityHandlers = new Map<string, CapabilityHandler>()

/** 注册命名 handler。重复注册会覆盖，便于热更新或测试。 */
export const registerCapabilityHandler = (name: string, handler: CapabilityHandler) => {
  capabilityHandlers.set(name, handler)
}

/** 查询已注册的 handler，未注册返回 undefined。 */
export const getCapabilityHandler = (name: string): CapabilityHandler | undefined =>
  capabilityHandlers.get(name)

// ----------------------------------------------------------------------------
// 注入算子（dispatch）
// ----------------------------------------------------------------------------

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** 把单条注入应用到 upstreamFields，返回新对象（不可变）。 */
const applyInjection = (
  upstreamFields: Record<string, unknown>,
  inj: CapabilityInjection | null | undefined,
): Record<string, unknown> => {
  // 防御：旧数据 / 空配置都直接跳过，避免运行时崩溃影响整条任务链路
  if (!inj || typeof inj !== 'object' || typeof (inj as { type?: unknown }).type !== 'string') {
    // eslint-disable-next-line no-console
    console.warn('[provider-capability] 注入配置缺失或非法，已跳过:', inj)
    return upstreamFields
  }

  switch (inj.type) {
    case 'set':
      return { ...upstreamFields, [inj.field]: inj.value }

    case 'append': {
      const existing = Array.isArray(upstreamFields[inj.field])
        ? (upstreamFields[inj.field] as unknown[])
        : []
      const incoming = Array.isArray(inj.value) ? inj.value : []
      return { ...upstreamFields, [inj.field]: [...existing, ...incoming] }
    }

    case 'merge-object': {
      const existing = isPlainObject(upstreamFields[inj.field])
        ? (upstreamFields[inj.field] as Record<string, unknown>)
        : {}
      const incoming = isPlainObject(inj.value) ? inj.value : {}
      return { ...upstreamFields, [inj.field]: { ...existing, ...incoming } }
    }

    case 'multi':
      return (Array.isArray(inj.injections) ? inj.injections : []).reduce(
        (acc, sub) => applyInjection(acc, sub),
        upstreamFields,
      )

    case 'custom': {
      const handler = capabilityHandlers.get(inj.handler)
      if (!handler) {
        // eslint-disable-next-line no-console
        console.warn('[provider-capability] custom handler 未注册:', inj.handler)
        return upstreamFields
      }
      const result = handler(upstreamFields, inj.config)
      return isPlainObject(result) ? result : upstreamFields
    }

    default: {
      // 兜底：未识别的注入类型直接跳过（运行时容错，避免脏数据破坏整体流程）
      // eslint-disable-next-line no-console
      console.warn('[provider-capability] 未识别的注入类型:', (inj as { type?: unknown }).type)
      return upstreamFields
    }
  }
}

// ----------------------------------------------------------------------------
// 公共 API
// ----------------------------------------------------------------------------

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
  let upstreamFields: Record<string, unknown> = {}
  const effectiveFlags: ModelCapabilityFlags = {}
  let billingMultiplier = 1

  if (!spec) {
    return { upstreamFields, billingMultiplier, effectiveFlags }
  }

  // 联网搜索
  if (spec.webSearch?.supported) {
    if (flags?.webSearch) {
      upstreamFields = applyInjection(upstreamFields, spec.webSearch.enabledInjection)
      effectiveFlags.webSearch = true
      const multiplier = spec.webSearch.billingMultiplier
      if (typeof multiplier === 'number' && multiplier > 0) {
        billingMultiplier *= multiplier
      }
    } else if (spec.webSearch.disabledInjection) {
      // 部分厂商需要显式发 false 才能关闭，否则可能继承上一次状态
      upstreamFields = applyInjection(upstreamFields, spec.webSearch.disabledInjection)
    }
  }

  // 深度思考
  if (
    spec.reasoning?.supported &&
    Array.isArray(spec.reasoning.options) &&
    spec.reasoning.options.length
  ) {
    const requestedKey = String(flags?.reasoning || '').trim()
    const option = requestedKey
      ? spec.reasoning.options.find(item => item.key === requestedKey)
      : null
    if (option) {
      upstreamFields = applyInjection(upstreamFields, option.injection)
      effectiveFlags.reasoning = option.key
      const multiplier = option.billingMultiplier
      if (typeof multiplier === 'number' && multiplier > 0) {
        billingMultiplier *= multiplier
      }
    } else if (spec.reasoning.disabledInjection) {
      upstreamFields = applyInjection(upstreamFields, spec.reasoning.disabledInjection)
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
