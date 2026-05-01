<template>
  <div class="admin-system-panel">
    <form class="admin-system-form-grid" @submit.prevent="onSubmit">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">品牌基础</h4>
            <div class="admin-card__desc">配置站点名称、描述、Logo 与图标，统一前后台品牌感知。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label" for="system-site-name">站点名称</label>
              <input id="system-site-name" v-model.trim="form.siteInfo.siteName" class="admin-input" type="text" placeholder="例如：Canana AI">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label" for="system-site-icon">站点图标</label>
              <input id="system-site-icon" v-model.trim="form.siteInfo.siteIconUrl" class="admin-input" type="text" placeholder="favicon 地址">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label" for="system-site-description">站点描述</label>
              <textarea id="system-site-description" v-model.trim="form.siteInfo.siteDescription" class="admin-textarea" placeholder="站点简介、SEO 描述或首页说明"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label" for="system-site-logo">站点 Logo</label>
              <input id="system-site-logo" v-model.trim="form.siteInfo.siteLogoUrl" class="admin-input" type="text" placeholder="Logo 图片地址">
            </div>
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">页脚与备案</h4>
            <div class="admin-card__desc">维护备案信息与版权文案，保证网站页脚信息完整合规。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label" for="system-site-icp-text">备案文案</label>
              <input id="system-site-icp-text" v-model.trim="form.siteInfo.icpText" class="admin-input" type="text" placeholder="例如：粤ICP备xxxx号">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label" for="system-site-icp-link">备案链接</label>
              <input id="system-site-icp-link" v-model.trim="form.siteInfo.icpLink" class="admin-input" type="text" placeholder="https://beian.miit.gov.cn">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label" for="system-site-copyright">版权文案</label>
              <input id="system-site-copyright" v-model.trim="form.siteInfo.copyrightText" class="admin-input" type="text" placeholder="例如：© 2026 Canana. All rights reserved.">
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { SystemConfigPayload } from '@/api/system-config'

defineProps({
  form: {
    type: Object as PropType<SystemConfigPayload>,
    required: true,
  },
  onSubmit: {
    type: Function as PropType<() => void>,
    required: true,
  },
})
</script>

<style scoped>
.admin-system-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-system-form-grid {
  display: grid;
  gap: 16px;
}
</style>
