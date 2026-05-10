<script setup lang="ts">
// 模型能力编辑器：把 AiModel.capabilityJson 中的 webSearch / reasoning 两段嵌套配置
// 表单化，避免运维手写 JSON。
//
// 设计原则：
// - 仅负责 webSearch / reasoning 两段（与现有 supportsVision 等 flat flag 共存于同一 capabilityJson）
// - 对外通过 v-model 直接绑定整段 capabilityJson；内部按字段拆分
// - requestValue / option.value 是任意 JSON 值，用文本框配合 JSON 校验，避免限制结构
// - 校验失败时不写回父级，保留旧值并显示错误提示

import { computed, reactive, watch } from 'vue'
import type {
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

// 容错读取嵌套对象
const readObject = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, any>
}

// 通用 JSON 字符串化（用于把 unknown 值显示为可编辑文本）
const stringifyJsonValue = (value: unknown) => {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

// 容错解析 JSON 文本，失败返回 { ok:false }
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

// 表单中间态：所有可输入字段都用字符串承载，提交时再转回结构化值。
interface OptionDraft {
  key: string
  label: string
  valueText: string
  billingMultiplierText: string
  description: string
}

interface CapabilityFormState {
  webSearchEnabled: boolean
  webSearchRequestField: string
  webSearchRequestValueText: string
  webSearchDisabledValueText: string
  webSearchBillingMultiplierText: string
  webSearchLabel: string
  webSearchDescription: string

  reasoningEnabled: boolean
  reasoningRequestField: string
  reasoningDefaultKey: string
  reasoningLabel: string
  reasoningDescription: string
  reasoningOptions: OptionDraft[]
}

const formState = reactive<CapabilityFormState>({
  webSearchEnabled: false,
  webSearchRequestField: '',
  webSearchRequestValueText: '',
  webSearchDisabledValueText: '',
  webSearchBillingMultiplierText: '',
  webSearchLabel: '',
  webSearchDescription: '',

  reasoningEnabled: false,
  reasoningRequestField: '',
  reasoningDefaultKey: '',
  reasoningLabel: '',
  reasoningDescription: '',
  reasoningOptions: [],
})

const errors = reactive({
  webSearchRequestValue: '',
  webSearchDisabledValue: '',
  optionValueErrors: {} as Record<number, string>,
})

// 初始化：从 props.modelValue 读取 webSearch / reasoning 段，回填到 form
const reloadFromModelValue = () => {
  const root = readObject(props.modelValue) || {}
  const webSearch = readObject(root.webSearch)
  const reasoning = readObject(root.reasoning)

  formState.webSearchEnabled = Boolean(webSearch?.supported)
  formState.webSearchRequestField = String(webSearch?.requestField || '')
  formState.webSearchRequestValueText = stringifyJsonValue(webSearch?.requestValue)
  formState.webSearchDisabledValueText = webSearch?.disabledValue !== undefined ? stringifyJsonValue(webSearch.disabledValue) : ''
  formState.webSearchBillingMultiplierText = webSearch?.billingMultiplier !== undefined ? String(webSearch.billingMultiplier) : ''
  formState.webSearchLabel = String(webSearch?.label || '')
  formState.webSearchDescription = String(webSearch?.description || '')

  formState.reasoningEnabled = Boolean(reasoning?.supported)
  formState.reasoningRequestField = String(reasoning?.requestField || '')
  formState.reasoningDefaultKey = String(reasoning?.defaultKey || '')
  formState.reasoningLabel = String(reasoning?.label || '')
  formState.reasoningDescription = String(reasoning?.description || '')
  const incomingOptions = Array.isArray(reasoning?.options) ? reasoning!.options : []
  formState.reasoningOptions = incomingOptions
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any) => ({
      key: String(item.key || ''),
      label: String(item.label || ''),
      valueText: stringifyJsonValue(item.value),
      billingMultiplierText: item.billingMultiplier !== undefined ? String(item.billingMultiplier) : '',
      description: String(item.description || ''),
    }))

  errors.webSearchRequestValue = ''
  errors.webSearchDisabledValue = ''
  errors.optionValueErrors = {}
}

watch(() => props.modelValue, reloadFromModelValue, { immediate: true, deep: true })

// 把 form 拼装成 capabilityJson，并触发 emit；any JSON 解析错误期间保留父级原值。
const emitUpdate = () => {
  const baseRoot = { ...(readObject(props.modelValue) || {}) }
  // webSearch 段
  let nextWebSearch: WebSearchCapabilitySpec | undefined
  if (formState.webSearchEnabled || formState.webSearchRequestField || formState.webSearchRequestValueText) {
    const requestValueParsed = parseJsonText(formState.webSearchRequestValueText)
    if (!requestValueParsed.ok) {
      errors.webSearchRequestValue = requestValueParsed.error
      return
    }
    errors.webSearchRequestValue = ''

    const disabledValueParsed = parseJsonText(formState.webSearchDisabledValueText)
    if (!disabledValueParsed.ok) {
      errors.webSearchDisabledValue = disabledValueParsed.error
      return
    }
    errors.webSearchDisabledValue = ''

    nextWebSearch = {
      supported: Boolean(formState.webSearchEnabled),
      requestField: formState.webSearchRequestField.trim(),
      requestValue: requestValueParsed.value === undefined ? {} : requestValueParsed.value,
    }
    if (disabledValueParsed.value !== undefined) {
      nextWebSearch.disabledValue = disabledValueParsed.value
    }
    const billingMultiplier = Number(formState.webSearchBillingMultiplierText)
    if (Number.isFinite(billingMultiplier) && billingMultiplier > 0) {
      nextWebSearch.billingMultiplier = billingMultiplier
    }
    if (formState.webSearchLabel.trim()) nextWebSearch.label = formState.webSearchLabel.trim()
    if (formState.webSearchDescription.trim()) nextWebSearch.description = formState.webSearchDescription.trim()
  }

  // reasoning 段
  let nextReasoning: ReasoningCapabilitySpec | undefined
  const optionDrafts = formState.reasoningOptions
  const hasAnyOptionInput = optionDrafts.some(item => (
    item.key.trim() || item.label.trim() || item.valueText.trim()
  ))
  if (formState.reasoningEnabled || formState.reasoningRequestField || hasAnyOptionInput) {
    const optionList: ReasoningCapabilityOption[] = []
    let optionParseFailed = false
    optionDrafts.forEach((item, index) => {
      const valueParsed = parseJsonText(item.valueText)
      if (!valueParsed.ok) {
        errors.optionValueErrors[index] = valueParsed.error
        optionParseFailed = true
        return
      }
      delete errors.optionValueErrors[index]

      const next: ReasoningCapabilityOption = {
        key: item.key.trim(),
        label: item.label.trim(),
        value: valueParsed.value === undefined ? null : valueParsed.value,
      }
      const optionMultiplier = Number(item.billingMultiplierText)
      if (Number.isFinite(optionMultiplier) && optionMultiplier > 0) {
        next.billingMultiplier = optionMultiplier
      }
      if (item.description.trim()) next.description = item.description.trim()
      optionList.push(next)
    })
    if (optionParseFailed) {
      return
    }

    nextReasoning = {
      supported: Boolean(formState.reasoningEnabled),
      requestField: formState.reasoningRequestField.trim(),
      options: optionList,
    }
    if (formState.reasoningDefaultKey.trim()) nextReasoning.defaultKey = formState.reasoningDefaultKey.trim()
    if (formState.reasoningLabel.trim()) nextReasoning.label = formState.reasoningLabel.trim()
    if (formState.reasoningDescription.trim()) nextReasoning.description = formState.reasoningDescription.trim()
  }

  // 写回根对象。webSearch / reasoning 段有空白时清空对应键，避免脏数据残留。
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

  emit('update:modelValue', baseRoot)
}

// 任意字段变化都触发 emit；JSON 校验错误时跳过，保留父级原值
const triggerEmitUpdate = () => emitUpdate()

// 自动应用：watch 整个 formState
watch(formState, triggerEmitUpdate, { deep: true })

// 选项操作
const addReasoningOption = () => {
  formState.reasoningOptions.push({
    key: '',
    label: '',
    valueText: '',
    billingMultiplierText: '',
    description: '',
  })
}

const removeReasoningOption = (index: number) => {
  formState.reasoningOptions.splice(index, 1)
  delete errors.optionValueErrors[index]
}

// 模板按钮：一键填充常见厂商的字段
const presetSamples = [
  {
    name: 'OpenAI 系列',
    apply: () => {
      formState.webSearchEnabled = true
      formState.webSearchRequestField = 'web_search_options'
      formState.webSearchRequestValueText = '{}'
      formState.webSearchBillingMultiplierText = '1.5'
      formState.reasoningEnabled = true
      formState.reasoningRequestField = 'reasoning_effort'
      formState.reasoningOptions = [
        { key: 'low', label: '低', valueText: '"low"', billingMultiplierText: '1.5', description: '' },
        { key: 'medium', label: '中', valueText: '"medium"', billingMultiplierText: '2', description: '' },
        { key: 'high', label: '高', valueText: '"high"', billingMultiplierText: '3', description: '' },
      ]
      formState.reasoningDefaultKey = 'medium'
    },
  },
  {
    name: '阿里通义 / DashScope',
    apply: () => {
      formState.webSearchEnabled = true
      formState.webSearchRequestField = 'enable_search'
      formState.webSearchRequestValueText = 'true'
      formState.webSearchDisabledValueText = 'false'
      formState.webSearchBillingMultiplierText = '1.3'
      formState.reasoningEnabled = true
      formState.reasoningRequestField = 'enable_thinking'
      formState.reasoningOptions = [
        { key: 'on', label: '开启', valueText: 'true', billingMultiplierText: '2', description: '' },
      ]
      formState.reasoningDefaultKey = ''
    },
  },
  {
    name: 'Anthropic Claude',
    apply: () => {
      formState.webSearchEnabled = false
      formState.webSearchRequestField = ''
      formState.webSearchRequestValueText = ''
      formState.reasoningEnabled = true
      formState.reasoningRequestField = 'thinking'
      formState.reasoningOptions = [
        { key: 'standard', label: '标准', valueText: '{ "type": "enabled", "budget_tokens": 4096 }', billingMultiplierText: '2', description: '' },
        { key: 'extended', label: '扩展', valueText: '{ "type": "enabled", "budget_tokens": 16000 }', billingMultiplierText: '3.5', description: '' },
      ]
      formState.reasoningDefaultKey = 'standard'
    },
  },
]

const applyPreset = (preset: typeof presetSamples[number]) => {
  preset.apply()
}

const clearWebSearch = () => {
  formState.webSearchEnabled = false
  formState.webSearchRequestField = ''
  formState.webSearchRequestValueText = ''
  formState.webSearchDisabledValueText = ''
  formState.webSearchBillingMultiplierText = ''
  formState.webSearchLabel = ''
  formState.webSearchDescription = ''
}

const clearReasoning = () => {
  formState.reasoningEnabled = false
  formState.reasoningRequestField = ''
  formState.reasoningDefaultKey = ''
  formState.reasoningLabel = ''
  formState.reasoningDescription = ''
  formState.reasoningOptions = []
  errors.optionValueErrors = {}
}

// 视图辅助
const hasWebSearchInput = computed(() => (
  formState.webSearchEnabled
  || formState.webSearchRequestField
  || formState.webSearchRequestValueText
))

const hasReasoningInput = computed(() => (
  formState.reasoningEnabled
  || formState.reasoningRequestField
  || formState.reasoningOptions.length > 0
))
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

      <div class="admin-form__grid">
        <div class="admin-form__field admin-form__field--full">
          <label class="admin-form__label">上游字段名 <span class="capability-editor__required">*</span></label>
          <input v-model.trim="formState.webSearchRequestField" class="admin-input" type="text" placeholder="如 web_search_options / enable_search">
          <div class="admin-form__hint">不同厂商字段名不同：OpenAI 用 web_search_options；阿里用 enable_search。</div>
        </div>

        <div class="admin-form__field admin-form__field--full">
          <label class="admin-form__label">启用时字段值（JSON）</label>
          <textarea v-model="formState.webSearchRequestValueText" class="admin-textarea capability-editor__json" rows="3" placeholder='例如 {} / true / { "search_context_size": "medium" }'></textarea>
          <div v-if="errors.webSearchRequestValue" class="admin-form__hint admin-form__hint--error">JSON 解析失败：{{ errors.webSearchRequestValue }}</div>
        </div>

        <div class="admin-form__field admin-form__field--full">
          <label class="admin-form__label">关闭时字段值（JSON，可选）</label>
          <textarea v-model="formState.webSearchDisabledValueText" class="admin-textarea capability-editor__json" rows="2" placeholder="部分厂商需要显式发 false"></textarea>
          <div v-if="errors.webSearchDisabledValue" class="admin-form__hint admin-form__hint--error">JSON 解析失败：{{ errors.webSearchDisabledValue }}</div>
        </div>

        <div class="admin-form__field">
          <label class="admin-form__label">计费倍率</label>
          <input v-model.trim="formState.webSearchBillingMultiplierText" class="admin-input" type="number" min="0" step="0.1" placeholder="例如 1.5（默认 1）">
          <div class="admin-form__hint">启用联网时按此倍率放大基础点数。</div>
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
        <div class="admin-form__field admin-form__field--full">
          <label class="admin-form__label">上游字段名 <span class="capability-editor__required">*</span></label>
          <input v-model.trim="formState.reasoningRequestField" class="admin-input" type="text" placeholder="如 reasoning_effort / thinking / enable_thinking">
        </div>

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

      <div class="capability-editor__options">
        <div class="capability-editor__options-header">
          <span class="capability-editor__options-title">思考等级 / 选项</span>
          <button type="button" class="admin-inline-button" @click="addReasoningOption">+ 添加选项</button>
        </div>

        <div v-if="!formState.reasoningOptions.length" class="capability-editor__empty">
          至少添加一个选项才能让前端展示。仅有"开关"语义时也建议加一个选项（如 key=on / value=true）。
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
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">字段值（JSON）<span class="capability-editor__required">*</span></label>
              <textarea v-model="option.valueText" class="admin-textarea capability-editor__json" rows="2" placeholder='例如 "high" / true / { "type": "enabled", "budget_tokens": 8192 }'></textarea>
              <div v-if="errors.optionValueErrors[index]" class="admin-form__hint admin-form__hint--error">JSON 解析失败：{{ errors.optionValueErrors[index] }}</div>
            </div>
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
