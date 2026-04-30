<template>
  <AdminPageContainer title="系统设置" description="统一维护站点信息、政策协议以及登录方式配置。">
    <div class="admin-grid admin-grid--stats">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">站点名称</div>
        <div class="admin-stat-card__value">{{ systemForm.siteInfo.siteName || '未设置' }}</div>
        <div class="admin-stat-card__hint">登录弹窗标题与浏览器标题都会复用这里的配置</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">启用登录方式</div>
        <div class="admin-stat-card__value">{{ enabledMethodCount }}</div>
        <div class="admin-stat-card__hint">当前对前台用户可见且可用的登录方式数量</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">协议勾选</div>
        <div class="admin-stat-card__value">{{ systemForm.policySettings.agreementRequired ? '开启' : '关闭' }}</div>
        <div class="admin-stat-card__hint">控制登录前是否必须勾选协议</div>
      </div>
    </div>

    <div class="admin-system-tabs">
      <button
        v-for="item in tabItems"
        :key="item.key"
        class="admin-system-tabs__item"
        :class="{ 'is-active': currentTab === item.key }"
        type="button"
        @click="currentTab = item.key"
      >
        <span class="admin-system-tabs__title">{{ item.label }}</span>
        <span class="admin-system-tabs__desc">{{ item.description }}</span>
      </button>
    </div>

    <div v-if="currentTab === 'site'" class="admin-system-panel">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">站点信息</h4>
            <div class="admin-card__desc">配置站点名称、描述、Logo、图标以及备案信息。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <form class="admin-form" @submit.prevent="handleSaveSystemSettings">
            <div class="admin-form__grid">
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-site-name">站点名称</label>
                <input id="system-site-name" v-model.trim="systemForm.siteInfo.siteName" class="admin-input" type="text" placeholder="例如：Canana AI">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-site-icon">站点图标</label>
                <input id="system-site-icon" v-model.trim="systemForm.siteInfo.siteIconUrl" class="admin-input" type="text" placeholder="favicon 地址">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-site-description">站点描述</label>
                <textarea id="system-site-description" v-model.trim="systemForm.siteInfo.siteDescription" class="admin-textarea" placeholder="站点简介、SEO 描述或首页说明"></textarea>
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-site-logo">站点 Logo</label>
                <input id="system-site-logo" v-model.trim="systemForm.siteInfo.siteLogoUrl" class="admin-input" type="text" placeholder="Logo 图片地址">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-site-icp-text">备案文案</label>
                <input id="system-site-icp-text" v-model.trim="systemForm.siteInfo.icpText" class="admin-input" type="text" placeholder="例如：粤ICP备xxxx号">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-site-icp-link">备案链接</label>
                <input id="system-site-icp-link" v-model.trim="systemForm.siteInfo.icpLink" class="admin-input" type="text" placeholder="https://beian.miit.gov.cn">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-site-copyright">版权文案</label>
                <input id="system-site-copyright" v-model.trim="systemForm.siteInfo.copyrightText" class="admin-input" type="text" placeholder="例如：© 2026 Canana. All rights reserved.">
              </div>
            </div>

            <div class="admin-form__footer">
              <button class="admin-button admin-button--primary" type="submit" :disabled="systemSaving || loading">
                {{ systemSaving ? '保存中...' : '保存站点信息' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div v-else-if="currentTab === 'policy'" class="admin-system-panel">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">政策协议</h4>
            <div class="admin-card__desc">配置登录弹窗展示的协议名称、跳转链接、提示文案和详情正文。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <form class="admin-form" @submit.prevent="handleSaveSystemSettings">
            <div class="admin-form__grid">
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label">协议开关</label>
                <label class="admin-switch-row">
                  <input v-model="systemForm.policySettings.agreementRequired" type="checkbox">
                  <span>登录前必须勾选协议</span>
                </label>
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-agreement-prefix">前置提示文案</label>
                <input id="system-agreement-prefix" v-model.trim="systemForm.policySettings.agreementTextPrefix" class="admin-input" type="text" placeholder="例如：已阅读并同意">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-agreement-title">用户协议标题</label>
                <input id="system-agreement-title" v-model.trim="systemForm.policySettings.userAgreementTitle" class="admin-input" type="text" placeholder="用户服务协议">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-agreement-url">用户协议链接</label>
                <input id="system-agreement-url" v-model.trim="systemForm.policySettings.userAgreementUrl" class="admin-input" type="text" placeholder="https://...">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-agreement-content">用户协议正文</label>
                <textarea id="system-agreement-content" v-model.trim="systemForm.policySettings.userAgreementContent" class="admin-textarea admin-system-json" placeholder="可填写前台协议详情页展示内容"></textarea>
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-privacy-title">隐私政策标题</label>
                <input id="system-privacy-title" v-model.trim="systemForm.policySettings.privacyPolicyTitle" class="admin-input" type="text" placeholder="隐私政策">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-privacy-url">隐私政策链接</label>
                <input id="system-privacy-url" v-model.trim="systemForm.policySettings.privacyPolicyUrl" class="admin-input" type="text" placeholder="https://...">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-privacy-content">隐私政策正文</label>
                <textarea id="system-privacy-content" v-model.trim="systemForm.policySettings.privacyPolicyContent" class="admin-textarea admin-system-json" placeholder="可填写前台隐私政策详情页展示内容"></textarea>
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-ai-title">AI 须知标题</label>
                <input id="system-ai-title" v-model.trim="systemForm.policySettings.aiNoticeTitle" class="admin-input" type="text" placeholder="AI功能使用须知">
              </div>
              <div class="admin-form__field">
                <label class="admin-form__label" for="system-ai-url">AI 须知链接</label>
                <input id="system-ai-url" v-model.trim="systemForm.policySettings.aiNoticeUrl" class="admin-input" type="text" placeholder="https://...">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-ai-content">AI 须知正文</label>
                <textarea id="system-ai-content" v-model.trim="systemForm.policySettings.aiNoticeContent" class="admin-textarea admin-system-json" placeholder="可填写前台 AI 功能使用须知详情页展示内容"></textarea>
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-login-title">登录标题</label>
                <input id="system-login-title" v-model.trim="systemForm.loginSettings.welcomeTitle" class="admin-input" type="text" placeholder="欢迎登录">
              </div>
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label" for="system-login-subtitle">登录副标题</label>
                <textarea id="system-login-subtitle" v-model.trim="systemForm.loginSettings.welcomeSubtitle" class="admin-textarea" placeholder="展示在登录弹窗标题下方，可填写品牌口号或提示"></textarea>
              </div>
            </div>

            <div class="admin-form__footer">
              <button class="admin-button admin-button--primary" type="submit" :disabled="systemSaving || loading">
                {{ systemSaving ? '保存中...' : '保存政策协议' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div v-else-if="currentTab === 'progress'" class="admin-system-panel">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">生成进度文案</h4>
            <div class="admin-card__desc">按阶段配置“造梦中”徽章的展示文案、百分比和说明，前端会自动按 SSE 阶段映射显示。</div>
          </div>
          <div class="admin-page__actions">
            <button class="admin-button admin-button--secondary" type="button" @click="expandAllProgressStages">全部展开</button>
            <button class="admin-button admin-button--secondary" type="button" @click="collapseAllProgressStages">全部折叠</button>
            <button class="admin-button admin-button--secondary" type="button" @click="resetGenerationProgressSettings">恢复默认文案</button>
          </div>
        </div>
        <div class="admin-card__content">
          <form class="admin-form" @submit.prevent="handleSaveSystemSettings">
            <div class="admin-form__grid">
              <div class="admin-form__field admin-form__field--full">
                <label class="admin-form__label">配置开关</label>
                <label class="admin-switch-row">
                  <input v-model="systemForm.generationProgressSettings.enabled" type="checkbox">
                  <span>启用后台生成进度文案配置</span>
                </label>
              </div>
              <div
                v-for="stage in systemForm.generationProgressSettings.stages"
                :key="stage.key"
                class="admin-form__field admin-form__field--full"
              >
                <div class="admin-system-stage-card">
                  <div class="admin-system-stage-card__header">
                    <div>
                      <div class="admin-system-stage-card__title-row">
                        <div class="admin-system-stage-card__title">{{ stage.label || stage.key }}</div>
                        <span class="admin-chip admin-system-stage-card__key">{{ stage.key }}</span>
                      </div>
                      <div class="admin-system-stage-card__desc">{{ stage.description || '未填写阶段说明' }}</div>
                    </div>
                    <div class="admin-system-stage-card__header-actions">
                      <span class="admin-status" :class="stage.showPercent ? 'admin-status--success' : 'admin-status--muted'">
                        {{ stage.showPercent ? '显示进度' : '纯文案' }}
                      </span>
                      <label class="admin-switch-row">
                        <input v-model="stage.showPercent" type="checkbox">
                        <span>显示百分比</span>
                      </label>
                      <button class="admin-inline-button" type="button" @click="toggleProgressStageCollapse(stage.key)">
                        {{ collapsedProgressStages.has(stage.key) ? '展开' : '折叠' }}
                      </button>
                    </div>
                  </div>
                  <div v-if="!collapsedProgressStages.has(stage.key)" class="admin-system-stage-card__preview">
                    <span class="admin-system-stage-card__preview-label">前台预览</span>
                    <span class="admin-system-stage-card__badge">
                      {{ buildProgressStagePreview(stage) }}
                    </span>
                  </div>
                  <div v-if="!collapsedProgressStages.has(stage.key)" class="admin-form__grid admin-system-stage-card__body">
                    <div class="admin-form__field">
                      <label class="admin-form__label">展示文案</label>
                      <input v-model.trim="stage.label" class="admin-input" type="text" placeholder="例如：生成中">
                    </div>
                    <div class="admin-form__field">
                      <label class="admin-form__label">展示百分比</label>
                      <input v-model.number="stage.percent" class="admin-input" type="number" min="0" max="100" placeholder="0-100">
                    </div>
                    <div class="admin-form__field admin-form__field--full">
                      <label class="admin-form__label">阶段说明</label>
                      <textarea v-model.trim="stage.description" class="admin-textarea" placeholder="用于后台识别当前阶段含义"></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="admin-form__footer">
              <button class="admin-button admin-button--primary" type="submit" :disabled="systemSaving || loading">
                {{ systemSaving ? '保存中...' : '保存生成文案' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div v-else class="admin-system-panel">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">登录方式配置说明</h4>
            <div class="admin-card__desc">当前页面用于维护登录入口展示、验证码渠道参数以及 OAuth 基础参数。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-form__hint">
            验证码登录可填写短信或邮件发送参数；OAuth 登录当前支持授权地址生成，回调换 Token 与用户绑定逻辑需后端继续接入。
          </div>
        </div>
      </div>

      <div class="admin-card admin-system-methods-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">登录方式</h4>
            <div class="admin-card__desc">按卡片管理登录入口，弹窗内完成新增、编辑和参数配置，最后统一保存到后端。</div>
          </div>
          <div class="admin-page__actions">
            <button class="admin-button admin-button--secondary" type="button" @click="openCreateMethodDialog" :disabled="loading || methodSaving || !creatableMethodTemplates.length">
              {{ creatableMethodTemplates.length ? '新增登录方式' : '已全部添加' }}
            </button>
            <button class="admin-button admin-button--primary" type="button" @click="handleSaveAuthMethods" :disabled="loading || methodSaving || !authMethods.length">
              {{ methodSaving ? '保存中...' : '保存登录方式' }}
            </button>
          </div>
        </div>
        <div class="admin-card__content">
          <div v-if="loading" class="admin-empty">正在加载系统设置...</div>
          <div v-else-if="!authMethods.length" class="admin-empty">暂无登录方式配置，请先检查后端认证配置初始化是否正常。</div>
          <div v-else class="admin-provider-grid admin-system-method-grid">
            <button
              class="admin-provider-create-card admin-system-method-create"
              type="button"
              @click="openCreateMethodDialog"
              :disabled="!creatableMethodTemplates.length"
            >
              <div class="admin-provider-create-card__plus">+</div>
              <div class="admin-provider-create-card__title">新增登录方式</div>
              <div class="admin-provider-create-card__desc">
                {{ creatableMethodTemplates.length ? '从预设模板中新增一项登录配置' : '预设登录方式已全部添加' }}
              </div>
              <div class="admin-provider-create-card__footer-actions">
                <span class="admin-provider-create-card__action admin-provider-create-card__action--muted">预设模板</span>
                <span class="admin-provider-create-card__action">弹窗配置</span>
              </div>
            </button>

            <div
              v-for="method in sortedAuthMethods"
              :key="method.methodType"
              class="admin-provider-tile admin-system-method-tile"
            >
              <div class="admin-provider-tile__header">
                <div class="admin-provider-tile__brand">
                  <div class="admin-provider-avatar admin-provider-avatar--small">
                    <span>{{ method.displayName.slice(0, 1) }}</span>
                  </div>
                  <div class="admin-provider-tile__meta">
                    <div class="admin-provider-tile__title">{{ method.displayName || method.methodType }}</div>
                    <div class="admin-provider-tile__link">{{ method.methodType }} / {{ method.category }}</div>
                  </div>
                </div>
                <div class="admin-provider-tile__actions" @click.stop>
                  <button class="admin-icon-button" type="button" title="登录方式操作" @click="toggleMethodMenu(method.methodType)"><el-icon><MoreFilled /></el-icon></button>
                  <div v-if="activeMethodMenuType === method.methodType" class="admin-provider-menu">
                    <button class="admin-provider-menu__item" type="button" @click="handleMethodMenuEdit(method)">
                      <span class="admin-provider-menu__icon"><el-icon><Edit /></el-icon></span>
                      <span>编辑配置</span>
                    </button>
                    <button class="admin-provider-menu__item" type="button" @click="handleMethodMenuToggleEnabled(method)">
                      <span class="admin-provider-menu__icon">{{ method.isEnabled ? '停' : '启' }}</span>
                      <span>{{ method.isEnabled ? '停用登录方式' : '启用登录方式' }}</span>
                    </button>
                    <button class="admin-provider-menu__item" type="button" @click="handleMethodMenuToggleVisible(method)">
                      <span class="admin-provider-menu__icon">{{ method.isVisible ? '隐' : '显' }}</span>
                      <span>{{ method.isVisible ? '前台隐藏' : '前台显示' }}</span>
                    </button>
                    <div class="admin-provider-menu__divider"></div>
                    <button class="admin-provider-menu__item admin-provider-menu__item--danger" type="button" @click="handleMethodMenuDelete(method)">
                      <span class="admin-provider-menu__icon"><el-icon><Delete /></el-icon></span>
                      <span>删除该项</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="admin-provider-tile__status-row">
                <span class="admin-status" :class="method.isEnabled ? 'admin-status--success' : 'admin-status--warning'">
                  {{ method.isEnabled ? '已启用' : '未启用' }}
                </span>
                <span class="admin-status" :class="method.isVisible ? 'admin-status--success' : 'admin-status--warning'">
                  {{ method.isVisible ? '前台可见' : '前台隐藏' }}
                </span>
              </div>

              <div class="admin-provider-tile__chips">
                <span class="admin-chip">{{ getMethodCategoryLabel(method.category) }}</span>
                <span class="admin-chip">排序 {{ method.sortOrder }}</span>
                <span class="admin-chip">{{ method.allowSignUp ? '允许自动注册' : '禁止自动注册' }}</span>
                <span v-if="method.category === 'CODE'" class="admin-chip">{{ method.debugSendEnabled ? '调试自动填码开启' : '调试自动填码关闭' }}</span>
              </div>

              <div class="admin-system-method-preview">
                <div v-for="item in buildMethodPreviewItems(method)" :key="item" class="admin-system-method-preview__item">
                  {{ item }}
                </div>
              </div>

              <div class="admin-provider-tile__footer">
                <span>{{ method.description || '未填写登录方式描述' }}</span>
                <span>{{ getMethodTypeLabel(method.methodType) }}</span>
              </div>

              <div class="admin-system-method-actions">
                <button class="admin-inline-button" type="button" @click="openEditMethodDialog(method)">编辑</button>
                <button class="admin-inline-button" type="button" @click="toggleMethodEnabled(method.methodType)">
                  {{ method.isEnabled ? '停用' : '启用' }}
                </button>
                <button class="admin-inline-button" type="button" @click="toggleMethodVisible(method.methodType)">
                  {{ method.isVisible ? '隐藏' : '显示' }}
                </button>
                <button class="admin-inline-button admin-inline-button--danger" type="button" @click="removeMethod(method.methodType)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminPageContainer>

  <div v-if="methodDialogVisible" class="admin-dialog-mask" @click="closeMethodDialog">
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
import { ElMessage } from 'element-plus'
import { Delete, Edit, MoreFilled } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import {
  listAuthMethodConfigs,
  saveAuthMethodConfigs,
  type AuthMethodCategory,
  type AuthMethodConfigPayload,
  type AuthMethodType,
  type PublicAuthMethod,
} from '@/api/auth'
import {
  createDefaultConversationSettings,
  getAdminSystemConfig,
  saveAdminSystemConfig,
  type SystemConfigPayload,
} from '@/api/system-config'
import { useSystemSettingsStore } from '@/stores/system-settings'

// 扩展登录方式编辑态，便于把通用 JSON 配置拆成可视化表单。
interface EditableAuthMethod extends PublicAuthMethod {
  configText: string
  targetLabel: string
  placeholder: string
  codePlaceholder: string
  debugSendEnabled: boolean
  senderName: string
  senderAddress: string
  providerCode: string
  accessKeyId: string
  accessKeySecret: string
  signName: string
  templateCode: string
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
}

interface AuthMethodTemplate {
  methodType: AuthMethodType
  category: AuthMethodCategory
  displayName: string
  description: string
  iconType: string
  iconUrl: string
  isEnabled: boolean
  isVisible: boolean
  sortOrder: number
  allowAutoFill: boolean
  allowSignUp: boolean
  config: Record<string, any>
}

const loading = ref(false)
const currentTab = ref<'site' | 'policy' | 'progress' | 'login'>('site')
const tabItems = [
  { key: 'site', label: '站点信息', description: '品牌、标题、页脚与备案信息' },
  { key: 'policy', label: '政策协议', description: '协议文案、正文与登录提示' },
  { key: 'progress', label: '生成文案', description: '进度阶段、百分比与徽章文案' },
  { key: 'login', label: '登录方式', description: '启用状态、排序与登录字段' },
] as const
const systemSaving = ref(false)
const methodSaving = ref(false)
const methodDialogVisible = ref(false)
const activeMethodMenuType = ref<AuthMethodType | ''>('')
const editingMethodType = ref<AuthMethodType | ''>('')
const authMethods = ref<EditableAuthMethod[]>([])
const collapsedProgressStages = ref<Set<string>>(new Set())
const { applyPublicSystemSettings } = useSystemSettingsStore()

const AUTH_METHOD_TEMPLATES: AuthMethodTemplate[] = [
  {
    methodType: 'PHONE_CODE',
    category: 'CODE',
    displayName: '手机号登录',
    description: '使用短信验证码登录',
    iconType: 'phone',
    iconUrl: '',
    isEnabled: true,
    isVisible: true,
    sortOrder: 10,
    allowAutoFill: true,
    allowSignUp: true,
    config: {
      targetLabel: '手机号',
      placeholder: '请输入手机号',
      codePlaceholder: '请输入验证码',
      providerCode: '',
      accessKeyId: '',
      accessKeySecret: '',
      signName: '',
      templateCode: '',
    },
  },
  {
    methodType: 'EMAIL_CODE',
    category: 'CODE',
    displayName: '邮箱登录',
    description: '使用邮箱验证码登录',
    iconType: 'mail',
    iconUrl: '',
    isEnabled: true,
    isVisible: true,
    sortOrder: 20,
    allowAutoFill: true,
    allowSignUp: true,
    config: {
      targetLabel: '邮箱',
      placeholder: '请输入邮箱',
      codePlaceholder: '请输入验证码',
      senderName: '',
      senderAddress: '',
      smtpHost: '',
      smtpPort: '',
      smtpSecure: true,
      smtpUser: '',
      smtpPassword: '',
    },
  },
  {
    methodType: 'WECHAT_OAUTH',
    category: 'OAUTH',
    displayName: '微信登录',
    description: '使用微信账号登录',
    iconType: 'wechat',
    iconUrl: '',
    isEnabled: false,
    isVisible: true,
    sortOrder: 30,
    allowAutoFill: false,
    allowSignUp: true,
    config: {
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      responseType: 'code',
      scope: '',
    },
  },
  {
    methodType: 'GITHUB_OAUTH',
    category: 'OAUTH',
    displayName: 'GitHub 登录',
    description: '使用 GitHub 账号登录',
    iconType: 'github',
    iconUrl: '',
    isEnabled: false,
    isVisible: true,
    sortOrder: 40,
    allowAutoFill: false,
    allowSignUp: true,
    config: {
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      responseType: 'code',
      scope: 'read:user user:email',
    },
  },
  {
    methodType: 'GOOGLE_OAUTH',
    category: 'OAUTH',
    displayName: 'Google 登录',
    description: '使用 Google 账号登录',
    iconType: 'google',
    iconUrl: '',
    isEnabled: false,
    isVisible: true,
    sortOrder: 50,
    allowAutoFill: false,
    allowSignUp: true,
    config: {
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      responseType: 'code',
      scope: 'openid email profile',
    },
  },
  {
    methodType: 'CUSTOM_OAUTH',
    category: 'OAUTH',
    displayName: '自定义 OAuth',
    description: '接入自定义第三方 OAuth 登录',
    iconType: 'link',
    iconUrl: '',
    isEnabled: false,
    isVisible: true,
    sortOrder: 60,
    allowAutoFill: false,
    allowSignUp: true,
    config: {
      authorizeUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      responseType: 'code',
      scope: '',
    },
  },
]

const createDefaultSystemForm = (): SystemConfigPayload => ({
  siteInfo: {
    siteName: 'Canana',
    siteDescription: '',
    siteLogoUrl: '',
    siteIconUrl: '',
    icpText: '',
    icpLink: '',
    copyrightText: '',
  },
  policySettings: {
    agreementRequired: true,
    agreementTextPrefix: '已阅读并同意',
    userAgreementTitle: '用户服务协议',
    userAgreementUrl: '',
    userAgreementContent: '',
    privacyPolicyTitle: '隐私政策',
    privacyPolicyUrl: '',
    privacyPolicyContent: '',
    aiNoticeTitle: 'AI功能使用须知',
    aiNoticeUrl: '',
    aiNoticeContent: '',
  },
  loginSettings: {
    welcomeTitle: '欢迎登录',
    welcomeSubtitle: '',
  },
  generationProgressSettings: {
    enabled: true,
    stages: [
      { key: 'queued', label: '排队中', percent: 5, showPercent: true, description: '任务已创建，等待服务端执行' },
      { key: 'resolved_provider', label: '准备中', percent: 12, showPercent: true, description: '已解析厂商与模型配置' },
      { key: 'requesting_upstream', label: '生成中', percent: 35, showPercent: true, description: '已开始请求上游图片模型' },
      { key: 'receiving_upstream_result', label: '解析中', percent: 72, showPercent: true, description: '上游已返回结果，正在解析图片内容' },
      { key: 'syncing_record', label: '同步中', percent: 92, showPercent: true, description: '图片结果已解析，正在同步记录与资源信息' },
      { key: 'completed', label: '已完成', percent: 100, showPercent: false, description: '任务执行完成' },
      { key: 'failing', label: '收尾中', percent: 96, showPercent: true, description: '任务执行异常，正在写入失败状态' },
      { key: 'failed', label: '生成失败', percent: 100, showPercent: false, description: '任务执行失败' },
      { key: 'stopping', label: '停止中', percent: 98, showPercent: true, description: '任务已收到停止指令，正在收口状态' },
      { key: 'stopped', label: '已停止', percent: 100, showPercent: false, description: '任务已停止' },
    ],
  },
  conversationSettings: createDefaultConversationSettings(),
})

const createDefaultGenerationProgressStages = () => createDefaultSystemForm().generationProgressSettings.stages.map(item => ({ ...item }))

const systemForm = reactive<SystemConfigPayload>(createDefaultSystemForm())
const methodForm = reactive<EditableAuthMethod>(createEditableAuthMethod(AUTH_METHOD_TEMPLATES[0]))

const enabledMethodCount = computed(() => authMethods.value.filter(item => item.isEnabled && item.isVisible).length)
const sortedAuthMethods = computed(() => sortEditableAuthMethods(authMethods.value))
const creatableMethodTemplates = computed(() => {
  const existingTypes = new Set(authMethods.value.map(item => item.methodType))
  return AUTH_METHOD_TEMPLATES.filter(item => !existingTypes.has(item.methodType))
})

const applySystemForm = (value: SystemConfigPayload) => {
  systemForm.siteInfo.siteName = value.siteInfo.siteName
  systemForm.siteInfo.siteDescription = value.siteInfo.siteDescription
  systemForm.siteInfo.siteLogoUrl = value.siteInfo.siteLogoUrl
  systemForm.siteInfo.siteIconUrl = value.siteInfo.siteIconUrl
  systemForm.siteInfo.icpText = value.siteInfo.icpText
  systemForm.siteInfo.icpLink = value.siteInfo.icpLink
  systemForm.siteInfo.copyrightText = value.siteInfo.copyrightText
  systemForm.policySettings.agreementRequired = value.policySettings.agreementRequired
  systemForm.policySettings.agreementTextPrefix = value.policySettings.agreementTextPrefix
  systemForm.policySettings.userAgreementTitle = value.policySettings.userAgreementTitle
  systemForm.policySettings.userAgreementUrl = value.policySettings.userAgreementUrl
  systemForm.policySettings.userAgreementContent = value.policySettings.userAgreementContent
  systemForm.policySettings.privacyPolicyTitle = value.policySettings.privacyPolicyTitle
  systemForm.policySettings.privacyPolicyUrl = value.policySettings.privacyPolicyUrl
  systemForm.policySettings.privacyPolicyContent = value.policySettings.privacyPolicyContent
  systemForm.policySettings.aiNoticeTitle = value.policySettings.aiNoticeTitle
  systemForm.policySettings.aiNoticeUrl = value.policySettings.aiNoticeUrl
  systemForm.policySettings.aiNoticeContent = value.policySettings.aiNoticeContent
  systemForm.loginSettings.welcomeTitle = value.loginSettings.welcomeTitle
  systemForm.loginSettings.welcomeSubtitle = value.loginSettings.welcomeSubtitle
  systemForm.generationProgressSettings.enabled = value.generationProgressSettings.enabled
  systemForm.generationProgressSettings.stages = value.generationProgressSettings.stages.map(item => ({ ...item }))
  systemForm.conversationSettings = JSON.parse(JSON.stringify(value.conversationSettings || createDefaultConversationSettings()))
}

// 把后端登录方式配置映射成后台表单结构。
function toEditableAuthMethod(method: PublicAuthMethod): EditableAuthMethod {
  return {
    ...method,
    configText: JSON.stringify(method.config || {}, null, 2),
    targetLabel: String(method.config?.targetLabel || ''),
    placeholder: String(method.config?.placeholder || ''),
    codePlaceholder: String(method.config?.codePlaceholder || ''),
    debugSendEnabled: method.allowAutoFill !== false,
    senderName: String(method.config?.senderName || ''),
    senderAddress: String(method.config?.senderAddress || ''),
    providerCode: String(method.config?.providerCode || ''),
    accessKeyId: String(method.config?.accessKeyId || ''),
    accessKeySecret: String(method.config?.accessKeySecret || ''),
    signName: String(method.config?.signName || ''),
    templateCode: String(method.config?.templateCode || ''),
    smtpHost: String(method.config?.smtpHost || ''),
    smtpPort: String(method.config?.smtpPort || ''),
    smtpSecure: method.config?.smtpSecure === true,
    smtpUser: String(method.config?.smtpUser || ''),
    smtpPassword: String(method.config?.smtpPassword || ''),
    authorizeUrl: String(method.config?.authorizeUrl || ''),
    tokenUrl: String(method.config?.tokenUrl || ''),
    userInfoUrl: String(method.config?.userInfoUrl || ''),
    clientId: String(method.config?.clientId || ''),
    clientSecret: String(method.config?.clientSecret || ''),
    redirectUri: String(method.config?.redirectUri || ''),
    responseType: String(method.config?.responseType || 'code'),
    scope: String(method.config?.scope || ''),
  }
}

// 根据预设模板创建一个新的可编辑登录方式。
function createEditableAuthMethod(template: AuthMethodTemplate): EditableAuthMethod {
  return toEditableAuthMethod({
    methodType: template.methodType,
    category: template.category,
    displayName: template.displayName,
    description: template.description,
    iconType: template.iconType,
    iconUrl: template.iconUrl,
    isEnabled: template.isEnabled,
    isVisible: template.isVisible,
    sortOrder: template.sortOrder,
    allowAutoFill: template.allowAutoFill,
    allowSignUp: template.allowSignUp,
    config: template.config,
  })
}

// 统一把编辑对象写回响应式表单，避免字段遗漏。
function applyEditableMethod(target: EditableAuthMethod, source: EditableAuthMethod) {
  target.methodType = source.methodType
  target.category = source.category
  target.displayName = source.displayName
  target.description = source.description
  target.iconType = source.iconType
  target.iconUrl = source.iconUrl
  target.isEnabled = source.isEnabled
  target.isVisible = source.isVisible
  target.sortOrder = source.sortOrder
  target.allowAutoFill = source.allowAutoFill
  target.allowSignUp = source.allowSignUp
  target.config = { ...(source.config || {}) }
  target.configText = source.configText
  target.targetLabel = source.targetLabel
  target.placeholder = source.placeholder
  target.codePlaceholder = source.codePlaceholder
  target.debugSendEnabled = source.debugSendEnabled
  target.senderName = source.senderName
  target.senderAddress = source.senderAddress
  target.providerCode = source.providerCode
  target.accessKeyId = source.accessKeyId
  target.accessKeySecret = source.accessKeySecret
  target.signName = source.signName
  target.templateCode = source.templateCode
  target.smtpHost = source.smtpHost
  target.smtpPort = source.smtpPort
  target.smtpSecure = source.smtpSecure
  target.smtpUser = source.smtpUser
  target.smtpPassword = source.smtpPassword
  target.authorizeUrl = source.authorizeUrl
  target.tokenUrl = source.tokenUrl
  target.userInfoUrl = source.userInfoUrl
  target.clientId = source.clientId
  target.clientSecret = source.clientSecret
  target.redirectUri = source.redirectUri
  target.responseType = source.responseType
  target.scope = source.scope
}

function cloneEditableMethod(source: EditableAuthMethod): EditableAuthMethod {
  return {
    ...source,
    config: { ...(source.config || {}) },
  }
}

function sortEditableAuthMethods(methods: EditableAuthMethod[]) {
  return [...methods].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }
    return left.methodType.localeCompare(right.methodType)
  })
}

function getMethodCategoryLabel(category: AuthMethodCategory) {
  return category === 'CODE' ? '验证码登录' : 'OAuth 登录'
}

function getMethodTypeLabel(methodType: AuthMethodType) {
  const currentTemplate = AUTH_METHOD_TEMPLATES.find(item => item.methodType === methodType)
  return currentTemplate?.displayName || methodType
}

const closeMethodMenu = () => {
  activeMethodMenuType.value = ''
}

const toggleMethodMenu = (methodType: AuthMethodType) => {
  activeMethodMenuType.value = activeMethodMenuType.value === methodType ? '' : methodType
}

const replaceMethodInList = (methodType: AuthMethodType, updater: (method: EditableAuthMethod) => EditableAuthMethod) => {
  authMethods.value = sortEditableAuthMethods(
    authMethods.value.map(item => item.methodType === methodType ? updater(cloneEditableMethod(item)) : item),
  )
}

const toggleMethodEnabled = (methodType: AuthMethodType) => {
  replaceMethodInList(methodType, (method) => {
    method.isEnabled = !method.isEnabled
    return method
  })
}

const toggleMethodVisible = (methodType: AuthMethodType) => {
  replaceMethodInList(methodType, (method) => {
    method.isVisible = !method.isVisible
    return method
  })
}

const removeMethod = (methodType: AuthMethodType) => {
  const targetMethod = authMethods.value.find(item => item.methodType === methodType)
  if (!targetMethod) {
    return
  }

  if (!window.confirm(`确认删除登录方式“${targetMethod.displayName || targetMethod.methodType}”吗？删除后需点击“保存登录方式”才会同步到后端。`)) {
    return
  }

  authMethods.value = authMethods.value.filter(item => item.methodType !== methodType)
  closeMethodMenu()
  ElMessage.success('登录方式已从待保存列表移除')
}

const handleMethodMenuEdit = (method: EditableAuthMethod) => {
  closeMethodMenu()
  openEditMethodDialog(method)
}

const handleMethodMenuToggleEnabled = (method: EditableAuthMethod) => {
  closeMethodMenu()
  toggleMethodEnabled(method.methodType)
}

const handleMethodMenuToggleVisible = (method: EditableAuthMethod) => {
  closeMethodMenu()
  toggleMethodVisible(method.methodType)
}

const handleMethodMenuDelete = (method: EditableAuthMethod) => {
  closeMethodMenu()
  removeMethod(method.methodType)
}

function buildMethodPreviewItems(method: EditableAuthMethod) {
  const items: string[] = []

  if (method.category === 'CODE') {
    items.push(`账号标签：${method.targetLabel || '未设置'}`)
    items.push(`输入占位：${method.placeholder || '未设置'}`)
    items.push(`验证码占位：${method.codePlaceholder || '未设置'}`)

    if (method.methodType === 'PHONE_CODE') {
      items.push(`短信服务商：${method.providerCode || '未设置'}`)
      items.push(`签名名称：${method.signName || '未设置'}`)
      items.push(`模板编号：${method.templateCode || '未设置'}`)
    }

    if (method.methodType === 'EMAIL_CODE') {
      items.push(`发件邮箱：${method.senderAddress || '未设置'}`)
      items.push(`SMTP Host：${method.smtpHost || '未设置'}`)
      items.push(`SMTP Port：${method.smtpPort || '未设置'}`)
    }
  }

  if (method.category === 'OAUTH') {
    items.push(`授权地址：${method.authorizeUrl || '未设置'}`)
    items.push(`Token 地址：${method.tokenUrl || '未设置'}`)
    items.push(`用户信息地址：${method.userInfoUrl || '未设置'}`)
    items.push(`Client ID：${method.clientId || '未设置'}`)
    items.push(`回调地址：${method.redirectUri || '未设置'}`)
  }

  return items.slice(0, 5)
}

function createEditableMethodSnapshot(source: EditableAuthMethod) {
  if (!source.displayName.trim()) {
    throw new Error('请先填写登录方式显示名称')
  }

  let normalizedConfigText = ''
  if (String(source.configText || '').trim()) {
    try {
      const parsed = JSON.parse(source.configText)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('扩展配置 JSON 必须是对象')
      }
      normalizedConfigText = JSON.stringify(parsed, null, 2)
    } catch (error: any) {
      throw new Error(error?.message || '扩展配置 JSON 格式不正确')
    }
  }

  return cloneEditableMethod({
    ...source,
    displayName: source.displayName.trim(),
    description: source.description.trim(),
    iconType: source.iconType.trim(),
    iconUrl: source.iconUrl.trim(),
    configText: normalizedConfigText,
    targetLabel: source.targetLabel.trim(),
    placeholder: source.placeholder.trim(),
    codePlaceholder: source.codePlaceholder.trim(),
    senderName: source.senderName.trim(),
    senderAddress: source.senderAddress.trim(),
    providerCode: source.providerCode.trim(),
    accessKeyId: source.accessKeyId.trim(),
    accessKeySecret: source.accessKeySecret.trim(),
    signName: source.signName.trim(),
    templateCode: source.templateCode.trim(),
    smtpHost: source.smtpHost.trim(),
    smtpPort: source.smtpPort.trim(),
    smtpUser: source.smtpUser.trim(),
    smtpPassword: source.smtpPassword.trim(),
    authorizeUrl: source.authorizeUrl.trim(),
    tokenUrl: source.tokenUrl.trim(),
    userInfoUrl: source.userInfoUrl.trim(),
    clientId: source.clientId.trim(),
    clientSecret: source.clientSecret.trim(),
    redirectUri: source.redirectUri.trim(),
    responseType: source.responseType.trim() || 'code',
    scope: source.scope.trim(),
  })
}

const loadPageData = async () => {
  loading.value = true
  try {
    const [systemSettings, methods] = await Promise.all([
      getAdminSystemConfig(),
      listAuthMethodConfigs(),
    ])

    applySystemForm(systemSettings || createDefaultSystemForm())
    authMethods.value = sortEditableAuthMethods(Array.isArray(methods) ? methods.map(toEditableAuthMethod) : [])
  } finally {
    loading.value = false
  }
}

const buildSystemPayload = (): SystemConfigPayload => ({
  siteInfo: {
    siteName: systemForm.siteInfo.siteName,
    siteDescription: systemForm.siteInfo.siteDescription,
    siteLogoUrl: systemForm.siteInfo.siteLogoUrl,
    siteIconUrl: systemForm.siteInfo.siteIconUrl,
    icpText: systemForm.siteInfo.icpText,
    icpLink: systemForm.siteInfo.icpLink,
    copyrightText: systemForm.siteInfo.copyrightText,
  },
  policySettings: {
    agreementRequired: systemForm.policySettings.agreementRequired,
    agreementTextPrefix: systemForm.policySettings.agreementTextPrefix,
    userAgreementTitle: systemForm.policySettings.userAgreementTitle,
    userAgreementUrl: systemForm.policySettings.userAgreementUrl,
    userAgreementContent: systemForm.policySettings.userAgreementContent,
    privacyPolicyTitle: systemForm.policySettings.privacyPolicyTitle,
    privacyPolicyUrl: systemForm.policySettings.privacyPolicyUrl,
    privacyPolicyContent: systemForm.policySettings.privacyPolicyContent,
    aiNoticeTitle: systemForm.policySettings.aiNoticeTitle,
    aiNoticeUrl: systemForm.policySettings.aiNoticeUrl,
    aiNoticeContent: systemForm.policySettings.aiNoticeContent,
  },
  loginSettings: {
    welcomeTitle: systemForm.loginSettings.welcomeTitle,
    welcomeSubtitle: systemForm.loginSettings.welcomeSubtitle,
  },
  generationProgressSettings: {
    enabled: systemForm.generationProgressSettings.enabled,
    stages: systemForm.generationProgressSettings.stages.map(item => ({
      key: item.key,
      label: item.label,
      percent: item.percent,
      showPercent: item.showPercent,
      description: item.description,
    })),
  },
  conversationSettings: JSON.parse(JSON.stringify(systemForm.conversationSettings)),
})

// 生成文案配置在后台实时预览成前台徽章文案，便于运营直接确认效果。
const buildProgressStagePreview = (stage: {
  label: string
  percent: number
  showPercent: boolean
}) => {
  const label = String(stage.label || '').trim() || '未命名阶段'
  const percent = Number.isFinite(Number(stage.percent)) ? Math.max(0, Math.min(100, Number(stage.percent))) : 0
  return stage.showPercent ? `${percent}%${label}` : label
}

// 切换单个生成阶段卡片折叠状态，方便批量配置时聚焦当前项。
const toggleProgressStageCollapse = (stageKey: string) => {
  const next = new Set(collapsedProgressStages.value)
  if (next.has(stageKey)) {
    next.delete(stageKey)
  } else {
    next.add(stageKey)
  }
  collapsedProgressStages.value = next
}

// 全部折叠生成文案配置卡片。
const collapseAllProgressStages = () => {
  collapsedProgressStages.value = new Set(systemForm.generationProgressSettings.stages.map(item => item.key))
}

// 全部展开生成文案配置卡片。
const expandAllProgressStages = () => {
  collapsedProgressStages.value = new Set()
}

// 恢复默认生成文案配置，便于快速回退到系统推荐值。
const resetGenerationProgressSettings = () => {
  systemForm.generationProgressSettings.enabled = true
  systemForm.generationProgressSettings.stages = createDefaultGenerationProgressStages()
  collapsedProgressStages.value = new Set()
  ElMessage.success('已恢复默认生成文案')
}

// 把后台表单重新合并成后端可直接保存的配置结构。
const buildAuthMethodPayload = (): AuthMethodConfigPayload[] => {
  return authMethods.value.map((method) => {
    let extraConfig: Record<string, any> = {}

    if (String(method.configText || '').trim()) {
      try {
        const parsed = JSON.parse(method.configText)
        extraConfig = parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        throw new Error(`登录方式“${method.displayName || method.methodType}”的扩展配置 JSON 格式不正确`)
      }
    }

    if (method.category === 'CODE') {
      extraConfig.targetLabel = method.targetLabel
      extraConfig.placeholder = method.placeholder
      extraConfig.codePlaceholder = method.codePlaceholder
      extraConfig.providerCode = method.providerCode
      extraConfig.senderName = method.senderName
      extraConfig.senderAddress = method.senderAddress
      extraConfig.accessKeyId = method.accessKeyId
      extraConfig.accessKeySecret = method.accessKeySecret
      extraConfig.signName = method.signName
      extraConfig.templateCode = method.templateCode
      extraConfig.smtpHost = method.smtpHost
      extraConfig.smtpPort = method.smtpPort
      extraConfig.smtpSecure = method.smtpSecure
      extraConfig.smtpUser = method.smtpUser
      extraConfig.smtpPassword = method.smtpPassword
    }

    if (method.category === 'OAUTH') {
      extraConfig.authorizeUrl = method.authorizeUrl
      extraConfig.tokenUrl = method.tokenUrl
      extraConfig.userInfoUrl = method.userInfoUrl
      extraConfig.clientId = method.clientId
      extraConfig.clientSecret = method.clientSecret
      extraConfig.redirectUri = method.redirectUri
      extraConfig.responseType = method.responseType || 'code'
      extraConfig.scope = method.scope
    }

    return {
      methodType: method.methodType,
      category: method.category,
      displayName: method.displayName,
      description: method.description,
      iconType: method.iconType,
      iconUrl: method.iconUrl,
      isEnabled: method.isEnabled,
      isVisible: method.isVisible,
      sortOrder: Number.isFinite(Number(method.sortOrder)) ? Number(method.sortOrder) : 0,
      allowAutoFill: method.category === 'CODE' ? method.debugSendEnabled : false,
      allowSignUp: method.allowSignUp,
      config: extraConfig,
    }
  })
}

const openCreateMethodDialog = () => {
  const [firstTemplate] = creatableMethodTemplates.value
  if (!firstTemplate) {
    ElMessage.warning('预设登录方式已全部添加，无需重复创建')
    return
  }

  editingMethodType.value = ''
  applyEditableMethod(methodForm, createEditableAuthMethod(firstTemplate))
  closeMethodMenu()
  methodDialogVisible.value = true
}

const openEditMethodDialog = (method: EditableAuthMethod) => {
  closeMethodMenu()
  editingMethodType.value = method.methodType
  applyEditableMethod(methodForm, cloneEditableMethod(method))
  methodDialogVisible.value = true
}

const closeMethodDialog = () => {
  methodDialogVisible.value = false
  editingMethodType.value = ''
}

const handleCreateMethodTypeChange = (methodType: string) => {
  const currentTemplate = creatableMethodTemplates.value.find(item => item.methodType === methodType)
  if (!currentTemplate) {
    return
  }

  applyEditableMethod(methodForm, createEditableAuthMethod(currentTemplate))
}

const handleSubmitMethodDialog = () => {
  try {
    const snapshot = createEditableMethodSnapshot(methodForm)

    if (editingMethodType.value) {
      authMethods.value = sortEditableAuthMethods(
        authMethods.value.map(item => item.methodType === editingMethodType.value ? snapshot : item),
      )
      ElMessage.success('登录方式已更新到待保存列表')
    } else {
      if (authMethods.value.some(item => item.methodType === snapshot.methodType)) {
        ElMessage.warning('该登录方式已存在，无需重复添加')
        return
      }
      authMethods.value = sortEditableAuthMethods([...authMethods.value, snapshot])
      ElMessage.success('登录方式已加入待保存列表')
    }

    closeMethodDialog()
  } catch (error: any) {
    ElMessage.error(error?.message || '登录方式配置保存失败')
  }
}

const handleSaveSystemSettings = async () => {
  systemSaving.value = true
  try {
    const saved = await saveAdminSystemConfig(buildSystemPayload())
    applySystemForm(saved)
    applyPublicSystemSettings(saved)
  } finally {
    systemSaving.value = false
  }
}

const handleSaveAuthMethods = async () => {
  methodSaving.value = true
  try {
    const saved = await saveAuthMethodConfigs(buildAuthMethodPayload())
    authMethods.value = sortEditableAuthMethods(Array.isArray(saved) ? saved.map(toEditableAuthMethod) : [])
    ElMessage.success('登录方式已更新')
  } catch (error: any) {
    ElMessage.error(error?.message || '保存登录方式失败')
  } finally {
    methodSaving.value = false
  }
}

onMounted(() => {
  void loadPageData()
})
</script>

<style scoped>
.admin-system-stage-card {
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 18px;
  padding: 18px;
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}

.admin-system-stage-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--brand-main-default) 16%, var(--line-divider, #00000014));
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
}

.admin-system-stage-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.admin-system-stage-card__header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.admin-system-stage-card__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.admin-system-stage-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.admin-system-stage-card__key {
  font-size: 12px;
  font-weight: 600;
}

.admin-system-stage-card__desc {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-tertiary);
}

.admin-system-stage-card__preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--bg-block-primary-default);
  border: 1px solid var(--line-divider, #00000014);
}

.admin-system-stage-card__preview-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.admin-system-stage-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand-main-block-default) 72%, var(--bg-surface));
  color: var(--brand-main-default);
  font-size: 13px;
  font-weight: 600;
  border: 1px solid color-mix(in srgb, var(--brand-main-default) 18%, transparent);
}

.admin-system-stage-card__body {
  padding-top: 2px;
}

@media (max-width: 900px) {
  .admin-system-stage-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-system-stage-card__header-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
