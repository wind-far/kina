<template>
  <section
    :class="[
      'install-admin-form mx-auto flex w-full justify-center transition-all duration-1000 ease-in-out',
      visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
    ]"
  >
    <div class="install-form-card w-full max-w-[440px]">
      <div class="install-form-card__header">
        <div class="install-form-card__eyebrow">管理员初始化</div>
        <h1 class="install-form-card__title">创建管理员账号</h1>
        <p class="install-form-card__desc">
          首个管理员账号用于后台管理、模型配置、系统设置与后续运维。
        </p>
      </div>

      <el-form label-position="top" class="install-form-grid">
        <el-form-item label="管理员账号" :error="errors.usernameError">
          <el-input :model-value="form.username" placeholder="请填写管理员账号" maxlength="32" @update:model-value="updateField('username', $event)" />
        </el-form-item>

        <el-form-item label="管理员昵称" :error="errors.nameError">
          <el-input :model-value="form.name" placeholder="请填写管理员昵称" maxlength="50" @update:model-value="updateField('name', $event)" />
        </el-form-item>

        <el-form-item label="登录密码" :error="errors.passwordError">
          <el-input
            :model-value="form.password"
            type="password"
            show-password
            placeholder="请填写登录密码"
            maxlength="64"
            @update:model-value="updateField('password', $event)"
          />
        </el-form-item>

        <el-form-item label="确认密码" :error="errors.confirmPasswordError">
          <el-input
            :model-value="form.confirmPassword"
            type="password"
            show-password
            placeholder="请再次填写密码"
            maxlength="64"
            @update:model-value="updateField('confirmPassword', $event)"
          />
        </el-form-item>

        <el-form-item label="邮箱" :error="errors.emailError">
          <el-input :model-value="form.email" placeholder="请填写管理员邮箱（可选）" maxlength="100" @update:model-value="updateField('email', $event)" />
        </el-form-item>
      </el-form>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface InstallAdminFormModel {
  username: string
  name: string
  password: string
  confirmPassword: string
  email: string
}

defineProps<{
  form: InstallAdminFormModel
  visible: boolean
  errors: {
    usernameError: string
    nameError: string
    passwordError: string
    confirmPasswordError: string
    emailError: string
  }
}>()

const emit = defineEmits<{
  'update-field': [field: keyof InstallAdminFormModel, value: string]
}>()

const updateField = (field: keyof InstallAdminFormModel, value: string | number) => {
  emit('update-field', field, String(value || ''))
}
</script>

<style scoped>
.install-form-card {
  border: 1px solid color-mix(in srgb, var(--stroke-primary) 86%, transparent);
  border-radius: 24px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-block-secondary-default) 92%, white 8%) 0%, var(--bg-block-secondary-default) 100%);
  padding: 28px;
  box-shadow:
    0 20px 54px rgba(0, 0, 0, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(18px);
}

.install-form-card__header {
  margin-bottom: 24px;
}

.install-form-card__eyebrow {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: var(--brand-main-default);
}

.install-form-card__title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
}

.install-form-card__desc {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-secondary);
}

.install-form-grid {
  display: grid;
  gap: 4px;
}

.install-admin-form :deep(.install-form-grid .el-form-item) {
  margin-bottom: 14px;
}

.install-admin-form :deep(.install-form-grid .el-form-item__label) {
  padding-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}

.install-admin-form :deep(.install-form-grid .el-input__wrapper),
.install-admin-form :deep(.install-form-grid .el-textarea__inner) {
  border-radius: 14px;
  box-shadow: none;
  background: color-mix(in srgb, var(--bg-block-primary-default) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--stroke-primary) 80%, transparent);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.install-admin-form :deep(.install-form-grid .el-input__wrapper) {
  min-height: 46px;
  padding-inline: 14px;
}

.install-admin-form :deep(.install-form-grid .el-textarea__inner) {
  min-height: 112px;
  padding: 12px 14px;
}

.install-admin-form :deep(.install-form-grid .el-input__wrapper:hover),
.install-admin-form :deep(.install-form-grid .el-textarea__inner:hover) {
  border-color: color-mix(in srgb, var(--brand-main-default) 42%, var(--stroke-primary));
}

.install-admin-form :deep(.install-form-grid .is-focus .el-input__wrapper),
.install-admin-form :deep(.install-form-grid .el-textarea__inner:focus) {
  border-color: color-mix(in srgb, var(--brand-main-default) 60%, white 0%);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand-main-default) 14%, transparent);
}

.install-admin-form :deep(.install-form-grid .el-input__inner),
.install-admin-form :deep(.install-form-grid .el-textarea__inner) {
  font-size: 14px;
  color: var(--text-primary);
}

.install-admin-form :deep(.install-form-grid .el-form-item__error) {
  padding-top: 6px;
  font-size: 12px;
}
</style>
