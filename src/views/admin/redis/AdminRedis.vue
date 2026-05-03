<template>
  <AdminPageContainer title="Redis 管理" description="集中查看 Redis 健康状态、缓存数量、任务运行态与分布式锁情况。">
    <template #actions>
      <button
        class="admin-button admin-button--secondary"
        type="button"
        :disabled="loading || actionLoading"
        @click="loadRedisOverview"
      >
        {{ loading ? '刷新中...' : '刷新状态' }}
      </button>
    </template>

    <div class="admin-grid admin-grid--stats">
      <AdminStatCard label="Redis 状态" :value="overview?.health.ok ? '正常' : '异常'" hint="根据健康检查接口实时返回" />
      <AdminStatCard label="模型缓存" :value="overview?.caches.providerCatalog.count ?? 0" hint="公开模型目录缓存数量" />
      <AdminStatCard label="发现缓存" :value="overview?.caches.providerDiscover.count ?? 0" hint="厂商 /v1/models 发现结果缓存数量" />
      <AdminStatCard label="技能缓存" :value="(overview?.caches.runtimeSkills.count ?? 0) + (overview?.caches.workspaceRuntimeSkills.count ?? 0)" hint="技能运行时与工作台技能缓存总数" />
      <AdminStatCard label="任务锁" :value="overview?.tasks.lock.count ?? 0" hint="当前 Redis 中仍存在的任务执行锁数量" />
      <AdminStatCard label="幂等记录" :value="overview?.tasks.idempotency.count ?? 0" hint="用于防重复提交的短期幂等键数量" />
      <AdminStatCard label="提交限流" :value="overview?.tasks.submitRateLimit.count ?? 0" hint="当前 Redis 中仍在生效的提交限流窗口数量" />
    </div>

    <div class="admin-card admin-redis-tabs-card">
      <div class="admin-card__content admin-redis-tabs-card__content">
        <button
          v-for="item in tabItems"
          :key="item.key"
          class="admin-system-tabs__item"
          :class="{ 'is-active': currentTab === item.key }"
          type="button"
          @click="currentTab = item.key"
        >
          <span class="admin-system-tabs__title">{{ item.label }}</span>
          <span class="admin-system-tabs__desc">{{ item.description }}</span>
        </button>
      </div>
    </div>

    <div v-if="currentTab === 'overview'" class="admin-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">Redis 总览</h4>
          <div class="admin-card__desc">按缓存、任务运行态、限流与并发模块查看当前 Redis 使用情况。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <AdminSystemRedisPanel
          :overview="overview"
          :loading="loading"
          :action-loading="actionLoading"
          :on-refresh="loadRedisOverview"
          :on-clear-scope="handleClearRedisScope"
        />
      </div>
    </div>

    <div v-else-if="currentTab === 'settings'" class="admin-card admin-redis-settings-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">运行参数</h4>
          <div class="admin-card__desc">在后台调整并发上限与限流阈值，服务端会自动读取最新配置。</div>
        </div>
        <button
          class="admin-button admin-button--primary"
          type="button"
          :disabled="settingsLoading || settingsSaving"
          @click="handleSaveRuntimeSettings"
        >
          {{ settingsSaving ? '保存中...' : '保存参数' }}
        </button>
      </div>
      <div class="admin-card__content admin-redis-settings-card__grid">
        <label class="admin-redis-settings-card__field">
          <span>任务提交限流</span>
          <input v-model.number="runtimeSettings.taskSubmitRateLimit" class="admin-input" type="number" min="1" max="200">
        </label>
        <label class="admin-redis-settings-card__field">
          <span>验证码限流</span>
          <input v-model.number="runtimeSettings.authVerificationRateLimit" class="admin-input" type="number" min="1" max="200">
        </label>
        <label class="admin-redis-settings-card__field">
          <span>登录限流</span>
          <input v-model.number="runtimeSettings.authLoginRateLimit" class="admin-input" type="number" min="1" max="200">
        </label>
        <label class="admin-redis-settings-card__field">
          <span>模型发现限流</span>
          <input v-model.number="runtimeSettings.providerModelDiscoverRateLimit" class="admin-input" type="number" min="1" max="200">
        </label>
        <label class="admin-redis-settings-card__field">
          <span>用户并发上限</span>
          <input v-model.number="runtimeSettings.taskUserConcurrencyLimit" class="admin-input" type="number" min="1" max="200">
        </label>
        <label class="admin-redis-settings-card__field">
          <span>技能并发上限</span>
          <input v-model.number="runtimeSettings.taskSkillConcurrencyLimit" class="admin-input" type="number" min="1" max="200">
        </label>
        <label class="admin-redis-settings-card__field">
          <span>厂商并发上限</span>
          <input v-model.number="runtimeSettings.taskProviderConcurrencyLimit" class="admin-input" type="number" min="1" max="500">
        </label>
      </div>
    </div>

    <div v-else-if="currentTab === 'risk'" class="admin-card admin-redis-risk-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">残留 Key 风险提示</h4>
          <div class="admin-card__desc">基于当前 Redis 中的 runtime、lock、snapshot、abort 等 key 关系做快速诊断。</div>
        </div>
      </div>
      <div class="admin-card__content admin-redis-risk-card__list">
        <div
          v-for="(item, index) in overview?.riskHints || []"
          :key="`${item.level}-${index}`"
          class="admin-redis-risk-card__item"
          :class="`is-${item.level}`"
        >
          {{ item.message }}
        </div>
      </div>
    </div>

    <div v-else class="admin-card admin-redis-query-card">
      <div class="admin-card__header">
        <div>
          <h4 class="admin-card__title">任务明细查询</h4>
          <div class="admin-card__desc">输入生成记录 `recordId`，查看 Redis 中该任务的运行态、停止标记和快照摘要。</div>
        </div>
      </div>
      <div class="admin-card__content admin-redis-query-card__content">
        <div class="admin-redis-query-card__toolbar">
          <input
            v-model.trim="recordIdKeyword"
            class="admin-input admin-redis-query-card__input"
            type="text"
            placeholder="请输入 recordId，例如 cmopoi65y0009l1t57j4g67ix"
          >
          <button
            class="admin-button admin-button--primary"
            type="button"
            :disabled="detailLoading || !recordIdKeyword"
            @click="loadTaskDetail"
          >
            {{ detailLoading ? '查询中...' : '查询任务' }}
          </button>
        </div>

          <div v-if="taskDetail" class="admin-redis-query-card__detail">
          <div class="admin-redis-query-card__grid">
            <div class="admin-redis-query-card__item">
              <span>运行状态</span>
              <strong>{{ taskDetail.runtime?.status || '无运行态' }}</strong>
            </div>
            <div class="admin-redis-query-card__item">
              <span>策略类型</span>
              <strong>{{ taskDetail.runtime?.strategyKey || '--' }}</strong>
            </div>
            <div class="admin-redis-query-card__item">
              <span>停止标记</span>
              <strong>{{ taskDetail.abort.exists ? `存在 (${taskDetail.abort.ttlSeconds}s)` : '不存在' }}</strong>
            </div>
            <div class="admin-redis-query-card__item">
              <span>执行锁</span>
              <strong>{{ taskDetail.lock.exists ? `存在 (${taskDetail.lock.ttlMs}ms)` : '不存在' }}</strong>
            </div>
            <div class="admin-redis-query-card__item">
              <span>快照类型</span>
              <strong>{{ taskDetail.snapshot?.type || '--' }}</strong>
            </div>
            <div class="admin-redis-query-card__item">
              <span>技能</span>
              <strong>{{ taskDetail.snapshot?.skill || '--' }}</strong>
            </div>
            <div class="admin-redis-query-card__item">
              <span>图片数</span>
              <strong>{{ taskDetail.snapshot?.imageCount ?? 0 }}</strong>
            </div>
            <div class="admin-redis-query-card__item">
              <span>输出数</span>
              <strong>{{ taskDetail.snapshot?.outputCount ?? 0 }}</strong>
            </div>
          </div>

          <div class="admin-redis-query-card__prompt">
            <div class="admin-redis-query-card__prompt-title">数据库主记录摘要</div>
            <div class="admin-redis-query-card__compare-grid">
              <div class="admin-redis-query-card__item">
                <span>数据库状态</span>
                <strong>{{ taskDetail.database?.status || '--' }}</strong>
              </div>
              <div class="admin-redis-query-card__item">
                <span>数据库类型</span>
                <strong>{{ taskDetail.database?.type || '--' }}</strong>
              </div>
              <div class="admin-redis-query-card__item">
                <span>数据库技能</span>
                <strong>{{ taskDetail.database?.skill || '--' }}</strong>
              </div>
              <div class="admin-redis-query-card__item">
                <span>数据库模型</span>
                <strong>{{ taskDetail.database?.modelKey || '--' }}</strong>
              </div>
              <div class="admin-redis-query-card__item">
                <span>数据库图片数</span>
                <strong>{{ taskDetail.database?.imageCount ?? 0 }}</strong>
              </div>
              <div class="admin-redis-query-card__item">
                <span>数据库输出数</span>
                <strong>{{ taskDetail.database?.outputCount ?? 0 }}</strong>
              </div>
            </div>
          </div>

          <div class="admin-redis-query-card__prompt">
            <div class="admin-redis-query-card__prompt-title">任务提示词摘要</div>
            <div class="admin-redis-query-card__prompt-text">{{ taskDetail.snapshot?.prompt || taskDetail.database?.prompt || '暂无快照提示词。' }}</div>
          </div>

          <div v-if="taskDetail.database?.error || taskDetail.snapshot?.error" class="admin-redis-query-card__prompt">
            <div class="admin-redis-query-card__prompt-title">错误对照</div>
            <div class="admin-redis-query-card__prompt-text">
              Redis: {{ taskDetail.snapshot?.error || '无' }}
              <br>
              DB: {{ taskDetail.database?.error || '无' }}
            </div>
          </div>

          <div class="admin-redis-query-card__prompt">
            <div class="admin-redis-query-card__prompt-title">最近事件摘要</div>
            <div v-if="taskDetail.recentEvents.length" class="admin-redis-query-card__event-list">
              <div v-for="(event, index) in taskDetail.recentEvents" :key="`${event.createdAt}-${index}`" class="admin-redis-query-card__event-item">
                <strong>{{ event.stage }}</strong>
                <span>{{ event.message || event.type }}</span>
                <small>{{ event.createdAt }}</small>
              </div>
            </div>
            <div v-else class="admin-redis-query-card__prompt-text">暂无最近事件摘要。</div>
          </div>
        </div>
      </div>
    </div>

  </AdminPageContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminSystemRedisPanel from '@/views/admin/system/components/AdminSystemRedisPanel.vue'
import {
  clearRedisCacheScope,
  getRedisAdminOverview,
  getRedisRuntimeSettings,
  getRedisTaskDetail,
  saveRedisRuntimeSettings,
  type RedisAdminOverviewConfig,
  type RedisTaskDetailConfig,
  type SystemRedisRuntimeSettingsConfig,
} from '@/api/system-config'

const loading = ref(false)
const actionLoading = ref(false)
const overview = ref<RedisAdminOverviewConfig | null>(null)
const detailLoading = ref(false)
const recordIdKeyword = ref('')
const taskDetail = ref<RedisTaskDetailConfig | null>(null)
const settingsLoading = ref(false)
const settingsSaving = ref(false)
const currentTab = ref<'overview' | 'settings' | 'risk' | 'task'>('overview')
const tabItems = [
  { key: 'overview', label: '总览', description: '查看缓存、任务运行态、限流与并发概览' },
  { key: 'settings', label: '运行参数', description: '调整并发上限与限流阈值' },
  { key: 'risk', label: '风险诊断', description: '查看残留 key 风险提示' },
  { key: 'task', label: '任务诊断', description: '按 recordId 查询 Redis 与数据库对照' },
] as const
const createDefaultRuntimeSettings = (): SystemRedisRuntimeSettingsConfig => ({
  taskSubmitRateLimit: 6,
  authVerificationRateLimit: 5,
  authLoginRateLimit: 10,
  providerModelDiscoverRateLimit: 6,
  taskUserConcurrencyLimit: 3,
  taskSkillConcurrencyLimit: 4,
  taskProviderConcurrencyLimit: 8,
})
const runtimeSettings = ref<SystemRedisRuntimeSettingsConfig>(createDefaultRuntimeSettings())

const loadRedisOverview = async () => {
  loading.value = true
  try {
    overview.value = await getRedisAdminOverview()
  } finally {
    loading.value = false
  }
}

const loadRuntimeSettings = async () => {
  settingsLoading.value = true
  try {
    const nextSettings = await getRedisRuntimeSettings()
    runtimeSettings.value = {
      ...createDefaultRuntimeSettings(),
      ...(nextSettings || {}),
    }
  } finally {
    settingsLoading.value = false
  }
}

const handleSaveRuntimeSettings = async () => {
  settingsSaving.value = true
  try {
    const nextSettings = await saveRedisRuntimeSettings(runtimeSettings.value)
    runtimeSettings.value = {
      ...createDefaultRuntimeSettings(),
      ...(nextSettings || {}),
    }
    await loadRedisOverview()
  } finally {
    settingsSaving.value = false
  }
}

const handleClearRedisScope = async (scope: 'provider-model-catalog' | 'skill-runtime' | 'task-runtime') => {
  const scopeLabel = scope === 'provider-model-catalog'
    ? '模型缓存'
    : scope === 'skill-runtime'
      ? '技能缓存'
      : '任务运行态'

  await ElMessageBox.confirm(
    `确认清理 Redis 中的${scopeLabel}吗？该操作会直接删除对应缓存或运行态 Key。`,
    '清理确认',
    {
      confirmButtonText: '确认清理',
      cancelButtonText: '取消',
      type: 'warning',
    },
  )

  actionLoading.value = true
  try {
    await clearRedisCacheScope(scope)
    await loadRedisOverview()
  } finally {
    actionLoading.value = false
  }
}

const loadTaskDetail = async () => {
  if (!recordIdKeyword.value) {
    return
  }

  detailLoading.value = true
  try {
    taskDetail.value = await getRedisTaskDetail(recordIdKeyword.value)
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => {
  void loadRedisOverview()
  void loadRuntimeSettings()
})
</script>

<style scoped>
.admin-redis-tabs-card__content {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.admin-redis-settings-card__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.admin-redis-settings-card__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-redis-settings-card__field span {
  color: var(--text-secondary);
  font-size: 12px;
}

.admin-redis-risk-card__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-redis-risk-card__item {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--line-divider, #00000014);
}

.admin-redis-risk-card__item.is-info {
  background: #f6f7fb;
}

.admin-redis-risk-card__item.is-warning {
  background: #fff7e8;
}

.admin-redis-risk-card__item.is-danger {
  background: #fff1f1;
}

.admin-redis-query-card__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-redis-query-card__toolbar {
  display: flex;
  gap: 12px;
}

.admin-redis-query-card__input {
  flex: 1 1 auto;
}

.admin-redis-query-card__detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-redis-query-card__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.admin-redis-query-card__compare-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.admin-redis-query-card__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 12px;
  background: var(--bg-surface);
}

.admin-redis-query-card__item span,
.admin-redis-query-card__prompt-title {
  color: var(--text-secondary);
  font-size: 12px;
}

.admin-redis-query-card__item strong {
  color: var(--text-primary);
  font-size: 16px;
}

.admin-redis-query-card__prompt {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 12px;
  background: var(--bg-surface);
}

.admin-redis-query-card__prompt-text {
  color: var(--text-primary);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.admin-redis-query-card__event-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-redis-query-card__event-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--line-divider, #00000014);
}

.admin-redis-query-card__event-item small {
  color: var(--text-secondary);
}

@media (max-width: 1080px) {
  .admin-redis-tabs-card__content,
  .admin-redis-settings-card__grid,
  .admin-redis-query-card__toolbar,
  .admin-redis-query-card__grid,
  .admin-redis-query-card__compare-grid {
    grid-template-columns: minmax(0, 1fr);
    flex-direction: column;
  }
}
</style>
