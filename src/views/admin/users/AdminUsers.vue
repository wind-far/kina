<template>
  <AdminPageContainer title="用户管理" description="统一管理平台用户资料、账号状态与资源沉淀，并集中处理用户角色与运营动作。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" @click="loadUsers" :disabled="loading || submitting || detailLoading">
        {{ loading ? '刷新中...' : '刷新列表' }}
      </button>
    </template>

    <div class="admin-grid admin-grid--stats">
      <AdminStatCard label="当前结果" :value="users.length" hint="当前筛选结果中的用户数量" />
      <AdminStatCard label="管理员" :value="adminCount" hint="当前筛选结果中的管理员数量" />
      <AdminStatCard label="普通用户" :value="userCount" hint="当前筛选结果中的普通用户数量" />
      <AdminStatCard label="已激活" :value="activeCount" hint="当前筛选结果中的激活用户数量" />
    </div>

    <AdminFilterToolbar>
      <template #search>
        <input
          v-model.trim="filters.keyword"
          class="admin-input"
          type="text"
          placeholder="搜索昵称、邮箱、手机号或用户 ID"
          :disabled="loading"
          @keydown.enter="handleSearch"
        >
      </template>
      <template #filters>
        <AdminFilterChips :groups="filterChipGroups" :disabled="loading" @select="handleChipSelect" />
      </template>
      <template #meta>
        <span class="admin-skill-toolbar__summary">
          共 {{ users.length }} 个用户
          <em v-if="activeFilterCount">，已启用 {{ activeFilterCount }} 个筛选</em>
        </span>
      </template>
      <template #actions>
        <button class="admin-button admin-button--secondary" type="button" :disabled="loading" @click="resetFilters">重置</button>
        <button class="admin-button admin-button--primary" type="button" :disabled="loading" @click="handleSearch">搜索</button>
      </template>
    </AdminFilterToolbar>

    <div class="admin-card admin-users-board admin-users-board--compact">
      <div class="admin-card__header admin-users-board__header">
        <div>
          <h4 class="admin-card__title">用户列表</h4>
          <div class="admin-card__desc">按统一卡片视图查看账号信息、创作沉淀和角色状态，支持直接执行编辑、会员、积分和登录治理动作。</div>
        </div>
      </div>
      <div class="admin-card__content">
        <div v-if="loading" class="admin-empty">正在加载用户列表...</div>
        <div v-else-if="users.length === 0" class="admin-empty">当前筛选条件下还没有用户数据。</div>
        <template v-else>
          <div class="admin-user-list admin-user-list--grid">
            <button class="admin-user-create-card" type="button" :disabled="submitting" @click="handleCreateUser">
              <span class="admin-user-create-card__icon">＋</span>
              <span class="admin-user-create-card__title">创建用户</span>
              <span class="admin-user-create-card__desc">支持后台新建用户，并直接绑定邮箱验证码或手机验证码登录身份。</span>
            </button>

            <article v-for="user in paginatedUsers" :key="user.id" class="admin-user-card admin-user-card--panel" @click="openUserDetail(user)">
              <div class="admin-user-card__panel-top">
                <div class="admin-user-card__identity">
                  <div class="admin-user-card__avatar admin-user-card__avatar--square">
                    <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name || '用户头像'" class="admin-user-card__avatar-image">
                    <div v-else class="admin-user-card__avatar-fallback">{{ getUserInitial(user.name || user.maskedEmail || user.maskedPhone || 'U') }}</div>
                  </div>

                  <div class="admin-user-card__identity-main">
                    <div class="admin-user-card__title-row">
                      <div class="admin-user-card__title-wrap">
                        <div class="admin-user-card__title">{{ user.name || '未命名用户' }}</div>
                        <div class="admin-user-card__secondary">{{ getUserSecondaryLabel(user) }}</div>
                      </div>
                      <el-dropdown
                        trigger="click"
                        placement="bottom-end"
                        popper-class="admin-user-card-dropdown"
                        @command="(command: string | number | boolean | object) => handleUserCommand(String(command), user)"
                        @click.stop
                      >
                        <button class="admin-user-card__more" type="button" @click.stop>
                          <el-icon><MoreFilled /></el-icon>
                        </button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="edit">
                              <span class="admin-user-menu-item">
                                <el-icon><Edit /></el-icon>
                                <span>编辑</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="membership">
                              <span class="admin-user-menu-item">
                                <el-icon><Star /></el-icon>
                                <span>调整会员</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="points">
                              <span class="admin-user-menu-item">
                                <el-icon><Lightning /></el-icon>
                                <span>调整积分</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="reset-login-state">
                              <span class="admin-user-menu-item">
                                <el-icon><Key /></el-icon>
                                <span>清空登录态</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="membership-orders">
                              <span class="admin-user-menu-item">
                                <el-icon><Tickets /></el-icon>
                                <span>订阅记录</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="copy-user-id">
                              <span class="admin-user-menu-item">
                                <el-icon><DocumentCopy /></el-icon>
                                <span>复制用户 ID</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="toggle-role">
                              <span class="admin-user-menu-item">
                                <el-icon><User /></el-icon>
                                <span>{{ user.role === 'ADMIN' ? '设为普通用户' : '设为管理员' }}</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="copy-display-no">
                              <span class="admin-user-menu-item">
                                <el-icon><Coin /></el-icon>
                                <span>复制用户编号</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="detail">
                              <span class="admin-user-menu-item">
                                <el-icon><Tickets /></el-icon>
                                <span>查看详情</span>
                              </span>
                            </el-dropdown-item>
                            <el-dropdown-item command="delete" class="is-danger" divided>
                              <span class="admin-user-menu-item admin-user-menu-item--danger">
                                <el-icon><Delete /></el-icon>
                                <span>删除</span>
                              </span>
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>

                    <div class="admin-user-card__id-row">
                      <span class="admin-user-card__id-label">{{ buildUserDisplayNo(user.id) }}</span>
                      <span class="admin-status" :class="getStatusTone(user.status)">{{ getStatusLabel(user.status) }}</span>
                      <span class="admin-chip">{{ user.role === 'ADMIN' ? '管理员' : '普通用户' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="admin-user-card__contact-list">
                <div class="admin-user-card__contact-item">
                  <span class="admin-user-card__contact-label">邮箱</span>
                  <span class="admin-user-card__contact-value">{{ user.maskedEmail || '未绑定邮箱' }}</span>
                </div>
                <div class="admin-user-card__contact-item">
                  <span class="admin-user-card__contact-label">手机</span>
                  <span class="admin-user-card__contact-value">{{ user.maskedPhone || '未绑定手机号' }}</span>
                </div>
              </div>

              <div class="admin-user-card__stats-grid">
                <div class="admin-user-card__metric">
                  <span class="admin-user-card__metric-label">资源数</span>
                  <strong class="admin-user-card__metric-value">{{ user.assetCount }}</strong>
                </div>
                <div class="admin-user-card__metric">
                  <span class="admin-user-card__metric-label">生成记录</span>
                  <strong class="admin-user-card__metric-value">{{ user.generationRecordCount }}</strong>
                </div>
              </div>

              <div class="admin-user-card__footer admin-user-card__footer--panel">
                <div class="admin-user-card__meta-stack">
                  <span class="admin-user-card__meta">用户 ID：{{ user.id }}</span>
                  <span class="admin-user-card__meta">创建时间：{{ formatDate(user.createdAt) }}</span>
                </div>
                <div class="admin-list-item__actions" @click.stop>
                  <button class="admin-inline-button" type="button" :disabled="submitting || updatingId === user.id" @click="handleQuickRoleToggle(user)">
                    {{ updatingId === user.id ? '更新中...' : user.role === 'ADMIN' ? '改为普通用户' : '设为管理员' }}
                  </button>
                  <button class="admin-inline-button" type="button" :disabled="submitting" @click="openEditDialog(user)">编辑</button>
                </div>
              </div>
            </article>
          </div>

          <AdminPagination
            v-model:page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="users.length"
            :disabled="loading"
          />
        </template>
      </div>
    </div>

    <el-drawer
      v-model="detailVisible"
      title="用户详情"
      size="860px"
      destroy-on-close
      class="admin-user-detail-drawer"
    >
      <div v-if="detailLoading" class="admin-empty">正在加载用户详情...</div>
      <div v-else-if="selectedUserDetail" class="admin-user-drawer">
        <div class="admin-user-drawer__summary">
          <div class="admin-user-drawer__summary-main">
            <div class="admin-user-drawer__identity">
              <div class="admin-user-card__avatar admin-user-card__avatar--drawer">
                <img v-if="selectedUserDetail.avatarUrl" :src="selectedUserDetail.avatarUrl" :alt="selectedUserDetail.name || '用户头像'" class="admin-user-card__avatar-image">
                <div v-else class="admin-user-card__avatar-fallback">{{ getUserInitial(selectedUserDetail.name || selectedUserDetail.maskedEmail || selectedUserDetail.maskedPhone || 'U') }}</div>
              </div>
              <div>
                <div class="admin-user-drawer__title-row">
                  <h3 class="admin-user-drawer__title">{{ selectedUserDetail.name || '未命名用户' }}</h3>
                  <span class="admin-status" :class="getStatusTone(selectedUserDetail.status)">{{ getStatusLabel(selectedUserDetail.status) }}</span>
                  <span class="admin-chip">{{ selectedUserDetail.role === 'ADMIN' ? '管理员' : '普通用户' }}</span>
                </div>
                <div class="admin-user-drawer__meta">用户编号：{{ buildUserDisplayNo(selectedUserDetail.id) }}</div>
                <div class="admin-user-drawer__meta">用户 ID：{{ selectedUserDetail.id }}</div>
              </div>
            </div>
          </div>
          <div class="admin-user-drawer__summary-stats">
            <span class="admin-chip">资源 {{ selectedUserDetail.assetCount }}</span>
            <span class="admin-chip">生成 {{ selectedUserDetail.generationRecordCount }}</span>
            <span class="admin-chip">积分 {{ selectedUserDetail.currentPointBalance }}</span>
            <span class="admin-chip">会话 {{ selectedUserDetail.sessionCount }}</span>
          </div>
        </div>

        <div class="admin-grid admin-grid--two admin-user-drawer__grid">
          <div class="admin-card admin-card--drawer">
            <div class="admin-card__header">
              <div>
                <h4 class="admin-card__title">账号信息</h4>
                <div class="admin-card__desc">查看基础资料、联系方式与当前账号状态。</div>
              </div>
            </div>
            <div class="admin-card__content admin-user-drawer__content">
              <div class="admin-user-drawer__field">
                <span class="admin-user-drawer__field-label">昵称</span>
                <strong class="admin-user-drawer__field-value">{{ selectedUserDetail.name || '未命名用户' }}</strong>
              </div>
              <div class="admin-user-drawer__field">
                <span class="admin-user-drawer__field-label">邮箱</span>
                <strong class="admin-user-drawer__field-value">{{ selectedUserDetail.maskedEmail || '未绑定邮箱' }}</strong>
              </div>
              <div class="admin-user-drawer__field">
                <span class="admin-user-drawer__field-label">手机号</span>
                <strong class="admin-user-drawer__field-value">{{ selectedUserDetail.maskedPhone || '未绑定手机号' }}</strong>
              </div>
              <div class="admin-user-drawer__field">
                <span class="admin-user-drawer__field-label">最近更新时间</span>
                <strong class="admin-user-drawer__field-value">{{ formatDate(selectedUserDetail.updatedAt) }}</strong>
              </div>
            </div>
          </div>

          <div class="admin-card admin-card--drawer">
            <div class="admin-card__header">
              <div>
                <h4 class="admin-card__title">当前订阅</h4>
                <div class="admin-card__desc">查看当前会员等级、有效期与最近订阅来源。</div>
              </div>
            </div>
            <div class="admin-card__content admin-user-drawer__content">
              <template v-if="selectedUserDetail.activeSubscription">
                <div class="admin-user-drawer__field">
                  <span class="admin-user-drawer__field-label">会员等级</span>
                  <strong class="admin-user-drawer__field-value">
                    {{ selectedUserDetail.activeSubscription.level?.name || '未命名等级' }}
                    <template v-if="selectedUserDetail.activeSubscription.level?.level">· Lv.{{ selectedUserDetail.activeSubscription.level.level }}</template>
                  </strong>
                </div>
                <div class="admin-user-drawer__field">
                  <span class="admin-user-drawer__field-label">开始时间</span>
                  <strong class="admin-user-drawer__field-value">{{ formatDate(selectedUserDetail.activeSubscription.startTime) }}</strong>
                </div>
                <div class="admin-user-drawer__field">
                  <span class="admin-user-drawer__field-label">结束时间</span>
                  <strong class="admin-user-drawer__field-value">{{ formatDate(selectedUserDetail.activeSubscription.endTime) }}</strong>
                </div>
                <div class="admin-user-drawer__field">
                  <span class="admin-user-drawer__field-label">订阅来源</span>
                  <strong class="admin-user-drawer__field-value">{{ selectedUserDetail.activeSubscription.order?.sourceType || '后台调整' }}</strong>
                </div>
              </template>
              <div v-else class="admin-empty admin-empty--inline">当前暂无有效订阅。</div>
            </div>
          </div>
        </div>

        <div class="admin-card admin-card--drawer">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">登录身份</h4>
              <div class="admin-card__desc">当前项目使用验证码 / OAuth 方式登录，因此这里展示的是登录身份绑定，而不是密码体系。</div>
            </div>
          </div>
          <div class="admin-card__content">
            <div v-if="!selectedUserDetail.authIdentities.length" class="admin-empty admin-empty--inline">该用户暂未绑定登录身份。</div>
            <div v-else class="admin-user-identity-list">
              <div v-for="identity in selectedUserDetail.authIdentities" :key="identity.id" class="admin-user-identity-item">
                <div>
                  <div class="admin-user-identity-item__title">{{ getAuthMethodLabel(identity.methodType) }}</div>
                  <div class="admin-user-identity-item__meta">{{ identity.identifier }}</div>
                </div>
                <div class="admin-user-identity-item__side">
                  <span class="admin-status" :class="identity.isVerified ? 'admin-status--success' : 'admin-status--warning'">
                    {{ identity.isVerified ? '已验证' : '未验证' }}
                  </span>
                  <span class="admin-user-identity-item__meta">{{ formatDate(identity.verifiedAt || identity.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-card admin-card--drawer">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">最近订阅记录</h4>
              <div class="admin-card__desc">展示最近 10 条会员订单，用于快速核对后台调整与订阅变化。</div>
            </div>
            <button class="admin-button admin-button--secondary" type="button" @click="openMembershipOrdersDialogByDetail">查看全部</button>
          </div>
          <div class="admin-card__content">
            <div v-if="!selectedUserDetail.membershipOrders.length" class="admin-empty admin-empty--inline">暂无订阅记录。</div>
            <div v-else class="admin-user-order-list">
              <div v-for="item in selectedUserDetail.membershipOrders.slice(0, 5)" :key="item.id" class="admin-user-order-item">
                <div>
                  <div class="admin-user-order-item__title">{{ item.level?.name || '会员等级' }}<template v-if="item.plan?.name"> · {{ item.plan.name }}</template></div>
                  <div class="admin-user-order-item__meta">{{ item.orderNo }} · {{ item.sourceType }} · {{ item.status }}</div>
                </div>
                <div class="admin-user-order-item__side">
                  <div class="admin-user-order-item__meta">{{ formatDate(item.createdAt) }}</div>
                  <div class="admin-user-order-item__meta">{{ formatMoney(item.paidAmount) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-card admin-card--drawer">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">运营动作</h4>
              <div class="admin-card__desc">支持编辑资料、调整会员和积分、清空登录态以及复制用户标识。</div>
            </div>
          </div>
          <div class="admin-card__content admin-user-drawer__actions">
            <button class="admin-button admin-button--secondary" type="button" @click="openEditDialog(selectedUserDetail)">编辑</button>
            <button class="admin-button admin-button--secondary" type="button" @click="openMembershipDialog(selectedUserDetail)">调整会员</button>
            <button class="admin-button admin-button--secondary" type="button" @click="openPointDialog(selectedUserDetail)">调整积分</button>
            <button class="admin-button admin-button--secondary" type="button" @click="handleResetLoginState(selectedUserDetail)">清空登录态</button>
            <button class="admin-button admin-button--secondary" type="button" @click="copyText(selectedUserDetail.id, '用户 ID 已复制')">复制用户 ID</button>
            <button class="admin-button admin-button--secondary" type="button" @click="copyText(buildUserDisplayNo(selectedUserDetail.id), '用户编号已复制')">复制用户编号</button>
          </div>
        </div>
      </div>
    </el-drawer>

    <div v-if="editDialogVisible" class="admin-dialog-mask" @click="closeEditDialog">
      <div class="admin-dialog admin-dialog--provider-form admin-user-manage-dialog" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">{{ isCreateMode ? '创建用户' : '编辑用户' }}</h3>
            <div class="admin-dialog__desc">{{ isCreateMode ? '填写基础资料并绑定至少一种登录身份。' : '更新昵称、联系方式和账号状态。' }}</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closeEditDialog">×</button>
        </div>
        <form class="admin-dialog__body admin-form" @submit.prevent="handleSubmitEdit">
          <div class="admin-user-dialog-hero">
            <span class="admin-chip">{{ isCreateMode ? '创建账号' : '资料编辑' }}</span>
            <span class="admin-user-dialog-hero__text">{{ isCreateMode ? '创建后可直接用于验证码登录与后台运营管理。' : '统一维护昵称、联系方式与账号状态。' }}</span>
          </div>
          <div class="admin-user-dialog-summary">
            <div class="admin-user-dialog-summary__item">
              <span class="admin-user-dialog-summary__label">{{ isCreateMode ? '创建模式' : '当前用户' }}</span>
              <strong class="admin-user-dialog-summary__value">{{ currentEditUserDisplayName }}</strong>
            </div>
            <div class="admin-user-dialog-summary__item">
              <span class="admin-user-dialog-summary__label">账号状态</span>
              <strong class="admin-user-dialog-summary__value">{{ getStatusLabel(editForm.status) }}</strong>
            </div>
          </div>
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label">昵称</label>
              <input v-model.trim="editForm.name" class="admin-input" type="text" placeholder="请输入昵称">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">邮箱</label>
              <input v-model.trim="editForm.email" class="admin-input" type="email" placeholder="请输入邮箱">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">手机号</label>
              <input v-model.trim="editForm.phone" class="admin-input" type="text" placeholder="请输入手机号">
            </div>
            <div v-if="isCreateMode" class="admin-form__field">
              <label class="admin-form__label">账号角色</label>
              <select v-model="editForm.role" class="admin-input">
                <option value="USER">普通用户</option>
                <option value="ADMIN">管理员</option>
              </select>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">账号状态</label>
              <select v-model="editForm.status" class="admin-input">
                <option value="ANONYMOUS">匿名</option>
                <option value="ACTIVE">已激活</option>
                <option value="DISABLED">已禁用</option>
              </select>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">头像地址</label>
              <input v-model.trim="editForm.avatarUrl" class="admin-input" type="text" placeholder="https://...">
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closeEditDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="submitting">{{ submitting ? (isCreateMode ? '创建中...' : '保存中...') : (isCreateMode ? '创建用户' : '保存资料') }}</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="pointDialogVisible" class="admin-dialog-mask" @click="closePointDialog">
      <div class="admin-dialog admin-dialog--provider-form admin-user-manage-dialog" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">调整积分</h3>
            <div class="admin-dialog__desc">直接增加或扣减用户积分，变更会记入统一积分流水。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closePointDialog">×</button>
        </div>
        <form class="admin-dialog__body admin-form" @submit.prevent="handleSubmitPointAdjust">
          <div class="admin-user-dialog-hero">
            <span class="admin-chip">积分账本</span>
            <span class="admin-user-dialog-hero__text">直接写入统一积分流水，并实时刷新当前余额。</span>
          </div>
          <div class="admin-user-balance-preview">
            <div class="admin-user-balance-preview__item">
              <span class="admin-user-balance-preview__label">当前余额</span>
              <strong class="admin-user-balance-preview__value">{{ pointCurrentBalance }}</strong>
            </div>
            <div class="admin-user-balance-preview__arrow">→</div>
            <div class="admin-user-balance-preview__item">
              <span class="admin-user-balance-preview__label">调整后</span>
              <strong class="admin-user-balance-preview__value admin-user-balance-preview__value--active">{{ pointPreviewBalance }}</strong>
            </div>
          </div>
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label">调整方向</label>
              <div class="admin-user-option-grid admin-user-option-grid--two">
                <button
                  class="admin-user-option-card"
                  :class="{ 'is-active': pointForm.action === 'INCREASE' }"
                  type="button"
                  @click="pointForm.action = 'INCREASE'"
                >
                  <span class="admin-user-option-card__title">增加积分</span>
                  <span class="admin-user-option-card__desc">用于活动补发、人工奖励等场景</span>
                </button>
                <button
                  class="admin-user-option-card"
                  :class="{ 'is-active': pointForm.action === 'DECREASE' }"
                  type="button"
                  @click="pointForm.action = 'DECREASE'"
                >
                  <span class="admin-user-option-card__title">扣减积分</span>
                  <span class="admin-user-option-card__desc">用于异常回收或人工修正场景</span>
                </button>
              </div>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">调整数量</label>
              <input v-model.number="pointForm.changeAmount" class="admin-input" type="number" min="1" placeholder="请输入调整积分">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">备注</label>
              <textarea v-model.trim="pointForm.remark" class="admin-textarea" rows="4" placeholder="请输入调整原因，例如：活动补发积分"></textarea>
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closePointDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="submitting">{{ submitting ? '处理中...' : '确认调整' }}</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="membershipDialogVisible" class="admin-dialog-mask" @click="closeMembershipDialog">
      <div class="admin-dialog admin-dialog--provider-form admin-user-manage-dialog" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">调整会员</h3>
            <div class="admin-dialog__desc">直接为用户发放会员权益，并可同步赠送积分。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closeMembershipDialog">×</button>
        </div>
        <form class="admin-dialog__body admin-form" @submit.prevent="handleSubmitMembershipAdjust">
          <div class="admin-user-dialog-hero">
            <span class="admin-chip">会员发放</span>
            <span class="admin-user-dialog-hero__text">沿用系统会员等级与订单模型，避免后台另起一套规则。</span>
          </div>
          <div class="admin-user-dialog-summary">
            <div class="admin-user-dialog-summary__item">
              <span class="admin-user-dialog-summary__label">当前用户</span>
              <strong class="admin-user-dialog-summary__value">{{ currentMembershipUserDisplayName }}</strong>
            </div>
            <div class="admin-user-dialog-summary__item">
              <span class="admin-user-dialog-summary__label">当前等级</span>
              <strong class="admin-user-dialog-summary__value">{{ currentMembershipLevelLabel }}</strong>
            </div>
          </div>
          <div class="admin-form__grid">
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">会员等级</label>
              <div class="admin-user-option-grid">
                <button
                  v-for="item in membershipLevels"
                  :key="item.id"
                  class="admin-user-option-card"
                  :class="{ 'is-active': membershipForm.levelId === item.id }"
                  type="button"
                  @click="membershipForm.levelId = item.id"
                >
                  <span class="admin-user-option-card__title">{{ item.name }} · Lv.{{ item.level }}</span>
                  <span class="admin-user-option-card__desc">
                    每月赠送 {{ item.monthlyBonusPoints }} 积分
                    <template v-if="item.description"> · {{ item.description }}</template>
                  </span>
                </button>
              </div>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">快捷时长</label>
              <div class="admin-user-duration-presets">
                <button
                  v-for="preset in membershipDurationPresets"
                  :key="preset.label"
                  class="admin-user-duration-presets__item"
                  :class="{ 'is-active': membershipForm.durationValue === preset.value && membershipForm.durationUnit === preset.unit }"
                  type="button"
                  @click="applyMembershipDurationPreset(preset.value, preset.unit)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">时长数值</label>
              <input v-model.number="membershipForm.durationValue" class="admin-input" type="number" min="1" placeholder="请输入时长">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">时长单位</label>
              <select v-model="membershipForm.durationUnit" class="admin-input">
                <option value="DAY">天</option>
                <option value="MONTH">月</option>
                <option value="YEAR">年</option>
              </select>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">赠送积分</label>
              <input v-model.number="membershipForm.bonusPoints" class="admin-input" type="number" min="0" placeholder="可选">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">发放预览</label>
              <div class="admin-user-membership-preview">
                <div class="admin-user-membership-preview__title">{{ selectedMembershipLevel?.name || '请选择会员等级' }}</div>
                <div class="admin-user-membership-preview__meta">
                  {{ membershipForm.durationValue }} {{ resolveDurationUnitLabel(membershipForm.durationUnit) }}
                  <template v-if="membershipForm.bonusPoints"> · 赠送 {{ membershipForm.bonusPoints }} 积分</template>
                </div>
              </div>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">备注</label>
              <textarea v-model.trim="membershipForm.remark" class="admin-textarea" rows="4" placeholder="请输入会员发放备注"></textarea>
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closeMembershipDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="submitting">{{ submitting ? '处理中...' : '确认发放' }}</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="membershipOrdersDialogVisible" class="admin-dialog-mask" @click="closeMembershipOrdersDialog">
      <div class="admin-dialog admin-dialog--provider-form admin-user-manage-dialog admin-user-manage-dialog--wide" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">订阅记录</h3>
            <div class="admin-dialog__desc">查看该用户的会员订单历史与后台调整记录。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closeMembershipOrdersDialog">×</button>
        </div>
        <div class="admin-dialog__body admin-form">
          <div class="admin-user-dialog-hero">
            <span class="admin-chip">订阅记录</span>
            <span class="admin-user-dialog-hero__text">按时间倒序查看该用户的会员订单与后台调整记录。</span>
          </div>
          <div class="admin-user-dialog-summary">
            <div class="admin-user-dialog-summary__item">
              <span class="admin-user-dialog-summary__label">记录总数</span>
              <strong class="admin-user-dialog-summary__value">{{ membershipOrders.length }}</strong>
            </div>
            <div class="admin-user-dialog-summary__item">
              <span class="admin-user-dialog-summary__label">最近来源</span>
              <strong class="admin-user-dialog-summary__value">{{ membershipOrders[0]?.sourceType || '暂无' }}</strong>
            </div>
          </div>
          <div v-if="membershipOrdersLoading" class="admin-empty admin-empty--inline">正在加载订阅记录...</div>
          <div v-else-if="!membershipOrders.length" class="admin-empty admin-empty--inline">暂无订阅记录。</div>
          <div v-else class="admin-user-order-list admin-user-order-list--dialog">
            <div v-for="item in membershipOrders" :key="item.id" class="admin-user-order-item">
              <div>
                <div class="admin-user-order-item__title">{{ item.level?.name || '会员等级' }}<template v-if="item.plan?.name"> · {{ item.plan.name }}</template></div>
                <div class="admin-user-order-item__meta">{{ item.orderNo }} · {{ item.sourceType }} · {{ item.status }}</div>
                <div class="admin-user-order-item__meta">开始 {{ formatDate(item.startTime) }} · 结束 {{ formatDate(item.endTime) }}</div>
              </div>
              <div class="admin-user-order-item__side">
                <div class="admin-user-order-item__meta">支付 {{ formatMoney(item.paidAmount) }}</div>
                <div class="admin-user-order-item__meta">赠送 {{ item.bonusPoints }} 积分</div>
                <div class="admin-user-order-item__meta">{{ formatDate(item.createdAt) }}</div>
              </div>
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closeMembershipOrdersDialog">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Coin, Delete, DocumentCopy, Edit, Key, Lightning, MoreFilled, Star, Tickets, User } from '@element-plus/icons-vue'
import AdminFilterChips, { type AdminFilterChipGroup } from '@/components/admin/common/AdminFilterChips.vue'
import AdminFilterToolbar from '@/components/admin/common/AdminFilterToolbar.vue'
import AdminPagination from '@/components/admin/common/AdminPagination.vue'
import AdminStatCard from '@/components/admin/common/AdminStatCard.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import { useAdminListFilters } from '@/composables/useAdminListFilters'
import { useAdminPagination } from '@/composables/useAdminPagination'
import {
  adjustAdminUserMembership,
  adjustAdminUserPoints,
  createAdminUser,
  deleteAdminUser,
  getAdminUserDetail,
  listAdminUserMembershipOrders,
  listAdminUsers,
  resetAdminUserLoginState,
  updateAdminUserProfile,
  updateAdminUserRole,
  type AdminUserDetail,
  type AdminUserItem,
  type AdminUserMembershipOrderItem,
  type ListAdminUsersOptions,
} from '@/api/admin-users'
import { listMembershipLevels, type MembershipLevelItem } from '@/api/admin-marketing'

const loading = ref(false)
const submitting = ref(false)
const detailLoading = ref(false)
const membershipOrdersLoading = ref(false)
const updatingId = ref('')
const users = ref<AdminUserItem[]>([])
const membershipLevels = ref<MembershipLevelItem[]>([])
const detailVisible = ref(false)
const selectedUserDetail = ref<AdminUserDetail | null>(null)
const membershipOrders = ref<AdminUserMembershipOrderItem[]>([])
const selectedUserId = ref('')

const editDialogVisible = ref(false)
const editMode = ref<'create' | 'edit'>('edit')
const pointDialogVisible = ref(false)
const membershipDialogVisible = ref(false)
const membershipOrdersDialogVisible = ref(false)
const membershipDurationPresets = [
  { label: '7 天', value: 7, unit: 'DAY' as const },
  { label: '30 天', value: 30, unit: 'DAY' as const },
  { label: '3 个月', value: 3, unit: 'MONTH' as const },
  { label: '12 个月', value: 12, unit: 'MONTH' as const },
]

const filters = reactive<ListAdminUsersOptions>({
  keyword: '',
  role: 'ALL',
  status: 'ALL',
})
const filterDefaults: ListAdminUsersOptions = {
  keyword: '',
  role: 'ALL',
  status: 'ALL',
}
const { activeFilterCount, resetFilters: resetFilterValues } = useAdminListFilters({
  filters,
  defaults: filterDefaults,
})
const { pagination, sliceItems, resetPage } = useAdminPagination({
  initialPageSize: 10,
})

const editForm = reactive({
  id: '',
  name: '',
  email: '',
  phone: '',
  avatarUrl: '',
  role: 'USER' as 'USER' | 'ADMIN',
  status: 'ACTIVE' as 'ANONYMOUS' | 'ACTIVE' | 'DISABLED',
})

const pointForm = reactive({
  id: '',
  action: 'INCREASE' as 'INCREASE' | 'DECREASE',
  changeAmount: 0,
  remark: '',
})

const membershipForm = reactive({
  id: '',
  levelId: '',
  durationValue: 1,
  durationUnit: 'MONTH' as 'DAY' | 'MONTH' | 'YEAR',
  bonusPoints: 0,
  remark: '',
})

const roleOptions: Array<{ label: string; value: 'ALL' | 'USER' | 'ADMIN' }> = [
  { label: '全部角色', value: 'ALL' },
  { label: '管理员', value: 'ADMIN' },
  { label: '普通用户', value: 'USER' },
]

const statusOptions: Array<{ label: string; value: 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED' }> = [
  { label: '全部状态', value: 'ALL' },
  { label: '匿名', value: 'ANONYMOUS' },
  { label: '已激活', value: 'ACTIVE' },
  { label: '已禁用', value: 'DISABLED' },
]

const filterChipGroups = computed((): AdminFilterChipGroup[] => [
  {
    key: 'role',
    label: '角色',
    modelValue: filters.role ?? 'ALL',
    options: roleOptions,
  },
  {
    key: 'status',
    label: '状态',
    modelValue: filters.status ?? 'ALL',
    options: statusOptions,
  },
])

const adminCount = computed(() => users.value.filter(user => user.role === 'ADMIN').length)
const userCount = computed(() => users.value.filter(user => user.role !== 'ADMIN').length)
const activeCount = computed(() => users.value.filter(user => user.status === 'ACTIVE').length)
const paginatedUsers = computed(() => sliceItems(users.value))
const isCreateMode = computed(() => editMode.value === 'create')
const pointCurrentBalance = computed(() => {
  if (selectedUserDetail.value?.id === pointForm.id) {
    return Number(selectedUserDetail.value.currentPointBalance || 0)
  }
  return 0
})
const pointPreviewBalance = computed(() => {
  const currentBalance = pointCurrentBalance.value
  const amount = Math.max(0, Number(pointForm.changeAmount || 0))
  return pointForm.action === 'DECREASE'
    ? Math.max(0, currentBalance - amount)
    : currentBalance + amount
})
const selectedMembershipLevel = computed(() => {
  return membershipLevels.value.find(item => item.id === membershipForm.levelId) || null
})
const currentEditUserDisplayName = computed(() => {
  if (isCreateMode.value) {
    return '新建用户'
  }
  if (selectedUserDetail.value?.id === editForm.id) {
    return selectedUserDetail.value.name || buildUserDisplayNo(selectedUserDetail.value.id)
  }
  const user = users.value.find(item => item.id === editForm.id)
  return user?.name || (user ? buildUserDisplayNo(user.id) : '-')
})
const currentMembershipUserDisplayName = computed(() => {
  if (selectedUserDetail.value?.id === membershipForm.id) {
    return selectedUserDetail.value.name || buildUserDisplayNo(selectedUserDetail.value.id)
  }
  const user = users.value.find(item => item.id === membershipForm.id)
  return user?.name || (user ? buildUserDisplayNo(user.id) : '-')
})
const currentMembershipLevelLabel = computed(() => {
  if (selectedUserDetail.value?.id === membershipForm.id && selectedUserDetail.value.activeSubscription?.level?.name) {
    return selectedUserDetail.value.activeSubscription.level.name
  }
  return '普通用户'
})

const loadUsers = async () => {
  loading.value = true
  try {
    users.value = await listAdminUsers(filters)
  } finally {
    loading.value = false
  }
}

const loadMembershipLevels = async () => {
  membershipLevels.value = await listMembershipLevels().catch(() => [])
}

const loadUserDetail = async (userId: string) => {
  detailLoading.value = true
  try {
    selectedUserDetail.value = await getAdminUserDetail(userId)
  } finally {
    detailLoading.value = false
  }
}

const ensureUserDetailLoaded = async (userId: string) => {
  if (selectedUserDetail.value?.id === userId) {
    return
  }
  await loadUserDetail(userId)
}

const refreshAfterUserMutation = async (userId = '') => {
  await loadUsers()
  if (detailVisible.value && (userId || selectedUserId.value)) {
    await loadUserDetail(userId || selectedUserId.value)
  }
}

const handleUpdateRole = async (id: string, role: 'USER' | 'ADMIN') => {
  updatingId.value = id
  try {
    await updateAdminUserRole(id, role)
    await refreshAfterUserMutation(id)
  } finally {
    updatingId.value = ''
  }
}

const handleQuickRoleToggle = async (user: AdminUserItem) => {
  await handleUpdateRole(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN')
}

const handleSearch = () => {
  void loadUsers()
}

const setRole = (role: 'ALL' | 'USER' | 'ADMIN') => {
  if (filters.role === role) {
    return
  }
  filters.role = role
  void loadUsers()
}

const setStatus = (status: 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED') => {
  if (filters.status === status) {
    return
  }
  filters.status = status
  void loadUsers()
}

const handleChipSelect = (payload: { groupKey: string; value: string }) => {
  if (payload.groupKey === 'role') {
    setRole(payload.value as 'ALL' | 'USER' | 'ADMIN')
    return
  }
  if (payload.groupKey === 'status') {
    setStatus(payload.value as 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED')
  }
}

const resetFilters = () => {
  resetFilterValues()
  void loadUsers()
}

watch(() => pagination.pageSize, () => {
  resetPage()
})

const getUserInitial = (value: string) => {
  return String(value || 'U').trim().slice(0, 1).toUpperCase() || 'U'
}

const buildUserDisplayNo = (userId: string) => {
  const value = String(userId || '').trim()
  if (!value) {
    return 'USER-UNKNOWN'
  }
  return `USER-${value.slice(-6).toUpperCase()}`
}

const getUserSecondaryLabel = (user: AdminUserItem) => {
  return user.maskedEmail || user.maskedPhone || '未绑定邮箱/手机号'
}

const getStatusTone = (status: string) => {
  if (status === 'ACTIVE') {
    return 'admin-status--success'
  }
  if (status === 'DISABLED') {
    return 'admin-status--danger'
  }
  return 'admin-status--warning'
}

const getStatusLabel = (status: string) => {
  if (status === 'ACTIVE') return '已激活'
  if (status === 'DISABLED') return '已禁用'
  if (status === 'ANONYMOUS') return '匿名'
  return status || '未知'
}

const getAuthMethodLabel = (methodType: string) => {
  if (methodType === 'PHONE_CODE') return '手机验证码'
  if (methodType === 'EMAIL_CODE') return '邮箱验证码'
  if (methodType === 'WECHAT_OAUTH') return '微信登录'
  if (methodType === 'GITHUB_OAUTH') return 'GitHub 登录'
  if (methodType === 'GOOGLE_OAUTH') return 'Google 登录'
  if (methodType === 'CUSTOM_OAUTH') return '自定义 OAuth'
  return methodType || '未知方式'
}

const resolveDurationUnitLabel = (value: string) => {
  if (value === 'DAY') return '天'
  if (value === 'YEAR') return '年'
  return '个月'
}

const formatDate = (value?: string | null) => {
  if (!value) {
    return '未知时间'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const formatMoney = (value: string | number | null | undefined) => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) {
    return '¥0.00'
  }
  return `¥${numeric.toFixed(2)}`
}

const openUserDetail = async (user: AdminUserItem) => {
  selectedUserId.value = user.id
  detailVisible.value = true
  await loadUserDetail(user.id)
}

const handleCreateUser = () => {
  editMode.value = 'create'
  resetEditForm()
  editDialogVisible.value = true
}

const copyText = async (text: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(successMessage)
  } catch {
    ElMessage.error('复制失败，请检查浏览器剪贴板权限。')
  }
}

const resetEditForm = () => {
  editForm.id = ''
  editForm.name = ''
  editForm.email = ''
  editForm.phone = ''
  editForm.avatarUrl = ''
  editForm.role = 'USER'
  editForm.status = 'ACTIVE'
}

const resetPointForm = () => {
  pointForm.id = ''
  pointForm.action = 'INCREASE'
  pointForm.changeAmount = 0
  pointForm.remark = ''
}

const resetMembershipForm = () => {
  membershipForm.id = ''
  membershipForm.levelId = ''
  membershipForm.durationValue = 1
  membershipForm.durationUnit = 'MONTH'
  membershipForm.bonusPoints = 0
  membershipForm.remark = ''
}

const openEditDialog = async (user: AdminUserItem | AdminUserDetail) => {
  editMode.value = 'edit'
  await ensureUserDetailLoaded(user.id)
  editForm.id = user.id
  editForm.name = user.name || ''
  editForm.email = user.email || ''
  editForm.phone = user.phone || ''
  editForm.avatarUrl = user.avatarUrl || ''
  editForm.role = user.role === 'ADMIN' ? 'ADMIN' : 'USER'
  editForm.status = (user.status === 'DISABLED' || user.status === 'ANONYMOUS' ? user.status : 'ACTIVE') as 'ANONYMOUS' | 'ACTIVE' | 'DISABLED'
  editDialogVisible.value = true
}

const closeEditDialog = () => {
  editDialogVisible.value = false
  editMode.value = 'edit'
  resetEditForm()
}

const openPointDialog = async (user: AdminUserItem | AdminUserDetail) => {
  await ensureUserDetailLoaded(user.id)
  pointForm.id = user.id
  pointDialogVisible.value = true
}

const closePointDialog = () => {
  pointDialogVisible.value = false
  resetPointForm()
}

const openMembershipDialog = async (user: AdminUserItem | AdminUserDetail) => {
  await ensureUserDetailLoaded(user.id)
  membershipForm.id = user.id
  membershipDialogVisible.value = true
}

const applyMembershipDurationPreset = (value: number, unit: 'DAY' | 'MONTH' | 'YEAR') => {
  membershipForm.durationValue = value
  membershipForm.durationUnit = unit
}

const closeMembershipDialog = () => {
  membershipDialogVisible.value = false
  resetMembershipForm()
}

const openMembershipOrdersDialog = async (user: AdminUserItem | AdminUserDetail) => {
  membershipOrdersDialogVisible.value = true
  selectedUserId.value = user.id
  membershipOrdersLoading.value = true
  try {
    membershipOrders.value = await listAdminUserMembershipOrders(user.id)
  } finally {
    membershipOrdersLoading.value = false
  }
}

const openMembershipOrdersDialogByDetail = async () => {
  if (!selectedUserDetail.value) {
    return
  }
  await openMembershipOrdersDialog(selectedUserDetail.value)
}

const closeMembershipOrdersDialog = () => {
  membershipOrdersDialogVisible.value = false
  membershipOrders.value = []
}

const handleSubmitEdit = async () => {
  if (!isCreateMode.value && !editForm.id) {
    return
  }
  submitting.value = true
  try {
    if (isCreateMode.value) {
      const createdUser = await createAdminUser({
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        avatarUrl: editForm.avatarUrl,
        role: editForm.role,
        status: editForm.status,
      })
      closeEditDialog()
      await refreshAfterUserMutation(createdUser.id)
      selectedUserId.value = createdUser.id
      return
    }

    const targetUserId = editForm.id
    await updateAdminUserProfile(editForm.id, {
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      avatarUrl: editForm.avatarUrl,
      status: editForm.status,
    })
    closeEditDialog()
    await refreshAfterUserMutation(targetUserId)
  } finally {
    submitting.value = false
  }
}

const handleSubmitPointAdjust = async () => {
  if (!pointForm.id) {
    return
  }
  submitting.value = true
  try {
    await adjustAdminUserPoints(pointForm.id, {
      action: pointForm.action,
      changeAmount: Number(pointForm.changeAmount || 0),
      remark: pointForm.remark,
    })
    closePointDialog()
    await refreshAfterUserMutation(pointForm.id)
  } finally {
    submitting.value = false
  }
}

const handleSubmitMembershipAdjust = async () => {
  if (!membershipForm.id) {
    return
  }
  submitting.value = true
  try {
    await adjustAdminUserMembership(membershipForm.id, {
      levelId: membershipForm.levelId,
      durationValue: Number(membershipForm.durationValue || 1),
      durationUnit: membershipForm.durationUnit,
      bonusPoints: Number(membershipForm.bonusPoints || 0),
      remark: membershipForm.remark,
    })
    closeMembershipDialog()
    await refreshAfterUserMutation(membershipForm.id)
  } finally {
    submitting.value = false
  }
}

const handleDeleteUser = async (user: AdminUserItem | AdminUserDetail) => {
  await ElMessageBox.confirm(`确定删除用户“${user.name || buildUserDisplayNo(user.id)}”吗？该操作不可恢复。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })
  submitting.value = true
  try {
    await deleteAdminUser(user.id)
    if (selectedUserDetail.value?.id === user.id) {
      detailVisible.value = false
      selectedUserDetail.value = null
    }
    await loadUsers()
  } finally {
    submitting.value = false
  }
}

const handleResetLoginState = async (user: AdminUserItem | AdminUserDetail) => {
  await ElMessageBox.confirm(`确定清空用户“${user.name || buildUserDisplayNo(user.id)}”的当前登录会话吗？执行后该用户需要重新登录。`, '清空登录态', {
    type: 'warning',
    confirmButtonText: '确认清空',
    cancelButtonText: '取消',
  })
  submitting.value = true
  try {
    await resetAdminUserLoginState(user.id)
    await refreshAfterUserMutation(user.id)
  } finally {
    submitting.value = false
  }
}

const handleUserCommand = async (command: string, user: AdminUserItem) => {
  if (command === 'copy-user-id') {
    await copyText(user.id, '用户 ID 已复制')
    return
  }
  if (command === 'copy-display-no') {
    await copyText(buildUserDisplayNo(user.id), '用户编号已复制')
    return
  }
  if (command === 'toggle-role') {
    await handleQuickRoleToggle(user)
    return
  }
  if (command === 'detail') {
    await openUserDetail(user)
    return
  }
  if (command === 'edit') {
    await openEditDialog(user)
    return
  }
  if (command === 'points') {
    await openPointDialog(user)
    return
  }
  if (command === 'membership') {
    await openMembershipDialog(user)
    return
  }
  if (command === 'membership-orders') {
    await openMembershipOrdersDialog(user)
    return
  }
  if (command === 'reset-login-state') {
    await handleResetLoginState(user)
    return
  }
  if (command === 'delete') {
    await handleDeleteUser(user)
  }
}

onMounted(async () => {
  await Promise.all([
    loadUsers(),
    loadMembershipLevels(),
  ])
})
</script>

<style scoped>
.admin-users-board--compact {
  border-radius: 16px;
}

.admin-users-board :deep(.admin-card__header) {
  padding: 18px 18px 0;
}

.admin-users-board :deep(.admin-card__content) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
}

.admin-users-board__header {
  align-items: flex-end;
}

.admin-user-list--grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
}

.admin-user-create-card,
.admin-user-card--panel {
  min-height: 224px;
  border-radius: 14px;
  border: 1px solid var(--line-divider, #00000014);
  background: var(--bg-surface);
  box-shadow: 0 6px 18px rgba(15, 15, 18, 0.04);
}

.admin-user-create-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 10px;
  padding: 16px;
  border-style: dashed;
  cursor: pointer;
  color: var(--text-primary);
  text-align: left;
  transition: border-color .2s ease, transform .2s ease, background-color .2s ease;
}

.admin-user-create-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--brand-main-default) 32%, var(--line-divider, #00000014));
  background: color-mix(in srgb, var(--bg-surface) 92%, var(--brand-main-block-default));
}

.admin-user-create-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: var(--bg-block-secondary-default);
  color: var(--brand-main-default);
  font-size: 28px;
  line-height: 1;
}

.admin-user-create-card__title {
  font-size: 16px;
  font-weight: 700;
}

.admin-user-create-card__desc {
  color: var(--text-secondary);
  line-height: 1.65;
}

.admin-user-card--panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}

.admin-user-card--panel:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--brand-main-default) 18%, var(--line-divider, #00000014));
  box-shadow: 0 10px 24px rgba(15, 15, 18, 0.06);
}

.admin-user-card__panel-top,
.admin-user-card__identity,
.admin-user-card__title-row,
.admin-user-card__id-row,
.admin-user-card__contact-item,
.admin-user-card__stats-grid,
.admin-user-card__footer--panel,
.admin-user-drawer__identity,
.admin-user-drawer__title-row,
.admin-user-drawer__actions,
.admin-user-identity-item,
.admin-user-order-item {
  display: flex;
}

.admin-user-card__identity,
.admin-user-drawer__identity {
  align-items: flex-start;
  gap: 12px;
}

.admin-user-card__identity-main {
  min-width: 0;
  flex: 1;
}

.admin-user-card__avatar--square {
  width: 48px;
  height: 48px;
}

.admin-user-card__avatar--drawer {
  width: 64px;
  height: 64px;
}

.admin-user-card__avatar--square .admin-user-card__avatar-image,
.admin-user-card__avatar--square .admin-user-card__avatar-fallback,
.admin-user-card__avatar--drawer .admin-user-card__avatar-image,
.admin-user-card__avatar--drawer .admin-user-card__avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.admin-user-card__title-row,
.admin-user-card__id-row,
.admin-user-card__footer--panel,
.admin-user-drawer__title-row,
.admin-user-drawer__actions,
.admin-user-identity-item,
.admin-user-order-item {
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.admin-user-card__title-wrap {
  min-width: 0;
  flex: 1;
}

.admin-user-card__secondary {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.admin-user-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.admin-user-menu-item .el-icon {
  font-size: 15px;
}

.admin-user-menu-item--danger {
  color: #ff5a5f;
}

.admin-user-dialog-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--line-divider, #00000014);
  background: color-mix(in srgb, var(--bg-surface) 78%, var(--bg-block-secondary-default));
}

.admin-user-dialog-hero__text {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.admin-user-dialog-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.admin-user-dialog-summary__item,
.admin-user-membership-preview,
.admin-user-balance-preview__item {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--line-divider, #00000014);
  background: color-mix(in srgb, var(--bg-surface) 84%, var(--bg-block-secondary-default));
}

.admin-user-dialog-summary__label,
.admin-user-balance-preview__label {
  display: block;
  color: var(--text-tertiary);
  font-size: 12px;
}

.admin-user-dialog-summary__value,
.admin-user-balance-preview__value,
.admin-user-membership-preview__title {
  display: block;
  margin-top: 8px;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.admin-user-balance-preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.admin-user-balance-preview__arrow {
  color: var(--text-tertiary);
  font-size: 18px;
  font-weight: 700;
}

.admin-user-balance-preview__value--active {
  color: var(--brand-main-default);
}

.admin-user-option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.admin-user-option-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-user-option-card,
.admin-user-duration-presets__item {
  border: 1px solid var(--line-divider, #00000014);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
}

.admin-user-option-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-height: 82px;
  padding: 12px;
  border-radius: 12px;
  text-align: left;
}

.admin-user-option-card.is-active,
.admin-user-duration-presets__item.is-active {
  border-color: color-mix(in srgb, var(--brand-main-default) 56%, var(--line-divider, #00000014));
  background: color-mix(in srgb, var(--brand-main-block-default) 65%, var(--bg-surface));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-main-default) 10%, transparent);
}

.admin-user-option-card__title {
  font-size: 14px;
  font-weight: 700;
}

.admin-user-option-card__desc,
.admin-user-membership-preview__meta {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.admin-user-duration-presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.admin-user-duration-presets__item {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
}

.admin-user-card__more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: background-color .2s ease, border-color .2s ease;
}

.admin-user-card__more:hover {
  background: var(--bg-block-secondary-default);
  border-color: var(--line-divider, #00000014);
}

.admin-user-card__more .el-icon {
  color: var(--text-tertiary);
  font-size: 16px;
}

.admin-user-card__id-row {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 8px;
}

.admin-user-card__id-label {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--bg-block-secondary-default);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.admin-user-card__contact-list,
.admin-user-identity-list,
.admin-user-order-list {
  display: grid;
  gap: 10px;
}

.admin-user-card__contact-item,
.admin-user-identity-item,
.admin-user-order-item {
  min-height: 38px;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-block-secondary-default);
}

.admin-user-card__contact-item {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
}

.admin-user-card__contact-label,
.admin-user-card__metric-label,
.admin-user-drawer__field-label,
.admin-user-order-item__meta,
.admin-user-identity-item__meta,
.admin-user-drawer__metric-label {
  color: var(--text-tertiary);
  font-size: 12px;
}

.admin-user-card__contact-value,
.admin-user-identity-item__title,
.admin-user-order-item__title {
  color: var(--text-primary);
  font-size: 13px;
}

.admin-user-card__contact-value {
  text-align: right;
  word-break: break-word;
}

.admin-user-card__stats-grid {
  gap: 8px;
}

.admin-user-card__metric,
.admin-user-drawer__metric-panel {
  flex: 1;
  min-width: 0;
  padding: 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-surface) 84%, var(--bg-block-secondary-default));
  border: 1px solid var(--line-divider, #00000014);
}

.admin-user-card__metric {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-user-card__metric-value,
.admin-user-drawer__metric-value {
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 700;
}

.admin-user-card__footer--panel {
  margin-top: auto;
  align-items: flex-end;
}

.admin-user-card__meta-stack,
.admin-user-drawer__summary-main,
.admin-user-drawer__content {
  display: flex;
  flex-direction: column;
}

.admin-user-card__meta-stack,
.admin-user-drawer__content {
  gap: 6px;
}

.admin-user-drawer {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.admin-user-drawer__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  background: var(--bg-surface);
  border: 1px solid var(--line-divider, #00000014);
}

.admin-user-drawer__title {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
}

.admin-user-drawer__meta,
.admin-user-drawer__field-value {
  color: var(--text-secondary);
}

.admin-user-drawer__summary-main {
  gap: 10px;
}

.admin-user-drawer__summary-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.admin-user-drawer__grid {
  gap: 18px;
}

.admin-user-drawer__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.admin-user-drawer__actions {
  flex-wrap: wrap;
  justify-content: flex-start;
}

.admin-user-identity-item__side,
.admin-user-order-item__side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.admin-user-manage-dialog {
  width: min(760px, calc(100vw - 32px));
}

.admin-user-manage-dialog--wide {
  width: min(960px, calc(100vw - 32px));
}

.admin-empty--inline {
  min-height: 120px;
}

:deep(.admin-user-detail-drawer .el-drawer) {
  background: var(--bg-body);
}

:deep(.admin-user-detail-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding: 22px 24px 0;
}

:deep(.admin-user-detail-drawer .el-drawer__title) {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
}

:deep(.admin-user-detail-drawer .el-drawer__body) {
  padding: 20px 24px 24px;
}

:deep(.admin-user-card-dropdown.el-popper) {
  padding: 8px;
  border-radius: 14px;
  border: 1px solid var(--line-divider, #00000014);
  background: var(--bg-surface);
  box-shadow: 0 18px 40px rgba(15, 15, 18, 0.12);
}

:deep(.admin-user-card-dropdown .el-dropdown-menu) {
  padding: 0;
  border: none;
  box-shadow: none;
}

:deep(.admin-user-card-dropdown .el-dropdown-menu__item) {
  min-width: 168px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
}

:deep(.admin-user-card-dropdown .el-dropdown-menu__item.is-danger),
:deep(.admin-user-card-dropdown .el-dropdown-menu__item.is-danger .admin-user-menu-item),
:deep(.admin-user-card-dropdown .el-dropdown-menu__item.is-danger .el-icon) {
  color: #ff5a5f;
}

:deep(.admin-user-card-dropdown .el-dropdown-menu__item:not(.is-disabled):focus),
:deep(.admin-user-card-dropdown .el-dropdown-menu__item:not(.is-disabled):hover) {
  background: var(--bg-block-secondary-default);
  color: var(--text-primary);
}

:deep(.admin-user-card-dropdown .el-dropdown-menu__item.is-danger:not(.is-disabled):focus),
:deep(.admin-user-card-dropdown .el-dropdown-menu__item.is-danger:not(.is-disabled):hover) {
  color: #ff5a5f;
}

@media (min-width: 640px) {
  .admin-user-list--grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .admin-user-list--grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1440px) {
  .admin-user-list--grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1800px) {
  .admin-user-list--grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .admin-user-dialog-summary,
  .admin-user-option-grid,
  .admin-user-balance-preview {
    grid-template-columns: 1fr;
  }

  .admin-user-dialog-hero,
  .admin-user-card__contact-item,
  .admin-user-card__footer--panel,
  .admin-user-drawer__summary,
  .admin-user-identity-item,
  .admin-user-order-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-user-drawer__summary-stats,
  .admin-user-identity-item__side,
  .admin-user-order-item__side {
    justify-content: flex-start;
    align-items: flex-start;
  }
}
</style>
