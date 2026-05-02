<template>
  <div class="admin-theme-sidebar__sections">
    <section
      :id="sectionIds.banner"
      class="admin-card admin-theme-section-card"
      :class="{ 'is-linked-active': activePreviewSection === sectionIds.banner }"
      @mouseenter="$emit('previewFocusChange', sectionIds.banner)"
      @mouseleave="$emit('previewFocusChange', null)"
    >
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台首页首屏</div>
          <h4 class="admin-card__title">首页 Banner 风格</h4>
          <div class="admin-card__desc">控制首页主视觉渐变、发光氛围和首屏品牌感。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid admin-form__grid--banner">
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">Banner 主渐变</label>
            <input
              v-model.trim="systemForm.globalThemeSettings.gradients.primaryGradient"
              class="admin-input"
              :class="{ 'is-linked-field': activePreviewField === 'primaryGradient' }"
              type="text"
              placeholder="例如：linear-gradient(135deg, #6f35ff 0%, #ff7a59 100%)"
              @mouseenter="$emit('previewFieldChange', 'primaryGradient')"
              @mouseleave="$emit('previewFieldChange', null)"
              @focus="$emit('previewFieldChange', 'primaryGradient')"
              @blur="$emit('previewFieldChange', null)"
            >
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">Banner 发光色</label>
            <div class="admin-theme-color-inputs">
              <input
                v-model.trim="systemForm.globalThemeSettings.gradients.bannerGlow"
                class="admin-input"
                :class="{ 'is-linked-field': activePreviewField === 'bannerGlow' }"
                type="text"
                placeholder="#2FE3FF"
                @mouseenter="$emit('previewFieldChange', 'bannerGlow')"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', 'bannerGlow')"
                @blur="$emit('previewFieldChange', null)"
              >
              <input
                v-model="systemForm.globalThemeSettings.gradients.bannerGlow"
                class="admin-theme-color-picker"
                type="color"
                @mouseenter="$emit('previewFieldChange', 'bannerGlow')"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', 'bannerGlow')"
                @blur="$emit('previewFieldChange', null)"
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      :id="sectionIds.background"
      class="admin-card admin-theme-section-card"
      :class="{ 'is-linked-active': activePreviewSection === sectionIds.background }"
      @mouseenter="$emit('previewFocusChange', sectionIds.background)"
      @mouseleave="$emit('previewFocusChange', null)"
    >
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台背景体系</div>
          <h4 class="admin-card__title">页面背景与侧栏底色</h4>
          <div class="admin-card__desc">直接控制首页整体底色、输入面板/卡片底色，以及左侧导航背景。</div>
        </div>
      </div>
      <div class="admin-card__content admin-theme-section-card__content">
        <div class="admin-theme-subsection">
          <div class="admin-theme-subsection__title">页面大背景</div>
          <div class="admin-theme-subsection__desc">影响首页主内容区域的整体底色，是用户第一眼感受到的空间氛围。</div>
          <div class="admin-theme-color-field">
            <label class="admin-form__label">页面背景色</label>
            <div class="admin-theme-color-inputs">
              <input
                v-model.trim="systemForm.globalThemeSettings.backgrounds.page"
                class="admin-input"
                :class="{ 'is-linked-field': activePreviewField === 'pageBackground' }"
                type="text"
                placeholder="#0f0f12"
                @mouseenter="$emit('previewFieldChange', 'pageBackground')"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', 'pageBackground')"
                @blur="$emit('previewFieldChange', null)"
              >
              <input
                v-model="systemForm.globalThemeSettings.backgrounds.page"
                class="admin-theme-color-picker"
                type="color"
                @mouseenter="$emit('previewFieldChange', 'pageBackground')"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', 'pageBackground')"
                @blur="$emit('previewFieldChange', null)"
              >
            </div>
          </div>
        </div>

        <div class="admin-theme-subsection">
          <div class="admin-theme-subsection__title">卡片 / 输入面板背景</div>
          <div class="admin-theme-subsection__desc">影响输入框、功能卡片、浮层面板这类承载内容的表层底色。</div>
          <div class="admin-theme-color-field">
            <label class="admin-form__label">表层背景色</label>
            <div class="admin-theme-color-inputs">
              <input
                v-model.trim="systemForm.globalThemeSettings.backgrounds.surface"
                class="admin-input"
                :class="{ 'is-linked-field': activePreviewField === 'surfaceBackground' }"
                type="text"
                placeholder="#15161a"
                @mouseenter="$emit('previewFieldChange', 'surfaceBackground')"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', 'surfaceBackground')"
                @blur="$emit('previewFieldChange', null)"
              >
              <input
                v-model="systemForm.globalThemeSettings.backgrounds.surface"
                class="admin-theme-color-picker"
                type="color"
                @mouseenter="$emit('previewFieldChange', 'surfaceBackground')"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', 'surfaceBackground')"
                @blur="$emit('previewFieldChange', null)"
              >
            </div>
          </div>
        </div>

        <div class="admin-theme-subsection">
          <div class="admin-theme-subsection__title">左侧导航背景</div>
          <div class="admin-theme-subsection__desc">控制首页左侧菜单区域的独立底色，建议比页面背景略深一点，层次会更稳。</div>
          <div class="admin-theme-color-field">
            <label class="admin-form__label">侧栏背景色</label>
            <div class="admin-theme-color-inputs">
              <input
                v-model.trim="systemForm.globalThemeSettings.backgrounds.sideMenu"
                class="admin-input"
                :class="{ 'is-linked-field': activePreviewField === 'sideMenuBackground' }"
                type="text"
                placeholder="#111218"
                @mouseenter="$emit('previewFieldChange', 'sideMenuBackground')"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', 'sideMenuBackground')"
                @blur="$emit('previewFieldChange', null)"
              >
              <input
                v-model="systemForm.globalThemeSettings.backgrounds.sideMenu"
                class="admin-theme-color-picker"
                type="color"
                @mouseenter="$emit('previewFieldChange', 'sideMenuBackground')"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', 'sideMenuBackground')"
                @blur="$emit('previewFieldChange', null)"
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      :id="sectionIds.action"
      class="admin-card admin-theme-section-card"
      :class="{ 'is-linked-active': activePreviewSection === sectionIds.action }"
      @mouseenter="$emit('previewFocusChange', sectionIds.action)"
      @mouseleave="$emit('previewFocusChange', null)"
    >
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台交互</div>
          <h4 class="admin-card__title">按钮与主交互颜色</h4>
          <div class="admin-card__desc">控制主按钮、次按钮、强调入口和常规交互反馈的颜色。</div>
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
                  :class="{ 'is-linked-field': activePreviewField === field.key }"
                  type="text"
                  :placeholder="field.placeholder"
                  @mouseenter="$emit('previewFieldChange', field.key)"
                  @mouseleave="$emit('previewFieldChange', null)"
                  @focus="$emit('previewFieldChange', field.key)"
                  @blur="$emit('previewFieldChange', null)"
                >
                <input
                  v-model="systemForm.globalThemeSettings.brandColors[field.key]"
                  class="admin-theme-color-picker"
                  type="color"
                  @mouseenter="$emit('previewFieldChange', field.key)"
                  @mouseleave="$emit('previewFieldChange', null)"
                  @focus="$emit('previewFieldChange', field.key)"
                  @blur="$emit('previewFieldChange', null)"
                >
              </div>
            </div>
          </div>
        </div>

        <div class="admin-theme-subsection">
          <div class="admin-theme-subsection__title">辅助与强调</div>
          <div class="admin-theme-subsection__desc">用于次按钮、标签和辅助入口。</div>
          <div class="admin-theme-color-grid admin-theme-color-grid--compact">
            <div v-for="field in accentColorFields" :key="field.key" class="admin-theme-color-field">
              <label class="admin-form__label">{{ field.label }}</label>
              <div class="admin-theme-color-inputs">
                <input
                  v-model.trim="systemForm.globalThemeSettings.brandColors[field.key]"
                  class="admin-input"
                  :class="{ 'is-linked-field': activePreviewField === field.key }"
                  type="text"
                  :placeholder="field.placeholder"
                  @mouseenter="$emit('previewFieldChange', field.key)"
                  @mouseleave="$emit('previewFieldChange', null)"
                  @focus="$emit('previewFieldChange', field.key)"
                  @blur="$emit('previewFieldChange', null)"
                >
                <input
                  v-model="systemForm.globalThemeSettings.brandColors[field.key]"
                  class="admin-theme-color-picker"
                  type="color"
                  @mouseenter="$emit('previewFieldChange', field.key)"
                  @mouseleave="$emit('previewFieldChange', null)"
                  @focus="$emit('previewFieldChange', field.key)"
                  @blur="$emit('previewFieldChange', null)"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      :id="sectionIds.status"
      class="admin-card admin-theme-section-card"
      :class="{ 'is-linked-active': activePreviewSection === sectionIds.status }"
      @mouseenter="$emit('previewFocusChange', sectionIds.status)"
      @mouseleave="$emit('previewFocusChange', null)"
    >
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台反馈</div>
          <h4 class="admin-card__title">状态反馈颜色</h4>
          <div class="admin-card__desc">影响生成结果、处理中状态、失败提醒等前台反馈色。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-theme-color-grid admin-theme-color-grid--status">
          <div v-for="field in statusColorFields" :key="field.key" class="admin-theme-color-field">
            <label class="admin-form__label">{{ field.label }}</label>
            <div class="admin-theme-color-inputs">
              <input
                v-model.trim="systemForm.globalThemeSettings.brandColors[field.key]"
                class="admin-input"
                :class="{ 'is-linked-field': activePreviewField === field.key }"
                type="text"
                :placeholder="field.placeholder"
                @mouseenter="$emit('previewFieldChange', field.key)"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', field.key)"
                @blur="$emit('previewFieldChange', null)"
              >
              <input
                v-model="systemForm.globalThemeSettings.brandColors[field.key]"
                class="admin-theme-color-picker"
                type="color"
                @mouseenter="$emit('previewFieldChange', field.key)"
                @mouseleave="$emit('previewFieldChange', null)"
                @focus="$emit('previewFieldChange', field.key)"
                @blur="$emit('previewFieldChange', null)"
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      :id="sectionIds.surface"
      class="admin-card admin-theme-section-card"
      :class="{ 'is-linked-active': activePreviewSection === sectionIds.surface }"
      @mouseenter="$emit('previewFocusChange', sectionIds.surface)"
      @mouseleave="$emit('previewFocusChange', null)"
    >
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台骨架</div>
          <h4 class="admin-card__title">页面骨架与卡片圆角</h4>
          <div class="admin-card__desc">影响首页与创作页的内容宽度、卡片圆角和整体舒展感。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">内容最大宽度（px）</label>
            <input
              v-model.number="systemForm.globalThemeSettings.surfaces.contentMaxWidth"
              class="admin-input"
              :class="{ 'is-linked-field': activePreviewField === 'contentMaxWidth' }"
              type="number"
              min="960"
              max="2560"
              step="10"
              @mouseenter="$emit('previewFieldChange', 'contentMaxWidth')"
              @mouseleave="$emit('previewFieldChange', null)"
              @focus="$emit('previewFieldChange', 'contentMaxWidth')"
              @blur="$emit('previewFieldChange', null)"
            >
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">卡片圆角（px）</label>
            <input
              v-model.number="systemForm.globalThemeSettings.surfaces.cardRadius"
              class="admin-input"
              :class="{ 'is-linked-field': activePreviewField === 'cardRadius' }"
              type="number"
              min="0"
              max="48"
              step="1"
              @mouseenter="$emit('previewFieldChange', 'cardRadius')"
              @mouseleave="$emit('previewFieldChange', null)"
              @focus="$emit('previewFieldChange', 'cardRadius')"
              @blur="$emit('previewFieldChange', null)"
            >
          </div>
        </div>
      </div>
    </section>

    <section
      :id="sectionIds.mode"
      class="admin-card admin-theme-section-card"
      :class="{ 'is-linked-active': activePreviewSection === sectionIds.mode }"
      @mouseenter="$emit('previewFocusChange', sectionIds.mode)"
      @mouseleave="$emit('previewFocusChange', null)"
    >
      <div class="admin-card__header admin-theme-section-card__header">
        <div>
          <div class="admin-theme-section-card__eyebrow">前台主题策略</div>
          <h4 class="admin-card__title">主题模式</h4>
          <div class="admin-card__desc">控制前台默认深浅模式，以及用户是否能自行切换主题。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">默认主题</label>
            <select
              v-model="systemForm.globalThemeSettings.modePolicy.defaultMode"
              class="admin-input"
              :class="{ 'is-linked-field': activePreviewField === 'defaultMode' }"
              @mouseenter="$emit('previewFieldChange', 'defaultMode')"
              @mouseleave="$emit('previewFieldChange', null)"
              @focus="$emit('previewFieldChange', 'defaultMode')"
              @blur="$emit('previewFieldChange', null)"
            >
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">切换策略</label>
            <div class="admin-theme-switch-grid">
              <label class="admin-switch-row admin-theme-switch-card">
                <input
                  v-model="systemForm.globalThemeSettings.modePolicy.allowUserToggle"
                  type="checkbox"
                  @mouseenter="$emit('previewFieldChange', 'allowUserToggle')"
                  @mouseleave="$emit('previewFieldChange', null)"
                  @focus="$emit('previewFieldChange', 'allowUserToggle')"
                  @blur="$emit('previewFieldChange', null)"
                >
                <span>
                  <strong>允许用户切换</strong>
                  <em>前台可手动切换深色 / 浅色模式</em>
                </span>
              </label>
              <label class="admin-switch-row admin-theme-switch-card">
                <input
                  v-model="systemForm.globalThemeSettings.modePolicy.supportSystemMode"
                  type="checkbox"
                  @mouseenter="$emit('previewFieldChange', 'supportSystemMode')"
                  @mouseleave="$emit('previewFieldChange', null)"
                  @focus="$emit('previewFieldChange', 'supportSystemMode')"
                  @blur="$emit('previewFieldChange', null)"
                >
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
  sectionIds: Record<'banner' | 'background' | 'action' | 'status' | 'surface' | 'mode', string>
  sectionSummaries: readonly SectionSummary[]
  actionColorFields: readonly ColorField[]
  accentColorFields: readonly ColorField[]
  statusColorFields: readonly ColorField[]
  activePreviewSection: string | null
  activePreviewField: string | null
}>()

defineEmits<{
  scrollToSection: [sectionId: string]
  previewFocusChange: [sectionId: string | null]
  previewFieldChange: [fieldId: string | null]
}>()
</script>

<style scoped>
.admin-theme-section-card.is-linked-active {
  border-color: color-mix(in srgb, var(--brand-main-default, #6f35ff) 38%, rgba(148, 163, 184, 0.16));
  background: color-mix(in srgb, var(--brand-main-default, #6f35ff) 7%, var(--bg-surface, #ffffff));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--brand-main-default, #6f35ff) 18%, transparent), 0 12px 28px rgba(79, 70, 229, 0.08);
}

.admin-input.is-linked-field,
.admin-theme-color-picker:focus-visible {
  border-color: color-mix(in srgb, var(--brand-main-default, #6f35ff) 48%, rgba(148, 163, 184, 0.16));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-main-default, #6f35ff) 14%, transparent);
}

.admin-theme-sidebar__sections {
  flex: 1;
  overflow: auto;
  padding: 0 12px 12px;
  display: grid;
  gap: 10px;
}

.admin-theme-section-card__header {
  align-items: flex-start;
  padding-bottom: 8px;
}

.admin-theme-section-card__content {
  display: grid;
  gap: 16px;
}

.admin-form__grid--banner {
  grid-template-columns: minmax(0, 1fr);
}

.admin-theme-section-card__eyebrow {
  font-size: 11px;
  line-height: 1.2;
  color: var(--text-tertiary, #8b94a7);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.admin-theme-subsection__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.admin-theme-subsection__desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.admin-theme-subsection + .admin-theme-subsection {
  margin-top: 14px;
}

.admin-theme-color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.admin-theme-color-grid--single-row {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.admin-theme-color-grid--compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-theme-color-grid--status {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-theme-color-field {
  display: grid;
  gap: 6px;
}

.admin-theme-color-inputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px;
  gap: 8px;
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
  gap: 10px;
}

.admin-theme-switch-card {
  min-height: 76px;
  align-items: flex-start;
  padding: 14px 16px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-surface, #ffffff) 92%, var(--bg-muted, #f8fafc));
}

.admin-theme-switch-card span {
  display: grid;
  gap: 6px;
}

.admin-theme-switch-card strong {
  font-size: 13px;
  color: var(--text-primary, #0f172a);
}

.admin-theme-switch-card em {
  font-style: normal;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

@media (max-width: 980px) {
  .admin-theme-color-grid,
  .admin-theme-color-grid--compact,
  .admin-theme-color-grid--status,
  .admin-theme-color-grid--single-row,
  .admin-theme-switch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
