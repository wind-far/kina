<template>
  <div class="admin-system-panel">
    <form class="admin-system-form-grid" @submit.prevent="onSubmit">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">协议开关与登录文案</h4>
            <div class="admin-card__desc">统一控制登录勾选协议、前置提示及登录弹窗欢迎文案。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-form__grid">
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">协议开关</label>
              <label class="admin-switch-row">
                <input v-model="form.policySettings.agreementRequired" type="checkbox">
                <span>登录前必须勾选协议</span>
              </label>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label" for="system-agreement-prefix">前置提示文案</label>
              <input id="system-agreement-prefix" v-model.trim="form.policySettings.agreementTextPrefix" class="admin-input" type="text" placeholder="例如：已阅读并同意">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label" for="system-login-title">登录标题</label>
              <input id="system-login-title" v-model.trim="form.loginSettings.welcomeTitle" class="admin-input" type="text" placeholder="欢迎登录">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label" for="system-login-subtitle">登录副标题</label>
              <textarea id="system-login-subtitle" v-model.trim="form.loginSettings.welcomeSubtitle" class="admin-textarea" placeholder="展示在登录弹窗标题下方，可填写品牌口号或提示"></textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="admin-system-policy-grid">
        <div class="admin-card">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">用户协议</h4>
              <div class="admin-card__desc">维护标题、链接与详情正文。</div>
            </div>
          </div>
          <div class="admin-card__content">
            <div class="admin-form__grid">
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-agreement-title">用户协议标题</label>
                <input id="system-agreement-title" v-model.trim="form.policySettings.userAgreementTitle" class="admin-input" type="text" placeholder="用户服务协议">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-agreement-url">用户协议链接</label>
                <input id="system-agreement-url" v-model.trim="form.policySettings.userAgreementUrl" class="admin-input" type="text" placeholder="https://...">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-agreement-content">用户协议正文</label>
                <textarea id="system-agreement-content" v-model.trim="form.policySettings.userAgreementContent" class="admin-textarea admin-system-json" placeholder="可填写前台协议详情页展示内容"></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-card">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">隐私政策</h4>
              <div class="admin-card__desc">维护标题、链接与详情正文。</div>
            </div>
          </div>
          <div class="admin-card__content">
            <div class="admin-form__grid">
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-privacy-title">隐私政策标题</label>
                <input id="system-privacy-title" v-model.trim="form.policySettings.privacyPolicyTitle" class="admin-input" type="text" placeholder="隐私政策">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-privacy-url">隐私政策链接</label>
                <input id="system-privacy-url" v-model.trim="form.policySettings.privacyPolicyUrl" class="admin-input" type="text" placeholder="https://...">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-privacy-content">隐私政策正文</label>
                <textarea id="system-privacy-content" v-model.trim="form.policySettings.privacyPolicyContent" class="admin-textarea admin-system-json" placeholder="可填写前台隐私政策详情页展示内容"></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-card">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">AI 须知</h4>
              <div class="admin-card__desc">维护标题、链接与详情正文。</div>
            </div>
          </div>
          <div class="admin-card__content">
            <div class="admin-form__grid">
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-ai-title">AI 须知标题</label>
                <input id="system-ai-title" v-model.trim="form.policySettings.aiNoticeTitle" class="admin-input" type="text" placeholder="AI功能使用须知">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-ai-url">AI 须知链接</label>
                <input id="system-ai-url" v-model.trim="form.policySettings.aiNoticeUrl" class="admin-input" type="text" placeholder="https://...">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-ai-content">AI 须知正文</label>
                <textarea id="system-ai-content" v-model.trim="form.policySettings.aiNoticeContent" class="admin-textarea admin-system-json" placeholder="可填写前台 AI 功能使用须知详情页展示内容"></textarea>
              </div>
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

.admin-system-policy-grid {
  display: grid;
  gap: 16px;
}
</style>
