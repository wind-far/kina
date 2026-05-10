<script setup lang="ts">
// 模型能力编辑器：把 AiModel.capabilityJson 中的 webSearch / reasoning 两段嵌套配置
// 表单化，避免运维手写 JSON。
//
// 设计原则：
// - 仅负责 webSearch / reasoning 两段（与现有 supportsVision 等 flat flag 共存于同一 capabilityJson）
// - 对外通过 v-model 直接绑定整段 capabilityJson；内部按字段拆分
// - 启用注入策略选择器（set / append / merge-object / custom），覆盖单字段、tools 数组、嵌套对象、命名 handler 场景
// - 注入值用文本框配合 JSON 校验，校验失败时不写回父级，保留旧值并显示错误提示

import { computed, reactive, ref, watch } from 'vue'
import type {
  CapabilityInjection,
  ReasoningCapabilityOption,
  ReasoningCapabilitySpec,
  WebSearchCapabilitySpec,
} from '@/shared/provider-capability'

interface Props {
  /** 当前 capabilityJson（含 supportsVision 等其它字段；本组件只读写 webSearch / reasoning 子键） */
  modelValue: Record<string, any> | null | undefined
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
}>()

const isSyncingFromModel = ref(false)
const isEmitScheduled = ref(false)

// ----------------------------------------------------------------------------
// 注入草稿 + 厂商模板可表达的注入种类（multi 由模板内部组合，UI 不展开）
// ----------------------------------------------------------------------------

type InjectionFormType = 'set' | 'append' | 'merge-object' | 'custom'

interface InjectionDraft {
  type: InjectionFormType
  field: string
  valueText: string
  handlerName: string
  configText: string
}

const INJECTION_TYPE_OPTIONS: Array<{ value: InjectionFormType; label: string; hint: string }> = [
  { value: 'set', label: '单字段覆盖', hint: 'requestBody[字段] = 值' },
  { value: 'append', label: '数组追加', hint: 'tools 等数组场景' },
  { value: 'merge-object', label: '对象合并', hint: '嵌套对象浅合并' },
  { value: 'custom', label: '命名 handler', hint: '调用服务端注册的特殊逻辑' },
]

const createInjectionDraft = (): InjectionDraft => ({
  type: 'set',
  field: '',
  valueText: '',
  handlerName: '',
  configText: '',
})

// ----------------------------------------------------------------------------
// 工具
// ----------------------------------------------------------------------------

const readObject = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, any>
}

const stringifyJsonValue = (value: unknown) => {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

const parseJsonText = (text: string): { ok: true; value: unknown } | { ok: false; error: string } => {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    return { ok: true, value: undefined }
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '无法解析 JSON' }
  }
}

/**
 * 把 InjectionDraft 编译为 CapabilityInjection。
 * - 返回 null 表示草稿未填或字段不全（视为"无注入"）。
 * - 返回 { error } 表示 JSON 解析失败，调用方应阻断 emit 并展示错误。
 */
const compileInjection = (
  draft: InjectionDraft,
): { ok: true; injection: CapabilityInjection | null } | { ok: false; error: string } => {
  if (draft.type === 'custom') {
    if (!draft.handlerName.trim()) {
      return { ok: true, injection: null }
    }
    const configParsed = parseJsonText(draft.configText)
    if (!configParsed.ok) return { ok: false, error: configParsed.error }
    const inj: CapabilityInjection = { type: 'custom', handler: draft.handlerName.trim() }
    if (configParsed.value !== undefined) {
      ;(inj as { config: unknown }).config = configParsed.value
    }
    return { ok: true, injection: inj }
  }

  // set / append / merge-object 都需要 field + value
  if (!draft.field.trim() && !draft.valueText.trim()) {
    return { ok: true, injection: null }
  }

  const valueParsed = parseJsonText(draft.valueText)
  if (!valueParsed.ok) return { ok: false, error: valueParsed.error }
  if (!draft.field.trim()) {
    return { ok: false, error: '字段名不能为空' }
  }

  const field = draft.field.trim()
  if (draft.type === 'set') {
    return { ok: true, injection: { type: 'set', field, value: valueParsed.value } }
  }
  if (draft.type === 'append') {
    if (!Array.isArray(valueParsed.value)) {
      return { ok: false, error: '数组追加模式下值必须是 JSON 数组' }
    }
    return { ok: true, injection: { type: 'append', field, value: valueParsed.value } }
  }
  // merge-object
  if (!valueParsed.value || typeof valueParsed.value !== 'object' || Array.isArray(valueParsed.value)) {
    return { ok: false, error: '对象合并模式下值必须是 JSON 对象' }
  }
  return { ok: true, injection: { type: 'merge-object', field, value: valueParsed.value as Record<string, unknown> } }
}

/**
 * 把已存在的 CapabilityInjection 反向回填为 InjectionDraft，便于编辑回显。
 * multi 类型展平不可逆，UI 不直接编辑 multi（仅模板可生成）；这里把 multi 退化为 set 占位。
 */
const decompileInjection = (inj: CapabilityInjection | null | undefined): InjectionDraft => {
  const draft = createInjectionDraft()
  if (!inj || typeof inj !== 'object') return draft
  switch (inj.type) {
    case 'set':
      draft.type = 'set'
      draft.field = String(inj.field || '')
      draft.valueText = stringifyJsonValue(inj.value)
      return draft
    case 'append':
      draft.type = 'append'
      draft.field = String(inj.field || '')
      draft.valueText = stringifyJsonValue(inj.value)
      return draft
    case 'merge-object':
      draft.type = 'merge-object'
      draft.field = String(inj.field || '')
      draft.valueText = stringifyJsonValue(inj.value)
      return draft
    case 'custom':
      draft.type = 'custom'
      draft.handlerName = String(inj.handler || '')
      draft.configText = inj.config !== undefined ? stringifyJsonValue(inj.config) : ''
      return draft
    case 'multi':
      // 退化：UI 不展开嵌套结构；保留原始 JSON 让运维通过其它入口编辑
      draft.type = 'set'
      draft.field = ''
      draft.valueText = stringifyJsonValue(inj)
      return draft
    default:
      return draft
  }
}

// ----------------------------------------------------------------------------
// 表单状态
// ----------------------------------------------------------------------------

interface OptionDraft {
  key: string
  label: string
  description: string
  billingMultiplierText: string
  injection: InjectionDraft
}

interface CapabilityFormState {
  webSearchEnabled: boolean
  webSearchEnabledInjection: InjectionDraft
  webSearchUseDisabledInjection: boolean
  webSearchDisabledInjection: InjectionDraft
  webSearchBillingMultiplierText: string
  webSearchLabel: string
  webSearchDescription: string

  reasoningEnabled: boolean
  reasoningUseDisabledInjection: boolean
  reasoningDisabledInjection: InjectionDraft
  reasoningDefaultKey: string
  reasoningLabel: string
  reasoningDescription: string
  reasoningOptions: OptionDraft[]
}

const formState = reactive<CapabilityFormState>({
  webSearchEnabled: false,
  webSearchEnabledInjection: createInjectionDraft(),
  webSearchUseDisabledInjection: false,
  webSearchDisabledInjection: createInjectionDraft(),
  webSearchBillingMultiplierText: '',
  webSearchLabel: '',
  webSearchDescription: '',

  reasoningEnabled: false,
  reasoningUseDisabledInjection: false,
  reasoningDisabledInjection: createInjectionDraft(),
  reasoningDefaultKey: '',
  reasoningLabel: '',
  reasoningDescription: '',
  reasoningOptions: [],
})

const errors = reactive({
  webSearchEnabledInjection: '',
  webSearchDisabledInjection: '',
  reasoningDisabledInjection: '',
  optionInjectionErrors: {} as Record<number, string>,
})

const createOptionDraft = (): OptionDraft => ({
  key: '',
  label: '',
  description: '',
  billingMultiplierText: '',
  injection: createInjectionDraft(),
})

// ----------------------------------------------------------------------------
// 初始化：从 props.modelValue 反向回填
// ----------------------------------------------------------------------------

const reloadFromModelValue = () => {
  isSyncingFromModel.value = true
  try {
    const root = readObject(props.modelValue) || {}
    const webSearch = readObject(root.webSearch)
    const reasoning = readObject(root.reasoning)

    formState.webSearchEnabled = Boolean(webSearch?.supported)
    formState.webSearchEnabledInjection = decompileInjection(webSearch?.enabledInjection as CapabilityInjection | undefined)
    const disabledInj = webSearch?.disabledInjection as CapabilityInjection | undefined
    formState.webSearchUseDisabledInjection = Boolean(disabledInj)
    formState.webSearchDisabledInjection = decompileInjection(disabledInj)
    formState.webSearchBillingMultiplierText = webSearch?.billingMultiplier !== undefined ? String(webSearch.billingMultiplier) : ''
    formState.webSearchLabel = String(webSearch?.label || '')
    formState.webSearchDescription = String(webSearch?.description || '')

    formState.reasoningEnabled = Boolean(reasoning?.supported)
    const reasoningDisabledInj = reasoning?.disabledInjection as CapabilityInjection | undefined
    formState.reasoningUseDisabledInjection = Boolean(reasoningDisabledInj)
    formState.reasoningDisabledInjection = decompileInjection(reasoningDisabledInj)
    formState.reasoningDefaultKey = String(reasoning?.defaultKey || '')
    formState.reasoningLabel = String(reasoning?.label || '')
    formState.reasoningDescription = String(reasoning?.description || '')
    const incomingOptions = Array.isArray(reasoning?.options) ? reasoning!.options : []
    formState.reasoningOptions = incomingOptions
      .filter((item: any) => item && typeof item === 'object')
      .map((item: any) => ({
        key: String(item.key || ''),
        label: String(item.label || ''),
        description: String(item.description || ''),
        billingMultiplierText: item.billingMultiplier !== undefined ? String(item.billingMultiplier) : '',
        injection: decompileInjection(item.injection as CapabilityInjection | undefined),
      }))

    errors.webSearchEnabledInjection = ''
    errors.webSearchDisabledInjection = ''
    errors.reasoningDisabledInjection = ''
    errors.optionInjectionErrors = {}
  } finally {
    isSyncingFromModel.value = false
  }
}

watch(() => props.modelValue, reloadFromModelValue, { immediate: true, deep: true })

// ----------------------------------------------------------------------------
// 提交：把 form 拼装成 capabilityJson 并触发 emit
// 任意 JSON 解析失败时阻断 emit，保留父级原值
// ----------------------------------------------------------------------------

const emitUpdate = () => {
  if (isSyncingFromModel.value) {
    return
  }
  const baseRoot = { ...(readObject(props.modelValue) || {}) }

  // ----- webSearch 段 -----
  let nextWebSearch: WebSearchCapabilitySpec | undefined
  const hasWebSearchInput = formState.webSearchEnabled
    || formState.webSearchEnabledInjection.field
    || formState.webSearchEnabledInjection.valueText
    || formState.webSearchEnabledInjection.handlerName
    || formState.webSearchUseDisabledInjection
    || formState.webSearchDisabledInjection.field
    || formState.webSearchDisabledInjection.valueText
    || formState.webSearchDisabledInjection.handlerName
    || formState.webSearchBillingMultiplierText.trim()
    || formState.webSearchLabel.trim()
    || formState.webSearchDescription.trim()
  if (hasWebSearchInput) {
    const enabledCompiled = compileInjection(formState.webSearchEnabledInjection)
    if (!enabledCompiled.ok) {
      errors.webSearchEnabledInjection = enabledCompiled.error
      return
    }
    errors.webSearchEnabledInjection = ''

    let disabledInjection: CapabilityInjection | null = null
    if (formState.webSearchUseDisabledInjection) {
      const disabledCompiled = compileInjection(formState.webSearchDisabledInjection)
      if (!disabledCompiled.ok) {
        errors.webSearchDisabledInjection = disabledCompiled.error
        return
      }
      if (!disabledCompiled.injection) {
        errors.webSearchDisabledInjection = '已开启“禁用时也注入”，请完整填写关闭注入配置'
        return
      }
      errors.webSearchDisabledInjection = ''
      disabledInjection = disabledCompiled.injection
    } else {
      errors.webSearchDisabledInjection = ''
    }

    if (enabledCompiled.injection) {
      nextWebSearch = {
        supported: Boolean(formState.webSearchEnabled),
        enabledInjection: enabledCompiled.injection,
      }
      if (disabledInjection) nextWebSearch.disabledInjection = disabledInjection
      const billingMultiplier = Number(formState.webSearchBillingMultiplierText)
      if (Number.isFinite(billingMultiplier) && billingMultiplier > 0) {
        nextWebSearch.billingMultiplier = billingMultiplier
      }
      if (formState.webSearchLabel.trim()) nextWebSearch.label = formState.webSearchLabel.trim()
      if (formState.webSearchDescription.trim()) nextWebSearch.description = formState.webSearchDescription.trim()
    }
  }

  // ----- reasoning 段 -----
  let nextReasoning: ReasoningCapabilitySpec | undefined
  const optionDrafts = formState.reasoningOptions
  const hasAnyOptionInput = optionDrafts.some(item => (
    item.key.trim() || item.label.trim() || item.injection.field || item.injection.valueText || item.injection.handlerName
  ))
  const hasReasoningInput = formState.reasoningEnabled
    || formState.reasoningUseDisabledInjection
    || formState.reasoningDisabledInjection.field
    || formState.reasoningDisabledInjection.valueText
    || formState.reasoningDisabledInjection.handlerName
    || formState.reasoningDefaultKey.trim()
    || formState.reasoningLabel.trim()
    || formState.reasoningDescription.trim()
    || hasAnyOptionInput
  if (hasReasoningInput) {
    const optionList: ReasoningCapabilityOption[] = []
    let optionParseFailed = false
    optionDrafts.forEach((item, index) => {
      const compiled = compileInjection(item.injection)
      if (!compiled.ok) {
        errors.optionInjectionErrors[index] = compiled.error
        optionParseFailed = true
        return
      }
      delete errors.optionInjectionErrors[index]

      // 没有有效注入则跳过该选项
      if (!compiled.injection) return

      const next: ReasoningCapabilityOption = {
        key: item.key.trim(),
        label: item.label.trim(),
        injection: compiled.injection,
      }
      const optionMultiplier = Number(item.billingMultiplierText)
      if (Number.isFinite(optionMultiplier) && optionMultiplier > 0) {
        next.billingMultiplier = optionMultiplier
      }
      if (item.description.trim()) next.description = item.description.trim()
      optionList.push(next)
    })
    if (optionParseFailed) return

    nextReasoning = {
      supported: Boolean(formState.reasoningEnabled),
      options: optionList,
    }
    if (formState.reasoningUseDisabledInjection) {
      const disabledCompiled = compileInjection(formState.reasoningDisabledInjection)
      if (!disabledCompiled.ok) {
        errors.reasoningDisabledInjection = disabledCompiled.error
        return
      }
      if (!disabledCompiled.injection) {
        errors.reasoningDisabledInjection = '已开启“禁用时也注入”，请完整填写关闭注入配置'
        return
      }
      errors.reasoningDisabledInjection = ''
      nextReasoning.disabledInjection = disabledCompiled.injection
    } else {
      errors.reasoningDisabledInjection = ''
    }
    if (formState.reasoningDefaultKey.trim()) nextReasoning.defaultKey = formState.reasoningDefaultKey.trim()
    if (formState.reasoningLabel.trim()) nextReasoning.label = formState.reasoningLabel.trim()
    if (formState.reasoningDescription.trim()) nextReasoning.description = formState.reasoningDescription.trim()
  }

  if (nextWebSearch) {
    baseRoot.webSearch = nextWebSearch
  } else {
    delete baseRoot.webSearch
  }
  if (nextReasoning) {
    baseRoot.reasoning = nextReasoning
  } else {
    delete baseRoot.reasoning
  }

  const currentSerialized = JSON.stringify(props.modelValue || {})
  const nextSerialized = JSON.stringify(baseRoot)
  if (currentSerialized === nextSerialized) {
    return
  }

  emit('update:modelValue', baseRoot)
}

const scheduleEmitUpdate = () => {
  if (isSyncingFromModel.value || isEmitScheduled.value) {
    return
  }
  isEmitScheduled.value = true
  queueMicrotask(() => {
    isEmitScheduled.value = false
    emitUpdate()
  })
}

watch(formState, () => scheduleEmitUpdate(), { deep: true, flush: 'post' })

// ----------------------------------------------------------------------------
// 选项操作
// ----------------------------------------------------------------------------

const addReasoningOption = () => {
  formState.reasoningOptions.push(createOptionDraft())
}

const removeReasoningOption = (index: number) => {
  formState.reasoningOptions.splice(index, 1)
  delete errors.optionInjectionErrors[index]
}

// ----------------------------------------------------------------------------
// 厂商模板
// ----------------------------------------------------------------------------

const draftFromInjection = (inj: CapabilityInjection): InjectionDraft => decompileInjection(inj)

const buildReasoningDisabledInjectionDraft = (
  options: OptionDraft[],
): InjectionDraft => {
  const firstDraft = options.find(item => item?.injection)?.injection
  if (!firstDraft) {
    return draftFromInjection({ type: 'set', field: 'enable_thinking', value: false })
  }

  const compiled = compileInjection(firstDraft)
  if (!compiled.ok || !compiled.injection) {
    return draftFromInjection({ type: 'set', field: 'enable_thinking', value: false })
  }

  if (compiled.injection.type === 'set') {
    const field = String(compiled.injection.field || '').trim()
    let value: unknown = false

    if (compiled.injection.value === true) {
      value = false
    } else if (field === 'thinking') {
      value = { type: 'disabled' }
    } else if (field === 'thinkingConfig') {
      value = { thinkingBudget: 0 }
    } else if (field === 'reasoning_effort') {
      value = ''
    } else if (compiled.injection.value && typeof compiled.injection.value === 'object' && !Array.isArray(compiled.injection.value)) {
      value = {}
    }

    return draftFromInjection({ type: 'set', field, value })
  }

  return draftFromInjection({ type: 'set', field: 'enable_thinking', value: false })
}

const presetSamples: Array<{ name: string; apply: () => void }> = [
  {
    name: 'OpenAI 系列',
    apply: () => {
      formState.webSearchEnabled = true
      formState.webSearchEnabledInjection = draftFromInjection({
        type: 'set',
        field: 'web_search_options',
        value: {},
      })
      formState.webSearchUseDisabledInjection = false
      formState.webSearchDisabledInjection = createInjectionDraft()
      formState.webSearchBillingMultiplierText = '1.5'
      formState.reasoningEnabled = true
      formState.reasoningUseDisabledInjection = false
      formState.reasoningDisabledInjection = createInjectionDraft()
      formState.reasoningOptions = [
        { key: 'low', label: '低', description: '', billingMultiplierText: '1.5', injection: draftFromInjection({ type: 'set', field: 'reasoning_effort', value: 'low' }) },
        { key: 'medium', label: '中', description: '', billingMultiplierText: '2', injection: draftFromInjection({ type: 'set', field: 'reasoning_effort', value: 'medium' }) },
        { key: 'high', label: '高', description: '', billingMultiplierText: '3', injection: draftFromInjection({ type: 'set', field: 'reasoning_effort', value: 'high' }) },
      ]
      formState.reasoningDefaultKey = 'medium'
    },
  },
  {
    name: '阿里通义 / DashScope',
    apply: () => {
      formState.webSearchEnabled = true
      formState.webSearchEnabledInjection = draftFromInjection({ type: 'set', field: 'enable_search', value: true })
      formState.webSearchUseDisabledInjection = true
      formState.webSearchDisabledInjection = draftFromInjection({ type: 'set', field: 'enable_search', value: false })
      formState.webSearchBillingMultiplierText = '1.3'
      formState.reasoningEnabled = true
      formState.reasoningUseDisabledInjection = true
      formState.reasoningOptions = [
        { key: 'on', label: '开启', description: '', billingMultiplierText: '2', injection: draftFromInjection({ type: 'set', field: 'enable_thinking', value: true }) },
      ]
      formState.reasoningDisabledInjection = buildReasoningDisabledInjectionDraft(formState.reasoningOptions)
      formState.reasoningDefaultKey = ''
    },
  },
  {
    name: 'Anthropic Claude',
    apply: () => {
      formState.webSearchEnabled = true
      formState.webSearchEnabledInjection = draftFromInjection({
        type: 'append',
        field: 'tools',
        value: [{ type: 'web_search_20250305', name: 'web_search' }],
      })
      formState.webSearchUseDisabledInjection = false
      formState.webSearchDisabledInjection = createInjectionDraft()
      formState.webSearchBillingMultiplierText = '1.5'
      formState.reasoningEnabled = true
      formState.reasoningUseDisabledInjection = true
      formState.reasoningOptions = [
        { key: 'standard', label: '标准', description: '', billingMultiplierText: '2', injection: draftFromInjection({ type: 'set', field: 'thinking', value: { type: 'enabled', budget_tokens: 4096 } }) },
        { key: 'extended', label: '扩展', description: '', billingMultiplierText: '3.5', injection: draftFromInjection({ type: 'set', field: 'thinking', value: { type: 'enabled', budget_tokens: 16000 } }) },
      ]
      formState.reasoningDisabledInjection = buildReasoningDisabledInjectionDraft(formState.reasoningOptions)
      formState.reasoningDefaultKey = 'standard'
    },
  },
  {
    name: 'Google Gemini',
    apply: () => {
      formState.webSearchEnabled = true
      formState.webSearchEnabledInjection = draftFromInjection({
        type: 'append',
        field: 'tools',
        value: [{ googleSearch: {} }],
      })
      formState.webSearchUseDisabledInjection = false
      formState.webSearchDisabledInjection = createInjectionDraft()
      formState.webSearchBillingMultiplierText = '1.3'
      formState.reasoningEnabled = true
      formState.reasoningUseDisabledInjection = true
      formState.reasoningOptions = [
        { key: 'auto', label: '自动', description: '由模型自行决定思考预算', billingMultiplierText: '2', injection: draftFromInjection({ type: 'set', field: 'thinkingConfig', value: { thinkingBudget: -1 } }) },
        { key: 'low', label: '低', description: '', billingMultiplierText: '1.5', injection: draftFromInjection({ type: 'set', field: 'thinkingConfig', value: { thinkingBudget: 1024 } }) },
        { key: 'high', label: '高', description: '', billingMultiplierText: '3', injection: draftFromInjection({ type: 'set', field: 'thinkingConfig', value: { thinkingBudget: 16000 } }) },
      ]
      formState.reasoningDisabledInjection = buildReasoningDisabledInjectionDraft(formState.reasoningOptions)
      formState.reasoningDefaultKey = 'auto'
    },
  },
  {
    name: '智谱 GLM',
    apply: () => {
      formState.webSearchEnabled = true
      formState.webSearchEnabledInjection = draftFromInjection({
        type: 'append',
        field: 'tools',
        value: [{ type: 'web_search', web_search: { enable: true } }],
      })
      formState.webSearchUseDisabledInjection = false
      formState.webSearchDisabledInjection = createInjectionDraft()
      formState.webSearchBillingMultiplierText = '1.3'
      formState.reasoningEnabled = true
      formState.reasoningUseDisabledInjection = true
      formState.reasoningOptions = [
        { key: 'on', label: '开启', description: '', billingMultiplierText: '2', injection: draftFromInjection({ type: 'set', field: 'thinking', value: { type: 'enabled' } }) },
      ]
      formState.reasoningDisabledInjection = buildReasoningDisabledInjectionDraft(formState.reasoningOptions)
      formState.reasoningDefaultKey = ''
    },
  },
]

const applyPreset = (preset: typeof presetSamples[number]) => {
  preset.apply()
}

const clearWebSearch = () => {
  formState.webSearchEnabled = false
  formState.webSearchEnabledInjection = createInjectionDraft()
  formState.webSearchUseDisabledInjection = false
  formState.webSearchDisabledInjection = createInjectionDraft()
  formState.webSearchBillingMultiplierText = ''
  formState.webSearchLabel = ''
  formState.webSearchDescription = ''
}

const clearReasoning = () => {
  formState.reasoningEnabled = false
  formState.reasoningUseDisabledInjection = false
  formState.reasoningDisabledInjection = createInjectionDraft()
  formState.reasoningDefaultKey = ''
  formState.reasoningLabel = ''
  formState.reasoningDescription = ''
  formState.reasoningOptions = []
  errors.reasoningDisabledInjection = ''
  errors.optionInjectionErrors = {}
}

watch(
  () => formState.reasoningUseDisabledInjection,
  (enabled) => {
    if (!enabled) return
    const draft = formState.reasoningDisabledInjection
    const hasAnyValue = draft.field.trim() || draft.valueText.trim() || draft.handlerName.trim() || draft.configText.trim()
    if (!hasAnyValue) {
      formState.reasoningDisabledInjection = buildReasoningDisabledInjectionDraft(formState.reasoningOptions)
    }
  },
)

// ----------------------------------------------------------------------------
// 视图辅助
// ----------------------------------------------------------------------------

const hasWebSearchInput = computed(() => (
  formState.webSearchEnabled
  || formState.webSearchEnabledInjection.field
  || formState.webSearchEnabledInjection.valueText
  || formState.webSearchEnabledInjection.handlerName
))

const hasReasoningInput = computed(() => (
  formState.reasoningEnabled
  || formState.reasoningUseDisabledInjection
  || formState.reasoningOptions.length > 0
))

const isCustomType = (type: InjectionFormType) => type === 'custom'

const valuePlaceholder = (type: InjectionFormType) => {
  switch (type) {
    case 'set': return '例如 {} / true / "high"'
    case 'append': return '例如 [{ "googleSearch": {} }]'
    case 'merge-object': return '例如 { "thinkingBudget": 1024 }'
    case 'custom': return ''
  }
}
</script>

<template>
  <div class="capability-editor">
    <div class="capability-editor__header">
      <div class="capability-editor__title">扩展能力（联网搜索 / 深度思考）</div>
      <div class="capability-editor__presets">
        <span class="capability-editor__hint">快速模板：</span>
        <button v-for="preset in presetSamples"
                :key="preset.name"
                type="button"
                class="admin-inline-button"
                @click="applyPreset(preset)">
          {{ preset.name }}
        </button>
      </div>
    </div>

    <!-- 联网搜索 -->
    <fieldset class="capability-editor__section">
      <legend class="capability-editor__section-title">
        <label class="admin-check-item admin-check-item--switch">
          <input v-model="formState.webSearchEnabled" type="checkbox">
          <span>启用联网搜索</span>
        </label>
        <button v-if="hasWebSearchInput" type="button" class="admin-inline-button admin-inline-button--ghost" @click="clearWebSearch">
          清空
        </button>
      </legend>

      <div class="capability-editor__subsection">
        <div class="capability-editor__subsection-title">启用时的注入</div>
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">注入模式</label>
            <select v-model="formState.webSearchEnabledInjection.type" class="admin-input">
              <option v-for="opt in INJECTION_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="admin-form__hint">{{ INJECTION_TYPE_OPTIONS.find(o => o.value === formState.webSearchEnabledInjection.type)?.hint }}</div>
          </div>

          <template v-if="!isCustomType(formState.webSearchEnabledInjection.type)">
            <div class="admin-form__field">
              <label class="admin-form__label">字段名 <span class="capability-editor__required">*</span></label>
              <input v-model.trim="formState.webSearchEnabledInjection.field" class="admin-input" type="text" placeholder="如 web_search_options / tools / enable_search">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">字段值（JSON）<span class="capability-editor__required">*</span></label>
              <textarea v-model="formState.webSearchEnabledInjection.valueText" class="admin-textarea capability-editor__json" rows="3" :placeholder="valuePlaceholder(formState.webSearchEnabledInjection.type)"></textarea>
              <div v-if="errors.webSearchEnabledInjection" class="admin-form__hint admin-form__hint--error">{{ errors.webSearchEnabledInjection }}</div>
            </div>
          </template>

          <template v-else>
            <div class="admin-form__field">
              <label class="admin-form__label">handler 名 <span class="capability-editor__required">*</span></label>
              <input v-model.trim="formState.webSearchEnabledInjection.handlerName" class="admin-input" type="text" placeholder="服务端已注册的 handler">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">配置（JSON，可选）</label>
              <textarea v-model="formState.webSearchEnabledInjection.configText" class="admin-textarea capability-editor__json" rows="2" placeholder="透传给 handler 的参数"></textarea>
              <div v-if="errors.webSearchEnabledInjection" class="admin-form__hint admin-form__hint--error">{{ errors.webSearchEnabledInjection }}</div>
            </div>
          </template>
        </div>
      </div>

      <div class="capability-editor__subsection">
        <label class="admin-check-item admin-check-item--switch capability-editor__subsection-title">
          <input v-model="formState.webSearchUseDisabledInjection" type="checkbox">
          <span>禁用时也注入（部分厂商需要显式 false）</span>
        </label>
        <div v-if="formState.webSearchUseDisabledInjection" class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">注入模式</label>
            <select v-model="formState.webSearchDisabledInjection.type" class="admin-input">
              <option v-for="opt in INJECTION_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <template v-if="!isCustomType(formState.webSearchDisabledInjection.type)">
            <div class="admin-form__field">
              <label class="admin-form__label">字段名</label>
              <input v-model.trim="formState.webSearchDisabledInjection.field" class="admin-input" type="text">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">字段值（JSON）</label>
              <textarea v-model="formState.webSearchDisabledInjection.valueText" class="admin-textarea capability-editor__json" rows="2" :placeholder="valuePlaceholder(formState.webSearchDisabledInjection.type)"></textarea>
              <div v-if="errors.webSearchDisabledInjection" class="admin-form__hint admin-form__hint--error">{{ errors.webSearchDisabledInjection }}</div>
            </div>
          </template>
          <template v-else>
            <div class="admin-form__field">
              <label class="admin-form__label">handler 名</label>
              <input v-model.trim="formState.webSearchDisabledInjection.handlerName" class="admin-input" type="text">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">配置（JSON，可选）</label>
              <textarea v-model="formState.webSearchDisabledInjection.configText" class="admin-textarea capability-editor__json" rows="2"></textarea>
              <div v-if="errors.webSearchDisabledInjection" class="admin-form__hint admin-form__hint--error">{{ errors.webSearchDisabledInjection }}</div>
            </div>
          </template>
        </div>
      </div>

      <div class="admin-form__grid">
        <div class="admin-form__field">
          <label class="admin-form__label">计费倍率</label>
          <input v-model.trim="formState.webSearchBillingMultiplierText" class="admin-input" type="number" min="0" step="0.1" placeholder="例如 1.5（默认 1）">
        </div>
        <div class="admin-form__field">
          <label class="admin-form__label">UI 显示标签（可选）</label>
          <input v-model.trim="formState.webSearchLabel" class="admin-input" type="text" placeholder="默认 联网搜索">
        </div>
        <div class="admin-form__field admin-form__field--full">
          <label class="admin-form__label">描述（可选）</label>
          <input v-model.trim="formState.webSearchDescription" class="admin-input" type="text" placeholder="鼠标悬停时显示，可解释费用">
        </div>
      </div>
    </fieldset>

    <!-- 深度思考 -->
    <fieldset class="capability-editor__section">
      <legend class="capability-editor__section-title">
        <label class="admin-check-item admin-check-item--switch">
          <input v-model="formState.reasoningEnabled" type="checkbox">
          <span>启用深度思考</span>
        </label>
        <button v-if="hasReasoningInput" type="button" class="admin-inline-button admin-inline-button--ghost" @click="clearReasoning">
          清空
        </button>
      </legend>

      <div class="admin-form__grid">
        <div class="admin-form__field">
          <label class="admin-form__label">默认选项 key（可选）</label>
          <input v-model.trim="formState.reasoningDefaultKey" class="admin-input" type="text" placeholder="如 medium">
        </div>
        <div class="admin-form__field">
          <label class="admin-form__label">UI 标签（可选）</label>
          <input v-model.trim="formState.reasoningLabel" class="admin-input" type="text" placeholder="默认 深度思考">
        </div>
        <div class="admin-form__field admin-form__field--full">
          <label class="admin-form__label">描述（可选）</label>
          <input v-model.trim="formState.reasoningDescription" class="admin-input" type="text" placeholder="解释思考能力的影响">
        </div>
      </div>

      <div class="capability-editor__subsection">
        <label class="admin-check-item admin-check-item--switch capability-editor__subsection-title">
          <input v-model="formState.reasoningUseDisabledInjection" type="checkbox">
          <span>禁用时也注入（需要显式关闭思考时开启）</span>
        </label>
        <div v-if="formState.reasoningUseDisabledInjection" class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">注入模式</label>
            <select v-model="formState.reasoningDisabledInjection.type" class="admin-input">
              <option v-for="opt in INJECTION_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <template v-if="!isCustomType(formState.reasoningDisabledInjection.type)">
            <div class="admin-form__field">
              <label class="admin-form__label">字段名</label>
              <input v-model.trim="formState.reasoningDisabledInjection.field" class="admin-input" type="text" placeholder="如 enable_thinking / thinking">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">字段值（JSON）</label>
              <textarea v-model="formState.reasoningDisabledInjection.valueText" class="admin-textarea capability-editor__json" rows="2" :placeholder="valuePlaceholder(formState.reasoningDisabledInjection.type)"></textarea>
              <div v-if="errors.reasoningDisabledInjection" class="admin-form__hint admin-form__hint--error">{{ errors.reasoningDisabledInjection }}</div>
            </div>
          </template>
          <template v-else>
            <div class="admin-form__field">
              <label class="admin-form__label">handler 名</label>
              <input v-model.trim="formState.reasoningDisabledInjection.handlerName" class="admin-input" type="text">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">配置（JSON，可选）</label>
              <textarea v-model="formState.reasoningDisabledInjection.configText" class="admin-textarea capability-editor__json" rows="2"></textarea>
              <div v-if="errors.reasoningDisabledInjection" class="admin-form__hint admin-form__hint--error">{{ errors.reasoningDisabledInjection }}</div>
            </div>
          </template>
        </div>
      </div>

      <div class="capability-editor__options">
        <div class="capability-editor__options-header">
          <span class="capability-editor__options-title">思考等级 / 选项</span>
          <button type="button" class="admin-inline-button" @click="addReasoningOption">+ 添加选项</button>
        </div>

        <div v-if="!formState.reasoningOptions.length" class="capability-editor__empty">
          至少添加一个选项才能让前端展示。仅有"开关"语义时也建议加一个选项（如 key=on）。
        </div>

        <div v-for="(option, index) in formState.reasoningOptions" :key="index" class="capability-editor__option">
          <div class="capability-editor__option-head">
            <span class="capability-editor__option-index">#{{ index + 1 }}</span>
            <button type="button" class="admin-inline-button admin-inline-button--danger" @click="removeReasoningOption(index)">删除</button>
          </div>
          <div class="admin-form__grid capability-editor__option-grid">
            <div class="admin-form__field">
              <label class="admin-form__label">key <span class="capability-editor__required">*</span></label>
              <input v-model.trim="option.key" class="admin-input" type="text" placeholder="如 low / medium / high">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">展示名 <span class="capability-editor__required">*</span></label>
              <input v-model.trim="option.label" class="admin-input" type="text" placeholder="如 低 / 中 / 高">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">计费倍率</label>
              <input v-model.trim="option.billingMultiplierText" class="admin-input" type="number" min="0" step="0.1" placeholder="如 1.5">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">注入模式</label>
              <select v-model="option.injection.type" class="admin-input">
                <option v-for="opt in INJECTION_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <template v-if="!isCustomType(option.injection.type)">
              <div class="admin-form__field">
                <label class="admin-form__label">字段名 <span class="capability-editor__required">*</span></label>
                <input v-model.trim="option.injection.field" class="admin-input" type="text" placeholder="如 reasoning_effort / thinking">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label">字段值（JSON）<span class="capability-editor__required">*</span></label>
                <textarea v-model="option.injection.valueText" class="admin-textarea capability-editor__json" rows="2" :placeholder="valuePlaceholder(option.injection.type)"></textarea>
                <div v-if="errors.optionInjectionErrors[index]" class="admin-form__hint admin-form__hint--error">{{ errors.optionInjectionErrors[index] }}</div>
              </div>
            </template>
            <template v-else>
              <div class="admin-form__field">
                <label class="admin-form__label">handler 名 <span class="capability-editor__required">*</span></label>
                <input v-model.trim="option.injection.handlerName" class="admin-input" type="text" placeholder="服务端已注册的 handler">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label">配置（JSON，可选）</label>
                <textarea v-model="option.injection.configText" class="admin-textarea capability-editor__json" rows="2" placeholder="透传给 handler 的参数"></textarea>
                <div v-if="errors.optionInjectionErrors[index]" class="admin-form__hint admin-form__hint--error">{{ errors.optionInjectionErrors[index] }}</div>
              </div>
            </template>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">描述（可选）</label>
              <input v-model.trim="option.description" class="admin-input" type="text" placeholder="选项副标题">
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.capability-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-block-secondary-default, rgba(15, 23, 42, 0.04));
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 8px;
}

.capability-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.capability-editor__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.capability-editor__presets {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.capability-editor__hint {
  color: var(--text-tertiary, #6b7280);
  font-size: 12px;
}

.capability-editor__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 6px;
  background: var(--bg-surface, #ffffff);
}

.capability-editor__section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
  font-size: 13px;
  color: var(--text-primary, #1f2937);
}

.capability-editor__subsection {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-block-secondary-default, #f9fafb);
  border-radius: 6px;
}

.capability-editor__subsection-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #4b5563);
}

.capability-editor__required {
  color: var(--brand-error, #ef4444);
  margin-left: 2px;
}

.capability-editor__json {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.capability-editor__options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.capability-editor__options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.capability-editor__options-title {
  font-size: 13px;
  color: var(--text-primary, #1f2937);
  font-weight: 500;
}

.capability-editor__empty {
  padding: 8px 10px;
  color: var(--text-tertiary, #6b7280);
  font-size: 12px;
  background: var(--bg-block-secondary-default, #f9fafb);
  border-radius: 4px;
}

.capability-editor__option {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-block-secondary-default, #f9fafb);
  border-radius: 4px;
}

.capability-editor__option-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.capability-editor__option-index {
  font-size: 12px;
  color: var(--text-tertiary, #6b7280);
  font-weight: 500;
}
</style>
