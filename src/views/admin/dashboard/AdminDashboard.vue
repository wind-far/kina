<template>
  <AdminPageContainer title="仪表盘" description="展示当前账号下的资源、生成和运行概览，帮助快速判断系统是否处于健康可运营状态。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="loadOverview" :disabled="loading">
        {{ loading ? '刷新中...' : '刷新统计' }}
      </button>
    </template>

    <div class="admin-grid admin-grid--stats">
      <AdminStatCard label="资源总数" :value="overview?.asset.total ?? 0" hint="当前账号可见的全部资源数" />
      <AdminStatCard label="已发布资源" :value="overview?.asset.published ?? 0" hint="已公开发布的资源数量" />
      <AdminStatCard label="生成总数" :value="overview?.generation.total ?? 0" hint="当前账号下的全部生成记录" />
      <AdminStatCard label="今日生成" :value="overview?.generation.today ?? 0" hint="今天新写入的生成记录数量" />
    </div>

    <div class="admin-grid admin-grid--two">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">生成概览</h4>
            <div class="admin-card__desc">优先观察完成数、失败数和最近 7 天趋势，方便快速判断生成链路是否稳定。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div v-if="loading" class="admin-empty">正在加载统计数据...</div>
          <div v-else-if="!overview" class="admin-empty">暂未获取到仪表盘统计数据。</div>
          <div v-else class="admin-list">
            <div class="admin-list-item">
              <div>
                <div class="admin-list-item__title">完成记录</div>
                <div class="admin-list-item__meta">已完成的生成记录总数</div>
              </div>
              <div class="admin-list-item__meta">失败记录：{{ overview.generation.failed }}</div>
              <div class="admin-status admin-status--success">{{ overview.generation.completed }}</div>
            </div>
            <div class="admin-list-item admin-list-item--stack">
              <div>
                <div class="admin-list-item__title">最近 7 天生成趋势</div>
                <div class="admin-list-item__meta">按天统计当前账号的生成记录数量。</div>
              </div>
              <div class="admin-trend-list">
                <div v-for="item in overview.generation.trend" :key="`generation-${item.label}`" class="admin-trend-item">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">资源与运行态</h4>
            <div class="admin-card__desc">帮助确认当前资源沉淀情况，以及默认厂商与存储配置是否已经生效。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div v-if="loading" class="admin-empty">正在加载资源概览...</div>
          <div v-else-if="!overview" class="admin-empty">暂未获取到运行态信息。</div>
          <div v-else class="admin-list">
            <div class="admin-list-item">
              <div>
                <div class="admin-list-item__title">资源概览</div>
                <div class="admin-list-item__meta">总资源：{{ overview.asset.total }} · 草稿：{{ overview.asset.draft }}</div>
              </div>
              <div class="admin-list-item__meta">已发布资源：{{ overview.asset.published }}</div>
              <div class="admin-status admin-status--success">稳定</div>
            </div>
            <div class="admin-list-item admin-list-item--stack">
              <div>
                <div class="admin-list-item__title">最近 7 天资源趋势</div>
                <div class="admin-list-item__meta">按天统计写入资源层的数据量。</div>
              </div>
              <div class="admin-trend-list">
                <div v-for="item in overview.asset.trend" :key="`asset-${item.label}`" class="admin-trend-item">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
            <div class="admin-list-item">
              <div>
                <div class="admin-list-item__title">当前默认厂商</div>
                <div class="admin-list-item__meta">{{ overview.runtime.providerName || '默认生成配置' }}</div>
              </div>
              <div class="admin-list-item__meta">{{ overview.runtime.providerBaseUrl || '未配置上游地址' }}</div>
              <div class="admin-status admin-status--success">已读取</div>
            </div>
            <div class="admin-list-item">
              <div>
                <div class="admin-list-item__title">当前存储方案</div>
                <div class="admin-list-item__meta">{{ overview.runtime.enabledStorageName }}</div>
              </div>
              <div class="admin-list-item__meta">配置总数：{{ overview.runtime.totalStorageConfigs }} · 编码：{{ overview.runtime.enabledStorageCode }}</div>
              <div class="admin-status admin-status--success">已生效</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { getAdminDashboardOverview, type AdminDashboardOverview } from '@/api/admin-dashboard'

const loading = ref(false)
const overview = ref<AdminDashboardOverview | null>(null)

const loadOverview = async () => {
  loading.value = true
  try {
    overview.value = await getAdminDashboardOverview()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadOverview()
})
</script>
