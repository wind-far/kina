<template>
  <AdminPageContainer title="存储配置" description="优先对接现有对象存储配置接口，并清晰标识当前启用状态与本地回退策略。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="startCreate" :disabled="loading || submitting || activatingId !== ''">
        新建配置
      </button>
      <button class="admin-button admin-button--secondary" type="button" @click="loadConfigs" :disabled="loading || submitting || activatingId !== ''">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <div class="admin-filter-bar">
      <div class="admin-filter-bar__chips">
        <span class="admin-chip">对象存储配置</span>
        <span class="admin-chip">本地 uploads 回退</span>
        <span class="admin-chip">支持启用切换</span>
        <span class="admin-chip">支持新建与编辑</span>
      </div>
      <div class="admin-list-item__meta">当前阶段先打通存储配置后台闭环，后续再补测试连接等能力。</div>
    </div>

    <div class="admin-grid admin-grid--two">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">配置表单</h4>
            <div class="admin-card__desc">用于新建对象存储配置，或对现有配置进行编辑更新。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <form class="admin-form" @submit.prevent="handleSubmit">
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
              <button class="admin-button admin-button--secondary" type="button" @click="resetForm" :disabled="submitting">
                {{ editingId ? '取消编辑' : '清空表单' }}
              </button>
              <button class="admin-button admin-button--primary" type="submit" :disabled="submitting || loading">
                {{ submitting ? '提交中...' : editingId ? '保存修改' : '创建配置' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">配置列表</h4>
            <div class="admin-card__desc">展示当前已保存的对象存储配置，并支持切换当前生效配置。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div v-if="loading" class="admin-empty">正在加载存储配置...</div>
          <div v-else-if="configs.length === 0" class="admin-empty">当前还没有对象存储配置，系统会自动使用本地 `uploads/` 目录回退。</div>
          <div v-else class="admin-list">
            <div v-for="config in configs" :key="config.id" class="admin-list-item">
              <div>
                <div class="admin-list-item__title">{{ config.name || config.code }}</div>
                <div class="admin-list-item__meta">
                  {{ config.endpoint || '未配置 endpoint' }} · Bucket：{{ config.bucket || '未配置' }}
                </div>
              </div>
              <div class="admin-list-item__meta">
                区域：{{ config.region || '未配置' }}
                <template v-if="config.domain"> · 域名：{{ config.domain }}</template>
                <template v-if="config.description"> · 说明：{{ config.description }}</template>
                <template v-if="config.isDefault"> · 默认配置</template>
              </div>
              <div class="admin-list-item__actions">
                <div class="admin-status" :class="config.isEnabled ? 'admin-status--success' : 'admin-status--warning'">
                  {{ config.isEnabled ? '当前启用' : '未启用' }}
                </div>
                <button class="admin-inline-button" type="button" :disabled="submitting || activatingId !== ''" @click="startEdit(config)">
                  编辑
                </button>
                <button
                  v-if="!config.isEnabled"
                  class="admin-inline-button"
                  type="button"
                  :disabled="activatingId === config.id || submitting"
                  @click="handleActivate(config.id)"
                >
                  {{ activatingId === config.id ? '启用中...' : '设为启用' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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

const resetForm = () => {
  editingId.value = ''
  applyForm()
}

const startCreate = () => {
  resetForm()
}

// 编辑已有配置时不回填明文密钥，留空表示沿用旧值。
const startEdit = (config: StorageConfigItem) => {
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
    resetForm()
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

onMounted(() => {
  void loadConfigs()
})
</script>
