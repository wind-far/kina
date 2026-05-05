<template>
  <section class="install-website-form mx-auto flex w-full justify-center">
    <div class="install-form-card w-full max-w-[520px]">
      <div class="install-form-card__header">
        <div class="install-form-card__eyebrow">品牌初始化</div>
        <h1 class="install-form-card__title">网站基本信息</h1>
        <p class="install-form-card__desc">
          这些信息会立即同步到站点展示层，作为初始化后的默认品牌配置。
        </p>
      </div>

      <el-form label-position="top" class="install-form-grid">
        <el-form-item label="网站名称" :error="siteNameError">
          <el-input :model-value="form.siteName" placeholder="请输入网站名称" maxlength="50" @update:model-value="updateField('siteName', $event)" />
        </el-form-item>

        <el-form-item label="网站描述">
          <el-input
            :model-value="form.siteDescription"
            type="textarea"
            :rows="4"
            placeholder="请输入网站描述"
            maxlength="240"
            @update:model-value="updateField('siteDescription', $event)"
          />
        </el-form-item>

        <el-collapse class="install-form-collapse">
          <el-collapse-item name="brand-assets">
            <template #title>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-[var(--text-primary)]">品牌素材</span>
                <span class="text-xs text-[var(--text-tertiary)]">Logo / Icon</span>
              </div>
            </template>

            <div class="grid grid-cols-2 gap-4 pt-2 max-md:grid-cols-1">
              <div>
                <div class="mb-2 text-sm text-[var(--text-secondary)]">网站 Logo</div>
                <button
                  class="install-upload-tile"
                  type="button"
                  :disabled="uploadingLogo"
                  @click="$emit('pick-logo')"
                >
                  <img
                    v-if="form.siteLogoUrl"
                    :src="form.siteLogoUrl"
                    alt="网站 Logo"
                    class="h-full w-full object-cover"
                  >
                  <div v-else class="flex flex-col items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span class="text-3xl leading-none text-[var(--brand-main-default)]">+</span>
                    <span>{{ uploadingLogo ? '上传中...' : '点击上传 Logo' }}</span>
                  </div>
                </button>
              </div>

              <div>
                <div class="mb-2 text-sm text-[var(--text-secondary)]">网站图标</div>
                <button
                  class="install-upload-tile"
                  type="button"
                  :disabled="uploadingIcon"
                  @click="$emit('pick-icon')"
                >
                  <img
                    v-if="form.siteIconUrl"
                    :src="form.siteIconUrl"
                    alt="网站图标"
                    class="h-full w-full object-contain p-6"
                  >
                  <div v-else class="flex flex-col items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <span class="text-3xl leading-none text-[var(--brand-main-default)]">+</span>
                    <span>{{ uploadingIcon ? '上传中...' : '点击上传图标' }}</span>
                  </div>
                </button>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-form>

      <div class="install-brand-preview">
        <img
          v-if="form.siteLogoUrl"
          :src="form.siteLogoUrl"
          alt="站点 Logo"
          class="size-11 rounded-xl object-cover"
        >
        <div
          v-else
          class="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-main-block-default)] text-lg font-bold text-[var(--text-primary)]"
        >
          {{ brandInitial }}
        </div>
        <div>
          <div class="text-sm font-semibold text-[var(--text-primary)]">{{ siteName }}</div>
          <div class="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {{ form.siteDescription || '初始化完成后，这里将显示你的站点描述。' }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface InstallWebsiteFormModel {
  siteName: string
  siteDescription: string
  siteLogoUrl: string
  siteIconUrl: string
}

defineProps<{
  form: InstallWebsiteFormModel
  siteName: string
  brandInitial: string
  siteNameError: string
  uploadingLogo: boolean
  uploadingIcon: boolean
}>()

const emit = defineEmits<{
  'update-field': [field: keyof InstallWebsiteFormModel, value: string]
  'pick-logo': []
  'pick-icon': []
}>()

const updateField = (field: keyof InstallWebsiteFormModel, value: string | number) => {
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

.install-upload-tile {
  display: flex;
  height: 160px;
  width: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 18px;
  border: 1px dashed color-mix(in srgb, var(--stroke-primary) 85%, transparent);
  background: color-mix(in srgb, var(--bg-block-primary-default) 92%, transparent);
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.install-upload-tile:hover {
  border-color: color-mix(in srgb, var(--brand-main-default) 48%, var(--stroke-primary));
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.install-upload-tile:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
}

.install-brand-preview {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--stroke-primary) 86%, transparent);
  background: color-mix(in srgb, var(--bg-block-primary-default) 92%, transparent);
  padding: 16px;
}

.install-website-form :deep(.install-form-grid .el-form-item) {
  margin-bottom: 14px;
}

.install-website-form :deep(.install-form-grid .el-form-item__label) {
  padding-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}

.install-website-form :deep(.install-form-grid .el-input__wrapper),
.install-website-form :deep(.install-form-grid .el-textarea__inner) {
  border-radius: 14px;
  box-shadow: none;
  background: color-mix(in srgb, var(--bg-block-primary-default) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--stroke-primary) 80%, transparent);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.install-website-form :deep(.install-form-grid .el-input__wrapper) {
  min-height: 46px;
  padding-inline: 14px;
}

.install-website-form :deep(.install-form-grid .el-textarea__inner) {
  min-height: 112px;
  padding: 12px 14px;
}

.install-website-form :deep(.install-form-grid .el-input__wrapper:hover),
.install-website-form :deep(.install-form-grid .el-textarea__inner:hover) {
  border-color: color-mix(in srgb, var(--brand-main-default) 42%, var(--stroke-primary));
}

.install-website-form :deep(.install-form-grid .is-focus .el-input__wrapper),
.install-website-form :deep(.install-form-grid .el-textarea__inner:focus) {
  border-color: color-mix(in srgb, var(--brand-main-default) 60%, white 0%);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand-main-default) 14%, transparent);
}

.install-website-form :deep(.install-form-grid .el-input__inner),
.install-website-form :deep(.install-form-grid .el-textarea__inner) {
  font-size: 14px;
  color: var(--text-primary);
}

.install-website-form :deep(.install-form-grid .el-form-item__error) {
  padding-top: 6px;
  font-size: 12px;
}

.install-website-form :deep(.install-form-collapse) {
  border-top: none;
  border-bottom: none;
  background: transparent;
}

.install-website-form :deep(.install-form-collapse .el-collapse-item__header) {
  min-height: 48px;
  border-radius: 14px;
  border-bottom: none;
  padding: 0 14px;
  background: color-mix(in srgb, var(--bg-block-primary-default) 88%, transparent);
}

.install-website-form :deep(.install-form-collapse .el-collapse-item__wrap) {
  border-bottom: none;
  background: transparent;
}
</style>
