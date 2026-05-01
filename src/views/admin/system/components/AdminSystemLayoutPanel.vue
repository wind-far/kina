<template>
  <div class="admin-system-panel admin-layout-panel">
    <form class="admin-system-form-grid admin-layout-form-grid" @submit.prevent="onSubmit">
      <div class="admin-card admin-layout-toolbar-card">
        <div class="admin-card__content admin-layout-toolbar-card__content">
          <div class="admin-layout-toolbar-card__summary">
            <div class="admin-layout-toolbar-card__title-row">
              <div class="admin-layout-toolbar-card__eyebrow">布局运营台</div>
              <h4 class="admin-layout-toolbar-card__title">先看状态，再改配置</h4>
            </div>
            <p class="admin-layout-toolbar-card__desc">建议先确认导航入口和首页开关，再处理 Banner 顺序与首屏三层图资源。这样更符合运营排查和上线节奏。</p>
          </div>
          <div class="admin-layout-toolbar-card__actions">
            <button class="admin-layout-jump-button" type="button" @click="scrollToLayoutSection('layout-side-menu-base')">导航基础</button>
            <button class="admin-layout-jump-button" type="button" @click="scrollToLayoutSection('layout-side-menu-items')">菜单项编排</button>
            <button class="admin-layout-jump-button" type="button" @click="scrollToLayoutSection('layout-home-header')">首页头部</button>
            <button class="admin-layout-jump-button" type="button" @click="scrollToLayoutSection('layout-home-banner')">Banner 编排</button>
          </div>
        </div>
      </div>

      <div id="layout-side-menu-base" class="admin-card admin-layout-section-card">
        <div class="admin-card__header admin-layout-section-card__header">
          <div>
            <div class="admin-layout-section-card__eyebrow">导航基础层</div>
            <h4 class="admin-card__title">左侧菜单基础</h4>
            <div class="admin-card__desc">统一控制首页与创作相关页面的左侧菜单栏展示开关和宽度参数。</div>
          </div>
          <div class="admin-layout-section-card__status">{{ homeSideMenuBaseStatus }}</div>
        </div>
        <div class="admin-card__content">
          <div class="admin-form__grid">
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">菜单总开关</label>
              <label class="admin-switch-row">
                <input v-model="form.homeSideMenuSettings.enabled" type="checkbox">
                <span>启用左侧菜单栏</span>
              </label>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">收起宽度</label>
              <input v-model.number="form.homeSideMenuSettings.collapsedWidth" class="admin-input" type="number" min="48" max="180" step="1">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">抽屉宽度</label>
              <input v-model.number="form.homeSideMenuSettings.drawerWidth" class="admin-input" type="number" min="280" max="960" step="1">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">浮层阈值宽度</label>
              <input v-model.number="form.homeSideMenuSettings.drawerFloatLimitWidth" class="admin-input" type="number" min="960" max="2560" step="1">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">区块显示</label>
              <div class="admin-user-option-grid admin-user-option-grid--three">
                <label class="admin-user-option-card">
                  <input v-model="form.homeSideMenuSettings.showTopMenu" type="checkbox">
                  <span class="admin-user-option-card__title">顶部 Logo</span>
                  <span class="admin-user-option-card__desc">控制顶部 Logo 区块展示</span>
                </label>
                <label class="admin-user-option-card">
                  <input v-model="form.homeSideMenuSettings.showCenterMenu" type="checkbox">
                  <span class="admin-user-option-card__title">中部主菜单</span>
                  <span class="admin-user-option-card__desc">控制创作与内容导航</span>
                </label>
                <label class="admin-user-option-card">
                  <input v-model="form.homeSideMenuSettings.showBottomMenu" type="checkbox">
                  <span class="admin-user-option-card__title">底部功能区</span>
                  <span class="admin-user-option-card__desc">控制营销、通知和设置入口</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="layout-side-menu-items" class="admin-card admin-layout-section-card">
        <div class="admin-card__header admin-layout-section-card__header">
          <div>
            <div class="admin-layout-section-card__eyebrow">导航运营</div>
            <h4 class="admin-card__title">菜单项编排</h4>
            <div class="admin-card__desc">配置每个菜单项的标题、分区、显示状态和跳转方式。当前图标沿用系统内置映射。</div>
          </div>
          <div class="admin-layout-section-card__status">{{ homeSideMenuItemsStatus }}</div>
        </div>
        <div class="admin-card__content">
          <div class="admin-list">
            <div v-for="(item, index) in form.homeSideMenuSettings.items" :key="item.key" class="admin-list-item">
              <div class="admin-list-item__main">
                <div class="admin-list-item__title">{{ item.title || item.key }}</div>
                <div class="admin-list-item__meta admin-layout-meta-row">
                  <span class="admin-layout-meta-badge">键名：{{ item.key }}</span>
                  <span class="admin-layout-meta-badge">分区：{{ getMenuSectionLabel(item.section) }}</span>
                  <span class="admin-layout-meta-badge">{{ item.visible ? '已显示' : '已隐藏' }}</span>
                  <span class="admin-layout-meta-badge">图标：{{ item.iconSource === 'custom' ? '自定义' : item.icon }}</span>
                </div>
              </div>
              <div class="admin-form__grid">
                <div class="admin-form__field">
                  <label class="admin-form__label">标题</label>
                  <input v-model.trim="item.title" class="admin-input" type="text" placeholder="菜单标题">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">分区</label>
                  <select v-model="item.section" class="admin-input">
                    <option value="top">顶部</option>
                    <option value="center">中部</option>
                    <option value="bottom">底部</option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">图标来源</label>
                  <select v-model="item.iconSource" class="admin-input">
                    <option value="default">使用默认</option>
                    <option value="custom">自行上传</option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">默认图标键</label>
                  <input
                    v-model.trim="item.icon"
                    class="admin-input"
                    type="text"
                    placeholder="例如：home / generate / asset"
                    :disabled="item.iconSource === 'custom'"
                  >
                </div>
                <div v-if="item.iconSource === 'custom'" class="admin-form__field admin-form__field--full">
                  <label class="admin-form__label">自定义双态图标</label>
                  <div class="admin-system-menu-icon-grid">
                    <div class="admin-system-menu-icon-card">
                      <div class="admin-system-menu-icon-card__label">未激活图标</div>
                      <div class="admin-system-menu-icon-card__preview">
                        <img v-if="item.inactiveIconUrl" :src="item.inactiveIconUrl" alt="">
                        <span v-else>未上传</span>
                      </div>
                      <input
                        v-model.trim="item.inactiveIconUrl"
                        class="admin-input"
                        type="text"
                        placeholder="可直接填写图片地址或使用下方上传"
                      >
                      <input
                        :id="`home-side-menu-icon-${item.key}-inactive`"
                        type="file"
                        accept="image/svg+xml,image/png,image/webp,image/jpeg"
                        class="admin-system-file-input"
                        @change="handleMenuIconFileChange($event, item, 'inactive')"
                      >
                      <div class="admin-list-item__actions">
                        <button class="admin-inline-button" type="button" @click="triggerMenuIconUpload(item.key, 'inactive')">上传未激活图</button>
                        <button class="admin-inline-button" type="button" @click="clearMenuIcon(item, 'inactive')">清空</button>
                      </div>
                    </div>

                    <div class="admin-system-menu-icon-card">
                      <div class="admin-system-menu-icon-card__label">激活图标</div>
                      <div class="admin-system-menu-icon-card__preview">
                        <img v-if="item.activeIconUrl" :src="item.activeIconUrl" alt="">
                        <span v-else>未上传</span>
                      </div>
                      <input
                        v-model.trim="item.activeIconUrl"
                        class="admin-input"
                        type="text"
                        placeholder="留空时自动复用未激活图标"
                      >
                      <input
                        :id="`home-side-menu-icon-${item.key}-active`"
                        type="file"
                        accept="image/svg+xml,image/png,image/webp,image/jpeg"
                        class="admin-system-file-input"
                        @change="handleMenuIconFileChange($event, item, 'active')"
                      >
                      <div class="admin-list-item__actions">
                        <button class="admin-inline-button" type="button" @click="triggerMenuIconUpload(item.key, 'active')">上传激活图</button>
                        <button class="admin-inline-button" type="button" @click="clearMenuIcon(item, 'active')">清空</button>
                      </div>
                    </div>
                  </div>
                  <div class="admin-form__hint">支持上传 SVG / PNG / WebP / JPG，文件会转成 Data URL 直接存到系统配置中；未配置时自动回退本地默认 SVG 双态图标。</div>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">跳转类型</label>
                  <select v-model="item.actionType" class="admin-input">
                    <option value="route">路由</option>
                    <option value="url">外链</option>
                    <option value="dialog">弹窗</option>
                    <option value="none">无动作</option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">动作值</label>
                  <input v-model.trim="item.actionValue" class="admin-input" type="text" placeholder="/generate 或 https://...">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">徽标文案</label>
                  <input v-model.trim="item.badgeText" class="admin-input" type="text" placeholder="可选">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">排序值</label>
                  <input v-model.number="item.sortOrder" class="admin-input" type="number" min="0" max="9999" step="10">
                </div>
                <div class="admin-form__field admin-form__field--full">
                  <div class="admin-list-item__actions">
                    <label class="admin-switch-row">
                      <input v-model="item.visible" type="checkbox">
                      <span>显示该菜单项</span>
                    </label>
                    <button class="admin-inline-button" type="button" :disabled="index === 0" @click="moveHomeSideMenuItem(index, -1)">上移</button>
                    <button class="admin-inline-button" type="button" :disabled="index === form.homeSideMenuSettings.items.length - 1" @click="moveHomeSideMenuItem(index, 1)">下移</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="layout-home-header" class="admin-card admin-layout-section-card">
        <div class="admin-card__header admin-layout-section-card__header">
          <div>
            <div class="admin-layout-section-card__eyebrow">首页信息层</div>
            <h4 class="admin-card__title">首页头部展示</h4>
            <div class="admin-card__desc">控制首页欢迎区下方的说明文案、任务指示器和 Banner 展示。</div>
          </div>
          <div class="admin-layout-section-card__status">{{ homeHeaderStatus }}</div>
        </div>
        <div class="admin-card__content">
          <div class="admin-user-option-grid admin-user-option-grid--three">
            <label class="admin-user-option-card">
              <input v-model="form.homeLayoutSettings.header.showSiteDescription" type="checkbox">
              <span class="admin-user-option-card__title">站点说明</span>
              <span class="admin-user-option-card__desc">显示首页品牌说明文案</span>
            </label>
            <label class="admin-user-option-card">
              <input v-model="form.homeLayoutSettings.header.showTaskIndicator" type="checkbox">
              <span class="admin-user-option-card__title">任务指示器</span>
              <span class="admin-user-option-card__desc">显示首页任务进度入口</span>
            </label>
            <label class="admin-user-option-card">
              <input v-model="form.homeLayoutSettings.header.showBanner" type="checkbox">
              <span class="admin-user-option-card__title">Banner 区域</span>
              <span class="admin-user-option-card__desc">显示首页横幅卡片组</span>
            </label>
          </div>
        </div>
      </div>

      <div id="layout-home-banner" class="admin-card admin-layout-section-card">
        <div class="admin-card__header admin-layout-section-card__header">
          <div>
            <div class="admin-layout-section-card__eyebrow">首页视觉层</div>
            <h4 class="admin-card__title">首页 Banner 编排</h4>
            <div class="admin-card__desc">维护首页横幅卡片的内容、跳转地址、发光色和显示顺序。首项会自动使用大卡样式。</div>
          </div>
          <div class="admin-layout-section-card__header-actions">
            <span class="admin-layout-section-card__status">{{ homeBannerStatus }}</span>
            <button class="admin-inline-button" type="button" @click="appendHomeBannerItem">新增 Banner</button>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-form__field admin-form__field--full" style="margin-bottom: 16px;">
            <label class="admin-switch-row">
              <input v-model="form.homeLayoutSettings.banner.enabled" type="checkbox">
              <span>启用首页 Banner 卡片组</span>
            </label>
          </div>

          <div class="admin-list">
            <div v-for="(item, index) in form.homeLayoutSettings.banner.items" :key="item.key" class="admin-list-item">
              <div class="admin-list-item__main">
                <div class="admin-list-item__title">{{ item.title || item.key }}</div>
                <div class="admin-list-item__meta admin-layout-meta-row">
                  <span class="admin-layout-meta-badge">键名：{{ item.key }}</span>
                  <span class="admin-layout-meta-badge">{{ item.visible ? '已显示' : '已隐藏' }}</span>
                  <span class="admin-layout-meta-badge">图片：{{ item.imageSource === 'custom' ? '自定义' : '默认预设' }}</span>
                  <span class="admin-layout-meta-badge">发光色：{{ item.glowColor }}</span>
                </div>
              </div>
              <div class="admin-form__grid">
                <div class="admin-form__field">
                  <label class="admin-form__label">键名</label>
                  <input v-model.trim="item.key" class="admin-input" type="text" placeholder="例如：image">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">标题</label>
                  <input v-model.trim="item.title" class="admin-input" type="text" placeholder="Banner 标题">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">副标题</label>
                  <input v-model.trim="item.subtitle" class="admin-input" type="text" placeholder="Banner 副标题">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">图片来源</label>
                  <select v-model="item.imageSource" class="admin-input">
                    <option value="default">系统默认图</option>
                    <option value="custom">自定义图片</option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">默认图预设</label>
                  <select v-model="item.presetKey" class="admin-input" :disabled="item.imageSource !== 'default'">
                    <option v-for="preset in homeBannerPresetOptions" :key="preset.value" :value="preset.value">
                      {{ preset.label }}
                    </option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">发光色</label>
                  <input v-model.trim="item.glowColor" class="admin-input" type="text" placeholder="#2FE3FF">
                </div>
                <div class="admin-form__field admin-form__field--full">
                  <label class="admin-form__label">图片地址</label>
                  <input
                    v-model.trim="item.imageUrl"
                    class="admin-input"
                    type="text"
                    :disabled="item.imageSource !== 'custom'"
                    :placeholder="item.imageSource === 'custom' ? '填写网络图片地址' : '当前使用系统默认图，无需填写地址'"
                  >
                </div>
                <template v-if="index === 0">
                  <div class="admin-form__field admin-form__field--full">
                    <label class="admin-form__label">三层图配置说明</label>
                    <div class="admin-form__hint">仅首个 Banner 模块（三层图）使用；主图层未填写时，会继续回退到“图片地址”或旧版默认图。</div>
                  </div>
                  <div class="admin-form__field admin-form__field--full">
                    <label class="admin-form__label">背景层图片地址</label>
                    <input v-model.trim="item.backgroundImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的背景层图片地址">
                  </div>
                  <div class="admin-form__field admin-form__field--full">
                    <label class="admin-form__label">主图层图片地址</label>
                    <input v-model.trim="item.mainImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的主图层图片地址">
                  </div>
                  <div class="admin-form__field admin-form__field--full">
                    <label class="admin-form__label">前景叠加图地址</label>
                    <input v-model.trim="item.overlayImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的前景叠加图地址">
                  </div>
                </template>
                <div v-else class="admin-form__field admin-form__field--full">
                  <label class="admin-form__label">三层图配置说明</label>
                  <div class="admin-form__hint">当前 Banner 使用常规单图配置，无需填写三层图字段。</div>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">跳转类型</label>
                  <select v-model="item.actionType" class="admin-input">
                    <option value="route">路由</option>
                    <option value="url">外链</option>
                    <option value="none">无动作</option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">跳转值</label>
                  <input v-model.trim="item.actionValue" class="admin-input" type="text" placeholder="/generate?type=image 或 https://...">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">排序值</label>
                  <input v-model.number="item.sortOrder" class="admin-input" type="number" min="0" max="9999" step="10">
                </div>
                <div class="admin-form__field admin-form__field--full">
                  <div class="admin-list-item__actions">
                    <label class="admin-switch-row">
                      <input v-model="item.visible" type="checkbox">
                      <span>显示该 Banner</span>
                    </label>
                    <button class="admin-inline-button" type="button" :disabled="index === 0" @click="moveHomeBannerItem(index, -1)">上移</button>
                    <button class="admin-inline-button" type="button" :disabled="index === form.homeLayoutSettings.banner.items.length - 1" @click="moveHomeBannerItem(index, 1)">下移</button>
                    <button class="admin-inline-button admin-inline-button--danger" type="button" @click="removeHomeBannerItem(index)">删除</button>
                  </div>
                </div>
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
import type {
  SystemConfigPayload,
  SystemHomeBannerItemConfig,
  SystemHomeSideMenuItemConfig,
} from '@/api/system-config'

defineProps({
  form: {
    type: Object as PropType<SystemConfigPayload>,
    required: true,
  },
  homeBannerPresetOptions: {
    type: Array as PropType<Array<{ value: SystemHomeBannerItemConfig['presetKey'], label: string }>>,
    required: true,
  },
  homeSideMenuBaseStatus: {
    type: String,
    required: true,
  },
  homeSideMenuItemsStatus: {
    type: String,
    required: true,
  },
  homeHeaderStatus: {
    type: String,
    required: true,
  },
  homeBannerStatus: {
    type: String,
    required: true,
  },
  onSubmit: {
    type: Function as PropType<() => void>,
    required: true,
  },
  scrollToLayoutSection: {
    type: Function as PropType<(sectionId: string) => void>,
    required: true,
  },
  getMenuSectionLabel: {
    type: Function as PropType<(section: string) => string>,
    required: true,
  },
  moveHomeSideMenuItem: {
    type: Function as PropType<(index: number, offset: number) => void>,
    required: true,
  },
  triggerMenuIconUpload: {
    type: Function as PropType<(key: string, state: 'inactive' | 'active') => void>,
    required: true,
  },
  handleMenuIconFileChange: {
    type: Function as PropType<(event: Event, item: SystemHomeSideMenuItemConfig, state: 'inactive' | 'active') => void | Promise<void>>,
    required: true,
  },
  clearMenuIcon: {
    type: Function as PropType<(item: SystemHomeSideMenuItemConfig, state: 'inactive' | 'active') => void>,
    required: true,
  },
  appendHomeBannerItem: {
    type: Function as PropType<() => void>,
    required: true,
  },
  moveHomeBannerItem: {
    type: Function as PropType<(index: number, offset: number) => void>,
    required: true,
  },
  removeHomeBannerItem: {
    type: Function as PropType<(index: number) => void>,
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

.admin-layout-panel {
  gap: 18px;
}

.admin-system-form-grid {
  display: grid;
  gap: 16px;
}

.admin-layout-form-grid {
  gap: 18px;
}

.admin-system-menu-icon-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.admin-system-menu-icon-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--stroke-soft);
  border-radius: 14px;
  background: var(--bg-card);
}

.admin-system-menu-icon-card__label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.admin-system-menu-icon-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 84px;
  border: 1px dashed var(--stroke-soft);
  border-radius: 12px;
  background: var(--bg-page);
  color: var(--text-tertiary);
}

.admin-system-menu-icon-card__preview img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.admin-system-file-input {
  display: none;
}

.admin-layout-toolbar-card {
  border-color: color-mix(in srgb, var(--brand-primary, #6b8cff) 18%, var(--line-divider, #00000014));
  background: linear-gradient(180deg, color-mix(in srgb, var(--brand-primary, #6b8cff) 5%, var(--bg-surface)) 0%, var(--bg-surface) 100%);
}

.admin-layout-toolbar-card__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.admin-layout-toolbar-card__summary {
  flex: 1;
  min-width: 0;
}

.admin-layout-toolbar-card__title-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-layout-toolbar-card__eyebrow,
.admin-layout-section-card__eyebrow {
  margin-bottom: 8px;
  color: var(--brand-primary, #6b8cff);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-layout-toolbar-card__title {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
  line-height: 1.3;
}

.admin-layout-toolbar-card__desc {
  margin: 10px 0 0;
  color: var(--text-secondary);
  line-height: 1.8;
}

.admin-layout-toolbar-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.admin-layout-jump-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--brand-primary, #6b8cff) 26%, transparent);
  background: color-mix(in srgb, var(--brand-primary, #6b8cff) 10%, var(--bg-surface));
  color: var(--brand-primary, #6b8cff);
  font-size: 13px;
  font-weight: 600;
  transition: all .2s ease;
}

.admin-layout-jump-button:hover {
  border-color: color-mix(in srgb, var(--brand-primary, #6b8cff) 40%, transparent);
  background: color-mix(in srgb, var(--brand-primary, #6b8cff) 16%, var(--bg-surface));
}

.admin-layout-section-card {
  scroll-margin-top: 24px;
}

.admin-layout-section-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.admin-layout-section-card__header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.admin-layout-section-card__status {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--line-divider, #00000014);
  background: color-mix(in srgb, var(--bg-surface) 88%, var(--bg-block-secondary-default));
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.admin-layout-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-layout-meta-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-surface) 88%, var(--bg-block-secondary-default));
  border: 1px solid var(--line-divider, #00000014);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1;
}

@media (max-width: 900px) {
  .admin-layout-toolbar-card__content {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-layout-toolbar-card__actions,
  .admin-layout-section-card__header-actions {
    justify-content: flex-start;
  }
}
</style>
