<template>
  <div class="admin-theme-sidebar__nav">
    <button
      v-for="section in sectionSummaries"
      :key="section.key"
      class="admin-theme-sidebar__nav-item"
      type="button"
      @click="$emit('scrollToSection', section.key)"
    >
      <span class="admin-theme-sidebar__nav-top">
        <span class="admin-theme-sidebar__nav-title">{{ section.title }}</span>
        <span class="admin-theme-sidebar__nav-count">{{ section.areas.length }} 处前台区域</span>
      </span>
      <span class="admin-theme-sidebar__nav-desc">{{ section.desc }}</span>
      <span class="admin-theme-sidebar__nav-tags">
        <span
          v-for="area in section.areas"
          :key="`${section.key}-${area}`"
          class="admin-theme-sidebar__nav-tag"
        >
          {{ area }}
        </span>
      </span>
    </button>
  </div>

  <div class="admin-theme-sidebar__sections">
    <section :id="sectionIds.banner" class="admin-card admin-theme-section-card">
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台首页首屏</div>
          <h4 class="admin-card__title">首页 Banner 风格</h4>
          <div class="admin-card__desc">控制首页主视觉渐变、发光氛围和首屏品牌感。</div>
        </div>
        <div class="admin-theme-impact-tags">
          <span>首页 Banner</span>
          <span>主视觉卡片</span>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid">
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">Banner 主渐变</label>
            <input
              v-model.trim="systemForm.globalThemeSettings.gradients.primaryGradient"
              class="admin-input"
              type="text"
              placeholder="例如：linear-gradient(135deg, #6f35ff 0%, #ff7a59 100%)"
            >
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">Banner 发光色</label>
            <div class="admin-theme-color-inputs">
              <input
                v-model.trim="systemForm.globalThemeSettings.gradients.bannerGlow"
                class="admin-input"
                type="text"
                placeholder="#2FE3FF"
              >
              <input
                v-model="systemForm.globalThemeSettings.gradients.bannerGlow"
                class="admin-theme-color-picker"
                type="color"
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <section :id="sectionIds.action" class="admin-card admin-theme-section-card">
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台交互</div>
          <h4 class="admin-card__title">按钮与主交互颜色</h4>
          <div class="admin-card__desc">控制主按钮、次按钮、强调入口和常规交互反馈的颜色。</div>
        </div>
        <div class="admin-theme-impact-tags">
          <span>首页按钮</span>
          <span>创作页按钮</span>
          <span>工作流交互</span>
        </div>
      </div>
      <div class="admin-card__content admin-theme-section-card__content">
        <div class="admin-theme-subsection">
          <div class="admin-theme-subsection__title">主按钮颜色</div>
          <div class="admin-theme-subsection__desc">影响按钮默认、悬浮、按下三种状态。</div>
          <div class="admin-theme-color-grid">
            <div v-for="field in actionColorFields" :key="field.key" class="admin-theme-color-field">
              <label class="admin-form__label">{{ field.label }}</label>
              <div class="admin-theme-color-inputs">
                <input
                  v-model.trim="systemForm.globalThemeSettings.brandColors[field.key]"
                  class="admin-input"
                  type="text"
                  :placeholder="field.placeholder"
                >
                <input
                  v-model="systemForm.globalThemeSettings.brandColors[field.key]"
                  class="admin-theme-color-picker"
                  type="color"
                >
              </div>
            </div>
          </div>
        </div>

        <div class="admin-theme-subsection">
          <div class="admin-theme-subsection__title">辅助与强调</div>
          <div class="admin-theme-subsection__desc">用于次按钮、标签和辅助入口。</div>
          <div class="admin-theme-color-grid admin-theme-color-grid--single-row">
            <div v-for="field in accentColorFields" :key="field.key" class="admin-theme-color-field">
              <label class="admin-form__label">{{ field.label }}</label>
              <div class="admin-theme-color-inputs">
                <input
                  v-model.trim="systemForm.globalThemeSettings.brandColors[field.key]"
                  class="admin-input"
                  type="text"
                  :placeholder="field.placeholder"
                >
                <input
                  v-model="systemForm.globalThemeSettings.brandColors[field.key]"
                  class="admin-theme-color-picker"
                  type="color"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section :id="sectionIds.status" class="admin-card admin-theme-section-card">
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台反馈</div>
          <h4 class="admin-card__title">状态反馈颜色</h4>
          <div class="admin-card__desc">影响生成结果、处理中状态、失败提醒等前台反馈色。</div>
        </div>
        <div class="admin-theme-impact-tags">
          <span>成功提示</span>
          <span>处理中</span>
          <span>失败提醒</span>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-theme-color-grid admin-theme-color-grid--single-row">
          <div v-for="field in statusColorFields" :key="field.key" class="admin-theme-color-field">
            <label class="admin-form__label">{{ field.label }}</label>
            <div class="admin-theme-color-inputs">
              <input
                v-model.trim="systemForm.globalThemeSettings.brandColors[field.key]"
                class="admin-input"
                type="text"
                :placeholder="field.placeholder"
              >
              <input
                v-model="systemForm.globalThemeSettings.brandColors[field.key]"
                class="admin-theme-color-picker"
                type="color"
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <section :id="sectionIds.surface" class="admin-card admin-theme-section-card">
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台骨架</div>
          <h4 class="admin-card__title">页面骨架与卡片圆角</h4>
          <div class="admin-card__desc">影响首页与创作页的内容宽度、卡片圆角和整体舒展感。</div>
        </div>
        <div class="admin-theme-impact-tags">
          <span>首页内容区</span>
          <span>创作页卡片</span>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">内容最大宽度（px）</label>
            <input
              v-model.number="systemForm.globalThemeSettings.surfaces.contentMaxWidth"
              class="admin-input"
              type="number"
              min="960"
              max="2560"
              step="10"
            >
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">卡片圆角（px）</label>
            <input
              v-model.number="systemForm.globalThemeSettings.surfaces.cardRadius"
              class="admin-input"
              type="number"
              min="0"
              max="48"
              step="1"
            >
          </div>
        </div>
      </div>
    </section>

    <section :id="sectionIds.mode" class="admin-card admin-theme-section-card">
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台主题策略</div>
          <h4 class="admin-card__title">主题模式</h4>
          <div class="admin-card__desc">控制前台默认深浅模式，以及用户是否能自行切换主题。</div>
        </div>
        <div class="admin-theme-impact-tags">
          <span>前台全局主题</span>
          <span>用户主题切换</span>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">默认主题</label>
            <select v-model="systemForm.globalThemeSettings.modePolicy.defaultMode" class="admin-input">
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">切换策略</label>
            <div class="admin-theme-switch-grid">
              <label class="admin-switch-row admin-theme-switch-card">
                <input v-model="systemForm.globalThemeSettings.modePolicy.allowUserToggle" type="checkbox">
                <span>
                  <strong>允许用户切换</strong>
                  <em>前台可手动切换深色 / 浅色模式</em>
                </span>
              </label>
              <label class="admin-switch-row admin-theme-switch-card">
                <input v-model="systemForm.globalThemeSettings.modePolicy.supportSystemMode" type="checkbox">
                <span>
                  <strong>支持跟随系统</strong>
                  <em>允许前台直接读取设备系统主题偏好</em>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { SystemConfigPayload } from '@/api/system-config'

interface SectionSummary {
  key: string
  title: string
  desc: string
  areas: readonly string[]
}

interface ColorField {
  key: 'primary' | 'primaryHover' | 'primaryActive' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger'
  label: string
  placeholder: string
}

defineProps<{
  systemForm: SystemConfigPayload
  sectionIds: Record<'banner' | 'action' | 'status' | 'surface' | 'mode', string>
  sectionSummaries: readonly SectionSummary[]
  actionColorFields: readonly ColorField[]
  accentColorFields: readonly ColorField[]
  statusColorFields: readonly ColorField[]
}>()

defineEmits<{
  scrollToSection: [sectionId: string]
}>()
</script>

<style scoped>
.admin-theme-sidebar__nav {
  display: grid;
  gap: 8px;
  padding: 0 16px 16px;
}

.admin-theme-sidebar__nav-item {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.16));
  border-radius: 14px;
  background: var(--bg-surface, #ffffff);
  text-align: left;
  cursor: pointer;
}

.admin-theme-sidebar__nav-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-theme-sidebar__nav-item:hover {
  border-color: color-mix(in srgb, var(--brand-main-default, #6f35ff) 24%, rgba(148, 163, 184, 0.16));
  background: color-mix(in srgb, var(--brand-main-default, #6f35ff) 5%, var(--bg-surface, #ffffff));
}

.admin-theme-sidebar__nav-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.admin-theme-sidebar__nav-desc {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.admin-theme-sidebar__nav-count {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand-main-default, #6f35ff) 10%, transparent);
  color: var(--brand-main-default, #6f35ff);
  font-size: 11px;
  font-weight: 600;
}

.admin-theme-sidebar__nav-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.admin-theme-sidebar__nav-tag,
.admin-theme-impact-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--bg-muted, #f8fafc);
  color: var(--text-secondary, #64748b);
  font-size: 11px;
}

.admin-theme-sidebar__sections {
  flex: 1;
  overflow: auto;
  padding: 0 16px 16px;
  display: grid;
  gap: 12px;
}

.admin-theme-section-card__header {
  align-items: flex-start;
}

.admin-theme-impact-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.admin-theme-section-card__content {
  display: grid;
  gap: 20px;
}

.admin-theme-section-card__eyebrow {
  font-size: 12px;
  line-height: 1.2;
  color: var(--text-tertiary, #8b94a7);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.admin-theme-subsection__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.admin-theme-subsection__desc {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

.admin-theme-subsection + .admin-theme-subsection {
  margin-top: 18px;
}

.admin-theme-color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 12px;
}

.admin-theme-color-grid--single-row {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.admin-theme-color-field {
  display: grid;
  gap: 8px;
}

.admin-theme-color-inputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px;
  gap: 10px;
  align-items: center;
}

.admin-theme-color-picker {
  width: 52px;
  height: 44px;
  padding: 4px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
}

.admin-theme-switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.admin-theme-switch-card {
  min-height: 88px;
  align-items: flex-start;
  padding: 16px 18px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-surface, #ffffff) 92%, var(--bg-muted, #f8fafc));
}

.admin-theme-switch-card span {
  display: grid;
  gap: 6px;
}

.admin-theme-switch-card strong {
  font-size: 14px;
  color: var(--text-primary, #0f172a);
}

.admin-theme-switch-card em {
  font-style: normal;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

@media (max-width: 980px) {
  .admin-theme-color-grid,
  .admin-theme-color-grid--single-row,
  .admin-theme-switch-grid {
    grid-template-columns: 1fr;
  }

  .admin-theme-impact-tags {
    justify-content: flex-start;
  }
}
</style>
