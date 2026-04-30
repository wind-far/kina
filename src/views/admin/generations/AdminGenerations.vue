<template>
  <AdminPageContainer title="生成记录" description="先打通生成记录后台列表、状态筛选、结果预览和错误排查，便于定位线上生成链路问题。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="loadRecords" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <div class="admin-filter-bar">
      <div class="admin-filter-bar__chips">
        <button
          v-for="option in typeOptions"
          :key="option.value"
          class="admin-chip-button"
          type="button"
          :class="{ 'is-active': filters.type === option.value }"
          @click="setType(option.value)"
        >
          {{ option.label }}
        </button>
        <button
          v-for="option in statusOptions"
          :key="option.value"
          class="admin-chip-button"
          type="button"
          :class="{ 'is-active': filters.status === option.value }"
          @click="setStatus(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="admin-list-item__meta">当前基于已有记录接口做前端筛选，后续如数据量变大再升级成分页查询。</div>
    </div>

    <div class="admin-grid admin-grid--stats">
      <AdminStatCard label="记录总数" :value="records.length" hint="当前账号可见的全部生成记录" />
      <AdminStatCard label="筛选结果" :value="filteredRecords.length" hint="当前筛选条件命中的记录数" />
      <AdminStatCard label="成功完成" :value="completedCount" hint="done=true 且无错误的记录数" />
      <AdminStatCard label="失败记录" :value="failedCount" hint="优先用来排查厂商、落盘和入库问题" />
    </div>

    <div class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">记录列表</h4>
          <div class="admin-card__desc">展示 prompt、模型、生成状态、结果图与错误信息，帮助后台快速排查生成链路。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div v-if="loading" class="admin-empty">正在加载生成记录...</div>
        <div v-else-if="filteredRecords.length === 0" class="admin-empty">当前筛选条件下还没有生成记录。</div>
        <div v-else class="admin-generation-list">
          <div v-for="record in paginatedRecords" :key="record.id" class="admin-generation-card">
            <div class="admin-generation-card__preview">
              <img
                v-if="getPreviewUrl(record)"
                :src="getPreviewUrl(record) || ''"
                :alt="record.prompt || '生成结果预览'"
                class="admin-generation-card__image"
              >
              <div v-else class="admin-generation-card__image admin-generation-card__image--empty">
                无结果预览
              </div>
            </div>

            <div class="admin-generation-card__body">
              <div class="admin-generation-card__head">
                <div>
                  <div class="admin-generation-card__title">{{ buildRecordTitle(record) }}</div>
                  <div class="admin-generation-card__meta">
                    类型：{{ record.type || 'unknown' }} · 创建于 {{ formatDate(record.createdAt) }}
                  </div>
                </div>
                <div class="admin-generation-card__tags">
                  <span class="admin-status" :class="getStatusClass(record)">
                    {{ getStatusLabel(record) }}
                  </span>
                  <span class="admin-chip">模型：{{ record.model || record.modelKey || '未记录' }}</span>
                </div>
              </div>

              <div class="admin-generation-card__prompt">
                {{ record.prompt || '暂无提示词' }}
              </div>

              <div class="admin-generation-card__stats">
                <span>比例：{{ record.ratio || '未记录' }}</span>
                <span>分辨率：{{ record.resolution || '未记录' }}</span>
                <span>功能：{{ record.feature || '未记录' }}</span>
                <span>技能：{{ record.skill || '未记录' }}</span>
                <span>输出数：{{ record.outputs.length || record.images.length }}</span>
              </div>

              <div v-if="record.error" class="admin-generation-card__error">
                <strong>错误信息：</strong>{{ record.error }}
              </div>

              <div v-else-if="record.content && record.type === 'agent'" class="admin-generation-card__content-preview">
                <strong>文本结果：</strong>{{ record.content }}
              </div>

              <div class="admin-generation-card__footer">
                <div class="admin-generation-card__meta">
                  任务 ID：{{ record.agentTaskId || '未记录' }}
                </div>
                <div class="admin-generation-card__meta">
                  {{ buildOutputSummary(record) }}
                </div>
              </div>
            </div>
          </div>
          <AdminPagination
            v-model:page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="filteredRecords.length"
            :disabled="loading"
          />
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AdminPagination from '@/components/admin/common/AdminPagination.vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { listGenerationRecords, type PersistedGenerationRecord } from '@/api/generation-records'

type GenerationStatusFilter = 'all' | 'completed' | 'failed' | 'running'
type GenerationTypeFilter = 'all' | PersistedGenerationRecord['type']

const loading = ref(false)
const records = ref<PersistedGenerationRecord[]>([])

const filters = reactive<{
  type: GenerationTypeFilter
  status: GenerationStatusFilter
}>({
  type: 'all',
  status: 'all',
})
const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const typeOptions: Array<{ label: string; value: GenerationTypeFilter }> = [
  { label: '全部类型', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '智能体', value: 'agent' },
  { label: '数字人', value: 'digital-human' },
  { label: '动态内容', value: 'motion' },
]

const statusOptions: Array<{ label: string; value: GenerationStatusFilter }> = [
  { label: '全部状态', value: 'all' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
  { label: '进行中', value: 'running' },
]

const getRecordStatus = (record: PersistedGenerationRecord): GenerationStatusFilter => {
  if (record.error) {
    return 'failed'
  }

  if (record.done) {
    return 'completed'
  }

  return 'running'
}

const filteredRecords = computed(() => {
  return records.value.filter((record) => {
    if (filters.type !== 'all' && record.type !== filters.type) {
      return false
    }

    if (filters.status !== 'all' && getRecordStatus(record) !== filters.status) {
      return false
    }

    return true
  })
})

const paginatedRecords = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  return filteredRecords.value.slice(start, start + pagination.pageSize)
})

const completedCount = computed(() => records.value.filter((record) => getRecordStatus(record) === 'completed').length)
const failedCount = computed(() => records.value.filter((record) => getRecordStatus(record) === 'failed').length)

const loadRecords = async () => {
  loading.value = true
  try {
    const list = await listGenerationRecords()
    records.value = [...list].sort((first, second) => {
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
    })
    pagination.page = 1
  } finally {
    loading.value = false
  }
}

const setType = (type: GenerationTypeFilter) => {
  filters.type = type
  pagination.page = 1
}

const setStatus = (status: GenerationStatusFilter) => {
  filters.status = status
  pagination.page = 1
}

const getPreviewUrl = (record: PersistedGenerationRecord) => {
  const imageOutput = record.outputs.find((output) => output.outputType === 'image' && output.url)
  if (imageOutput?.url) {
    return imageOutput.url
  }

  const videoOutput = record.outputs.find((output) => output.outputType === 'video' && output.url)
  if (videoOutput?.url) {
    return videoOutput.url
  }

  return record.images[0] || ''
}

const getStatusLabel = (record: PersistedGenerationRecord) => {
  const status = getRecordStatus(record)
  switch (status) {
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return '进行中'
  }
}

const getStatusClass = (record: PersistedGenerationRecord) => {
  return getRecordStatus(record) === 'completed'
    ? 'admin-status--success'
    : getRecordStatus(record) === 'failed'
      ? 'admin-status--danger'
      : 'admin-status--warning'
}

const buildRecordTitle = (record: PersistedGenerationRecord) => {
  if (record.model) {
    return `${record.model} 生成记录`
  }

  if (record.modelKey) {
    return `${record.modelKey} 生成记录`
  }

  return '生成记录'
}

const buildOutputSummary = (record: PersistedGenerationRecord) => {
  const outputTypes = record.outputs.map((output) => output.outputType)
  if (outputTypes.length) {
    return `输出类型：${outputTypes.join(' / ')}`
  }

  if (record.images.length) {
    return `图片结果：${record.images.length} 张`
  }

  return '暂无输出结果'
}

const formatDate = (value?: string) => {
  if (!value) {
    return '未知时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  void loadRecords()
})
</script>
