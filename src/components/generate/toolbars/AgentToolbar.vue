<script setup lang="ts">
// Agent 模式工具栏组件
// 包含自动（生成偏好）、灵感搜索、创意设计三个功能按钮
// 支持弹出方向设置和纯图标模式

import { ref, computed, watch, onMounted } from 'vue'
import PreferencePanel from '../common/PreferencePanel.vue'
import SelectPopup from '../common/SelectPopup.vue'
import { getAllChatModels, getDefaultChatModelKey, loadPublicModelCatalog } from '@/config/models'
import { listEnabledAgentSkills, loadPublicSkillCatalog } from '@/config/agentSkills'
import { getAgentModel, setAgentModel } from '@/api/agent'
import {
  parseModelCapabilitySpec,
  type ModelCapabilityFlags,
  type ModelCapabilitySpec,
} from '@/shared/provider-capability'

// 弹出方向类型
type Placement = 'top' | 'bottom' | 'auto'

const AGENT_TOOLBAR_STORAGE_KEY = 'canana:generator:agent-toolbar'

// Props 定义
interface Props {
  // 弹出方向：top-向上, bottom-向下, auto-自动计算
  placement?: Placement
  // 是否只显示图标（侧边栏模式）
  iconOnly?: boolean
  // 是否显示模型选择器
  showModelSelector?: boolean
  // 是否显示助手选择器
  showAssistantSelector?: boolean
  // 默认模型
  defaultModelKey?: string
  // 允许模型白名单
  allowedModelKeys?: string[]
  // 默认助手
  defaultAssistantKey?: string
  // 允许助手白名单
  allowedAssistantKeys?: string[]
  // 自动按钮是否显示
  showAutoAction?: boolean
  // 自动按钮默认开关
  autoActionEnabled?: boolean
  // 灵感搜索是否显示
  showInspirationAction?: boolean
  // 灵感搜索默认开关
  inspirationActionEnabled?: boolean
  // 创意设计是否显示
  showCreativeDesignAction?: boolean
  // 创意设计默认开关
  creativeDesignActionEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'auto',
  iconOnly: false,
  showModelSelector: true,
  showAssistantSelector: true,
  defaultModelKey: '',
  allowedModelKeys: () => [],
  defaultAssistantKey: 'general',
  allowedAssistantKeys: () => [],
  showAutoAction: true,
  autoActionEnabled: true,
  showInspirationAction: true,
  inspirationActionEnabled: false,
  showCreativeDesignAction: true,
  creativeDesignActionEnabled: false,
})

// 定义事件
const emit = defineEmits<{
  'panelOpen': []
  'panelClose': []
}>()

// Agent 技能选项
interface AgentSkillOption {
  value: string
  label: string
  description: string
}

// 功能开关状态
const autoMode = ref(props.autoActionEnabled !== false)
const inspirationSearchEnabled = ref(props.inspirationActionEnabled)
const creativeDesignEnabled = ref(props.creativeDesignActionEnabled)

// 技能选择
const skillOptions = ref<AgentSkillOption[]>(listEnabledAgentSkills())
const readStoredAgentToolbarState = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return JSON.parse(window.localStorage.getItem(AGENT_TOOLBAR_STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

// 按模型分桶的能力开关持久化结构：{ skill, capabilityFlags: { [modelKey]: { webSearch, reasoning } } }
// 同模型间的选择互不污染：用户在 A 模型上的偏好不会因为切到 B 模型而被覆盖。
type StoredCapabilityFlagsByModel = Record<string, { webSearch?: boolean; reasoning?: string }>

const writeStoredAgentToolbarState = (patch: Record<string, unknown>) => {
  if (typeof window === 'undefined') return
  const current = readStoredAgentToolbarState() || {}
  window.localStorage.setItem(AGENT_TOOLBAR_STORAGE_KEY, JSON.stringify({ ...current, ...patch }))
}

const readStoredCapabilityFlagsByModel = (): StoredCapabilityFlagsByModel => {
  const stored = readStoredAgentToolbarState()
  const raw = stored?.capabilityFlags
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as StoredCapabilityFlagsByModel
}

const storedAgentToolbarState = readStoredAgentToolbarState()
const currentSkill = ref(typeof storedAgentToolbarState?.skill === 'string' ? storedAgentToolbarState.skill : props.defaultAssistantKey)
const isSkillSelectOpen = ref(false)
const skillTriggerRef = ref<HTMLElement | null>(null)

const currentSkillLabel = computed(() => {
  const skill = skillOptions.value.find(option => option.value === currentSkill.value)
  return skill?.label || '使用技能'
})

const visibleSkillOptions = computed(() => {
  const allowedSkillKeys = Array.isArray(props.allowedAssistantKeys) && props.allowedAssistantKeys.length
    ? props.allowedAssistantKeys.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const nextOptions = allowedSkillKeys.length
    ? skillOptions.value.filter(option => allowedSkillKeys.includes(option.value))
    : skillOptions.value

  if (currentSkill.value === 'general') {
    return nextOptions.filter(option => option.value !== 'general')
  }
  return nextOptions
})

// 模型选择
const chatModels = computed(() => {
  const allowedModelKeys = Array.isArray(props.allowedModelKeys) && props.allowedModelKeys.length
    ? props.allowedModelKeys.map(item => String(item || '').trim()).filter(Boolean)
    : []

  // 保留 capabilityJson，供下方"联网搜索/深度思考"开关读取模型能力声明。
  const allModels = getAllChatModels().map((m: any) => ({
    value: m.key,
    label: m.label,
    capabilityJson: m.capabilityJson || null,
  }))
  const nextModels = allowedModelKeys.length
    ? allModels.filter(item => allowedModelKeys.includes(item.value))
    : allModels

  return nextModels.length ? nextModels : allModels
})
const currentModel = ref(getAgentModel())
const isModelSelectOpen = ref(false)
const modelTriggerRef = ref<HTMLElement | null>(null)

const currentModelLabel = computed(() => {
  const m = chatModels.value.find(v => v.value === currentModel.value)
  return m?.label || currentModel.value
})

// 模型能力声明：联网搜索 / 深度思考由 AiModel.capabilityJson 配置。
// 切换模型时，前端开关需自动跟随：未声明则隐藏，声明了则显示。
const currentModelCapabilitySpec = computed<ModelCapabilitySpec | null>(() => {
  const matched = chatModels.value.find(item => item.value === currentModel.value)
  return parseModelCapabilitySpec(matched?.capabilityJson)
})

const webSearchSpec = computed(() => currentModelCapabilitySpec.value?.webSearch || null)
const reasoningSpec = computed(() => currentModelCapabilitySpec.value?.reasoning || null)

// 用户当前选中的开关状态。模型切换时按"目标模型支持的能力"做收敛。
const webSearchEnabled = ref(false)
const reasoningKey = ref('')

// 当前能力开关的显式视图，提供给父组件透传到 createGenerationTask。
// 只要模型声明支持该能力，就始终发送当前状态：
// - 联网搜索：true / false
// - 深度思考：选中的 key；关闭时为空字符串
const currentCapabilityFlags = computed<ModelCapabilityFlags>(() => {
  const flags: ModelCapabilityFlags = {}
  if (webSearchSpec.value?.supported) {
    flags.webSearch = Boolean(webSearchEnabled.value)
  }
  if (reasoningSpec.value?.supported) {
    flags.reasoning = reasoningKey.value || ''
  }
  return flags
})

// 深度思考下拉框开关
const isReasoningSelectOpen = ref(false)
const reasoningTriggerRef = ref<HTMLElement | null>(null)

const reasoningOptions = computed(() => reasoningSpec.value?.options || [])

const currentReasoningLabel = computed(() => {
  const fallback = reasoningSpec.value?.label || '深度思考'
  if (!reasoningKey.value) return fallback
  const matched = reasoningOptions.value.find(item => item.key === reasoningKey.value)
  return matched ? `${fallback}：${matched.label}` : fallback
})

const webSearchLabel = computed(() => webSearchSpec.value?.label || '联网搜索')
const reasoningLabel = computed(() => reasoningSpec.value?.label || '深度思考')

watch(
  chatModels,
  (options) => {
    const values = options.map(item => item.value)
    if (!values.length) return
    if (!values.includes(currentModel.value)) {
      currentModel.value = props.defaultModelKey || getAgentModel() || getDefaultChatModelKey() || values[0]
    }
  },
  { immediate: true },
)

onMounted(() => {
  void loadPublicModelCatalog()
  void loadPublicSkillCatalog().then((skills) => {
    skillOptions.value = listEnabledAgentSkills()
    const allowedSkillKeys = Array.isArray(props.allowedAssistantKeys) && props.allowedAssistantKeys.length
      ? props.allowedAssistantKeys.map(item => String(item || '').trim()).filter(Boolean)
      : []
    const filteredSkills = allowedSkillKeys.length
      ? skills.filter(item => allowedSkillKeys.includes(item.skillKey))
      : skills
    if (!filteredSkills.some(item => item.skillKey === currentSkill.value)) {
      currentSkill.value = props.defaultAssistantKey || filteredSkills[0]?.skillKey || 'general'
    }
  })
})

watch(
  () => props.defaultModelKey,
  (value) => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) {
      return
    }

    if (chatModels.value.some(item => item.value === normalizedValue)) {
      currentModel.value = normalizedValue
      setAgentModel(normalizedValue)
    }
  },
  { immediate: true },
)

watch(
  () => props.defaultAssistantKey,
  (value) => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) {
      return
    }

    currentSkill.value = normalizedValue
  },
  { immediate: true },
)

watch(
  () => props.autoActionEnabled,
  (value) => {
    autoMode.value = value !== false
  },
  { immediate: true },
)

watch(
  () => props.inspirationActionEnabled,
  (value) => {
    inspirationSearchEnabled.value = value === true
  },
  { immediate: true },
)

watch(
  () => props.creativeDesignActionEnabled,
  (value) => {
    creativeDesignEnabled.value = value === true
  },
  { immediate: true },
)

watch(
  currentSkill,
  (skill) => {
    writeStoredAgentToolbarState({ skill })
  },
  { immediate: true },
)

// 切换模型 / 模型 capabilityJson 变化时：
// 1. 从 localStorage 读取该模型上次的选择
// 2. 按当前 spec 做收敛（不支持的能力清空当前显示态，但不写回 localStorage 其它模型的桶）
// 3. 主动持久化（webSearch/reasoning 的写入 watcher 会兜底，但这里同步避免抖动）
watch(
  currentModelCapabilitySpec,
  (spec) => {
    const modelKey = currentModel.value
    const storedForModel = modelKey ? readStoredCapabilityFlagsByModel()[modelKey] : undefined

    // 联网搜索
    if (spec?.webSearch?.supported) {
      webSearchEnabled.value = Boolean(storedForModel?.webSearch)
    } else {
      webSearchEnabled.value = false
    }

    // 深度思考
    if (!spec?.reasoning?.supported) {
      reasoningKey.value = ''
      isReasoningSelectOpen.value = false
      return
    }
    const options = spec.reasoning.options || []
    if (!options.length) {
      reasoningKey.value = ''
      return
    }
    const storedReasoning = String(storedForModel?.reasoning || '')
    if (storedReasoning && options.some(item => item.key === storedReasoning)) {
      reasoningKey.value = storedReasoning
    } else if (reasoningKey.value && !options.some(item => item.key === reasoningKey.value)) {
      reasoningKey.value = spec.reasoning.defaultKey || ''
    } else if (!reasoningKey.value) {
      // 该模型无历史偏好且当前未选时，保持空（不自动选默认值，避免误扣点）
      reasoningKey.value = ''
    }
  },
  { immediate: true },
)

// 用户主动切换 webSearch / reasoning 时按 modelKey 分桶持久化
watch(
  [webSearchEnabled, reasoningKey, currentModel],
  ([nextWebSearch, nextReasoning, modelKey]) => {
    if (!modelKey) return
    const all = readStoredCapabilityFlagsByModel()
    const next: { webSearch?: boolean; reasoning?: string } = {}
    if (nextWebSearch) next.webSearch = true
    if (nextReasoning) next.reasoning = nextReasoning
    if (next.webSearch || next.reasoning) {
      all[modelKey] = next
    } else {
      delete all[modelKey]
    }
    writeStoredAgentToolbarState({ capabilityFlags: all })
  },
)

// 统一关闭 Agent 工具栏内部所有浮层
const closeAllPopups = () => {
  isModelSelectOpen.value = false
  isSkillSelectOpen.value = false
  isPreferencePanelOpen.value = false
  isReasoningSelectOpen.value = false
}

const toggleModelSelect = (e: Event) => {
  e.stopPropagation()
  const wasOpen = isModelSelectOpen.value
  isSkillSelectOpen.value = false
  isModelSelectOpen.value = !isModelSelectOpen.value
  if (isPreferencePanelOpen.value) {
    isPreferencePanelOpen.value = false
    emit('panelClose')
  }
  if (!wasOpen && isModelSelectOpen.value) {
    emit('panelOpen')
  } else if (wasOpen && !isModelSelectOpen.value) {
    emit('panelClose')
  }
}

const selectModel = (key: string) => {
  currentModel.value = key
  setAgentModel(key)
  isModelSelectOpen.value = false
  emit('panelClose')
}

const toggleSkillSelect = (e: Event) => {
  e.stopPropagation()
  const wasOpen = isSkillSelectOpen.value
  isModelSelectOpen.value = false
  if (isPreferencePanelOpen.value) {
    isPreferencePanelOpen.value = false
    emit('panelClose')
  }
  isSkillSelectOpen.value = !isSkillSelectOpen.value
  if (!wasOpen && isSkillSelectOpen.value) {
    emit('panelOpen')
  } else if (wasOpen && !isSkillSelectOpen.value) {
    emit('panelClose')
  }
}

const selectSkill = (key: string) => {
  currentSkill.value = key
  isSkillSelectOpen.value = false
  emit('panelClose')
}

// 生成偏好面板状态
const isPreferencePanelOpen = ref(false)
const preferenceTriggerRef = ref<HTMLElement | null>(null)

// 按钮文字（根据 autoMode 显示不同文字）
const preferenceButtonText = computed(() => autoMode.value ? '自动' : '自定义')

// 关闭面板方法（供外部调用）
const closePanel = () => {
  if (isPreferencePanelOpen.value || isModelSelectOpen.value || isSkillSelectOpen.value || isReasoningSelectOpen.value) {
    closeAllPopups()
    emit('panelClose')
  }
}

// 暴露方法和状态
defineExpose({
  isPreferencePanelOpen,
  closePanel,
  currentModel,
  currentModelLabel,
  currentSkill,
  currentSkillLabel,
  currentCapabilityFlags,
})

// 切换生成偏好面板
const togglePreferencePanel = (e: Event) => {
  e.stopPropagation()
  const wasOpen = isPreferencePanelOpen.value
  isModelSelectOpen.value = false
  isSkillSelectOpen.value = false
  isReasoningSelectOpen.value = false
  isPreferencePanelOpen.value = !isPreferencePanelOpen.value
  // 打开时通知父组件
  if (!wasOpen && isPreferencePanelOpen.value) {
    emit('panelOpen')
  } else if (wasOpen && !isPreferencePanelOpen.value) {
    emit('panelClose')
  }
}

// 切换灵感搜索
const toggleInspirationSearch = () => {
  inspirationSearchEnabled.value = !inspirationSearchEnabled.value
}

// 切换创意设计
const toggleCreativeDesign = () => {
  creativeDesignEnabled.value = !creativeDesignEnabled.value
}

// 切换联网搜索按钮
const toggleWebSearch = () => {
  if (!webSearchSpec.value?.supported) return
  webSearchEnabled.value = !webSearchEnabled.value
}

// 打开/关闭深度思考下拉
const toggleReasoningSelect = (e: Event) => {
  e.stopPropagation()
  if (!reasoningSpec.value?.supported) return
  const wasOpen = isReasoningSelectOpen.value
  isModelSelectOpen.value = false
  isSkillSelectOpen.value = false
  if (isPreferencePanelOpen.value) {
    isPreferencePanelOpen.value = false
    emit('panelClose')
  }
  isReasoningSelectOpen.value = !isReasoningSelectOpen.value
  if (!wasOpen && isReasoningSelectOpen.value) {
    emit('panelOpen')
  } else if (wasOpen && !isReasoningSelectOpen.value) {
    emit('panelClose')
  }
}

// 选择深度思考等级；点击当前已选中的等级时取消
const selectReasoning = (key: string) => {
  if (reasoningKey.value === key) {
    reasoningKey.value = ''
  } else {
    reasoningKey.value = key
  }
  isReasoningSelectOpen.value = false
  emit('panelClose')
}
</script>

<template>
  <div class="agent-toolbar">
    <!-- 模型选择 -->
    <div v-if="showModelSelector" ref="modelTriggerRef"
         :class="['lv-select', 'lv-select-single', 'lv-select-size-default', 'toolbar-select', 'select-joF5y7', 'select-NNOj5P', { 'compact': iconOnly }]"
         role="combobox"
         tabindex="0"
         :aria-expanded="isModelSelectOpen"
         :title="iconOnly ? currentModelLabel : undefined"
         @click.stop="toggleModelSelect">
      <div class="lv-select-view">
        <span class="lv-select-view-selector">
          <span class="lv-select-view-value">
            <svg fill="none" height="16" preserveAspectRatio="xMidYMid meet"
                 role="presentation" viewBox="0 0 24 24" width="16"
                 xmlns="http://www.w3.org/2000/svg">
              <g>
                <path clip-rule="evenodd"
                      d="M13.25 2.682a2.5 2.5 0 0 0-2.5 0L4.556 6.258a2.5 2.5 0 0 0-1.25 2.165v7.153a2.5 2.5 0 0 0 1.25 2.165l6.194 3.576a2.5 2.5 0 0 0 2.5 0l6.194-3.576a2.5 2.5 0 0 0 1.25-2.165V8.423a2.5 2.5 0 0 0-1.25-2.165L13.25 2.682Zm-1.6 1.559a.7.7 0 0 1 .7 0L17.995 7.5 12 10.96 6.005 7.5l5.645-3.26Zm1.25 8.279v6.92l5.644-3.258a.7.7 0 0 0 .35-.606V9.059l-5.994 3.46ZM5.106 9.059l5.994 3.46v6.922l-5.644-3.259a.7.7 0 0 1-.35-.606V9.059Z"
                      data-follow-fill="currentColor" fill="currentColor"
                      fill-rule="evenodd"></path>
              </g>
            </svg>
            <span v-if="!iconOnly">{{ currentModelLabel }}</span>
          </span>
        </span>
        <div v-if="!iconOnly" aria-hidden="true" class="lv-select-suffix">
          <div class="lv-select-arrow-icon">
            <svg width="1em" height="1em" viewBox="0 0 24 24"
                 preserveAspectRatio="xMidYMid meet" fill="none"
                 role="presentation" xmlns="http://www.w3.org/2000/svg">
              <g>
                <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"
                      d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                      fill="currentColor"></path>
              </g>
            </svg>
          </div>
        </div>
        <div v-else aria-hidden="true" class="lv-select-suffix sf-hidden"></div>
      </div>
    </div>

    <!-- 模型选择弹窗 -->
    <SelectPopup v-if="showModelSelector" v-model:visible="isModelSelectOpen" :trigger-ref="modelTriggerRef" :placement="placement" title="对话模型">
      <ul class="lv-select-popup-inner">
        <li v-for="m in chatModels"
            :key="m.value"
            :class="['lv-select-option', { 'lv-select-option-wrapper-selected': currentModel === m.value }]"
            @click.stop="selectModel(m.value)">
          <div class="select-option-label">
            <div class="select-option-label-content">
              <span>{{ m.label }}</span>
            </div>
            <span v-if="currentModel === m.value" class="select-option-check-icon">
              <svg width="1em" height="1em" viewBox="0 0 24 24"
                   preserveAspectRatio="xMidYMid meet" fill="none"
                   role="presentation" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"
                        d="M20.774 6.289a1 1 0 0 1 .1 1.41l-9.666 11a1 1 0 0 1-1.447.063l-5.334-5a1 1 0 0 1 1.368-1.458l4.572 4.286 9.002-10.2a1 1 0 0 1 1.405-.101Z"
                        fill="currentColor"></path>
                </g>
              </svg>
            </span>
          </div>
        </li>
      </ul>
    </SelectPopup>

    <!-- 技能选择器 -->
    <span v-if="showAssistantSelector" class="lv-badge skill-select-badge">
      <div ref="skillTriggerRef"
           :class="['lv-select', 'lv-select-single', 'lv-select-size-default', 'toolbar-select', 'select-joF5y7', 'select-NNOj5P', 'skill-select', { 'compact': iconOnly, 'active-P7cL4x': isSkillSelectOpen }]"
           role="combobox"
           tabindex="0"
           :aria-expanded="isSkillSelectOpen"
           :title="iconOnly ? currentSkillLabel : undefined"
           @click.stop="toggleSkillSelect">
        <div class="lv-select-view">
          <span class="lv-select-view-selector">
            <span class="lv-select-view-value">
              <svg width="16" height="16" viewBox="0 0 24 24"
                   preserveAspectRatio="xMidYMid meet" fill="none"
                   role="presentation" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path data-follow-fill="currentColor"
                        d="m20.498 8.652-.09.091a3.377 3.377 0 0 1-4.754 0 3.336 3.336 0 0 1 0-4.74l.435-.432a5.367 5.367 0 0 0-.868-.071c-2.923 0-5.28 2.35-5.28 5.234 0 .754.161 1.469.449 2.114a1 1 0 0 1-.21 1.117l-6.284 6.238a1.335 1.335 0 0 0 0 1.9c.534.529 1.4.529 1.934 0l6.34-6.294.112-.096a1 1 0 0 1 .964-.123 5.302 5.302 0 0 0 1.975.379c2.922 0 5.279-2.35 5.279-5.235l-.002-.082Zm2.002.082c0 4.002-3.266 7.235-7.28 7.235a7.323 7.323 0 0 1-2.083-.302l-5.898 5.856a3.376 3.376 0 0 1-4.752 0 3.336 3.336 0 0 1 0-4.739l5.82-5.78a7.187 7.187 0 0 1-.366-2.27c0-4.002 3.266-7.234 7.28-7.234 1.135 0 2.213.26 3.174.723a1 1 0 0 1 .27 1.61l-1.601 1.59a1.335 1.335 0 0 0 0 1.9c.533.53 1.4.53 1.934 0l1.426-1.416.096-.084a1 1 0 0 1 1.548.452c.28.77.432 1.598.432 2.46Z"
                        fill="currentColor"></path>
                </g>
              </svg>
              <span v-if="!iconOnly">{{ currentSkillLabel }}</span>
            </span>
          </span>
          <div v-if="!iconOnly" aria-hidden="true" class="lv-select-suffix">
            <div class="lv-select-arrow-icon">
              <svg width="1em" height="1em" viewBox="0 0 24 24"
                   preserveAspectRatio="xMidYMid meet" fill="none"
                   role="presentation" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"
                        d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                        fill="currentColor"></path>
                </g>
              </svg>
            </div>
          </div>
          <div v-else aria-hidden="true" class="lv-select-suffix sf-hidden"></div>
        </div>
      </div>
    </span>

    <!-- 技能选择弹窗 -->
    <SelectPopup v-if="showAssistantSelector" v-model:visible="isSkillSelectOpen" :trigger-ref="skillTriggerRef" :placement="placement" popup-class="skill-select-popup-shell-dark" title="">
      <div class="skill-select-shell">
        <div class="skill-select-title">选择技能</div>
        <ul class="lv-select-popup-inner skill-select-popup">
        <li v-for="skill in visibleSkillOptions"
            :key="skill.value"
            :class="['lv-select-option', 'skill-option', { 'skill-option-selected': currentSkill === skill.value }]"
            @click.stop="selectSkill(skill.value)">
          <div class="select-option-label skill-option-label">
            <span class="skill-option-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24"
                   preserveAspectRatio="xMidYMid meet" fill="none"
                   role="presentation" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path data-follow-fill="currentColor"
                        d="m20.498 8.652-.09.091a3.377 3.377 0 0 1-4.754 0 3.336 3.336 0 0 1 0-4.74l.435-.432a5.367 5.367 0 0 0-.868-.071c-2.923 0-5.28 2.35-5.28 5.234 0 .754.161 1.469.449 2.114a1 1 0 0 1-.21 1.117l-6.284 6.238a1.335 1.335 0 0 0 0 1.9c.534.529 1.4.529 1.934 0l6.34-6.294.112-.096a1 1 0 0 1 .964-.123 5.302 5.302 0 0 0 1.975.379c2.922 0 5.279-2.35 5.279-5.235l-.002-.082Zm2.002.082c0 4.002-3.266 7.235-7.28 7.235a7.323 7.323 0 0 1-2.083-.302l-5.898 5.856a3.376 3.376 0 0 1-4.752 0 3.336 3.336 0 0 1 0-4.739l5.82-5.78a7.187 7.187 0 0 1-.366-2.27c0-4.002 3.266-7.234 7.28-7.234 1.135 0 2.213.26 3.174.723a1 1 0 0 1 .27 1.61l-1.601 1.59a1.335 1.335 0 0 0 0 1.9c.533.53 1.4.53 1.934 0l1.426-1.416.096-.084a1 1 0 0 1 1.548.452c.28.77.432 1.598.432 2.46Z"
                        fill="currentColor"></path>
                </g>
              </svg>
            </span>
            <div class="select-option-label-content skill-option-content">
              <span class="skill-option-title">{{ skill.label }}</span>
              <span class="skill-option-description" :title="skill.description">{{ skill.description }}</span>
            </div>
          </div>
        </li>
        </ul>
      </div>
    </SelectPopup>

    <!-- 自动按钮（打开生成偏好面板） -->
    <button v-if="showAutoAction" ref="preferenceTriggerRef"
            :class="['lv-btn', 'lv-btn-secondary', 'lv-btn-size-default', 'lv-btn-shape-square', 'button-lc3WzE', 'toolbar-button-FhFnQ_', 'toolbar-button-pEFNv9', { 'lv-btn-icon-only': iconOnly, 'active-Rs99sz active-mrQmUS': isPreferencePanelOpen }]"
            type="button"
            :title="iconOnly ? preferenceButtonText : undefined"
            @click="togglePreferencePanel">
      <svg width="1em" height="1em" viewBox="0 0 24 24"
           preserveAspectRatio="xMidYMid meet" fill="none"
           role="presentation" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path data-follow-fill="currentColor"
                d="M18.047 4.1a1 1 0 1 0-2 0v2.8a1 1 0 1 0 2 0v-.447h3.103a1 1 0 1 0 0-2h-3.103V4.1Zm-4 2.353H2.85a1 1 0 0 1 0-2h11.197v2Zm-7 3.247a1 1 0 0 0-1 1v.4H2.85a1 1 0 1 0 0 2h3.197v.4a1 1 0 1 0 2 0v-2.8a1 1 0 0 0-1-1Zm14.103 3.4H10.047v-2H21.15a1 1 0 1 1 0 2Zm-10.103 3a1 1 0 0 0-1 1v2.8a1 1 0 1 0 2 0v-2.8a1 1 0 0 0-1-1ZM2.85 17.497h5.197v2H2.85a1 1 0 1 1 0-2Zm18.3 2h-9.103v-2h9.103a1 1 0 1 1 0 2Z"
                clip-rule="evenodd" fill-rule="evenodd"
                fill="currentColor"></path>
        </g>
      </svg>
      <span v-if="!iconOnly">{{ preferenceButtonText }}</span>
    </button>

    <!-- 生成偏好面板 -->
    <PreferencePanel v-if="showAutoAction" v-model:visible="isPreferencePanelOpen" v-model:autoMode="autoMode" :trigger-ref="preferenceTriggerRef" :placement="placement" />

    <!-- 灵感搜索按钮 -->
    <button v-if="showInspirationAction" :class="['lv-btn', 'lv-btn-secondary', 'lv-btn-size-default', 'lv-btn-shape-square', 'button-lc3WzE', 'toolbar-button-FhFnQ_', 'toolbar-button-pEFNv9', 'switch-button-GPRaGT', { 'lv-btn-icon-only': iconOnly, 'checked-SqLqYu': inspirationSearchEnabled }]"
            type="button"
            :title="iconOnly ? '灵感搜索' : undefined"
            @click="toggleInspirationSearch">
      <svg width="1em" height="1em" viewBox="0 0 24 24"
           preserveAspectRatio="xMidYMid meet" fill="none"
           role="presentation" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path data-follow-fill="currentColor"
                d="M11.606 2.25a8.5 8.5 0 0 1 6.676 13.762l3.406 3.406a1 1 0 1 1-1.414 1.414l-3.406-3.406a8.464 8.464 0 0 1-6.666 1.706v-2.036a6.5 6.5 0 1 0-5.096-6.346c0 .084.004.167.007.25H3.112a8.5 8.5 0 0 1 8.494-8.75Z"
                fill="currentColor"></path>
          <path d="M7.772 12.57a.944.944 0 0 1 1.348-.002.98.98 0 0 1 .002 1.37l-3.999 4.064a.947.947 0 0 1-1.35 0l-2.295-2.339a.978.978 0 0 1 .002-1.369.944.944 0 0 1 1.348.003l1.621 1.65 3.323-3.378Z"
                fill="#00CAE0"></path>
        </g>
      </svg>
      <span v-if="!iconOnly">灵感搜索</span>
    </button>

    <!-- 创意设计按钮 -->
    <button v-if="showCreativeDesignAction" :class="['lv-btn', 'lv-btn-secondary', 'lv-btn-size-default', 'lv-btn-shape-square', 'button-lc3WzE', 'toolbar-button-FhFnQ_', 'toolbar-button-pEFNv9', 'switch-button-GPRaGT', { 'lv-btn-icon-only': iconOnly, 'checked-SqLqYu': creativeDesignEnabled }]"
            type="button"
            :title="iconOnly ? '创意设计' : undefined"
            @click="toggleCreativeDesign">
      <svg width="1em" height="1em" viewBox="0 0 24 24"
           preserveAspectRatio="xMidYMid meet" fill="none"
           role="presentation" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path data-follow-fill="currentColor"
                d="M13.402 20.598c.289 0 .53.239.453.516a1.904 1.904 0 0 1-3.724-.322.185.185 0 0 1 .184-.194h3.087ZM11.988 1.499a7.953 7.953 0 0 1 7.951 7.952 7.943 7.943 0 0 1-3.758 6.752 2.952 2.952 0 0 1-2.943 2.75h-2.237s-.87.003-.87-.953.87-.95.87-.95h2.237l.108-.006c.528-.054.94-.5.941-1.043v-.352a.95.95 0 0 1 .509-.841A6.048 6.048 0 0 0 12.3 3.41l-.312-.008A6.05 6.05 0 0 0 6.143 11s.257.749-.743 1c-.937.251-1.213-1-1.213-1a7.953 7.953 0 0 1 7.8-9.501Z"
                fill="currentColor"></path>
          <path data-follow-fill="currentColor"
                d="M11.706 7.7a.316.316 0 0 1 .588 0l.158.381c.27.651.774 1.172 1.407 1.453l.449.2a.332.332 0 0 1 0 .602l-.475.21a2.725 2.725 0 0 0-1.387 1.406l-.154.354a.317.317 0 0 1-.584 0l-.154-.354A2.761 2.761 0 0 0 11 11.13l-.137-.13a2.682 2.682 0 0 0-.696-.453l-.475-.211a.332.332 0 0 1 0-.603l.449-.199a2.729 2.729 0 0 0 1.407-1.453l.158-.382Z"
                fill="currentColor"></path>
          <path fill="#00CAE0"
                d="M8.078 12.57a.944.944 0 0 1 1.347-.002.98.98 0 0 1 .002 1.37L5.43 18.001a.947.947 0 0 1-1.35 0l-2.296-2.339a.978.978 0 0 1 .003-1.369.944.944 0 0 1 1.347.003l1.621 1.65 3.324-3.378Z"></path>
        </g>
      </svg>
      <span v-if="!iconOnly">创意设计</span>
    </button>

    <!-- 联网搜索（按模型 capabilityJson.webSearch.supported 决定显隐） -->
    <button v-if="webSearchSpec?.supported"
            :class="['lv-btn', 'lv-btn-secondary', 'lv-btn-size-default', 'lv-btn-shape-square', 'button-lc3WzE', 'toolbar-button-FhFnQ_', 'toolbar-button-pEFNv9', 'switch-button-GPRaGT', 'capability-button', { 'lv-btn-icon-only': iconOnly, 'checked-SqLqYu': webSearchEnabled }]"
            type="button"
            :title="webSearchSpec?.description || (iconOnly ? webSearchLabel : undefined)"
            @click="toggleWebSearch">
      <svg width="1em" height="1em" viewBox="0 0 24 24"
           preserveAspectRatio="xMidYMid meet" fill="none"
           role="presentation" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path data-follow-fill="currentColor"
                d="M12 2.25c5.385 0 9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12 6.615 2.25 12 2.25Zm0 1.6a8.15 8.15 0 0 0-7.95 6.4h3.36a13.7 13.7 0 0 1 1.86-4.74A8.16 8.16 0 0 0 8.5 5l3.5-1.15Zm0 0c.84 1.42 1.5 3.06 1.95 4.84A8.13 8.13 0 0 0 12 3.85Zm0 16.3c.99-1.42 1.78-3.07 2.34-4.85h-4.68A14.2 14.2 0 0 0 12 20.15Zm-3.95-4.85h-3.36A8.16 8.16 0 0 0 12 20.15a13.7 13.7 0 0 1-1.86-4.74A14.7 14.7 0 0 1 8.05 15.3Zm-3.36-1.6h3.18a16 16 0 0 1 0-3.4H4.7a8.1 8.1 0 0 0 0 3.4Zm5.06-3.4a14.6 14.6 0 0 0 0 3.4h4.5a14.6 14.6 0 0 0 0-3.4h-4.5Zm5.95 0a16 16 0 0 1 0 3.4h3.18a8.1 8.1 0 0 0 0-3.4h-3.18Zm-1.96-1.6c-.45-1.78-1.1-3.42-1.95-4.84.85 1.42 1.5 3.06 1.95 4.84Zm-2.34 7.95c-.56-1.78-1.35-3.43-2.34-4.85h4.68A14.2 14.2 0 0 1 12 18.45Z"
                fill="currentColor"></path>
        </g>
      </svg>
      <span v-if="!iconOnly">{{ webSearchLabel }}</span>
    </button>

    <!-- 深度思考（按模型 capabilityJson.reasoning.supported 决定显隐） -->
    <div v-if="reasoningSpec?.supported" ref="reasoningTriggerRef"
         :class="['lv-btn', 'lv-btn-secondary', 'lv-btn-size-default', 'lv-btn-shape-square', 'button-lc3WzE', 'toolbar-button-FhFnQ_', 'toolbar-button-pEFNv9', 'switch-button-GPRaGT', 'capability-button', { 'lv-btn-icon-only': iconOnly, 'checked-SqLqYu': !!reasoningKey, 'active-Rs99sz active-mrQmUS': isReasoningSelectOpen }]"
         role="combobox"
         tabindex="0"
         :aria-expanded="isReasoningSelectOpen"
         :title="reasoningSpec?.description || (iconOnly ? currentReasoningLabel : undefined)"
         @click.stop="toggleReasoningSelect">
      <svg width="1em" height="1em" viewBox="0 0 24 24"
           preserveAspectRatio="xMidYMid meet" fill="none"
           role="presentation" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path data-follow-fill="currentColor"
                d="M12 2.5a7.75 7.75 0 0 1 7.75 7.75c0 2.04-.79 3.9-2.07 5.28-.42.45-.71.95-.85 1.46l-.45 1.6a3.5 3.5 0 0 1-3.36 2.4h-2.14a3.5 3.5 0 0 1-3.36-2.4l-.45-1.6a3.7 3.7 0 0 0-.85-1.46A7.72 7.72 0 0 1 4.25 10.25 7.75 7.75 0 0 1 12 2.5Zm0 2a5.75 5.75 0 0 0-5.75 5.75c0 1.51.59 2.9 1.55 3.93a5.7 5.7 0 0 1 1.31 2.27l.45 1.6c.18.65.78 1.1 1.45 1.1h2.14c.67 0 1.27-.45 1.45-1.1l.45-1.6c.27-.96.71-1.69 1.31-2.27A5.74 5.74 0 0 0 17.75 10.25 5.75 5.75 0 0 0 12 4.5ZM10 13a1 1 0 1 1 0-2h4a1 1 0 1 1 0 2h-4Z"
                fill="currentColor"></path>
        </g>
      </svg>
      <span v-if="!iconOnly">{{ currentReasoningLabel }}</span>
      <div v-if="!iconOnly" aria-hidden="true" class="lv-select-suffix">
        <div class="lv-select-arrow-icon">
          <svg width="1em" height="1em" viewBox="0 0 24 24"
               preserveAspectRatio="xMidYMid meet" fill="none"
               role="presentation" xmlns="http://www.w3.org/2000/svg">
            <g>
              <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"
                    d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                    fill="currentColor"></path>
            </g>
          </svg>
        </div>
      </div>
    </div>

    <!-- 深度思考等级弹窗 -->
    <SelectPopup v-if="reasoningSpec?.supported"
                 v-model:visible="isReasoningSelectOpen"
                 :trigger-ref="reasoningTriggerRef"
                 :placement="placement"
                 :title="reasoningLabel">
      <ul class="lv-select-popup-inner">
        <li v-for="option in reasoningOptions"
            :key="option.key"
            :class="['lv-select-option', { 'lv-select-option-wrapper-selected': reasoningKey === option.key }]"
            @click.stop="selectReasoning(option.key)">
          <div class="select-option-label">
            <div class="select-option-label-content">
              <span>{{ option.label }}</span>
              <span v-if="option.description" class="reasoning-option-description">{{ option.description }}</span>
            </div>
            <span v-if="reasoningKey === option.key" class="select-option-check-icon">
              <svg width="1em" height="1em" viewBox="0 0 24 24"
                   preserveAspectRatio="xMidYMid meet" fill="none"
                   role="presentation" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"
                        d="M20.774 6.289a1 1 0 0 1 .1 1.41l-9.666 11a1 1 0 0 1-1.447.063l-5.334-5a1 1 0 0 1 1.368-1.458l4.572 4.286 9.002-10.2a1 1 0 0 1 1.405-.101Z"
                        fill="currentColor"></path>
                </g>
              </svg>
            </span>
          </div>
        </li>
      </ul>
    </SelectPopup>
  </div>
</template>

<style>
/* 样式已在 generate.css 中定义 */
.agent-toolbar {
  display: contents;
}

/* 自动按钮选中状态 */
.toolbar-button-FhFnQ_.active-Rs99sz.lv-btn.lv-btn-secondary.lv-btn-size-default:not(.lv-btn-disabled):not(.lv-btn-loading) {
  background: var(--bg-block-secondary-hover);
  border-color: var(--brand-main-default);
}

/* 技能弹窗内容 */
.skill-select-badge {
  display: inline-flex;
}

.skill-select.lv-select.lv-select-single .lv-select-view {
  min-width: 118px;
  padding-left: 12px;
  padding-right: 10px;
}

.skill-select .lv-select-view-value {
  gap: 6px;
  color: var(--text-primary);
}

.skill-select .lv-select-view-value > svg {
  flex: 0 0 auto;
}

.skill-select .lv-select-arrow-icon {
  color: var(--text-placeholder);
}

.skill-select.active-P7cL4x .lv-select-view,
.skill-select:focus-visible .lv-select-view,
.skill-select:hover .lv-select-view {
  background: var(--bg-block-primary-hover);
}

.skill-select.active-P7cL4x .lv-select-arrow-icon svg {
  transform: rotate(180deg);
}

.skill-select-popup-shell-dark {
  border-radius: 18px;
  border-color: var(--stroke-tertiary);
  background: var(--bg-dropdown-menu);
  box-shadow: var(--shadow-dropdown-menu);
  padding: 0;
}

.skill-select-popup {
  min-width: 400px;
  max-height: 320px;
  padding: 0;
  overflow-y: auto;
}

.skill-select-shell {
  width: 400px;
  padding: 12px 10px 10px;
}

.skill-select-title {
  padding: 2px 8px 10px;
  color: var(--text-placeholder);
  font-size: 12px;
  line-height: 18px;
}

.skill-option {
  margin: 0;
  min-height: 36px;
  padding: 0;
  border-radius: 8px;
  background: transparent;
}

.skill-option + .skill-option {
  margin-top: 1px;
}

.skill-option:hover {
  background: var(--bg-block-primary-hover);
}

.skill-option-selected {
  background: transparent;
}

.skill-option-label {
  width: 100%;
  gap: 8px;
  padding: 7px 10px;
}

.skill-option-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--text-primary);
}

.skill-option-content {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.skill-option-title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  flex: 0 0 60px;
  white-space: nowrap;
}

.skill-option-description {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 16px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 联网搜索 / 深度思考开关组：与既有"灵感搜索""创意设计"按钮共用样式，
   仅靠 capability-button 类做轻量区分（如未来需要单独主题色）。 */
.capability-button .lv-select-suffix {
  margin-left: 4px;
}

.reasoning-option-description {
  margin-left: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
