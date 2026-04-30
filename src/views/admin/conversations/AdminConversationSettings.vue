<template>
  <AdminPageContainer title="会话配置" description="统一维护会话规则、后台列表展示与创作入口展示，优先沉淀可运营、可复用的通用会话配置。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" :disabled="loading || saving" @click="handleReset">
        恢复默认
      </button>
      <button class="admin-button admin-button--primary" type="button" :disabled="loading || saving" @click="handleSave">
        {{ saving ? '保存中...' : '保存配置' }}
      </button>
    </template>

    <div class="admin-grid admin-grid--stats">
      <AdminStatCard label="默认分页" :value="form.listDisplay.defaultPageSize" hint="后台会话列表首次进入时的默认分页条数" />
      <AdminStatCard label="入口标题" :value="form.entryDisplay.hero.title || '未设置'" hint="创作页欢迎标题，影响首页输入区首屏感知" />
      <AdminStatCard label="模式数量" :value="form.entryDisplay.mode.options.length" hint="会话入口允许展示的模式选项数量" />
      <AdminStatCard label="策略开关" :value="enabledPolicyCount" hint="当前已启用的管理策略数量" />
    </div>

    <div class="admin-conversation-settings-tabs">
      <button
        v-for="item in tabItems"
        :key="item.key"
        class="admin-conversation-settings-tabs__item"
        :class="{ 'is-active': currentTab === item.key }"
        type="button"
        @click="currentTab = item.key"
      >
        <span class="admin-conversation-settings-tabs__title">{{ item.label }}</span>
        <span class="admin-conversation-settings-tabs__desc">{{ item.description }}</span>
      </button>
    </div>

    <div v-if="currentTab === 'basic'" class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">基础规则</h4>
          <div class="admin-card__desc">控制会话默认命名、默认排序，以及后台允许执行的基础管理动作。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">默认会话标题</label>
            <input v-model.trim="form.basicRules.defaultSessionTitle" class="admin-input" type="text" placeholder="新对话">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">新建会话前缀</label>
            <input v-model.trim="form.basicRules.newSessionTitlePrefix" class="admin-input" type="text" placeholder="新对话">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">标题最大长度</label>
            <input v-model.number="form.basicRules.sessionTitleMaxLength" class="admin-input" type="number" min="1" max="200">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">默认排序方式</label>
            <select v-model="form.basicRules.defaultSortMode" class="admin-select">
              <option value="lastRecordAt_desc">最近活跃优先</option>
              <option value="updatedAt_desc">更新时间优先</option>
              <option value="createdAt_desc">创建时间优先</option>
            </select>
          </div>
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">后台操作</label>
            <div class="admin-toggle-grid">
              <label class="admin-switch-row">
                <input v-model="form.basicRules.allowAdminRename" type="checkbox">
                <span>允许后台重命名会话</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.basicRules.allowAdminDelete" type="checkbox">
                <span>允许后台删除会话</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.basicRules.allowDeleteDefaultSession" type="checkbox">
                <span>允许删除默认会话</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="currentTab === 'list'" class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">列表展示</h4>
          <div class="admin-card__desc">控制后台会话列表首次加载的分页大小，以及卡片上默认显示的信息维度。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">默认每页条数</label>
            <input v-model.number="form.listDisplay.defaultPageSize" class="admin-input" type="number" min="1" max="100">
          </div>
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">展示字段</label>
            <div class="admin-toggle-grid">
              <label class="admin-switch-row">
                <input v-model="form.listDisplay.showUserInfo" type="checkbox">
                <span>显示用户信息</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.listDisplay.showCoverImage" type="checkbox">
                <span>显示封面图</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.listDisplay.showLatestPrompt" type="checkbox">
                <span>显示最近提示词摘要</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.listDisplay.showStatusStats" type="checkbox">
                <span>显示状态统计</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.listDisplay.showSessionId" type="checkbox">
                <span>显示会话 ID</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.listDisplay.showLastRecordTime" type="checkbox">
                <span>显示最近活跃时间</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.listDisplay.enableUserMasking" type="checkbox">
                <span>用户信息脱敏</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="currentTab === 'entry'" class="admin-conversation-entry-layout">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">入口展示</h4>
            <div class="admin-card__desc">维护欢迎标题、输入框占位文案、默认模型、默认助手，以及功能按钮显隐与默认状态。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-form__grid">
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">欢迎区</label>
              <div class="admin-toggle-grid admin-toggle-grid--single">
                <label class="admin-switch-row">
                  <input v-model="form.entryDisplay.hero.enabled" type="checkbox">
                  <span>显示欢迎区</span>
                </label>
              </div>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">欢迎标题</label>
              <input v-model.trim="form.entryDisplay.hero.title" class="admin-input" type="text" placeholder="你好，想创作什么？">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">欢迎副标题</label>
              <input v-model.trim="form.entryDisplay.hero.subtitle" class="admin-input" type="text" placeholder="可留空">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">输入框占位文案</label>
              <input v-model.trim="form.entryDisplay.input.placeholder" class="admin-input" type="text" placeholder="说说今天想做点什么">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">默认模式</label>
              <input v-model.trim="form.entryDisplay.mode.defaultMode" class="admin-input" type="text" placeholder="agent">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">入口开关</label>
              <div class="admin-toggle-grid">
                <label class="admin-switch-row">
                  <input v-model="form.entryDisplay.mode.enabled" type="checkbox">
                  <span>显示模式选择</span>
                </label>
                <label class="admin-switch-row">
                  <input v-model="form.entryDisplay.modelSelector.enabled" type="checkbox">
                  <span>显示模型选择器</span>
                </label>
                <label class="admin-switch-row">
                  <input v-model="form.entryDisplay.assistantSelector.enabled" type="checkbox">
                  <span>显示助手选择器</span>
                </label>
                <label class="admin-switch-row">
                  <input v-model="form.entryDisplay.modelSelector.allowSkillOverride" type="checkbox">
                  <span>允许技能覆盖默认模型</span>
                </label>
              </div>
            </div>

            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">模式选项</label>
              <div class="admin-conversation-settings-list">
                <div v-for="(item, index) in form.entryDisplay.mode.options" :key="`mode-${index}`" class="admin-conversation-settings-list__row">
                  <input v-model.trim="item.label" class="admin-input" type="text" placeholder="显示名称">
                  <input v-model.trim="item.value" class="admin-input" type="text" placeholder="值">
                  <button class="admin-inline-button admin-inline-button--danger" type="button" @click="removeModeOption(index)">删除</button>
                </div>
                <button class="admin-button admin-button--secondary" type="button" @click="addModeOption">新增模式</button>
              </div>
            </div>

            <div class="admin-form__field">
              <label class="admin-form__label">默认模型</label>
              <input v-model.trim="form.entryDisplay.modelSelector.defaultModelKey" class="admin-input" type="text" placeholder="deepseek-v4-flash">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">默认助手</label>
              <input v-model.trim="form.entryDisplay.assistantSelector.defaultAssistantKey" class="admin-input" type="text" placeholder="general">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">允许模型列表（每行一个）</label>
              <textarea v-model="allowedModelKeysText" class="admin-textarea admin-textarea--compact" placeholder="deepseek-v4-flash&#10;gpt-4.1-mini"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">允许助手列表（每行一个）</label>
              <textarea v-model="allowedAssistantKeysText" class="admin-textarea admin-textarea--compact" placeholder="general&#10;ecommerce-pack&#10;poster-design"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">功能按钮</label>
              <div class="admin-conversation-action-grid">
                <div class="admin-conversation-action-grid__item">
                  <div class="admin-conversation-action-grid__title">自动</div>
                  <label class="admin-switch-row">
                    <input v-model="form.entryDisplay.actions.auto.visible" type="checkbox">
                    <span>显示</span>
                  </label>
                  <label class="admin-switch-row">
                    <input v-model="form.entryDisplay.actions.auto.defaultEnabled" type="checkbox">
                    <span>默认开启</span>
                  </label>
                </div>
                <div class="admin-conversation-action-grid__item">
                  <div class="admin-conversation-action-grid__title">灵感搜索</div>
                  <label class="admin-switch-row">
                    <input v-model="form.entryDisplay.actions.inspiration.visible" type="checkbox">
                    <span>显示</span>
                  </label>
                  <label class="admin-switch-row">
                    <input v-model="form.entryDisplay.actions.inspiration.defaultEnabled" type="checkbox">
                    <span>默认开启</span>
                  </label>
                </div>
                <div class="admin-conversation-action-grid__item">
                  <div class="admin-conversation-action-grid__title">创意设计</div>
                  <label class="admin-switch-row">
                    <input v-model="form.entryDisplay.actions.creativeDesign.visible" type="checkbox">
                    <span>显示</span>
                  </label>
                  <label class="admin-switch-row">
                    <input v-model="form.entryDisplay.actions.creativeDesign.defaultEnabled" type="checkbox">
                    <span>默认开启</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">实时预览</h4>
            <div class="admin-card__desc">预览创作页输入区的欢迎语、输入框和底部工具栏显隐效果。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="conversation-preview">
            <div v-if="form.entryDisplay.hero.enabled" class="conversation-preview__hero">
              <h3>{{ form.entryDisplay.hero.title || '你好，想创作什么？' }}</h3>
              <p v-if="form.entryDisplay.hero.subtitle">{{ form.entryDisplay.hero.subtitle }}</p>
            </div>
            <div class="conversation-preview__panel">
              <div class="conversation-preview__placeholder">{{ form.entryDisplay.input.placeholder || '说说今天想做点什么' }}</div>
              <div class="conversation-preview__toolbar">
                <span v-if="form.entryDisplay.mode.enabled" class="conversation-preview__chip">{{ previewModeLabel }}</span>
                <span v-if="form.entryDisplay.modelSelector.enabled" class="conversation-preview__chip">{{ form.entryDisplay.modelSelector.defaultModelKey || '默认模型' }}</span>
                <span v-if="form.entryDisplay.assistantSelector.enabled" class="conversation-preview__chip">{{ form.entryDisplay.assistantSelector.defaultAssistantKey || '通用助手' }}</span>
                <span v-if="form.entryDisplay.actions.auto.visible" class="conversation-preview__chip">自动{{ form.entryDisplay.actions.auto.defaultEnabled ? ' · 开' : '' }}</span>
                <span v-if="form.entryDisplay.actions.inspiration.visible" class="conversation-preview__chip">灵感搜索{{ form.entryDisplay.actions.inspiration.defaultEnabled ? ' · 开' : '' }}</span>
                <span v-if="form.entryDisplay.actions.creativeDesign.visible" class="conversation-preview__chip">创意设计{{ form.entryDisplay.actions.creativeDesign.defaultEnabled ? ' · 开' : '' }}</span>
                <button class="conversation-preview__submit" type="button">↑</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">管理策略</h4>
          <div class="admin-card__desc">控制后台批量操作权限，以及后续自动清理与导出类能力的治理边界。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid">
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">策略开关</label>
            <div class="admin-toggle-grid">
              <label class="admin-switch-row">
                <input v-model="form.managementPolicy.allowBatchDelete" type="checkbox">
                <span>允许批量删除</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.managementPolicy.allowExportSessions" type="checkbox">
                <span>允许导出会话明细</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.managementPolicy.autoCleanupEnabled" type="checkbox">
                <span>启用自动清理</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="form.managementPolicy.deleteCascadeRecords" type="checkbox">
                <span>删除会话时级联删除记录</span>
              </label>
            </div>
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">空会话保留天数</label>
            <input v-model.number="form.managementPolicy.emptySessionRetentionDays" class="admin-input" type="number" min="1" max="3650">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">已完成会话保留天数</label>
            <input v-model.number="form.managementPolicy.completedSessionRetentionDays" class="admin-input" type="number" min="1" max="3650">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">失败会话保留天数</label>
            <input v-model.number="form.managementPolicy.failedSessionRetentionDays" class="admin-input" type="number" min="1" max="3650">
          </div>
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import {
  createDefaultConversationSettings,
  getAdminConversationSettings,
  saveAdminConversationSettings,
  type ConversationSettingsConfig,
} from '@/api/admin-conversation-settings'

const loading = ref(false)
const saving = ref(false)
const currentTab = ref<'basic' | 'list' | 'entry' | 'policy'>('basic')
const tabItems = [
  { key: 'basic', label: '基础规则', description: '命名、排序与基础管理权限' },
  { key: 'list', label: '列表展示', description: '后台会话列表默认展示项' },
  { key: 'entry', label: '入口展示', description: '欢迎标题、输入框与底部能力条' },
  { key: 'policy', label: '管理策略', description: '批量操作、清理与导出策略' },
] as const

const form = reactive<ConversationSettingsConfig>(createDefaultConversationSettings())
const allowedModelKeysText = ref('')
const allowedAssistantKeysText = ref('')

const syncTextareaValues = () => {
  allowedModelKeysText.value = form.entryDisplay.modelSelector.allowedModelKeys.join('\n')
  allowedAssistantKeysText.value = form.entryDisplay.assistantSelector.allowedAssistantKeys.join('\n')
}

const applyForm = (value?: ConversationSettingsConfig | null) => {
  const nextValue = value || createDefaultConversationSettings()
  Object.assign(form.basicRules, nextValue.basicRules)
  Object.assign(form.listDisplay, nextValue.listDisplay)
  Object.assign(form.entryDisplay.hero, nextValue.entryDisplay.hero)
  Object.assign(form.entryDisplay.input, nextValue.entryDisplay.input)
  Object.assign(form.entryDisplay.mode, {
    ...nextValue.entryDisplay.mode,
    options: nextValue.entryDisplay.mode.options.map(item => ({ ...item })),
  })
  Object.assign(form.entryDisplay.modelSelector, {
    ...nextValue.entryDisplay.modelSelector,
    allowedModelKeys: [...nextValue.entryDisplay.modelSelector.allowedModelKeys],
  })
  Object.assign(form.entryDisplay.assistantSelector, {
    ...nextValue.entryDisplay.assistantSelector,
    allowedAssistantKeys: [...nextValue.entryDisplay.assistantSelector.allowedAssistantKeys],
  })
  Object.assign(form.entryDisplay.actions.auto, nextValue.entryDisplay.actions.auto)
  Object.assign(form.entryDisplay.actions.inspiration, nextValue.entryDisplay.actions.inspiration)
  Object.assign(form.entryDisplay.actions.creativeDesign, nextValue.entryDisplay.actions.creativeDesign)
  Object.assign(form.managementPolicy, nextValue.managementPolicy)
  syncTextareaValues()
}

const buildPayload = (): ConversationSettingsConfig => ({
  basicRules: {
    ...form.basicRules,
  },
  listDisplay: {
    ...form.listDisplay,
  },
  entryDisplay: {
    hero: {
      ...form.entryDisplay.hero,
    },
    input: {
      ...form.entryDisplay.input,
    },
    mode: {
      enabled: form.entryDisplay.mode.enabled,
      defaultMode: form.entryDisplay.mode.defaultMode,
      options: form.entryDisplay.mode.options
        .map(item => ({
          value: String(item.value || '').trim(),
          label: String(item.label || '').trim(),
        }))
        .filter(item => item.value && item.label),
    },
    modelSelector: {
      ...form.entryDisplay.modelSelector,
      allowedModelKeys: allowedModelKeysText.value
        .split('\n')
        .map(item => item.trim())
        .filter(Boolean),
    },
    assistantSelector: {
      ...form.entryDisplay.assistantSelector,
      allowedAssistantKeys: allowedAssistantKeysText.value
        .split('\n')
        .map(item => item.trim())
        .filter(Boolean),
    },
    actions: {
      auto: {
        ...form.entryDisplay.actions.auto,
      },
      inspiration: {
        ...form.entryDisplay.actions.inspiration,
      },
      creativeDesign: {
        ...form.entryDisplay.actions.creativeDesign,
      },
    },
  },
  managementPolicy: {
    ...form.managementPolicy,
  },
})

const enabledPolicyCount = computed(() => {
  let count = 0
  if (form.managementPolicy.allowBatchDelete) count += 1
  if (form.managementPolicy.allowExportSessions) count += 1
  if (form.managementPolicy.autoCleanupEnabled) count += 1
  if (form.managementPolicy.deleteCascadeRecords) count += 1
  return count
})

const previewModeLabel = computed(() => {
  const matchedMode = form.entryDisplay.mode.options.find(item => item.value === form.entryDisplay.mode.defaultMode)
  return matchedMode?.label || form.entryDisplay.mode.options[0]?.label || 'Agent 模式'
})

const loadSettings = async () => {
  loading.value = true
  try {
    const result = await getAdminConversationSettings()
    applyForm(result)
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    const result = await saveAdminConversationSettings(buildPayload())
    applyForm(result)
  } finally {
    saving.value = false
  }
}

const handleReset = () => {
  applyForm(createDefaultConversationSettings())
}

const addModeOption = () => {
  form.entryDisplay.mode.options.push({
    value: '',
    label: '',
  })
}

const removeModeOption = (index: number) => {
  if (form.entryDisplay.mode.options.length <= 1) {
    return
  }

  form.entryDisplay.mode.options.splice(index, 1)
}

watch(allowedModelKeysText, (value) => {
  form.entryDisplay.modelSelector.allowedModelKeys = value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
})

watch(allowedAssistantKeysText, (value) => {
  form.entryDisplay.assistantSelector.allowedAssistantKeys = value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
})

onMounted(() => {
  void loadSettings()
})
</script>

<style scoped>
.admin-conversation-settings-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.admin-conversation-settings-tabs__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 18px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.admin-conversation-settings-tabs__item:hover,
.admin-conversation-settings-tabs__item.is-active {
  border-color: color-mix(in srgb, var(--brand-primary, #6b8cff) 32%, transparent);
  background: color-mix(in srgb, var(--brand-primary, #6b8cff) 10%, var(--bg-surface));
  color: var(--text-primary);
}

.admin-conversation-settings-tabs__title {
  font-size: 15px;
  font-weight: 600;
}

.admin-conversation-settings-tabs__desc {
  font-size: 12px;
  line-height: 1.5;
}

.admin-toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.admin-toggle-grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.admin-select {
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
}

.admin-textarea--compact {
  min-height: 120px;
}

.admin-conversation-entry-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
  gap: 16px;
}

.admin-conversation-settings-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-conversation-settings-list__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
}

.admin-conversation-action-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.admin-conversation-action-grid__item {
  padding: 14px 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-surface) 92%, var(--bg-block-secondary-default));
}

.admin-conversation-action-grid__title {
  margin-bottom: 10px;
  color: var(--text-primary);
  font-weight: 600;
}

.conversation-preview {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 40px 20px;
  border-radius: 24px;
  background: #121316;
}

.conversation-preview__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #f5f7fa;
  text-align: center;
}

.conversation-preview__hero h3 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.conversation-preview__hero p {
  margin: 0;
  color: rgba(245, 247, 250, 0.72);
}

.conversation-preview__panel {
  width: 100%;
  min-height: 208px;
  padding: 28px 28px 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 28px;
  background: #1f2127;
}

.conversation-preview__placeholder {
  min-height: 96px;
  color: rgba(245, 247, 250, 0.38);
  font-size: 16px;
}

.conversation-preview__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.conversation-preview__chip {
  display: inline-flex;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: rgba(245, 247, 250, 0.84);
  font-size: 13px;
}

.conversation-preview__submit {
  margin-left: auto;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

@media (max-width: 1200px) {
  .admin-conversation-entry-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 960px) {
  .admin-conversation-settings-tabs,
  .admin-conversation-action-grid,
  .admin-toggle-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-conversation-settings-list__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
