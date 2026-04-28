<template>
  <AdminPageContainer title="系统设置" description="当前先展示部署与运行说明，后续再演进为真正可编辑的系统设置页面。">
    <div class="admin-grid admin-grid--two">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">运行说明</h4>
            <div class="admin-card__desc">先把现阶段最重要的部署与运行信息集中展示。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-list">
            <div class="admin-list-item">
              <div>
                <div class="admin-list-item__title">端口模式</div>
                <div class="admin-list-item__meta">当前生产部署已收敛为单端口方案。</div>
              </div>
              <div class="admin-list-item__meta">优先使用 `APP_PORT` 控制外部访问端口。</div>
              <div class="admin-status admin-status--success">推荐</div>
            </div>
            <div class="admin-list-item">
              <div>
                <div class="admin-list-item__title">本地上传目录</div>
                <div class="admin-list-item__meta">默认回退目录为 `/app/uploads`。</div>
              </div>
              <div class="admin-list-item__meta">对象存储未启用时会自动走本地存储。</div>
              <div class="admin-status admin-status--success">已启用</div>
            </div>
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">后续规划</h4>
            <div class="admin-card__desc">这里会继续沉淀真正的系统级设置能力。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-empty">后续将补充登录策略、环境变量说明、版本信息与管理员权限控制。</div>
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
</script>
