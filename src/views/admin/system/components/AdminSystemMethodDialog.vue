<template>
  <div v-if="visible" class="admin-dialog-mask" @click="closeMethodDialog">
    <div class="admin-dialog admin-dialog--provider-form admin-system-method-dialog" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">{{ editingMethodType ? '编辑登录方式' : '新增登录方式' }}</h3>
          <div class="admin-dialog__desc">{{ editingMethodType ? '调整当前登录入口的展示文案和参数配置。' : '从预设模板中新增一项登录方式，并在弹窗内完成参数配置。' }}</div>
        </div>
        <button class="admin-dialog__close" type="button" @click="closeMethodDialog">×</button>
      </div>

      <form class="admin-form admin-dialog__body" @submit.prevent="handleSubmitMethodDialog">
        <div class="admin-form__grid">
          <div v-if="!editingMethodType" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">登录方式模板</label>
            <select
              class="admin-input"
              :value="methodForm.methodType"
              @change="handleCreateMethodTypeChange(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="template in creatableMethodTemplates" :key="template.methodType" :value="template.methodType">
                {{ template.displayName }}（{{ template.methodType }}）
              </option>
            </select>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label">显示名称</label>
            <input v-model.trim="methodForm.displayName" class="admin-input" type="text" placeholder="登录方式显示名称">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">排序</label>
            <input v-model.number="methodForm.sortOrder" class="admin-input" type="number" min="0" step="1">
          </div>
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">描述</label>
            <input v-model.trim="methodForm.description" class="admin-input" type="text" placeholder="例如：使用邮箱验证码登录">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">图标类型</label>
            <input v-model.trim="methodForm.iconType" class="admin-input" type="text" placeholder="phone / mail / wechat">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">图标地址</label>
            <input v-model.trim="methodForm.iconUrl" class="admin-input" type="text" placeholder="可选，自定义图标地址">
          </div>

          <div v-if="methodForm.category === 'CODE'" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">验证码登录配置</label>
            <div class="admin-form__hint">配置前台输入框文案，以及短信或邮件验证码发送参数。</div>
          </div>
          <div v-if="methodForm.category === 'CODE'" class="admin-form__field">
            <label class="admin-form__label">账号标签</label>
            <input v-model.trim="methodForm.targetLabel" class="admin-input" type="text" placeholder="手机号 / 邮箱">
          </div>
          <div v-if="methodForm.category === 'CODE'" class="admin-form__field">
            <label class="admin-form__label">账号占位文案</label>
            <input v-model.trim="methodForm.placeholder" class="admin-input" type="text" placeholder="请输入手机号">
          </div>
          <div v-if="methodForm.category === 'CODE'" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">验证码占位文案</label>
            <input v-model.trim="methodForm.codePlaceholder" class="admin-input" type="text" placeholder="请输入验证码">
          </div>
          <div v-if="methodForm.methodType === 'PHONE_CODE'" class="admin-form__field">
            <label class="admin-form__label">短信服务商</label>
            <input v-model.trim="methodForm.providerCode" class="admin-input" type="text" placeholder="例如：aliyun-sms">
          </div>
          <div v-if="methodForm.methodType === 'PHONE_CODE'" class="admin-form__field">
            <label class="admin-form__label">签名名称</label>
            <input v-model.trim="methodForm.signName" class="admin-input" type="text" placeholder="短信签名">
          </div>
          <div v-if="methodForm.methodType === 'PHONE_CODE'" class="admin-form__field">
            <label class="admin-form__label">模板编号</label>
            <input v-model.trim="methodForm.templateCode" class="admin-input" type="text" placeholder="短信模板编码">
          </div>
          <div v-if="methodForm.methodType === 'PHONE_CODE'" class="admin-form__field">
            <label class="admin-form__label">AccessKey ID</label>
            <input v-model.trim="methodForm.accessKeyId" class="admin-input" type="text" placeholder="服务商 AccessKey ID">
          </div>
          <div v-if="methodForm.methodType === 'PHONE_CODE'" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">AccessKey Secret</label>
            <input v-model.trim="methodForm.accessKeySecret" class="admin-input" type="password" placeholder="服务商 AccessKey Secret">
          </div>
          <div v-if="methodForm.methodType === 'EMAIL_CODE'" class="admin-form__field">
            <label class="admin-form__label">发件人名称</label>
            <input v-model.trim="methodForm.senderName" class="admin-input" type="text" placeholder="例如：Canana 团队">
          </div>
          <div v-if="methodForm.methodType === 'EMAIL_CODE'" class="admin-form__field">
            <label class="admin-form__label">发件邮箱</label>
            <input v-model.trim="methodForm.senderAddress" class="admin-input" type="text" placeholder="例如：noreply@example.com">
          </div>
          <div v-if="methodForm.methodType === 'EMAIL_CODE'" class="admin-form__field">
            <label class="admin-form__label">SMTP Host</label>
            <input v-model.trim="methodForm.smtpHost" class="admin-input" type="text" placeholder="例如：smtp.qq.com">
          </div>
          <div v-if="methodForm.methodType === 'EMAIL_CODE'" class="admin-form__field">
            <label class="admin-form__label">SMTP Port</label>
            <input v-model.trim="methodForm.smtpPort" class="admin-input" type="text" placeholder="例如：465">
          </div>
          <div v-if="methodForm.methodType === 'EMAIL_CODE'" class="admin-form__field">
            <label class="admin-form__label">SMTP 用户名</label>
            <input v-model.trim="methodForm.smtpUser" class="admin-input" type="text" placeholder="邮箱账号">
          </div>
          <div v-if="methodForm.methodType === 'EMAIL_CODE'" class="admin-form__field">
            <label class="admin-form__label">SMTP 密码</label>
            <input v-model.trim="methodForm.smtpPassword" class="admin-input" type="password" placeholder="SMTP 授权码或密码">
          </div>
          <div v-if="methodForm.methodType === 'EMAIL_CODE'" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">SMTP 选项</label>
            <label class="admin-switch-row">
              <input v-model="methodForm.smtpSecure" type="checkbox">
              <span>启用 SSL / TLS 安全连接</span>
            </label>
          </div>

          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">OAuth 配置</label>
            <div class="admin-form__hint">请填写厂商提供的授权地址、客户端信息和回调地址，前台会据此生成跳转链接。</div>
          </div>
          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field">
            <label class="admin-form__label">授权地址</label>
            <input v-model.trim="methodForm.authorizeUrl" class="admin-input" type="text" placeholder="https://.../authorize">
          </div>
          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field">
            <label class="admin-form__label">Token 地址</label>
            <input v-model.trim="methodForm.tokenUrl" class="admin-input" type="text" placeholder="https://.../token">
          </div>
          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">用户信息地址</label>
            <input v-model.trim="methodForm.userInfoUrl" class="admin-input" type="text" placeholder="https://.../userinfo">
          </div>
          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field">
            <label class="admin-form__label">Client ID</label>
            <input v-model.trim="methodForm.clientId" class="admin-input" type="text" placeholder="OAuth Client ID">
          </div>
          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field">
            <label class="admin-form__label">Client Secret</label>
            <input v-model.trim="methodForm.clientSecret" class="admin-input" type="password" placeholder="OAuth Client Secret">
          </div>
          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field">
            <label class="admin-form__label">回调地址</label>
            <input v-model.trim="methodForm.redirectUri" class="admin-input" type="text" placeholder="https://your-app/callback">
          </div>
          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field">
            <label class="admin-form__label">响应类型</label>
            <input v-model.trim="methodForm.responseType" class="admin-input" type="text" placeholder="code">
          </div>
          <div v-if="methodForm.category === 'OAUTH'" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">授权 Scope</label>
            <input v-model.trim="methodForm.scope" class="admin-input" type="text" placeholder="例如：read:user user:email">
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">状态选项</label>
            <div class="admin-system-switch-group">
              <label class="admin-switch-row">
                <input v-model="methodForm.isEnabled" type="checkbox">
                <span>启用该登录方式</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="methodForm.isVisible" type="checkbox">
                <span>前台可见</span>
              </label>
              <label class="admin-switch-row">
                <input v-model="methodForm.allowSignUp" type="checkbox">
                <span>允许自动注册</span>
              </label>
              <label v-if="methodForm.category === 'CODE'" class="admin-switch-row">
                <input v-model="methodForm.debugSendEnabled" type="checkbox">
                <span>调试模式下允许自动填充验证码</span>
              </label>
            </div>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">扩展配置 JSON</label>
            <textarea v-model="methodForm.configText" class="admin-textarea admin-system-json" placeholder="可继续补充当前登录方式的扩展配置 JSON"></textarea>
            <div class="admin-form__hint">当前表单字段会在最终保存时自动同步回 JSON，额外字段也会一并保留。</div>
          </div>
        </div>

        <div class="admin-form__footer">
          <button class="admin-button admin-button--secondary" type="button" @click="closeMethodDialog">取消</button>
          <button class="admin-button admin-button--primary" type="submit">{{ editingMethodType ? '更新到列表' : '加入列表' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { AuthMethodCategory, AuthMethodType } from '@/api/auth'

interface EditableAuthMethodFormLike {
  methodType: AuthMethodType
  category: AuthMethodCategory
  displayName: string
  description: string
  iconType: string
  iconUrl: string
  sortOrder: number
  targetLabel: string
  placeholder: string
  codePlaceholder: string
  providerCode: string
  accessKeyId: string
  accessKeySecret: string
  signName: string
  templateCode: string
  senderName: string
  senderAddress: string
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUser: string
  smtpPassword: string
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  responseType: string
  scope: string
  isEnabled: boolean
  isVisible: boolean
  allowSignUp: boolean
  debugSendEnabled: boolean
  configText: string
}

interface AuthMethodTemplateLike {
  methodType: AuthMethodType
  displayName: string
}

defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  editingMethodType: {
    type: String as PropType<AuthMethodType | ''>,
    required: true,
  },
  methodForm: {
    type: Object as PropType<EditableAuthMethodFormLike>,
    required: true,
  },
  creatableMethodTemplates: {
    type: Array as PropType<AuthMethodTemplateLike[]>,
    required: true,
  },
  closeMethodDialog: {
    type: Function as PropType<() => void>,
    required: true,
  },
  handleSubmitMethodDialog: {
    type: Function as PropType<() => void>,
    required: true,
  },
  handleCreateMethodTypeChange: {
    type: Function as PropType<(methodType: string) => void>,
    required: true,
  },
})
</script>
