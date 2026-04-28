<template>
  <AdminPageContainer title="存储配置" description="集中管理对象存储配置，并清晰展示当前启用状态与本地回退策略。">
    <div class="admin-provider-toolbar">
      <input
        v-model.trim="keyword"
        class="admin-input admin-provider-toolbar__search"
        type="text"
        placeholder="搜索配置名称或编码"
      >
      <select v-model="statusFilter" class="admin-input admin-provider-toolbar__status">
        <option value="ALL">配置状态</option>
        <option value="DEFAULT">当前启用</option>
        <option value="ENABLED">已启用</option>
        <option value="DISABLED">未启用</option>
      </select>
      <button class="admin-button admin-button--secondary" type="button" @click="loadConfigs" :disabled="loading || submitting || activatingId !== ''">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
      <button
        v-if="hasFilters"
        class="admin-button admin-button--ghost"
        type="button"
        :disabled="loading || submitting || activatingId !== ''"
        @click="resetFilters"
      >
        清空筛选
      </button>
    </div>

    <div class="admin-grid admin-grid--stats">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">配置总数</div>
        <div class="admin-stat-card__value">{{ configs.length }}</div>
        <div class="admin-stat-card__hint">当前后台已保存的全部对象存储配置</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">启用配置</div>
        <div class="admin-stat-card__value">{{ enabledCount }}</div>
        <div class="admin-stat-card__hint">包含默认配置与备用启用配置</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">当前生效</div>
        <div class="admin-stat-card__value">{{ activeConfig?.name || '本地回退' }}</div>
        <div class="admin-stat-card__hint">未配置时自动回退到本地 `uploads/`</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">存储模式</div>
        <div class="admin-stat-card__value">S3</div>
        <div class="admin-stat-card__hint">当前后端统一按 S3 兼容协议接入</div>
      </div>
    </div>

    <div class="admin-section-head">
      <div>
        <div class="admin-section-head__title">配置列表</div>
        <div class="admin-section-head__desc">
          {{ filteredConfigs.length }} 条结果，默认配置会优先承接生成资源上传。
        </div>
      </div>
    </div>

    <div class="admin-provider-grid admin-storage-grid">
      <button class="admin-provider-create-card" type="button" @click="openCreateDialog">
        <div class="admin-provider-create-card__plus">+</div>
        <div class="admin-provider-create-card__title">新增配置</div>
        <div class="admin-provider-create-card__desc">添加新的对象存储配置</div>
        <div class="admin-provider-create-card__footer-actions">
          <span class="admin-provider-create-card__action admin-provider-create-card__action--muted">本地回退</span>
          <span class="admin-provider-create-card__action">手动创建</span>
        </div>
      </button>

      <div class="admin-storage-local-card">
        <div class="admin-storage-local-card__title">本地 uploads 回退</div>
        <div class="admin-storage-local-card__desc">当没有可用对象存储配置时，系统会自动回退到服务器本地目录。</div>
        <div class="admin-storage-local-card__path">`/app/uploads` / `uploads/`</div>
        <div class="admin-storage-local-card__footer">无需额外配置，可作为兜底存储方案。</div>
      </div>

      <div v-if="!loading && filteredConfigs.length === 0" class="admin-empty admin-storage-empty">
        当前筛选条件下暂无存储配置，建议清空筛选或新增一条配置。
      </div>

      <div v-for="config in filteredConfigs" :key="config.id" class="admin-provider-tile admin-storage-card" :class="{ 'is-active': config.isDefault }">
        <div class="admin-provider-tile__header">
          <div class="admin-provider-tile__brand">
            <div class="admin-provider-avatar">
              <span>{{ getStorageInitial(config.name || config.code) }}</span>
            </div>
            <div class="admin-provider-tile__meta">
              <div class="admin-provider-tile__title">{{ config.name || config.code }}</div>
              <div class="admin-provider-tile__link admin-storage-card__subline">{{ config.code }}</div>
            </div>
          </div>
          <div class="admin-provider-tile__actions">
            <button class="admin-inline-button" type="button" :disabled="submitting || activatingId !== ''" @click="openEditDialog(config)">编辑</button>
          </div>
        </div>

        <div class="admin-provider-tile__status-row">
          <span class="admin-status" :class="config.isDefault ? 'admin-status--success' : config.isEnabled ? 'admin-status--success' : 'admin-status--warning'">
            {{ config.isDefault ? '当前启用' : config.isEnabled ? '已启用' : '未启用' }}
          </span>
          <button
            v-if="!config.isDefault"
            class="admin-inline-button"
            type="button"
            :disabled="activatingId === config.id || submitting"
            @click="handleActivate(config.id)"
          >
            {{ activatingId === config.id ? '启用中...' : '设为启用' }}
          </button>
        </div>

        <div class="admin-storage-card__info">
          <div><span class="admin-storage-card__label">Endpoint</span>{{ config.endpoint || '未配置' }}</div>
          <div><span class="admin-storage-card__label">Bucket</span>{{ config.bucket || '未配置' }}</div>
          <div><span class="admin-storage-card__label">Region</span>{{ config.region || '未配置' }}</div>
          <div><span class="admin-storage-card__label">Domain</span>{{ config.domain || '未配置' }}</div>
        </div>

        <div class="admin-provider-tile__chips">
          <span class="admin-chip">{{ config.providerType }}</span>
          <span class="admin-chip">排序 {{ config.sortOrder }}</span>
          <span v-if="config.accessKeyHint" class="admin-chip">AK {{ config.accessKeyHint }}</span>
          <span v-if="config.secretKeyHint" class="admin-chip">SK {{ config.secretKeyHint }}</span>
        </div>

        <div class="admin-provider-tile__footer">
          <span>{{ config.description || '暂无说明' }}</span>
          <span>{{ formatDate(config.updatedAt) }}</span>
        </div>
      </div>
    </div>
  </AdminPageContainer>

  <div v-if="dialogVisible" class="admin-dialog-mask" @click="closeDialog">
    <div class="admin-dialog admin-dialog--provider-form" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">{{ editingId ? '编辑存储配置' : '新增存储配置' }}</h3>
          <div class="admin-dialog__desc">维护对象存储连接信息、启用状态与默认配置。</div>
        </div>
        <button class="admin-dialog__close" type="button" @click="closeDialog">×</button>
      </div>

      <form class="admin-form admin-dialog__body" @submit.prevent="handleSubmit">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label" for="storage-name">名称</label>
            <input id="storage-name" v-model.trim="form.name" class="admin-input" type="text" placeholder="例如：生产 MinIO">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="storage-code">编码</label>
            <input id="storage-code" v-model.trim="form.code" class="admin-input" type="text" placeholder="例如：minio-prod">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="storage-access-key">Access Key</label>
            <input id="storage-access-key" v-model.trim="form.accessKey" class="admin-input" type="text" placeholder="请输入 Access Key">
            <div class="admin-form__hint">编辑已有配置时，如果不想修改 Access Key，可以留空。</div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="storage-secret-key">Secret Key</label>
            <input id="storage-secret-key" v-model.trim="form.secretKey" class="admin-input" type="password" placeholder="请输入 Secret Key">
            <div class="admin-form__hint">编辑已有配置时，如果不想修改 Secret Key，可以留空。</div>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="storage-endpoint">Endpoint</label>
            <input id="storage-endpoint" v-model.trim="form.endpoint" class="admin-input" type="text" placeholder="例如：https://s3.example.com">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="storage-bucket">Bucket</label>
            <input id="storage-bucket" v-model.trim="form.bucket" class="admin-input" type="text" placeholder="请输入 Bucket">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="storage-region">区域</label>
            <input id="storage-region" v-model.trim="form.region" class="admin-input" type="text" placeholder="例如：ap-guangzhou">
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="storage-domain">自定义域名</label>
            <input id="storage-domain" v-model.trim="form.domain" class="admin-input" type="text" placeholder="例如：https://cdn.example.com">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label" for="storage-sort-order">排序</label>
            <input id="storage-sort-order" v-model.number="form.sortOrder" class="admin-input" type="number" min="0" step="1" placeholder="999">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label">状态选项</label>
            <label class="admin-switch-row">
              <input v-model="form.isEnabled" type="checkbox">
              <span>保存后立即启用</span>
            </label>
            <label class="admin-switch-row">
              <input v-model="form.isDefault" type="checkbox">
              <span>设为默认配置</span>
            </label>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label" for="storage-description">描述</label>
            <textarea id="storage-description" v-model.trim="form.description" class="admin-textarea" placeholder="可填写用途、环境说明、负责人等信息"></textarea>
          </div>
        </div>

        <div class="admin-form__footer">
          <button class="admin-button admin-button--secondary" type="button" @click="closeDialog" :disabled="submitting">取消</button>
          <button class="admin-button admin-button--primary" type="submit" :disabled="submitting || loading">
            {{ submitting ? '提交中...' : editingId ? '保存修改' : '创建配置' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import {
  activateStorageConfig,
  createStorageConfig,
  listStorageConfigs,
  updateStorageConfig,
  type StorageConfigItem,
  type StorageConfigPayload,
} from '@/api/storage-config'

const loading = ref(false)
const submitting = ref(false)
const activatingId = ref('')
const editingId = ref('')
const dialogVisible = ref(false)
const keyword = ref('')
const statusFilter = ref<'ALL' | 'DEFAULT' | 'ENABLED' | 'DISABLED'>('ALL')
const configs = ref<StorageConfigItem[]>([])

const createDefaultForm = () => ({
  name: '',
  code: '',
  accessKey: '',
  secretKey: '',
  endpoint: '',
  bucket: '',
  domain: '',
  region: '',
  sortOrder: 999,
  description: '',
  isEnabled: true,
  isDefault: false,
})

const form = reactive(createDefaultForm())

const enabledCount = computed(() => configs.value.filter(item => item.isEnabled).length)
const activeConfig = computed(() => configs.value.find(item => item.isDefault) || null)
// 统一维护筛选状态，保证列表、统计和空状态展示逻辑一致。
const hasFilters = computed(() => keyword.value !== '' || statusFilter.value !== 'ALL')
const filteredConfigs = computed(() => {
  return configs.value.filter((config) => {
    const matchedKeyword = !keyword.value
      || config.name.toLowerCase().includes(keyword.value.toLowerCase())
      || config.code.toLowerCase().includes(keyword.value.toLowerCase())

    const matchedStatus = statusFilter.value === 'ALL'
      || (statusFilter.value === 'DEFAULT' && config.isDefault)
      || (statusFilter.value === 'ENABLED' && config.isEnabled)
      || (statusFilter.value === 'DISABLED' && !config.isEnabled)

    return matchedKeyword && matchedStatus
  })
})

const applyForm = (value = createDefaultForm()) => {
  form.name = value.name
  form.code = value.code
  form.accessKey = value.accessKey
  form.secretKey = value.secretKey
  form.endpoint = value.endpoint
  form.bucket = value.bucket
  form.domain = value.domain
  form.region = value.region
  form.sortOrder = value.sortOrder
  form.description = value.description
  form.isEnabled = value.isEnabled
  form.isDefault = value.isDefault
}

const loadConfigs = async () => {
  loading.value = true
  try {
    configs.value = await listStorageConfigs()
  } finally {
    loading.value = false
  }
}

// 重置筛选条件时只恢复列表状态，不影响已填写的弹窗表单。
const resetFilters = () => {
  keyword.value = ''
  statusFilter.value = 'ALL'
}

const resetForm = () => {
  editingId.value = ''
  applyForm()
}

const openCreateDialog = () => {
  resetForm()
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
  resetForm()
}

// 编辑已有配置时不回填明文密钥，留空表示沿用旧值。
const openEditDialog = (config: StorageConfigItem) => {
  editingId.value = config.id
  applyForm({
    name: config.name,
    code: config.code,
    accessKey: '',
    secretKey: '',
    endpoint: config.endpoint,
    bucket: config.bucket,
    domain: config.domain,
    region: config.region,
    sortOrder: config.sortOrder,
    description: config.description,
    isEnabled: config.isEnabled,
    isDefault: config.isDefault,
  })
  dialogVisible.value = true
}

const buildPayload = (): StorageConfigPayload => ({
  name: form.name,
  code: form.code,
  accessKey: form.accessKey,
  secretKey: form.secretKey,
  endpoint: form.endpoint,
  bucket: form.bucket,
  domain: form.domain || undefined,
  region: form.region || undefined,
  sortOrder: Number.isFinite(Number(form.sortOrder)) ? Number(form.sortOrder) : 999,
  description: form.description || undefined,
  isEnabled: form.isEnabled,
  isDefault: form.isDefault,
})

const handleSubmit = async () => {
  submitting.value = true
  try {
    if (editingId.value) {
      await updateStorageConfig(editingId.value, buildPayload())
    } else {
      await createStorageConfig(buildPayload())
    }

    await loadConfigs()
    closeDialog()
  } finally {
    submitting.value = false
  }
}

// 启用成功后重新拉一次列表，确保后台状态与服务端保持一致。
const handleActivate = async (id: string) => {
  activatingId.value = id
  try {
    await activateStorageConfig(id)
    await loadConfigs()
  } finally {
    activatingId.value = ''
  }
}

const getStorageInitial = (value: string) => String(value || '').trim().slice(0, 1).toUpperCase() || 'S'
const formatDate = (value: string) => String(value || '').replace('T', ' ').slice(0, 16) || '未知时间'

onMounted(() => {
  void loadConfigs()
})
</script>
