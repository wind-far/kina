<template>
  <div class="admin-system-panel admin-layout-panel">
    <form class="admin-system-form-grid admin-layout-form-grid" @submit.prevent="onSubmit">
      <div class="admin-card admin-layout-toolbar-card">
        <div class="admin-card__content admin-layout-toolbar-card__content">
          <div class="admin-layout-toolbar-card__summary">
            <div class="admin-layout-toolbar-card__actions" role="tablist" aria-label="布局配置分区切换">
              <button
                v-for="tab in layoutTabs"
                :key="tab.key"
                class="admin-layout-jump-button"
                :class="{ 'is-active': activeSection === tab.key }"
                type="button"
                role="tab"
                :aria-selected="activeSection === tab.key"
                :aria-controls="tab.key"
                @click="activeSection = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-show="activeSection === 'layout-side-menu'"
        id="layout-side-menu"
        class="admin-layout-tab-panel"
        role="tabpanel"
        aria-label="左侧导航配置"
      >
        <div class="admin-layout-nav-workspace">
        <div id="layout-side-menu-base-panel" class="admin-card admin-layout-section-card">
          <div class="admin-card__header admin-layout-section-card__header">
            <div>
              <div class="admin-layout-section-card__eyebrow">导航基础层</div>
              <h4 class="admin-card__title">左侧菜单基础</h4>
              <div class="admin-card__desc">统一控制首页与创作相关页面的左侧菜单栏展示开关和宽度参数。</div>
              <div class="admin-layout-section-card__helper">适合先由运营确认展示区块，再由开发校验收起 / 抽屉阈值。</div>
            </div>
            <div class="admin-layout-section-card__status">{{ homeSideMenuBaseStatus }}</div>
          </div>
          <div class="admin-card__content">
            <div class="admin-layout-form-stack">
              <section class="admin-layout-form-block">
                <div class="admin-layout-form-block__header">
                  <div>
                    <div class="admin-layout-form-block__title">展示策略</div>
                    <div class="admin-layout-form-block__desc">先明确菜单整体开关，再决定顶部、中部、底部三个区块是否同时露出。</div>
                  </div>
                </div>
                <div class="admin-form__grid">
                  <div class="admin-form__field admin-form__field--full">
                    <label class="admin-form__label">菜单总开关</label>
                    <label class="admin-switch-row">
                      <input v-model="form.homeSideMenuSettings.enabled" type="checkbox">
                      <span>启用左侧菜单栏</span>
                    </label>
                    <div class="admin-layout-inline-hint">关闭后，前台首页与创作入口将不再显示左侧菜单骨架。</div>
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
              </section>

              <section class="admin-layout-form-block">
                <div class="admin-layout-form-block__header">
                  <div>
                    <div class="admin-layout-form-block__title">尺寸策略</div>
                    <div class="admin-layout-form-block__desc">控制菜单在折叠态、抽屉态和浮层切换时的空间表现，建议与设计稿一并核对。</div>
                  </div>
                </div>
                <div class="admin-form__grid">
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
                </div>
              </section>
            </div>
          </div>
        </div>

        <div id="layout-side-menu-items-panel" class="admin-card admin-layout-section-card">
          <div class="admin-card__header admin-layout-section-card__header">
            <div>
              <div class="admin-layout-section-card__eyebrow">导航运营</div>
              <h4 class="admin-card__title">菜单项编排</h4>
              <div class="admin-card__desc">配置每个菜单项的标题、分区、显示状态和跳转方式。当前图标沿用系统内置映射。</div>
              <div class="admin-layout-section-card__helper">适合协同处理命名、排序与跳转落点，避免前台入口语义不一致。</div>
            </div>
            <div class="admin-layout-section-card__status">{{ homeSideMenuItemsStatus }}</div>
          </div>
          <div class="admin-card__content">
            <div class="admin-layout-list-head">
              <div class="admin-layout-list-head__title">菜单项清单</div>
              <div class="admin-layout-list-head__desc">列表里先看入口状态与排序，点击右侧“编辑”再进入完整表单，适合运营集中巡检与逐项调整。</div>
            </div>

            <div class="admin-layout-menu-list">
              <div
                v-for="(item, index) in form.homeSideMenuSettings.items"
                :key="item.key"
                class="admin-layout-menu-row"
              >
                <div class="admin-layout-menu-row__order">{{ index + 1 }}</div>
                <div class="admin-layout-menu-row__main">
                  <div class="admin-layout-menu-row__head">
                    <div class="admin-layout-menu-row__title">{{ item.title || item.key }}</div>
                    <div class="admin-layout-meta-row">
                      <span class="admin-layout-meta-badge">键名：{{ item.key }}</span>
                      <span class="admin-layout-meta-badge">分区：{{ getMenuSectionLabel(item.section) }}</span>
                      <span class="admin-layout-meta-badge">{{ item.visible ? '已显示' : '已隐藏' }}</span>
                      <span class="admin-layout-meta-badge">图标：{{ item.iconSource === 'custom' ? '自定义' : item.icon }}</span>
                      <span class="admin-layout-meta-badge">跳转：{{ item.actionType }}</span>
                    </div>
                  </div>
                  <div class="admin-layout-menu-row__summary">
                    <span>标题：{{ item.title || '未填写' }}</span>
                    <span>动作值：{{ item.actionValue || '未配置' }}</span>
                    <span>排序：{{ item.sortOrder }}</span>
                    <span>徽标：{{ item.badgeText || '无' }}</span>
                  </div>
                </div>
                <div class="admin-layout-menu-row__actions">
                  <button class="admin-inline-button" type="button" @click="openMenuItemDialog(index)">编辑</button>
                  <button class="admin-inline-button" type="button" :disabled="index === 0" @click="moveHomeSideMenuItem(index, -1)">上移</button>
                  <button class="admin-inline-button" type="button" :disabled="index === form.homeSideMenuSettings.items.length - 1" @click="moveHomeSideMenuItem(index, 1)">下移</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        <div v-if="menuItemDialogVisible && editingMenuItemDraft" class="admin-dialog-mask" @click="closeMenuItemDialog">
          <div class="admin-dialog admin-layout-menu-dialog" @click.stop>
            <div class="admin-dialog__header">
              <div>
                <h3 class="admin-dialog__title">编辑菜单项</h3>
                <div class="admin-dialog__desc">维护当前导航入口的标题、分区、图标、跳转和显示状态。</div>
              </div>
              <button class="admin-dialog__close" type="button" @click="closeMenuItemDialog">×</button>
            </div>

            <div class="admin-form admin-dialog__body">
              <div class="admin-form__grid">
                <div class="admin-form__field">
                  <label class="admin-form__label">标题</label>
                  <input v-model.trim="editingMenuItemDraft.title" class="admin-input" type="text" placeholder="菜单标题">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">键名</label>
                  <input v-model.trim="editingMenuItemDraft.key" class="admin-input" type="text" placeholder="例如：home">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">分区</label>
                  <select v-model="editingMenuItemDraft.section" class="admin-input">
                    <option value="top">顶部</option>
                    <option value="center">中部</option>
                    <option value="bottom">底部</option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">排序值</label>
                  <input v-model.number="editingMenuItemDraft.sortOrder" class="admin-input" type="number" min="0" max="9999" step="10">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">图标来源</label>
                  <select v-model="editingMenuItemDraft.iconSource" class="admin-input">
                    <option value="default">使用默认</option>
                    <option value="custom">自行上传</option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">默认图标键</label>
                  <input
                    v-model.trim="editingMenuItemDraft.icon"
                    class="admin-input"
                    type="text"
                    placeholder="例如：home / generate / asset"
                    :disabled="editingMenuItemDraft.iconSource === 'custom'"
                  >
                </div>

                <div v-if="editingMenuItemDraft.iconSource === 'custom'" class="admin-form__field admin-form__field--full">
                  <label class="admin-form__label">自定义双态图标</label>
                  <div class="admin-system-menu-icon-grid">
                    <div class="admin-system-menu-icon-card">
                      <div class="admin-system-menu-icon-card__label">未激活图标</div>
                      <div class="admin-system-menu-icon-card__preview">
                        <img v-if="editingMenuItemDraft.inactiveIconUrl" :src="editingMenuItemDraft.inactiveIconUrl" alt="">
                        <span v-else>未上传</span>
                      </div>
                      <input
                        v-model.trim="editingMenuItemDraft.inactiveIconUrl"
                        class="admin-input"
                        type="text"
                        placeholder="可直接填写图片地址或使用下方上传"
                      >
                      <input
                        id="layout-menu-item-dialog-icon-inactive"
                        type="file"
                        accept="image/svg+xml,image/png,image/webp,image/jpeg"
                        class="admin-system-file-input"
                        @change="handleEditingMenuIconFileChange($event, 'inactive')"
                      >
                      <div class="admin-list-item__actions">
                        <button class="admin-inline-button" type="button" @click="triggerEditingMenuIconUpload('inactive')">上传未激活图</button>
                        <button class="admin-inline-button" type="button" @click="clearEditingMenuIcon('inactive')">清空</button>
                      </div>
                    </div>

                    <div class="admin-system-menu-icon-card">
                      <div class="admin-system-menu-icon-card__label">激活图标</div>
                      <div class="admin-system-menu-icon-card__preview">
                        <img v-if="editingMenuItemDraft.activeIconUrl" :src="editingMenuItemDraft.activeIconUrl" alt="">
                        <span v-else>未上传</span>
                      </div>
                      <input
                        v-model.trim="editingMenuItemDraft.activeIconUrl"
                        class="admin-input"
                        type="text"
                        placeholder="留空时自动复用未激活图标"
                      >
                      <input
                        id="layout-menu-item-dialog-icon-active"
                        type="file"
                        accept="image/svg+xml,image/png,image/webp,image/jpeg"
                        class="admin-system-file-input"
                        @change="handleEditingMenuIconFileChange($event, 'active')"
                      >
                      <div class="admin-list-item__actions">
                        <button class="admin-inline-button" type="button" @click="triggerEditingMenuIconUpload('active')">上传激活图</button>
                        <button class="admin-inline-button" type="button" @click="clearEditingMenuIcon('active')">清空</button>
                      </div>
                    </div>
                  </div>
                  <div class="admin-form__hint">支持上传 SVG / PNG / WebP / JPG，文件会转成 Data URL 暂存；点击“保存菜单项”后才会写回列表。</div>
                </div>

                <div class="admin-form__field">
                  <label class="admin-form__label">跳转类型</label>
                  <select v-model="editingMenuItemDraft.actionType" class="admin-input">
                    <option value="route">路由</option>
                    <option value="url">外链</option>
                    <option value="dialog">弹窗</option>
                    <option value="none">无动作</option>
                  </select>
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">动作值</label>
                  <input v-model.trim="editingMenuItemDraft.actionValue" class="admin-input" type="text" placeholder="/generate 或 https://...">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">徽标文案</label>
                  <input v-model.trim="editingMenuItemDraft.badgeText" class="admin-input" type="text" placeholder="可选">
                </div>
                <div class="admin-form__field">
                  <label class="admin-form__label">徽标语气</label>
                  <select v-model="editingMenuItemDraft.badgeTone" class="admin-input">
                    <option value="default">默认</option>
                    <option value="primary">主色</option>
                    <option value="success">成功</option>
                    <option value="warning">提醒</option>
                    <option value="danger">警示</option>
                  </select>
                </div>
                <div class="admin-form__field admin-form__field--full">
                  <label class="admin-switch-row">
                    <input v-model="editingMenuItemDraft.visible" type="checkbox">
                    <span>显示该菜单项</span>
                  </label>
                </div>
              </div>

              <div class="admin-form__footer">
                <button class="admin-button admin-button--secondary" type="button" @click="closeMenuItemDialog">取消</button>
                <button class="admin-button admin-button--primary" type="button" @click="submitMenuItemDialog">保存菜单项</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-show="activeSection === 'layout-home-header'" id="layout-home-header" class="admin-card admin-layout-section-card">
        <div class="admin-card__header admin-layout-section-card__header">
          <div>
            <div class="admin-layout-section-card__eyebrow">首页信息层</div>
            <h4 class="admin-card__title">首页头部展示</h4>
            <div class="admin-card__desc">控制首页欢迎区下方的说明文案、任务指示器和 Banner 展示。</div>
            <div class="admin-layout-section-card__helper">适合先由运营确认露出策略，再统一首屏信息密度。</div>
          </div>
          <div class="admin-layout-section-card__status">{{ homeHeaderStatus }}</div>
        </div>
        <div class="admin-card__content">
          <div class="admin-layout-form-stack">
            <section class="admin-layout-form-block">
              <div class="admin-layout-form-block__header">
                <div>
                  <div class="admin-layout-form-block__title">首屏信息密度</div>
                  <div class="admin-layout-form-block__desc">适合由运营先确认露出组合，再由设计校验视觉层级与留白。</div>
                </div>
              </div>
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
            </section>
          </div>
        </div>
      </div>

      <div v-show="activeSection === 'layout-home-banner'" id="layout-home-banner" class="admin-card admin-layout-section-card">
        <div class="admin-card__header admin-layout-section-card__header">
          <div>
            <div class="admin-layout-section-card__eyebrow">首页视觉层</div>
            <h4 class="admin-card__title">首页 Banner 编排</h4>
            <div class="admin-card__desc">维护首页横幅卡片的内容、跳转地址、发光色和显示顺序。首项会自动使用大卡样式。</div>
            <div class="admin-layout-section-card__helper">建议最后处理这一层，确保结构与文案稳定后再统一视觉素材。</div>
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

          <div class="admin-layout-list-head">
            <div class="admin-layout-list-head__title">Banner 卡片清单</div>
            <div class="admin-layout-list-head__desc">列表里先看标题、图片来源和显隐状态，点击右侧“编辑”再进入完整表单；首项三层图也统一在弹窗里维护。</div>
          </div>

          <div class="admin-layout-banner-list">
            <div
              v-for="(item, index) in form.homeLayoutSettings.banner.items"
              :key="item.key"
              class="admin-layout-banner-row"
            >
              <div class="admin-layout-banner-row__order">{{ index + 1 }}</div>
              <div class="admin-layout-banner-row__main">
                <div class="admin-layout-banner-row__head">
                  <div>
                    <div class="admin-layout-banner-row__title">{{ item.title || item.key }}</div>
                    <div class="admin-layout-meta-row">
                      <span class="admin-layout-meta-badge">键名：{{ item.key }}</span>
                      <span class="admin-layout-meta-badge">{{ item.visible ? '已显示' : '已隐藏' }}</span>
                      <span class="admin-layout-meta-badge">图片：{{ item.imageSource === 'custom' ? '自定义' : '默认预设' }}</span>
                      <span class="admin-layout-meta-badge">跳转：{{ item.actionType }}</span>
                      <span class="admin-layout-meta-badge">发光色：{{ item.glowColor }}</span>
                    </div>
                  </div>
                  <div class="admin-layout-item-index">{{ index === 0 ? '首屏主 Banner' : `Banner ${index + 1}` }}</div>
                </div>
                <div class="admin-layout-banner-row__summary">
                  <span>标题：{{ item.title || '未填写' }}</span>
                  <span>副标题：{{ item.subtitle || '未填写' }}</span>
                  <span>动作值：{{ item.actionValue || '未配置' }}</span>
                  <span>排序：{{ item.sortOrder }}</span>
                  <span v-if="index === 0">三层图：{{ item.backgroundImageUrl || item.mainImageUrl || item.overlayImageUrl ? '已配置' : '未配置' }}</span>
                </div>
              </div>
              <div class="admin-layout-banner-row__actions">
                <button class="admin-inline-button" type="button" @click="openBannerDialog(index)">编辑</button>
                <button class="admin-inline-button" type="button" :disabled="index === 0" @click="moveHomeBannerItem(index, -1)">上移</button>
                <button class="admin-inline-button" type="button" :disabled="index === form.homeLayoutSettings.banner.items.length - 1" @click="moveHomeBannerItem(index, 1)">下移</button>
                <button class="admin-inline-button admin-inline-button--danger" type="button" @click="removeHomeBannerItem(index)">删除</button>
              </div>
            </div>
          </div>

          <div v-if="bannerDialogVisible && editingBannerDraft" class="admin-dialog-mask" @click="closeBannerDialog">
            <div class="admin-dialog admin-layout-banner-dialog" @click.stop>
              <div class="admin-dialog__header">
                <div>
                  <h3 class="admin-dialog__title">编辑 Banner</h3>
                  <div class="admin-dialog__desc">维护当前 Banner 的标题、视觉资源、跳转动作和显示状态。</div>
                </div>
                <button class="admin-dialog__close" type="button" @click="closeBannerDialog">×</button>
              </div>

              <div class="admin-form admin-dialog__body">
                <div class="admin-form__grid">
                  <div class="admin-form__field">
                    <label class="admin-form__label">键名</label>
                    <input v-model.trim="editingBannerDraft.key" class="admin-input" type="text" placeholder="例如：image">
                  </div>
                  <div class="admin-form__field">
                    <label class="admin-form__label">标题</label>
                    <input v-model.trim="editingBannerDraft.title" class="admin-input" type="text" placeholder="Banner 标题">
                  </div>
                  <div class="admin-form__field">
                    <label class="admin-form__label">副标题</label>
                    <input v-model.trim="editingBannerDraft.subtitle" class="admin-input" type="text" placeholder="Banner 副标题">
                  </div>
                  <div class="admin-form__field">
                    <label class="admin-form__label">排序值</label>
                    <input v-model.number="editingBannerDraft.sortOrder" class="admin-input" type="number" min="0" max="9999" step="10">
                  </div>

                  <div class="admin-form__field">
                    <label class="admin-form__label">图片来源</label>
                    <select v-model="editingBannerDraft.imageSource" class="admin-input">
                      <option value="default">系统默认图</option>
                      <option value="custom">自定义图片</option>
                    </select>
                  </div>
                  <div class="admin-form__field">
                    <label class="admin-form__label">默认图预设</label>
                    <select v-model="editingBannerDraft.presetKey" class="admin-input" :disabled="editingBannerDraft.imageSource !== 'default'">
                      <option v-for="preset in homeBannerPresetOptions" :key="preset.value" :value="preset.value">
                        {{ preset.label }}
                      </option>
                    </select>
                  </div>
                  <div class="admin-form__field">
                    <label class="admin-form__label">发光色</label>
                    <input v-model.trim="editingBannerDraft.glowColor" class="admin-input" type="text" placeholder="#2FE3FF">
                  </div>
                  <div class="admin-form__field admin-form__field--full">
                    <label class="admin-form__label">图片地址</label>
                    <input
                      v-model.trim="editingBannerDraft.imageUrl"
                      class="admin-input"
                      type="text"
                      :disabled="editingBannerDraft.imageSource !== 'custom'"
                      :placeholder="editingBannerDraft.imageSource === 'custom' ? '填写网络图片地址' : '当前使用系统默认图，无需填写地址'"
                    >
                  </div>

                  <div v-if="editingBannerIndex === 0" class="admin-form__field admin-form__field--full">
                    <label class="admin-form__label">三层图配置说明</label>
                    <div class="admin-form__hint">仅首个 Banner 使用三层图配置；主图层未填写时，会继续回退到图片地址或默认预设。</div>
                  </div>
                  <template v-if="editingBannerIndex === 0">
                    <div class="admin-form__field admin-form__field--full">
                      <label class="admin-form__label">背景层图片地址</label>
                      <input v-model.trim="editingBannerDraft.backgroundImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的背景层图片地址">
                    </div>
                    <div class="admin-form__field admin-form__field--full">
                      <label class="admin-form__label">主图层图片地址</label>
                      <input v-model.trim="editingBannerDraft.mainImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的主图层图片地址">
                    </div>
                    <div class="admin-form__field admin-form__field--full">
                      <label class="admin-form__label">前景叠加图地址</label>
                      <input v-model.trim="editingBannerDraft.overlayImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的前景叠加图地址">
                    </div>
                  </template>

                  <div class="admin-form__field">
                    <label class="admin-form__label">跳转类型</label>
                    <select v-model="editingBannerDraft.actionType" class="admin-input">
                      <option value="route">路由</option>
                      <option value="url">外链</option>
                      <option value="none">无动作</option>
                    </select>
                  </div>
                  <div class="admin-form__field">
                    <label class="admin-form__label">跳转值</label>
                    <input v-model.trim="editingBannerDraft.actionValue" class="admin-input" type="text" placeholder="/generate?type=image 或 https://...">
                  </div>
                  <div class="admin-form__field admin-form__field--full">
                    <label class="admin-switch-row">
                      <input v-model="editingBannerDraft.visible" type="checkbox">
                      <span>显示该 Banner</span>
                    </label>
                  </div>
                </div>

                <div class="admin-form__footer">
                  <button class="admin-button admin-button--secondary" type="button" @click="closeBannerDialog">取消</button>
                  <button class="admin-button admin-button--primary" type="button" @click="submitBannerDialog">保存 Banner</button>
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
import { ref, type PropType } from 'vue'
import type {
  SystemConfigPayload,
  SystemHomeBannerItemConfig,
  SystemHomeSideMenuItemConfig,
} from '@/api/system-config'

const layoutTabs = [
  { key: 'layout-side-menu', label: '左侧导航' },
  { key: 'layout-home-header', label: '核对首页头部' },
  { key: 'layout-home-banner', label: '处理 Banner 视觉' },
] as const

const activeSection = ref<(typeof layoutTabs)[number]['key']>('layout-side-menu')
const menuItemDialogVisible = ref(false)
const editingMenuItemIndex = ref(-1)
const editingMenuItemDraft = ref<SystemHomeSideMenuItemConfig | null>(null)
const bannerDialogVisible = ref(false)
const editingBannerIndex = ref(-1)
const editingBannerDraft = ref<SystemHomeBannerItemConfig | null>(null)

const props = defineProps({
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

function createMenuItemDraft(item: SystemHomeSideMenuItemConfig): SystemHomeSideMenuItemConfig {
  return {
    key: item.key,
    title: item.title,
    section: item.section,
    iconSource: item.iconSource,
    iconType: item.iconType,
    icon: item.icon,
    inactiveIconUrl: item.inactiveIconUrl,
    activeIconUrl: item.activeIconUrl,
    visible: item.visible,
    badgeText: item.badgeText,
    badgeTone: item.badgeTone,
    actionType: item.actionType,
    actionValue: item.actionValue,
    sortOrder: item.sortOrder,
  }
}

function openMenuItemDialog(index: number) {
  const target = props.form.homeSideMenuSettings.items[index]
  if (!target) return

  editingMenuItemIndex.value = index
  editingMenuItemDraft.value = createMenuItemDraft(target)
  menuItemDialogVisible.value = true
}

function closeMenuItemDialog() {
  menuItemDialogVisible.value = false
  editingMenuItemIndex.value = -1
  editingMenuItemDraft.value = null
}

function submitMenuItemDialog() {
  if (editingMenuItemIndex.value < 0 || !editingMenuItemDraft.value) {
    closeMenuItemDialog()
    return
  }

  const target = props.form.homeSideMenuSettings.items[editingMenuItemIndex.value]
  if (!target) {
    closeMenuItemDialog()
    return
  }

  Object.assign(target, createMenuItemDraft(editingMenuItemDraft.value))
  closeMenuItemDialog()
}

function triggerEditingMenuIconUpload(state: 'inactive' | 'active') {
  if (typeof document === 'undefined') return
  const input = document.getElementById(`layout-menu-item-dialog-icon-${state}`) as HTMLInputElement | null
  input?.click()
}

async function handleEditingMenuIconFileChange(event: Event, state: 'inactive' | 'active') {
  if (!editingMenuItemDraft.value) return
  await props.handleMenuIconFileChange(event, editingMenuItemDraft.value, state)
}

function clearEditingMenuIcon(state: 'inactive' | 'active') {
  if (!editingMenuItemDraft.value) return
  props.clearMenuIcon(editingMenuItemDraft.value, state)
}

function createBannerDraft(item: SystemHomeBannerItemConfig): SystemHomeBannerItemConfig {
  return {
    key: item.key,
    title: item.title,
    subtitle: item.subtitle,
    imageSource: item.imageSource,
    presetKey: item.presetKey,
    imageUrl: item.imageUrl,
    backgroundImageUrl: item.backgroundImageUrl,
    mainImageUrl: item.mainImageUrl,
    overlayImageUrl: item.overlayImageUrl,
    glowColor: item.glowColor,
    actionType: item.actionType,
    actionValue: item.actionValue,
    visible: item.visible,
    sortOrder: item.sortOrder,
  }
}

function openBannerDialog(index: number) {
  const target = props.form.homeLayoutSettings.banner.items[index]
  if (!target) return

  editingBannerIndex.value = index
  editingBannerDraft.value = createBannerDraft(target)
  bannerDialogVisible.value = true
}

function closeBannerDialog() {
  bannerDialogVisible.value = false
  editingBannerIndex.value = -1
  editingBannerDraft.value = null
}

function submitBannerDialog() {
  if (editingBannerIndex.value < 0 || !editingBannerDraft.value) {
    closeBannerDialog()
    return
  }

  const target = props.form.homeLayoutSettings.banner.items[editingBannerIndex.value]
  if (!target) {
    closeBannerDialog()
    return
  }

  Object.assign(target, createBannerDraft(editingBannerDraft.value))
  closeBannerDialog()
}
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

.admin-layout-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.admin-layout-form-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-layout-nav-workspace {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.admin-layout-form-block {
  padding: 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-surface) 96%, var(--bg-block-secondary-default));
}

.admin-layout-form-block--embedded {
  padding: 14px;
  border-style: dashed;
}

.admin-layout-form-block__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.admin-layout-form-block__title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.admin-layout-form-block__desc {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.admin-layout-inline-hint {
  margin-top: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
}

.admin-layout-list-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 16px;
  background: color-mix(in srgb, var(--brand-primary, #6b8cff) 6%, var(--bg-surface));
}

.admin-layout-list-head__title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.admin-layout-list-head__desc {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.admin-layout-menu-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-layout-menu-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-surface) 96%, var(--bg-block-secondary-default));
}

.admin-layout-menu-row__order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--brand-primary, #6b8cff) 12%, var(--bg-surface));
  color: var(--brand-primary, #6b8cff);
  font-size: 13px;
  font-weight: 700;
}

.admin-layout-menu-row__main {
  min-width: 0;
}

.admin-layout-menu-row__head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-layout-menu-row__title {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.admin-layout-menu-row__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
}

.admin-layout-menu-row__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.admin-layout-menu-dialog {
  width: min(960px, calc(100vw - 32px));
}

.admin-layout-banner-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-layout-banner-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-surface) 96%, var(--bg-block-secondary-default));
}

.admin-layout-banner-row__order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--brand-primary, #6b8cff) 12%, var(--bg-surface));
  color: var(--brand-primary, #6b8cff);
  font-size: 13px;
  font-weight: 700;
}

.admin-layout-banner-row__main {
  min-width: 0;
}

.admin-layout-banner-row__head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-layout-banner-row__title {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.admin-layout-banner-row__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
}

.admin-layout-banner-row__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.admin-layout-banner-dialog {
  width: min(960px, calc(100vw - 32px));
}

.admin-layout-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.admin-layout-item-index {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand-primary, #6b8cff) 10%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, var(--brand-primary, #6b8cff) 20%, transparent);
  color: var(--brand-primary, #6b8cff);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
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

.admin-layout-section-card__eyebrow {
  margin-bottom: 8px;
  color: var(--brand-primary, #6b8cff);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-layout-toolbar-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-start;
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

.admin-layout-jump-button.is-active {
  border-color: color-mix(in srgb, var(--brand-primary, #6b8cff) 42%, transparent);
  background: color-mix(in srgb, var(--brand-primary, #6b8cff) 18%, var(--bg-surface));
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand-primary, #6b8cff) 16%, transparent);
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

.admin-layout-section-card__helper {
  margin-top: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
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

  .admin-layout-menu-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-layout-banner-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-layout-menu-row__order {
    width: 32px;
    height: 32px;
  }

  .admin-layout-banner-row__order {
    width: 32px;
    height: 32px;
  }

  .admin-layout-menu-row__actions {
    justify-content: flex-start;
  }

  .admin-layout-banner-row__actions {
    justify-content: flex-start;
  }

  .admin-layout-item-head {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .admin-system-menu-icon-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
