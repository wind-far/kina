<template>
  <AdminPageContainer title="模型厂商" description="集中管理多个 AI 厂商，并在厂商维度下维护模型列表与模型能力。">
    <div class="admin-provider-toolbar">
      <input
        v-model.trim="providerKeyword"
        class="admin-input admin-provider-toolbar__search"
        type="text"
        placeholder="搜索供应商名称或厂商标识"
      >
      <select v-model="providerStatus" class="admin-input admin-provider-toolbar__status">
        <option value="ALL">全部状态</option>
        <option value="ENABLED">已启用</option>
        <option value="DISABLED">已禁用</option>
      </select>
      <button class="admin-button admin-button--secondary" type="button" @click="loadProviders" :disabled="providerLoading || providerSaving || modelLoading || modelSaving">
        {{ providerLoading ? '刷新中...' : '刷新列表' }}
      </button>
    </div>

    <div class="admin-provider-grid">
      <button class="admin-provider-create-card" type="button" @click="openCreateProviderDialog">
        <div class="admin-provider-create-card__plus">+</div>
        <div class="admin-provider-create-card__title">新增厂商</div>
        <div class="admin-provider-create-card__desc">添加新的自定义模型厂商</div>
        <div class="admin-provider-create-card__actions">
          <span class="admin-provider-create-card__action">手动创建</span>
        </div>
      </button>

      <div v-for="provider in filteredProviders" :key="provider.id" class="admin-provider-tile">
        <div class="admin-provider-tile__header">
          <div class="admin-provider-tile__brand">
            <div class="admin-provider-avatar">
              <img v-if="provider.iconUrl" :src="provider.iconUrl" :alt="provider.name">
              <span v-else>{{ getProviderInitial(provider.name) }}</span>
            </div>
            <div class="admin-provider-tile__meta">
              <div class="admin-provider-tile__title">{{ provider.name }}</div>
              <button class="admin-provider-tile__link" type="button" @click="openModelManager(provider)">
                管理模型({{ provider.modelCount }})
              </button>
            </div>
          </div>
          <div class="admin-provider-tile__actions">
            <button class="admin-icon-button" type="button" title="编辑厂商" @click="openEditProviderDialog(provider.id)">✎</button>
            <button class="admin-icon-button admin-icon-button--danger" type="button" title="删除厂商" @click="handleDeleteProvider(provider)">🗑</button>
          </div>
        </div>

        <div class="admin-provider-tile__status-row">
          <span class="admin-status" :class="provider.isEnabled ? 'admin-status--success' : 'admin-status--warning'">
            {{ provider.isEnabled ? '已启用' : '已禁用' }}
          </span>
          <label class="admin-switch">
            <input :checked="provider.isEnabled" type="checkbox" @change="toggleProviderEnabled(provider)">
            <span class="admin-switch__slider" />
          </label>
        </div>

        <div class="admin-provider-tile__chips">
          <span v-for="type in provider.supportedTypes" :key="type" class="admin-chip">{{ getSupportedTypeLabel(type) }}</span>
        </div>

        <div class="admin-provider-tile__footer">
          <span>{{ provider.code }}</span>
          <span>启用模型 {{ provider.enabledModelCount }}/{{ provider.modelCount }}</span>
        </div>
      </div>
    </div>
  </AdminPageContainer>

  <div v-if="providerDialogVisible" class="admin-dialog-mask" @click="closeProviderDialog">
    <div class="admin-dialog admin-dialog--provider-form" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">{{ editingProviderId ? '编辑供应商' : '新增供应商' }}</h3>
          <div class="admin-dialog__desc">添加一个新的 AI 模型供应商，并配置基础地址、密钥与能力范围。</div>
        </div>
        <button class="admin-dialog__close" type="button" @click="closeProviderDialog">×</button>
      </div>

      <form class="admin-form admin-dialog__body" @submit.prevent="handleSaveProvider">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label" for="provider-icon-url">图标地址</label>
            <input id="provider-icon-url" v-model.trim="providerForm.iconUrl" class="admin-input" type="text" placeholder="https://example.com/icon.png">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label">启用状态</label>
            <div class="admin-radio-group">
              <label class="admin-radio-item">
                <input v-model="providerForm.isEnabled" :value="true" type="radio">
                <span>启用</span>
              </label>
              <label class="admin-radio-item">
                <input v-model="providerForm.isEnabled" :value="false" type="radio">
                <span>禁用</span>
              </label>
            </div>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="provider-code">供应商标识</label>
            <input id="provider-code" v-model.trim="providerForm.code" class="admin-input" type="text" placeholder="例如：openai、deepseek、doubao">
            <div class="admin-form__hint">唯一标识符，建议使用英文、小写与中划线组合。</div>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="provider-name">供应商名称</label>
            <input id="provider-name" v-model.trim="providerForm.name" class="admin-input" type="text" placeholder="例如：OpenAI、DeepSeek、字节豆包">
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="provider-description">描述</label>
            <textarea id="provider-description" v-model="providerForm.description" class="admin-textarea" placeholder="供应商描述信息（可选）"></textarea>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="provider-base-url">基础地址</label>
            <input id="provider-base-url" v-model.trim="providerForm.baseUrl" class="admin-input" type="text" placeholder="https://api.example.com/v1">
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="provider-api-key">绑定密钥</label>
            <input id="provider-api-key" v-model.trim="providerForm.apiKey" class="admin-input" type="password" placeholder="请输入厂商 API Key">
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">支持的模型类型</label>
            <div class="admin-check-grid">
              <label v-for="option in providerTypeOptions" :key="option.value" class="admin-check-item">
                <input :checked="providerForm.supportedTypes.includes(option.value)" type="checkbox" @change="toggleSupportedType(option.value)">
                <span>{{ option.label }}</span>
              </label>
            </div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="provider-chat-endpoint">对话端点</label>
            <input id="provider-chat-endpoint" v-model.trim="providerForm.chatEndpoint" class="admin-input" type="text" placeholder="/chat/completions">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="provider-image-endpoint">图片端点</label>
            <input id="provider-image-endpoint" v-model.trim="providerForm.imageEndpoint" class="admin-input" type="text" placeholder="/images/generations">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="provider-video-endpoint">视频端点</label>
            <input id="provider-video-endpoint" v-model.trim="providerForm.videoEndpoint" class="admin-input" type="text" placeholder="/videos">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="provider-default-chat-model">默认对话模型</label>
            <input id="provider-default-chat-model" v-model.trim="providerForm.defaultChatModel" class="admin-input" type="text" placeholder="例如 gpt-4.1-mini">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="provider-sort-order">排序权重</label>
            <input id="provider-sort-order" v-model.number="providerForm.sortOrder" class="admin-input" type="number" min="0" placeholder="0">
          </div>
        </div>

        <div class="admin-form__footer">
          <button class="admin-button admin-button--secondary" type="button" @click="closeProviderDialog">取消</button>
          <button class="admin-button admin-button--primary" type="submit" :disabled="providerSaving">
            {{ providerSaving ? '保存中...' : editingProviderId ? '保存' : '创建' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <div v-if="modelManagerVisible" class="admin-dialog-mask" @click="closeModelManager">
    <div class="admin-dialog admin-dialog--model-manager" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">{{ selectedProvider?.name || '模型管理' }}</h3>
          <div class="admin-dialog__desc">{{ selectedProvider?.baseUrl || '请先选择厂商' }}</div>
        </div>
        <div class="admin-dialog__header-actions">
          <button class="admin-button admin-button--primary" type="button" @click="openCreateModelDialog" :disabled="!selectedProvider">添加模型</button>
          <button class="admin-dialog__close" type="button" @click="closeModelManager">×</button>
        </div>
      </div>

      <div class="admin-dialog__body">
        <div class="admin-model-toolbar">
          <input v-model.trim="modelKeyword" class="admin-input" type="text" placeholder="搜索模型名称...">
          <select v-model="modelStatus" class="admin-input">
            <option value="ALL">全部状态</option>
            <option value="ENABLED">已启用</option>
            <option value="DISABLED">已禁用</option>
          </select>
          <select v-model="modelCategoryFilter" class="admin-input">
            <option value="ALL">全部类型</option>
            <option v-for="option in modelCategoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>

        <div class="admin-model-list-title">模型列表({{ filteredModels.length }})</div>

        <div v-if="modelLoading" class="admin-empty">正在加载模型列表...</div>
        <div v-else-if="!filteredModels.length" class="admin-empty">当前厂商下还没有模型。</div>
        <div v-else class="admin-model-list">
          <div v-for="model in filteredModels" :key="model.id" class="admin-model-row">
            <div class="admin-model-row__main">
              <div class="admin-model-row__title">{{ model.modelKey }}</div>
              <div class="admin-model-row__badges">
                <span class="admin-chip">{{ getModelCategoryLabel(model.category) }}</span>
                <span v-if="readCapabilityFlag(model.capabilityJson, 'supportsVision')" class="admin-chip">视觉</span>
                <span v-if="readCapabilityFlag(model.capabilityJson, 'supportsToolCall')" class="admin-chip">工具</span>
                <span v-if="readCapabilityFlag(model.capabilityJson, 'supportsReasoning')" class="admin-chip">推理</span>
                <span v-if="readCapabilityFlag(model.capabilityJson, 'supportsStructuredOutput')" class="admin-chip">结构化</span>
              </div>
            </div>
            <div class="admin-model-row__right">
              <button class="admin-inline-button" type="button" @click="openEditModelDialog(model)">配置</button>
              <button class="admin-inline-button admin-inline-button--danger" type="button" @click="handleDeleteModel(model)">删除</button>
              <label class="admin-switch">
                <input :checked="model.isEnabled" type="checkbox" @change="toggleModelEnabled(model)">
                <span class="admin-switch__slider" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="modelDialogVisible" class="admin-dialog-mask admin-dialog-mask--inner" @click="closeModelDialog">
    <div class="admin-dialog admin-dialog--model-form" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">{{ editingModelId ? '编辑模型' : '添加模型' }}</h3>
          <div class="admin-dialog__desc">为当前供应商添加一个新的 AI 模型。</div>
        </div>
        <button class="admin-dialog__close" type="button" @click="closeModelDialog">×</button>
      </div>

      <form class="admin-form admin-dialog__body" @submit.prevent="handleSaveModel">
        <div class="admin-form__grid">
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="model-label">模型名称</label>
            <input id="model-label" v-model.trim="modelForm.label" class="admin-input" type="text" placeholder="例如：GPT-4o、DeepSeek-V3">
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="model-key">模型标识符</label>
            <input id="model-key" v-model.trim="modelForm.modelKey" class="admin-input" type="text" placeholder="例如：gpt-4o、deepseek-chat">
            <div class="admin-form__hint">API 调用时使用的模型标识。</div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="model-category">模型类型</label>
            <select id="model-category" v-model="modelForm.category" class="admin-input">
              <option v-for="option in modelCategoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="model-sort-order">排序权重</label>
            <input id="model-sort-order" v-model.number="modelForm.sortOrder" class="admin-input" type="number" min="0" placeholder="0">
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="model-description">描述</label>
            <textarea id="model-description" v-model="modelForm.description" class="admin-textarea" placeholder="模型描述信息（可选）"></textarea>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">模型能力</label>
            <div class="admin-check-grid">
              <label v-for="option in modelCapabilityOptions" :key="option.key" class="admin-check-item">
                <input :checked="readCapabilityFlag(modelForm.capabilityJson, option.key)" type="checkbox" @change="toggleModelCapability(option.key)">
                <span>{{ option.label }}</span>
              </label>
            </div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label admin-form__label--inline">
              <input v-model="modelForm.isEnabled" type="checkbox">
              <span>已启用</span>
            </label>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="model-default-params">默认参数 JSON</label>
            <textarea id="model-default-params" v-model="modelForm.defaultParamsJsonText" class="admin-textarea" placeholder='例如 {"temperature": 0.7}'></textarea>
          </div>
        </div>

        <div class="admin-form__footer">
          <button class="admin-button admin-button--secondary" type="button" @click="closeModelDialog">取消</button>
          <button class="admin-button admin-button--primary" type="submit" :disabled="modelSaving">
            {{ modelSaving ? '保存中...' : editingModelId ? '保存' : '创建' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import {
  createAdminProvider,
  deleteAdminProvider,
  getAdminProviderDetail,
  listAdminProviders,
  updateAdminProvider,
  type AdminProviderDetail,
  type AdminProviderItem,
  type AdminProviderPayload,
} from '@/api/admin-providers'
import {
  createAdminProviderModel,
  deleteAdminProviderModel,
  listAdminProviderModels,
  updateAdminProviderModel,
  type AdminModelCategory,
  type AdminProviderModelItem,
  type AdminProviderModelPayload,
} from '@/api/admin-models'

const providerTypeOptions = [
  { label: 'LLM', value: 'CHAT' },
  { label: '图片生成', value: 'IMAGE' },
  { label: '视频生成', value: 'VIDEO' },
  { label: 'TEXT EMBEDDING', value: 'TEXT_EMBEDDING' },
  { label: 'RERANK', value: 'RERANK' },
  { label: 'TTS', value: 'TTS' },
  { label: 'SPEECH2TEXT', value: 'SPEECH2TEXT' },
]

const modelCategoryOptions: Array<{ label: string; value: AdminModelCategory }> = [
  { label: 'LLM（文本生成、对话、推理等）', value: 'CHAT' },
  { label: '图片生成', value: 'IMAGE' },
  { label: '视频生成', value: 'VIDEO' },
]

const modelCapabilityOptions = [
  { key: 'supportsVision', label: '视觉理解' },
  { key: 'supportsToolCall', label: '工具调用' },
  { key: 'supportsReasoning', label: '深度思考' },
  { key: 'supportsStructuredOutput', label: '结构化输出' },
]

const providerLoading = ref(false)
const providerSaving = ref(false)
const modelLoading = ref(false)
const modelSaving = ref(false)

const providerKeyword = ref('')
const providerStatus = ref<'ALL' | 'ENABLED' | 'DISABLED'>('ALL')
const providers = ref<AdminProviderItem[]>([])
const selectedProvider = ref<AdminProviderItem | null>(null)
const providerDialogVisible = ref(false)
const modelManagerVisible = ref(false)
const modelDialogVisible = ref(false)
const editingProviderId = ref('')
const editingModelId = ref('')

const modelKeyword = ref('')
const modelStatus = ref<'ALL' | 'ENABLED' | 'DISABLED'>('ALL')
const modelCategoryFilter = ref<'ALL' | AdminModelCategory>('ALL')
const models = ref<AdminProviderModelItem[]>([])

const providerForm = reactive<AdminProviderPayload>({
  code: '',
  name: '',
  description: '',
  iconUrl: '',
  baseUrl: '',
  apiKey: '',
  chatEndpoint: '/chat/completions',
  imageEndpoint: '/images/generations',
  videoEndpoint: '/videos',
  defaultChatModel: '',
  supportedTypes: ['CHAT'],
  isEnabled: true,
  sortOrder: 0,
})

const modelForm = reactive({
  category: 'CHAT' as AdminModelCategory,
  label: '',
  modelKey: '',
  description: '',
  sortOrder: 0,
  isEnabled: true,
  capabilityJson: {} as Record<string, any>,
  defaultParamsJsonText: '',
})

const filteredProviders = computed(() => {
  return providers.value.filter((provider) => {
    const matchedKeyword = !providerKeyword.value
      || provider.name.toLowerCase().includes(providerKeyword.value.toLowerCase())
      || provider.code.toLowerCase().includes(providerKeyword.value.toLowerCase())

    const matchedStatus = providerStatus.value === 'ALL'
      || (providerStatus.value === 'ENABLED' && provider.isEnabled)
      || (providerStatus.value === 'DISABLED' && !provider.isEnabled)

    return matchedKeyword && matchedStatus
  })
})

const filteredModels = computed(() => {
  return models.value
    .filter((model) => {
      const matchedKeyword = !modelKeyword.value
        || model.label.toLowerCase().includes(modelKeyword.value.toLowerCase())
        || model.modelKey.toLowerCase().includes(modelKeyword.value.toLowerCase())

      const matchedStatus = modelStatus.value === 'ALL'
        || (modelStatus.value === 'ENABLED' && model.isEnabled)
        || (modelStatus.value === 'DISABLED' && !model.isEnabled)

      const matchedCategory = modelCategoryFilter.value === 'ALL' || model.category === modelCategoryFilter.value

      return matchedKeyword && matchedStatus && matchedCategory
    })
    .sort((prevItem, nextItem) => prevItem.sortOrder - nextItem.sortOrder)
})

const resetProviderForm = () => {
  providerForm.code = ''
  providerForm.name = ''
  providerForm.description = ''
  providerForm.iconUrl = ''
  providerForm.baseUrl = ''
  providerForm.apiKey = ''
  providerForm.chatEndpoint = '/chat/completions'
  providerForm.imageEndpoint = '/images/generations'
  providerForm.videoEndpoint = '/videos'
  providerForm.defaultChatModel = ''
  providerForm.supportedTypes = ['CHAT']
  providerForm.isEnabled = true
  providerForm.sortOrder = 0
}

// 编辑厂商时统一把接口返回值灌入表单，避免字段遗漏。
const applyProviderForm = (provider: AdminProviderDetail) => {
  providerForm.code = provider.code
  providerForm.name = provider.name
  providerForm.description = provider.description || ''
  providerForm.iconUrl = provider.iconUrl || ''
  providerForm.baseUrl = provider.baseUrl
  providerForm.apiKey = provider.apiKey || ''
  providerForm.chatEndpoint = provider.chatEndpoint
  providerForm.imageEndpoint = provider.imageEndpoint
  providerForm.videoEndpoint = provider.videoEndpoint
  providerForm.defaultChatModel = provider.defaultChatModel || ''
  providerForm.supportedTypes = Array.isArray(provider.supportedTypes) ? [...provider.supportedTypes] : ['CHAT']
  providerForm.isEnabled = provider.isEnabled
  providerForm.sortOrder = provider.sortOrder
}

const stringifyJson = (value: Record<string, any> | null | undefined) => {
  if (!value || typeof value !== 'object') {
    return ''
  }

  return JSON.stringify(value, null, 2)
}

const parseOptionalJson = (value: string, fieldLabel: string) => {
  const trimmedValue = String(value || '').trim()
  if (!trimmedValue) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmedValue)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('必须是对象')
    }
    return parsed as Record<string, any>
  } catch {
    throw new Error(`${fieldLabel} 必须是合法的 JSON 对象`)
  }
}

const resetModelForm = () => {
  editingModelId.value = ''
  modelForm.category = 'CHAT'
  modelForm.label = ''
  modelForm.modelKey = ''
  modelForm.description = ''
  modelForm.sortOrder = 0
  modelForm.isEnabled = true
  modelForm.capabilityJson = {}
  modelForm.defaultParamsJsonText = ''
}

// 编辑模型时统一回填，避免能力字段和默认参数丢失。
const applyModelForm = (model: AdminProviderModelItem) => {
  editingModelId.value = model.id
  modelForm.category = model.category
  modelForm.label = model.label
  modelForm.modelKey = model.modelKey
  modelForm.description = model.description || ''
  modelForm.sortOrder = model.sortOrder
  modelForm.isEnabled = model.isEnabled
  modelForm.capabilityJson = { ...(model.capabilityJson || {}) }
  modelForm.defaultParamsJsonText = stringifyJson(model.defaultParamsJson || null)
}

const loadProviders = async () => {
  providerLoading.value = true
  try {
    providers.value = await listAdminProviders()

    if (selectedProvider.value) {
      const nextSelectedProvider = providers.value.find(item => item.id === selectedProvider.value?.id) || null
      selectedProvider.value = nextSelectedProvider
    }
  } finally {
    providerLoading.value = false
  }
}

const loadModels = async (providerId?: string) => {
  const targetProviderId = providerId || selectedProvider.value?.id || ''
  if (!targetProviderId) {
    models.value = []
    return
  }

  modelLoading.value = true
  try {
    const result = await listAdminProviderModels(targetProviderId)
    models.value = result.models
    selectedProvider.value = result.provider
  } finally {
    modelLoading.value = false
  }
}

const getProviderInitial = (name: string) => String(name || '').trim().slice(0, 1).toUpperCase() || 'A'

const getSupportedTypeLabel = (value: string) => {
  const matched = providerTypeOptions.find(item => item.value === value)
  return matched?.label || value
}

const getModelCategoryLabel = (value: AdminModelCategory) => {
  const matched = modelCategoryOptions.find(item => item.value === value)
  return matched?.label.split('（')[0] || value
}

const openCreateProviderDialog = () => {
  editingProviderId.value = ''
  resetProviderForm()
  providerDialogVisible.value = true
}

const openEditProviderDialog = async (providerId: string) => {
  providerSaving.value = true
  try {
    const detail = await getAdminProviderDetail(providerId)
    editingProviderId.value = providerId
    applyProviderForm(detail)
    providerDialogVisible.value = true
  } finally {
    providerSaving.value = false
  }
}

const closeProviderDialog = () => {
  providerDialogVisible.value = false
  editingProviderId.value = ''
  resetProviderForm()
}

const buildProviderPayload = (): AdminProviderPayload => ({
  code: providerForm.code,
  name: providerForm.name,
  description: providerForm.description,
  iconUrl: providerForm.iconUrl,
  baseUrl: providerForm.baseUrl,
  apiKey: providerForm.apiKey,
  chatEndpoint: providerForm.chatEndpoint,
  imageEndpoint: providerForm.imageEndpoint,
  videoEndpoint: providerForm.videoEndpoint,
  defaultChatModel: providerForm.defaultChatModel,
  supportedTypes: providerForm.supportedTypes,
  isEnabled: Boolean(providerForm.isEnabled),
  sortOrder: Number(providerForm.sortOrder) || 0,
})

const handleSaveProvider = async () => {
  providerSaving.value = true
  try {
    const payload = buildProviderPayload()
    if (editingProviderId.value) {
      await updateAdminProvider(editingProviderId.value, payload)
    } else {
      await createAdminProvider(payload)
    }
    await loadProviders()
    closeProviderDialog()
  } finally {
    providerSaving.value = false
  }
}

const toggleSupportedType = (value: string) => {
  if (providerForm.supportedTypes.includes(value)) {
    providerForm.supportedTypes = providerForm.supportedTypes.filter(item => item !== value)
    if (!providerForm.supportedTypes.length) {
      providerForm.supportedTypes = ['CHAT']
    }
    return
  }

  providerForm.supportedTypes = [...providerForm.supportedTypes, value]
}

const toggleProviderEnabled = async (provider: AdminProviderItem) => {
  const detail = await getAdminProviderDetail(provider.id)
  await updateAdminProvider(provider.id, {
    code: detail.code,
    name: detail.name,
    description: detail.description,
    iconUrl: detail.iconUrl,
    baseUrl: detail.baseUrl,
    apiKey: detail.apiKey,
    chatEndpoint: detail.chatEndpoint,
    imageEndpoint: detail.imageEndpoint,
    videoEndpoint: detail.videoEndpoint,
    defaultChatModel: detail.defaultChatModel,
    supportedTypes: detail.supportedTypes,
    isEnabled: !provider.isEnabled,
    sortOrder: detail.sortOrder,
  })
  await loadProviders()
}

const handleDeleteProvider = async (provider: AdminProviderItem) => {
  if (!window.confirm(`确认删除厂商“${provider.name}”吗？删除后其模型也会一起删除。`)) {
    return
  }

  await deleteAdminProvider(provider.id)
  if (selectedProvider.value?.id === provider.id) {
    closeModelManager()
  }
  await loadProviders()
}

const openModelManager = async (provider: AdminProviderItem) => {
  selectedProvider.value = provider
  modelKeyword.value = ''
  modelStatus.value = 'ALL'
  modelCategoryFilter.value = 'ALL'
  modelManagerVisible.value = true
  await loadModels(provider.id)
}

const closeModelManager = () => {
  modelManagerVisible.value = false
  modelDialogVisible.value = false
  selectedProvider.value = null
  models.value = []
  resetModelForm()
}

const openCreateModelDialog = () => {
  resetModelForm()
  modelDialogVisible.value = true
}

const openEditModelDialog = (model: AdminProviderModelItem) => {
  applyModelForm(model)
  modelDialogVisible.value = true
}

const closeModelDialog = () => {
  modelDialogVisible.value = false
  resetModelForm()
}

const readCapabilityFlag = (value: Record<string, any> | null | undefined, key: string) => Boolean(value && value[key])

const toggleModelCapability = (key: string) => {
  const nextCapabilityJson = { ...(modelForm.capabilityJson || {}) }
  if (nextCapabilityJson[key]) {
    delete nextCapabilityJson[key]
  } else {
    nextCapabilityJson[key] = true
  }
  modelForm.capabilityJson = nextCapabilityJson
}

const buildModelPayload = (): AdminProviderModelPayload => ({
  category: modelForm.category,
  label: modelForm.label,
  modelKey: modelForm.modelKey,
  description: modelForm.description,
  sortOrder: Number(modelForm.sortOrder) || 0,
  isEnabled: Boolean(modelForm.isEnabled),
  capabilityJson: Object.keys(modelForm.capabilityJson || {}).length ? modelForm.capabilityJson : null,
  defaultParamsJson: parseOptionalJson(modelForm.defaultParamsJsonText, '默认参数 JSON'),
})

const handleSaveModel = async () => {
  if (!selectedProvider.value) {
    ElMessage.error('请先选择厂商')
    return
  }

  try {
    modelSaving.value = true
    const payload = buildModelPayload()
    if (editingModelId.value) {
      await updateAdminProviderModel(selectedProvider.value.id, editingModelId.value, payload)
    } else {
      await createAdminProviderModel(selectedProvider.value.id, payload)
    }
    await loadModels(selectedProvider.value.id)
    await loadProviders()
    closeModelDialog()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存模型失败')
  } finally {
    modelSaving.value = false
  }
}

const toggleModelEnabled = async (model: AdminProviderModelItem) => {
  if (!selectedProvider.value) {
    return
  }

  await updateAdminProviderModel(selectedProvider.value.id, model.id, {
    category: model.category,
    label: model.label,
    modelKey: model.modelKey,
    description: model.description,
    sortOrder: model.sortOrder,
    isEnabled: !model.isEnabled,
    capabilityJson: model.capabilityJson,
    defaultParamsJson: model.defaultParamsJson,
  })
  await loadModels(selectedProvider.value.id)
  await loadProviders()
}

const handleDeleteModel = async (model: AdminProviderModelItem) => {
  if (!selectedProvider.value) {
    return
  }

  if (!window.confirm(`确认删除模型“${model.label}”吗？`)) {
    return
  }

  await deleteAdminProviderModel(selectedProvider.value.id, model.id)
  await loadModels(selectedProvider.value.id)
  await loadProviders()
}

onMounted(() => {
  void loadProviders()
})
</script>
