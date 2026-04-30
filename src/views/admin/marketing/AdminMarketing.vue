<template>
  <AdminPageContainer title="营销中心" description="集中管理会员订阅、积分充值、卡密兑换与奖励规则。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" :disabled="loading" @click="loadAllData">
        {{ loading ? '刷新中...' : '刷新数据' }}
      </button>
    </template>

    <section class="admin-marketing-hero">
      <div class="admin-marketing-hero__main">
        <div class="admin-marketing-hero__eyebrow">营销工作台</div>
        <h3 class="admin-marketing-hero__title">统一管理会员、积分、激励与补偿等核心运营能力</h3>
        <p class="admin-marketing-hero__desc">
          当前模块为 <strong>{{ currentToolInfo.title }}</strong>，主要用于 {{ currentToolInfo.description }}。
          可结合左侧模块导航快速切换到具体业务域，集中处理日常运营动作。
        </p>
        <div class="admin-marketing-hero__chips">
          <span class="admin-chip">当前模块：{{ currentToolInfo.title }}</span>
          <span class="admin-chip">{{ currentToolInfo.meta }}</span>
        </div>
      </div>
      <div class="admin-marketing-hero__stats">
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">会员等级</div>
          <div class="admin-stat-card__value">{{ overview?.membership.levelCount ?? levels.length }}</div>
          <div class="admin-stat-card__hint">当前已配置会员等级与成长体系</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">会员计划</div>
          <div class="admin-stat-card__value">{{ overview?.membership.planCount ?? plans.length }}</div>
          <div class="admin-stat-card__hint">支持月卡、季卡、年卡等订阅产品</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">充值套餐</div>
          <div class="admin-stat-card__value">{{ overview?.recharge.packageCount ?? packages.length }}</div>
          <div class="admin-stat-card__hint">用于积分充值与多充多送活动</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-card__label">奖励规则</div>
          <div class="admin-stat-card__value">{{ overview?.rewards.ruleCount ?? rewardRules.length }}</div>
          <div class="admin-stat-card__hint">覆盖登录、注册、签到等激励动作</div>
        </div>
      </div>
    </section>

    <section class="admin-marketing-workspace">
      <aside class="admin-marketing-sidebar">
        <div class="admin-card admin-marketing-sidebar-card">
          <div class="admin-card__header">
            <div>
              <h4 class="admin-card__title">运营模块</h4>
              <div class="admin-card__desc">按业务域拆分，减少运营跳转成本。</div>
            </div>
          </div>
          <div class="admin-card__content">
            <div class="admin-marketing-tools">
              <button
                v-for="tool in marketingTools"
                :key="tool.key"
                class="admin-marketing-tool"
                :class="{ 'is-active': activeTool === tool.key }"
                type="button"
                @click="activeTool = tool.key"
              >
                <div class="admin-marketing-tool__icon">{{ tool.icon }}</div>
                <div class="admin-marketing-tool__body">
                  <div class="admin-marketing-tool__title">{{ tool.title }}</div>
                  <div class="admin-marketing-tool__desc">{{ tool.description }}</div>
                  <div class="admin-marketing-tool__meta">{{ tool.meta() }}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div class="admin-marketing-main">
        <div class="admin-marketing-main__header">
          <div>
            <h3 class="admin-marketing-main__title">{{ currentToolInfo.title }}</h3>
            <div class="admin-marketing-main__desc">{{ currentToolInfo.focus }}</div>
          </div>
          <div class="admin-marketing-main__meta">{{ currentToolInfo.meta }}</div>
        </div>

        <div v-if="activeTool === 'membership'" class="admin-marketing-section-shell">
          <div class="admin-grid admin-grid--two admin-marketing-panel-grid">
            <div class="admin-card admin-marketing-module-card">
              <div class="admin-card__header">
                <div>
                  <h4 class="admin-card__title">会员等级</h4>
                  <div class="admin-card__desc">定义会员层级、专属权益、每月赠送积分和排序权重。</div>
                </div>
                <button class="admin-button admin-button--primary" type="button" @click="openLevelDialog()">新增等级</button>
              </div>
              <div class="admin-card__content">
                <div v-if="!levels.length" class="admin-empty">暂无会员等级，请先创建。</div>
                <div v-else class="admin-list">
                  <div v-for="item in levels" :key="item.id" class="admin-list-item admin-marketing-list-item">
                    <div>
                      <div class="admin-list-item__title">{{ item.name }}</div>
                      <div class="admin-list-item__meta">
                        Lv.{{ item.level }} · 每月赠送 {{ item.monthlyBonusPoints }} 积分 · 容量 {{ item.storageCapacity || 0 }}
                      </div>
                    </div>
                    <div class="admin-marketing-list-item__badges">
                      <span class="admin-chip">排序 {{ item.sortOrder }}</span>
                      <span class="admin-status" :class="item.isEnabled ? 'admin-status--success' : 'admin-status--muted'">
                        {{ item.isEnabled ? '已启用' : '已停用' }}
                      </span>
                    </div>
                    <div class="admin-row-actions">
                      <button class="admin-inline-button" type="button" @click="openLevelDialog(item)">编辑</button>
                      <button class="admin-inline-button admin-inline-button--danger" type="button" @click="handleDeleteLevel(item)">删除</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="admin-card admin-marketing-module-card">
              <div class="admin-card__header">
                <div>
                  <h4 class="admin-card__title">会员计划</h4>
                  <div class="admin-card__desc">创建订阅商品，支持设置时长、售价、原价和赠送积分。</div>
                </div>
                <button class="admin-button admin-button--primary" type="button" @click="openPlanDialog()">新增计划</button>
              </div>
              <div class="admin-card__content">
                <div v-if="!plans.length" class="admin-empty">暂无会员计划，请先配置。</div>
                <div v-else class="admin-list">
                  <div v-for="item in plans" :key="item.id" class="admin-list-item admin-marketing-list-item">
                    <div>
                      <div class="admin-list-item__title">{{ item.name }}</div>
                      <div class="admin-list-item__meta">
                        {{ item.durationValue }} {{ getDurationUnitLabel(item.durationUnit) }} · {{ getPlanBillingSummary(item.billingRules) }}
                      </div>
                    </div>
                    <div class="admin-marketing-list-item__badges">
                      <span class="admin-chip">赠送 {{ item.bonusPoints }} 积分</span>
                      <span class="admin-status" :class="item.isEnabled ? 'admin-status--success' : 'admin-status--muted'">
                        {{ item.isEnabled ? '已上架' : '已下架' }}
                      </span>
                    </div>
                    <div class="admin-row-actions">
                      <button class="admin-inline-button" type="button" @click="openPlanDialog(item)">编辑</button>
                      <button class="admin-inline-button admin-inline-button--danger" type="button" @click="handleDeletePlan(item)">删除</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTool === 'recharge'" class="admin-marketing-section-shell">
          <div class="admin-card admin-marketing-module-card">
            <div class="admin-card__header">
              <div>
                <h4 class="admin-card__title">积分充值</h4>
                <div class="admin-card__desc">支持配置充值金额、基础积分、赠送积分和促销角标。</div>
              </div>
              <button class="admin-button admin-button--primary" type="button" @click="openPackageDialog()">新增套餐</button>
            </div>
            <div class="admin-card__content">
              <div v-if="!packages.length" class="admin-empty">暂无积分充值套餐。</div>
              <div v-else class="admin-provider-grid admin-marketing-package-grid">
                <div v-for="item in packages" :key="item.id" class="admin-provider-tile admin-marketing-package-card">
                  <div class="admin-provider-tile__header">
                    <div>
                      <div class="admin-provider-tile__title">{{ item.name }}</div>
                      <div class="admin-provider-tile__desc">{{ item.description || '未填写套餐说明' }}</div>
                    </div>
                    <span class="admin-status" :class="item.isEnabled ? 'admin-status--success' : 'admin-status--muted'">
                      {{ item.isEnabled ? '已启用' : '已停用' }}
                    </span>
                  </div>
                  <div class="admin-provider-tile__chips">
                    <span class="admin-chip">积分 {{ item.points }}</span>
                    <span class="admin-chip">赠送 {{ item.bonusPoints }}</span>
                    <span v-if="item.badgeText" class="admin-chip">{{ item.badgeText }}</span>
                  </div>
                  <div class="admin-provider-tile__endpoint">
                    <span>售价</span>
                    <strong>{{ formatMoney(item.price) }}</strong>
                  </div>
                  <div class="admin-marketing-package-card__footer">
                    <span class="admin-marketing-package-card__footer-text">排序 {{ item.sortOrder }}</span>
                    <span v-if="item.originalPrice" class="admin-marketing-package-card__footer-text">原价 {{ formatMoney(item.originalPrice) }}</span>
                  </div>
                  <div class="admin-provider-tile__actions">
                    <button class="admin-inline-button" type="button" @click="openPackageDialog(item)">编辑</button>
                    <button class="admin-inline-button admin-inline-button--danger" type="button" @click="handleDeletePackage(item)">删除</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTool === 'rewards'" class="admin-marketing-section-shell">
          <div class="admin-card admin-marketing-module-card">
            <div class="admin-card__header">
              <div>
                <h4 class="admin-card__title">奖励中心</h4>
                <div class="admin-card__desc">管理登录奖励、注册奖励和签到奖励等营销激励规则。</div>
              </div>
              <button class="admin-button admin-button--primary" type="button" @click="openRewardDialog()">新增规则</button>
            </div>
            <div class="admin-card__content">
              <div v-if="!rewardRules.length" class="admin-empty">暂无奖励规则。</div>
              <div v-else class="admin-list">
                <div v-for="item in rewardRules" :key="item.id" class="admin-list-item admin-marketing-list-item">
                  <div>
                    <div class="admin-list-item__title">{{ item.name }}</div>
                    <div class="admin-list-item__meta">
                      {{ getRewardTriggerLabel(item.triggerType) }} · {{ getCycleTypeLabel(item.cycleType) }} · 每周期 {{ item.limitPerCycle }} 次
                    </div>
                  </div>
                  <div class="admin-marketing-list-item__badges">
                    <span class="admin-chip">奖励 {{ item.rewardPoints }} 积分</span>
                    <span class="admin-status" :class="item.isEnabled ? 'admin-status--success' : 'admin-status--muted'">
                      {{ item.isEnabled ? '启用中' : '已关闭' }}
                    </span>
                  </div>
                  <div class="admin-row-actions">
                    <button class="admin-inline-button" type="button" @click="openRewardDialog(item)">编辑</button>
                    <button class="admin-inline-button admin-inline-button--danger" type="button" @click="handleDeleteReward(item)">删除</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTool === 'cdk'" class="admin-marketing-section-shell">
          <div class="admin-card admin-marketing-module-card">
            <div class="admin-card__header">
              <div>
                <h4 class="admin-card__title">卡密兑换</h4>
                <div class="admin-card__desc">用于批量生成兑换码，可绑定积分奖励或会员权益，适合运营活动投放。</div>
              </div>
              <button class="admin-button admin-button--primary" type="button" @click="openBatchDialog()">新增批次</button>
            </div>
            <div class="admin-card__content">
              <div v-if="!cardBatches.length" class="admin-empty">暂无卡密批次。</div>
              <div v-else class="admin-list">
                <div v-for="item in cardBatches" :key="item.id" class="admin-list-item admin-marketing-list-item admin-marketing-list-item--batch">
                  <div>
                    <div class="admin-list-item__title">{{ item.name }}</div>
                    <div class="admin-list-item__meta">
                      批次号 {{ item.batchNo }} · 总数 {{ item.totalCount }} · 已用 {{ item.usedCount }} · {{ getCardRewardSummary(item) }}
                    </div>
                  </div>
                  <div class="admin-marketing-list-item__badges">
                    <span class="admin-chip">剩余 {{ Math.max(item.totalCount - item.usedCount, 0) }}</span>
                    <span class="admin-status" :class="item.isEnabled ? 'admin-status--success' : 'admin-status--muted'">
                      {{ item.isEnabled ? '可兑换' : '已停用' }}
                    </span>
                  </div>
                  <div class="admin-row-actions">
                    <button class="admin-inline-button" type="button" @click="openCodesDialog(item)">查看卡密</button>
                    <button class="admin-inline-button" type="button" @click="openBatchDialog(item)">编辑</button>
                    <button class="admin-inline-button admin-inline-button--danger" type="button" @click="handleDeleteBatch(item)">删除</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="admin-marketing-section-shell">
          <div class="admin-card admin-marketing-module-card">
            <div class="admin-card__header">
              <div>
                <h4 class="admin-card__title">积分流水明细</h4>
                <div class="admin-card__desc">支持按动作、来源、终端类型、退款状态和关键词筛选，并可对失败未退款流水直接补偿。</div>
              </div>
              <div class="admin-row-actions">
                <button class="admin-button admin-button--secondary" type="button" :disabled="compensationLoading" @click="loadPointLogs">
                  {{ compensationLoading ? '刷新中...' : '刷新流水' }}
                </button>
                <button class="admin-button admin-button--secondary" type="button" @click="openManualCompensationDialog">
                  手动补偿
                </button>
                <button
                  class="admin-button admin-button--primary"
                  type="button"
                  :disabled="compensationSubmitting || !selectedCompensationAssociationNos.length"
                  @click="handleExecuteSelectedPointLogCompensation"
                >
                  {{ compensationSubmitting ? '补偿中...' : `补偿已选 ${selectedCompensationAssociationNos.length} 条` }}
                </button>
              </div>
            </div>
            <div class="admin-card__content">
              <div class="admin-marketing-log-toolbar">
                <div class="admin-marketing-log-toolbar__search">
                  <div class="admin-marketing-log-filter-field admin-marketing-log-filter-field--search">
                    <span class="admin-marketing-log-filter-field__label">关键词搜索</span>
                    <input
                      v-model.trim="pointLogQuery.keyword"
                      class="admin-input admin-marketing-log-filter-field__control"
                      type="text"
                      placeholder="搜索用户、流水号、备注、模型、任务提示词"
                      @keydown.enter.prevent="handleApplyPointLogFilters"
                    >
                  </div>
                  <div class="admin-marketing-log-toolbar__actions">
                    <button class="admin-button admin-button--secondary" type="button" :disabled="compensationLoading" @click="handleResetPointLogFilters">
                      重置
                    </button>
                    <button class="admin-button admin-button--primary" type="button" :disabled="compensationLoading" @click="handleApplyPointLogFilters">
                      {{ compensationLoading ? '筛选中...' : '应用筛选' }}
                    </button>
                  </div>
                </div>

                <div class="admin-marketing-log-filters">
                  <label class="admin-marketing-log-filter-field">
                    <span class="admin-marketing-log-filter-field__label">动作类型</span>
                    <select v-model="pointLogQuery.action" class="admin-select admin-marketing-log-filter-field__control">
                      <option value="">全部动作</option>
                      <option value="INCREASE">收入</option>
                      <option value="DECREASE">支出</option>
                    </select>
                  </label>
                  <label class="admin-marketing-log-filter-field">
                    <span class="admin-marketing-log-filter-field__label">来源渠道</span>
                    <select v-model="pointLogQuery.sourceType" class="admin-select admin-marketing-log-filter-field__control">
                      <option value="">全部来源</option>
                      <option value="GENERATION_CONSUME">生成消费</option>
                      <option value="RECHARGE_ORDER">充值</option>
                      <option value="MEMBERSHIP_ORDER">订阅</option>
                      <option value="REWARD_RULE">奖励规则</option>
                      <option value="CHECKIN">签到</option>
                      <option value="CARD_REDEEM">卡密兑换</option>
                    </select>
                  </label>
                  <label class="admin-marketing-log-filter-field">
                    <span class="admin-marketing-log-filter-field__label">终端类型</span>
                    <select v-model="pointLogQuery.endpointType" class="admin-select admin-marketing-log-filter-field__control">
                      <option value="">全部终端</option>
                      <option value="chat">CHAT</option>
                      <option value="image">IMAGE</option>
                      <option value="video">VIDEO</option>
                    </select>
                  </label>
                  <label class="admin-marketing-log-filter-field">
                    <span class="admin-marketing-log-filter-field__label">退款状态</span>
                    <select v-model="pointLogQuery.refundStatus" class="admin-select admin-marketing-log-filter-field__control">
                      <option value="">全部退款状态</option>
                      <option value="compensable">待补偿</option>
                      <option value="refunded">已退款</option>
                      <option value="unrefunded">未退款</option>
                    </select>
                  </label>
                  <label class="admin-marketing-log-filter-field">
                    <span class="admin-marketing-log-filter-field__label">时间窗口</span>
                    <select v-model.number="pointLogQuery.days" class="admin-select admin-marketing-log-filter-field__control">
                      <option :value="7">近 7 天</option>
                      <option :value="30">近 30 天</option>
                      <option :value="90">近 90 天</option>
                    </select>
                  </label>
                </div>
              </div>

              <div class="admin-marketing-log-summary">
                <div class="admin-marketing-log-summary__item">
                  <span class="admin-marketing-log-summary__label">命中明细</span>
                  <strong class="admin-marketing-log-summary__value">{{ pointLogSummary.totalCount }}</strong>
                </div>
                <div class="admin-marketing-log-summary__item">
                  <span class="admin-marketing-log-summary__label">待补偿</span>
                  <strong class="admin-marketing-log-summary__value">{{ pointLogSummary.compensableCount }}</strong>
                </div>
                <div class="admin-marketing-log-summary__item">
                  <span class="admin-marketing-log-summary__label">已退款</span>
                  <strong class="admin-marketing-log-summary__value">{{ pointLogSummary.refundCount }}</strong>
                </div>
                <div class="admin-marketing-log-summary__item">
                  <span class="admin-marketing-log-summary__label">统计窗口</span>
                  <strong class="admin-marketing-log-summary__value">{{ pointLogSummary.windowDays }} 天</strong>
                </div>
              </div>

              <div v-if="!pointLogs.length" class="admin-empty">当前筛选条件下暂无积分流水。</div>
              <div v-else class="admin-list admin-point-log-list">
                <label v-for="item in pointLogs" :key="item.id" class="admin-list-item admin-point-log-item">
                  <div class="admin-point-log-item__check">
                    <input
                      :checked="selectedCompensationAssociationNos.includes(item.associationNo)"
                      :disabled="!item.canCompensate"
                      type="checkbox"
                      @change="toggleCompensationSelection(item.associationNo)"
                    >
                  </div>
                  <div class="admin-point-log-item__main">
                    <div class="admin-point-log-item__headline">
                      <div class="admin-list-item__title">{{ getPointLogTitle(item) }}</div>
                      <span class="admin-chip admin-point-log-item__amount" :class="item.action === 'DECREASE' ? 'is-decrease' : 'is-increase'">
                        {{ item.action === 'DECREASE' ? '-' : '+' }}{{ item.changeAmount }} 积分
                      </span>
                    </div>
                    <div class="admin-point-log-item__meta-grid">
                      <div class="admin-list-item__meta">
                        用户 {{ resolvePointLogUserText(item) }} · ID {{ item.userId || '-' }}
                        <button
                          v-if="item.userId"
                          class="admin-inline-button admin-point-log-item__copy-button"
                          type="button"
                          @click.prevent="handleCopyPointLogText('user', item.id, item.userId)"
                        >
                          {{ resolveCopyButtonText('user', item.id, '复制用户ID') }}
                        </button>
                      </div>
                      <div class="admin-list-item__meta">余额 {{ item.balanceAfter }} · 可用 {{ item.availableAmount }}</div>
                    </div>
                    <div class="admin-point-log-item__meta-grid">
                      <div class="admin-list-item__meta">来源 {{ item.sourceType }} · 终端 {{ item.endpointType || '-' }}</div>
                      <div class="admin-list-item__meta">
                        流水号 {{ item.associationNo || item.accountNo }}
                        <button
                          v-if="item.associationNo || item.accountNo"
                          class="admin-inline-button admin-point-log-item__copy-button"
                          type="button"
                          @click.prevent="handleCopyPointLogText('association', item.id, item.associationNo || item.accountNo)"
                        >
                          {{ resolveCopyButtonText('association', item.id, '复制流水号') }}
                        </button>
                      </div>
                    </div>
                    <div class="admin-list-item__meta">发生时间 {{ formatDateText(item.createdAt) }}</div>
                    <div v-if="item.generationPrompt || item.generationErrorMessage" class="admin-list-item__meta">
                      {{ item.generationPrompt || '未记录任务提示词' }}<span v-if="item.generationErrorMessage"> · 错误：{{ item.generationErrorMessage }}</span>
                    </div>
                  </div>
                  <div class="admin-point-log-item__aside">
                    <div class="admin-point-log-item__status">
                    <span class="admin-status" :class="resolvePointLogStatusClass(item)">
                      {{ resolvePointLogStatusText(item) }}
                    </span>
                    </div>
                    <div class="admin-point-log-item__compensation-reason">
                      {{ item.compensationReason }}
                    </div>
                  </div>
                  <div class="admin-row-actions">
                    <button
                      v-if="item.canCompensate"
                      class="admin-inline-button"
                      type="button"
                      :disabled="compensationSubmitting"
                      @click.prevent="handleExecuteSinglePointLogCompensation(item.associationNo)"
                    >
                      失败补偿
                    </button>
                  </div>
                </label>
                <AdminPagination
                  v-model:page="pointLogPagination.page"
                  v-model:page-size="pointLogPagination.pageSize"
                  :total="pointLogSummary.totalCount"
                  :disabled="compensationLoading || compensationSubmitting"
                  @change="handlePointLogPaginationChange"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="manualCompensationDialogVisible" class="admin-dialog-mask" @click="closeManualCompensationDialog">
      <div class="admin-dialog admin-dialog--provider-form" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">手动补偿</h3>
            <div class="admin-dialog__desc">用于处理历史遗留漏账或缺少生成记录关联的流水，请按关联号逐条核实后执行。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closeManualCompensationDialog">×</button>
        </div>
        <div class="admin-dialog__body admin-form">
          <div class="admin-form__field">
            <label class="admin-form__label">手动输入关联号</label>
            <textarea
              v-model.trim="compensationForm.manualAssociationNos"
              class="admin-textarea"
              rows="8"
              placeholder="每行一个关联号，或使用逗号分隔，例如：&#10;GTK1777512523146OM0MFW&#10;GTK1777512456545MH6GTH"
            />
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">补偿备注</label>
            <textarea
              v-model.trim="compensationForm.note"
              class="admin-textarea"
              rows="4"
              placeholder="例如：修复对话失败退款漏账后，补偿 2026-04-30 历史遗留记录"
            />
          </div>
          <label class="admin-checkbox">
            <input v-model="compensationForm.forceManual" type="checkbox">
            <span>允许补偿缺少生成记录关联的历史流水（请先人工确认任务确实失败）</span>
          </label>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="fillLegacyCompensationExample">填入当前遗留样例</button>
            <button class="admin-button admin-button--secondary" type="button" @click="closeManualCompensationDialog">取消</button>
            <button class="admin-button admin-button--primary" type="button" :disabled="compensationSubmitting" @click="handleExecuteManualCompensation">
              {{ compensationSubmitting ? '执行中...' : '执行手动补偿' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="levelDialogVisible" class="admin-dialog-mask" @click="closeLevelDialog">
      <div class="admin-dialog admin-dialog--provider-form" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">{{ levelEditingId ? '编辑会员等级' : '新增会员等级' }}</h3>
            <div class="admin-dialog__desc">配置会员层级、每月积分和权益说明。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closeLevelDialog">×</button>
        </div>
        <form class="admin-dialog__body admin-form" @submit.prevent="handleSubmitLevel">
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label">等级名称</label>
              <input v-model.trim="levelForm.name" class="admin-input" type="text" placeholder="例如：黄金会员">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">等级值</label>
              <input v-model.number="levelForm.level" class="admin-input" type="number" min="1">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">每月赠送积分</label>
              <input v-model.number="levelForm.monthlyBonusPoints" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">存储容量</label>
              <input v-model.number="levelForm.storageCapacity" class="admin-input" type="number" min="0" placeholder="单位自定义">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">图标地址</label>
              <input v-model.trim="levelForm.iconUrl" class="admin-input" type="text" placeholder="https://...">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">等级说明</label>
              <textarea v-model.trim="levelForm.description" class="admin-textarea" placeholder="简述此等级的定位和权益"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">权益 JSON</label>
              <textarea v-model.trim="levelForm.benefitsJsonText" class="admin-textarea admin-system-json" placeholder='例如：[{"label":"高速生成"}]'></textarea>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">排序权重</label>
              <input v-model.number="levelForm.sortOrder" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field admin-form__field--checkbox">
              <label class="admin-form__label admin-form__label--inline">
                <input v-model="levelForm.isEnabled" type="checkbox">
                <span>启用此等级</span>
              </label>
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closeLevelDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存等级' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="planDialogVisible" class="admin-dialog-mask" @click="closePlanDialog">
      <div class="admin-dialog admin-dialog--provider-form" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">{{ planEditingId ? '编辑会员计划' : '新增会员计划' }}</h3>
            <div class="admin-dialog__desc">设置订阅时长、价格和绑定等级。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closePlanDialog">×</button>
        </div>
        <form class="admin-dialog__body admin-form" @submit.prevent="handleSubmitPlan">
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label">计划名称</label>
              <input v-model.trim="planForm.name" class="admin-input" type="text" placeholder="例如：黄金月卡">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">展示标签</label>
              <input v-model.trim="planForm.label" class="admin-input" type="text" placeholder="热门推荐">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">时长数值</label>
              <input v-model.number="planForm.durationValue" class="admin-input" type="number" min="1">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">时长单位</label>
              <select v-model="planForm.durationUnit" class="admin-input">
                <option value="DAY">天</option>
                <option value="MONTH">月</option>
                <option value="YEAR">年</option>
              </select>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">赠送积分</label>
              <input v-model.number="planForm.bonusPoints" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <div class="admin-form__label admin-form__label--row">
                <span>会员计费</span>
                <button class="admin-inline-button" type="button" @click="appendPlanBillingRule">新增计费</button>
              </div>
              <div class="admin-membership-billing-list">
                <div v-for="(rule, ruleIndex) in planForm.billingRules" :key="`${rule.levelId}-${ruleIndex}`" class="admin-membership-billing-item">
                  <select v-model="rule.levelId" class="admin-input">
                    <option value="">选择等级</option>
                    <option v-for="item in levels" :key="item.id" :value="item.id">{{ item.name }}</option>
                  </select>
                  <input v-model.trim="rule.salesPrice" class="admin-input" type="text" inputmode="decimal" placeholder="售价">
                  <input v-model.trim="rule.originalPrice" class="admin-input" type="text" inputmode="decimal" placeholder="原价，可留空">
                  <input v-model.trim="rule.label" class="admin-input" type="text" placeholder="标签，可选">
                  <label class="admin-form__label admin-form__label--inline admin-membership-billing-switch">
                    <input v-model="rule.status" type="checkbox">
                    <span>启用</span>
                  </label>
                  <button class="admin-inline-button admin-inline-button--danger" type="button" @click="removePlanBillingRule(ruleIndex)">删除</button>
                </div>
              </div>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">计划说明</label>
              <textarea v-model.trim="planForm.description" class="admin-textarea" placeholder="描述计划内容与目标用户"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">会员权益 JSON</label>
              <textarea v-model.trim="planForm.benefitsJsonText" class="admin-textarea admin-system-json" placeholder='例如：["高速生成","会员专属能力"]'></textarea>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">排序权重</label>
              <input v-model.number="planForm.sortOrder" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field admin-form__field--checkbox">
              <label class="admin-form__label admin-form__label--inline">
                <input v-model="planForm.isEnabled" type="checkbox">
                <span>启用此计划</span>
              </label>
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closePlanDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存计划' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="packageDialogVisible" class="admin-dialog-mask" @click="closePackageDialog">
      <div class="admin-dialog admin-dialog--provider-form" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">{{ packageEditingId ? '编辑充值套餐' : '新增充值套餐' }}</h3>
            <div class="admin-dialog__desc">支持设置多充多送、原价与角标文案。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closePackageDialog">×</button>
        </div>
        <form class="admin-dialog__body admin-form" @submit.prevent="handleSubmitPackage">
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label">套餐名称</label>
              <input v-model.trim="packageForm.name" class="admin-input" type="text" placeholder="例如：500 积分包">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">展示标签</label>
              <input v-model.trim="packageForm.label" class="admin-input" type="text" placeholder="限时特惠">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">基础积分</label>
              <input v-model.number="packageForm.points" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">赠送积分</label>
              <input v-model.number="packageForm.bonusPoints" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">售价</label>
              <input v-model.trim="packageForm.price" class="admin-input" type="text" inputmode="decimal" placeholder="例如：19.90">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">原价</label>
              <input v-model.trim="packageForm.originalPrice" class="admin-input" type="text" inputmode="decimal" placeholder="例如：19.90">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">角标文案</label>
              <input v-model.trim="packageForm.badgeText" class="admin-input" type="text" placeholder="多充多送">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">排序权重</label>
              <input v-model.number="packageForm.sortOrder" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">套餐说明</label>
              <textarea v-model.trim="packageForm.description" class="admin-textarea" placeholder="说明套餐定位和活动力度"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">底部权益文案</label>
              <textarea v-model.trim="packageForm.benefitsText" class="admin-textarea" placeholder="每行一条，例如：&#10;充值后即时到账&#10;支持多充多送&#10;可用于图片与视频生成"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">扩展 JSON</label>
              <textarea v-model.trim="packageForm.metaJsonText" class="admin-textarea admin-system-json" placeholder='例如：{"tagColor":"gold"}'></textarea>
            </div>
            <div class="admin-form__field admin-form__field--checkbox">
              <label class="admin-form__label admin-form__label--inline">
                <input v-model="packageForm.isEnabled" type="checkbox">
                <span>启用此套餐</span>
              </label>
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closePackageDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存套餐' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="rewardDialogVisible" class="admin-dialog-mask" @click="closeRewardDialog">
      <div class="admin-dialog admin-dialog--provider-form" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">{{ rewardEditingId ? '编辑奖励规则' : '新增奖励规则' }}</h3>
            <div class="admin-dialog__desc">配置登录、注册、签到等触发动作与积分规则。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closeRewardDialog">×</button>
        </div>
        <form class="admin-dialog__body admin-form" @submit.prevent="handleSubmitReward">
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label">规则编码</label>
              <input v-model.trim="rewardForm.code" class="admin-input" type="text" placeholder="LOGIN_DAILY_DEFAULT">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">规则名称</label>
              <input v-model.trim="rewardForm.name" class="admin-input" type="text" placeholder="每日登录奖励">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">触发类型</label>
              <select v-model="rewardForm.triggerType" class="admin-input">
                <option value="LOGIN_DAILY">登录奖励</option>
                <option value="REGISTER_ONCE">注册奖励</option>
                <option value="CHECKIN_DAILY">签到奖励</option>
              </select>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">周期类型</label>
              <select v-model="rewardForm.cycleType" class="admin-input">
                <option value="ONCE">仅一次</option>
                <option value="DAILY">每日</option>
                <option value="WEEKLY">每周</option>
                <option value="MONTHLY">每月</option>
              </select>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">奖励积分</label>
              <input v-model.number="rewardForm.rewardPoints" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">周期上限</label>
              <input v-model.number="rewardForm.limitPerCycle" class="admin-input" type="number" min="1">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">规则说明</label>
              <textarea v-model.trim="rewardForm.description" class="admin-textarea" placeholder="说明规则的投放场景与限制"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">条件 JSON</label>
              <textarea v-model.trim="rewardForm.conditionJsonText" class="admin-textarea admin-system-json" placeholder='例如：{"days":[1,2,3]}'></textarea>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">排序权重</label>
              <input v-model.number="rewardForm.sortOrder" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field admin-form__field--checkbox">
              <label class="admin-form__label admin-form__label--inline">
                <input v-model="rewardForm.isEnabled" type="checkbox">
                <span>启用此规则</span>
              </label>
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closeRewardDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存规则' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="batchDialogVisible" class="admin-dialog-mask" @click="closeBatchDialog">
      <div class="admin-dialog admin-dialog--provider-form" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">{{ batchEditingId ? '编辑卡密批次' : '新增卡密批次' }}</h3>
            <div class="admin-dialog__desc">设置兑换奖励、批次数量和过期时间，创建时会自动生成卡密。</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closeBatchDialog">×</button>
        </div>
        <form class="admin-dialog__body admin-form" @submit.prevent="handleSubmitBatch">
          <div class="admin-form__grid">
            <div class="admin-form__field">
              <label class="admin-form__label">批次名称</label>
              <input v-model.trim="batchForm.name" class="admin-input" type="text" placeholder="例如：五一活动卡密批次">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">批次号</label>
              <input v-model.trim="batchForm.batchNo" class="admin-input" type="text" placeholder="例如：MKT-20260428-A">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">奖励类型</label>
              <select v-model="batchForm.rewardType" class="admin-input">
                <option value="POINTS">积分</option>
                <option value="MEMBERSHIP">会员时长</option>
              </select>
            </div>
            <div class="admin-form__field" v-if="batchForm.rewardType === 'POINTS'">
              <label class="admin-form__label">奖励积分</label>
              <input v-model.number="batchForm.rewardPoints" class="admin-input" type="number" min="0">
            </div>
            <div class="admin-form__field" v-else>
              <label class="admin-form__label">会员等级</label>
              <select v-model="batchForm.rewardLevelId" class="admin-input">
                <option value="">请选择会员等级</option>
                <option v-for="item in levels" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>
            </div>
            <div class="admin-form__field" v-if="batchForm.rewardType === 'MEMBERSHIP'">
              <label class="admin-form__label">奖励天数</label>
              <input v-model.number="batchForm.rewardDays" class="admin-input" type="number" min="1">
            </div>
            <div class="admin-form__field" v-else>
              <label class="admin-form__label">总数量</label>
              <input v-model.number="batchForm.totalCount" class="admin-input" type="number" min="1" :disabled="Boolean(batchEditingId)">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">过期时间</label>
              <input v-model="batchForm.expiresAt" class="admin-input" type="datetime-local">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">批次说明</label>
              <textarea v-model.trim="batchForm.description" class="admin-textarea" placeholder="说明该批次的用途和发放渠道"></textarea>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">扩展 JSON</label>
              <textarea v-model.trim="batchForm.metaJsonText" class="admin-textarea admin-system-json" placeholder='例如：{"channel":"douyin"}'></textarea>
            </div>
            <div class="admin-form__field admin-form__field--checkbox">
              <label class="admin-form__label admin-form__label--inline">
                <input v-model="batchForm.isEnabled" type="checkbox">
                <span>允许兑换</span>
              </label>
            </div>
          </div>
          <div class="admin-form__footer">
            <button class="admin-button admin-button--secondary" type="button" @click="closeBatchDialog">取消</button>
            <button class="admin-button admin-button--primary" type="submit" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存批次' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="codesDialogVisible" class="admin-dialog-mask" @click="closeCodesDialog">
      <div class="admin-dialog admin-dialog--manager" @click.stop>
        <div class="admin-dialog__header">
          <div>
            <h3 class="admin-dialog__title">卡密列表</h3>
            <div class="admin-dialog__desc">{{ currentBatch?.name || '当前批次' }} · {{ currentBatch?.batchNo || '-' }}</div>
          </div>
          <button class="admin-dialog__close" type="button" @click="closeCodesDialog">×</button>
        </div>
        <div class="admin-dialog__body">
          <div v-if="codesLoading" class="admin-empty">正在加载卡密...</div>
          <div v-else-if="!cardCodes.length" class="admin-empty">当前批次暂无卡密数据。</div>
          <div v-else class="admin-marketing-code-grid">
            <div v-for="item in cardCodes" :key="item.id" class="admin-marketing-code-card">
              <div class="admin-marketing-code-card__top">
                <strong>{{ item.code }}</strong>
                <span class="admin-status" :class="item.status === 'USED' ? 'admin-status--warning' : 'admin-status--success'">
                  {{ item.status === 'USED' ? '已使用' : '未使用' }}
                </span>
              </div>
              <div class="admin-marketing-code-card__meta">到期：{{ formatDateText(item.expiresAt) }}</div>
              <div class="admin-marketing-code-card__meta">使用者：{{ item.usedByUser?.name || item.usedByUser?.email || item.usedByUser?.phone || '暂无' }}</div>
              <div class="admin-marketing-code-card__meta">使用时间：{{ formatDateText(item.usedAt) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminPageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AdminPagination from '@/components/admin/common/AdminPagination.vue'
import AdminPageContainer from '@/components/admin/layout/AdminPageContainer.vue'
import {
  createCardBatch,
  createMembershipLevel,
  createMembershipPlan,
  createRechargePackage,
  createRewardRule,
  deleteCardBatch,
  deleteMembershipLevel,
  deleteMembershipPlan,
  deleteRechargePackage,
  deleteRewardRule,
  getAdminMarketingOverview,
  listAdminPointLogs,
  listCardBatches,
  listCardCodesByBatch,
  listMembershipLevels,
  listMembershipPlans,
  listRechargePackages,
  listRewardRules,
  executePointCompensation,
  updateCardBatch,
  updateMembershipLevel,
  updateMembershipPlan,
  updateRechargePackage,
  updateRewardRule,
  type AdminMarketingOverview,
  type CardBatchItem,
  type CardCodeItem,
  type AdminPointLogItem,
  type AdminPointLogListResult,
  type MembershipLevelItem,
  type MembershipPlanBillingItem,
  type MembershipPlanItem,
  type RechargePackageItem,
  type RewardRuleItem,
} from '@/api/admin-marketing'
import { formatMoney, normalizeMoneyString, toMoneyNumber } from '@/utils/money'

// 营销中心四个核心工具。
type MarketingToolKey = 'membership' | 'recharge' | 'rewards' | 'cdk' | 'compensation'

const overview = ref<AdminMarketingOverview | null>(null)
const levels = ref<MembershipLevelItem[]>([])
const plans = ref<MembershipPlanItem[]>([])
const packages = ref<RechargePackageItem[]>([])
const rewardRules = ref<RewardRuleItem[]>([])
const cardBatches = ref<CardBatchItem[]>([])
const cardCodes = ref<CardCodeItem[]>([])
const pointLogs = ref<AdminPointLogItem[]>([])

const loading = ref(false)
const submitting = ref(false)
const codesLoading = ref(false)
const compensationLoading = ref(false)
const compensationSubmitting = ref(false)
const pointLogCopiedKey = ref('')
const activeTool = ref<MarketingToolKey>('membership')
const selectedCompensationAssociationNos = ref<string[]>([])
const pointLogQuery = reactive({
  days: 30,
  action: '',
  sourceType: '',
  endpointType: '',
  refundStatus: '',
  keyword: '',
})
const pointLogPagination = reactive({
  page: 1,
  pageSize: 10,
})
const compensationForm = reactive({
  manualAssociationNos: '',
  note: '',
  forceManual: false,
})
const pointLogSummary = reactive<AdminPointLogListResult['summary']>({
  totalCount: 0,
  compensableCount: 0,
  refundCount: 0,
  windowDays: 30,
  page: 1,
  pageSize: 10,
  totalPages: 1,
})

const marketingTools = computed(() => [
  {
    key: 'membership' as MarketingToolKey,
    icon: '👑',
    title: '会员订阅',
    description: '自行设置会员等级与订阅规则',
    meta: () => `${levels.value.length} 个等级 / ${plans.value.length} 个计划`,
  },
  {
    key: 'recharge' as MarketingToolKey,
    icon: '💎',
    title: '积分充值',
    description: '支持多充多送，提升复购转化',
    meta: () => `${packages.value.length} 个可售套餐`,
  },
  {
    key: 'rewards' as MarketingToolKey,
    icon: '🎁',
    title: '奖励中心',
    description: '登录、注册、签到奖励统一管理',
    meta: () => `${rewardRules.value.length} 条奖励规则`,
  },
  {
    key: 'cdk' as MarketingToolKey,
    icon: '🪪',
    title: '卡密兑换',
    description: '批量生成卡密并投放运营活动',
    meta: () => `${cardBatches.value.length} 个批次`,
  },
  {
    key: 'compensation' as MarketingToolKey,
    icon: '🧾',
    title: '积分流水',
    description: '查看积分明细、筛选状态并处理失败补偿',
    meta: () => `${pointLogSummary.totalCount} 条流水 / 可补偿 ${pointLogSummary.compensableCount} 条`,
  },
])

const currentToolInfo = computed(() => {
  if (activeTool.value === 'membership') {
    return {
      title: '会员订阅',
      description: '管理会员等级、订阅计划与长期权益体系',
      focus: '适合处理等级成长、订阅商品、月赠积分和会员差异化权益。',
      meta: `${levels.value.length} 个等级 / ${plans.value.length} 个计划`,
    }
  }
  if (activeTool.value === 'recharge') {
    return {
      title: '积分充值',
      description: '管理积分商品、赠送策略和促销包装',
      focus: '适合处理价格带设计、多充多送和运营售卖包装。',
      meta: `${packages.value.length} 个套餐在线管理`,
    }
  }
  if (activeTool.value === 'rewards') {
    return {
      title: '奖励中心',
      description: '管理登录、注册、签到等激励触发规则',
      focus: '适合做拉新、留存、签到等轻运营激励编排。',
      meta: `${rewardRules.value.length} 条规则生效中`,
    }
  }
  if (activeTool.value === 'cdk') {
    return {
      title: '卡密兑换',
      description: '管理批次投放、卡密发放与兑换追踪',
      focus: '适合活动发码、渠道合作、定向补贴等场景。',
      meta: `${cardBatches.value.length} 个批次 / ${cardCodes.value.length} 条卡密缓存`,
    }
  }
  return {
    title: '积分流水',
    description: '查看积分明细、筛选状态并处理失败补偿',
    focus: '适合运营核对每一笔积分变动，并在失败未退款的生成流水上直接执行补偿。',
    meta: `${pointLogSummary.totalCount} 条流水 / 可补偿 ${pointLogSummary.compensableCount} 条`,
  }
})

const createLevelForm = () => ({
  name: '',
  level: Math.max(levels.value.length + 1, 1),
  description: '',
  iconUrl: '',
  monthlyBonusPoints: 0,
  storageCapacity: 0,
  benefitsJsonText: '[]',
  isEnabled: true,
  sortOrder: levels.value.length,
})

const createPlanBillingRule = () => ({
  levelId: '',
  salesPrice: '0',
  originalPrice: '',
  label: '',
  status: true,
})

const createPlanForm = () => ({
  name: '',
  label: '',
  description: '',
  durationValue: 1,
  durationUnit: 'MONTH',
  bonusPoints: 0,
  billingRules: [createPlanBillingRule()],
  benefitsJsonText: '[]',
  isEnabled: true,
  sortOrder: plans.value.length,
})

const createPackageForm = () => ({
  name: '',
  label: '',
  description: '',
  points: 0,
  bonusPoints: 0,
  // 价格字段保留字符串中间态，避免 number 修饰符吞掉小数点和清空输入。
  price: '0',
  originalPrice: '0',
  badgeText: '',
  // 充值卡片底部权益文案按行编辑，提交时写入 metaJson.benefits。
  benefitsText: '',
  isEnabled: true,
  sortOrder: packages.value.length,
  metaJsonText: '{}',
})

const createRewardForm = () => ({
  code: '',
  triggerType: 'LOGIN',
  name: '',
  description: '',
  rewardPoints: 0,
  cycleType: 'DAILY',
  limitPerCycle: 1,
  isEnabled: true,
  conditionJsonText: '{}',
  sortOrder: rewardRules.value.length,
})

const createBatchForm = () => ({
  name: '',
  batchNo: '',
  description: '',
  rewardType: 'POINTS',
  rewardPoints: 0,
  rewardLevelId: '',
  rewardDays: 30,
  totalCount: 10,
  expiresAt: '',
  isEnabled: true,
  metaJsonText: '{}',
})

const levelDialogVisible = ref(false)
const levelEditingId = ref('')
const levelForm = reactive(createLevelForm())

const planDialogVisible = ref(false)
const planEditingId = ref('')
const planForm = reactive(createPlanForm())

const packageDialogVisible = ref(false)
const packageEditingId = ref('')
const packageForm = reactive(createPackageForm())

const rewardDialogVisible = ref(false)
const rewardEditingId = ref('')
const rewardForm = reactive(createRewardForm())

const batchDialogVisible = ref(false)
const batchEditingId = ref('')
const batchForm = reactive(createBatchForm())

const codesDialogVisible = ref(false)
const currentBatch = ref<CardBatchItem | null>(null)
const manualCompensationDialogVisible = ref(false)

// 用于把表单重置为最新初始值，避免多次弹窗编辑残留脏数据。
const assignForm = <T extends Record<string, any>>(target: T, source: T) => {
  Object.assign(target, source)
}

const parseJsonText = (value: string, fallback: unknown) => {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return fallback
  }
  return JSON.parse(normalized)
}

const formatJsonText = (value: unknown, fallback = '{}') => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return fallback
  }
}


// 充值套餐底部权益文案统一读写 metaJson.benefits，后台按多行文本编辑更直观。
const parsePackageBenefitsText = (metaJson: unknown) => {
  if (!metaJson || typeof metaJson !== 'object') {
    return ''
  }
  const benefits = (metaJson as Record<string, unknown>).benefits
  if (!Array.isArray(benefits)) {
    return ''
  }
  return benefits
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n')
}

const mergePackageMetaJson = (metaJsonText: string, benefitsText: string) => {
  const parsed = parseJsonText(metaJsonText, {})
  const base = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, unknown>) }
    : {}
  const benefits = String(benefitsText || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  if (benefits.length) {
    base.benefits = benefits
  } else {
    delete base.benefits
  }

  return base
}

const toDatetimeLocalValue = (value: string | null | undefined) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

// 统一解析价格输入，兼容字符串小数、空值和中文逗号。
const parseDecimalInput = (value: string | number | null | undefined) => {
  const normalized = normalizeMoneyString(value, '').replace(/，/g, '.').replace(/[^\d.-]/g, '')
  return toMoneyNumber(normalized, 0)
}

// 原价允许留空，不强制回落为 0。
const parseOptionalDecimalInput = (value: string | number | null | undefined) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return null
  }
  const numeric = parseDecimalInput(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

const appendPlanBillingRule = () => {
  planForm.billingRules.push(createPlanBillingRule())
}

const removePlanBillingRule = (index: number) => {
  if (planForm.billingRules.length <= 1) {
    planForm.billingRules.splice(0, planForm.billingRules.length, createPlanBillingRule())
    return
  }
  planForm.billingRules.splice(index, 1)
}

const getPlanBillingSummary = (billingRules?: MembershipPlanBillingItem[]) => {
  const enabledRules = Array.isArray(billingRules) ? billingRules.filter((item) => item.status !== false) : []
  if (!enabledRules.length) {
    return '暂无计费规则'
  }
  return `计费 ${enabledRules.length} 档 · ${enabledRules.map((item) => `${item.level?.name || '未命名等级'} ${formatMoney(item.salesPrice)}`).join(' / ')}`
}

const formatDateText = (value: string | null | undefined) => {
  if (!value) {
    return '未设置'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '未设置'
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}

const getDurationUnitLabel = (value: string) => {
  if (value === 'DAY') return '天'
  if (value === 'YEAR') return '年'
  return '月'
}

const getRewardTriggerLabel = (value: string) => {
  if (value === 'REGISTER' || value === 'REGISTER_ONCE') return '注册奖励'
  if (value === 'CHECKIN' || value === 'CHECKIN_DAILY') return '签到奖励'
  return '登录奖励'
}

const getCycleTypeLabel = (value: string) => {
  if (value === 'ONCE') return '仅一次'
  if (value === 'WEEKLY') return '每周'
  if (value === 'MONTHLY') return '每月'
  return '每日'
}

const getCardRewardSummary = (item: CardBatchItem) => {
  if (item.rewardType === 'MEMBERSHIP') {
    return `${item.rewardLevel?.name || '会员权益'} ${item.rewardDays || 0} 天`
  }
  return `${item.rewardPoints} 积分`
}

const parseAssociationNoList = (value: string) => {
  return Array.from(new Set(
    String(value || '')
      .split(/[\n,，\s]+/g)
      .map((item) => item.trim())
      .filter(Boolean),
  ))
}

const toggleCompensationSelection = (associationNo: string) => {
  const current = new Set(selectedCompensationAssociationNos.value)
  if (current.has(associationNo)) {
    current.delete(associationNo)
  } else {
    current.add(associationNo)
  }
  selectedCompensationAssociationNos.value = Array.from(current)
}

// 统一处理后台复制动作，优先使用 Clipboard API，失败时自动回退到选区复制。
const copyText = async (value: string) => {
  const text = String(value || '').trim()
  if (!text) {
    throw new Error('empty_text')
  }

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  textArea.style.pointerEvents = 'none'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textArea)
  if (!copied) {
    throw new Error('copy_failed')
  }
}

const buildPointLogCopyKey = (field: 'user' | 'association', recordId: string) => {
  return `${field}:${recordId}`
}

const resolveCopyButtonText = (field: 'user' | 'association', recordId: string, fallback: string) => {
  return pointLogCopiedKey.value === buildPointLogCopyKey(field, recordId) ? '已复制' : fallback
}

const handleCopyPointLogText = async (field: 'user' | 'association', recordId: string, value: string) => {
  try {
    await copyText(value)
    const currentKey = buildPointLogCopyKey(field, recordId)
    pointLogCopiedKey.value = currentKey
    window.setTimeout(() => {
      if (pointLogCopiedKey.value === currentKey) {
        pointLogCopiedKey.value = ''
      }
    }, 1600)
  } catch {
    window.alert('复制失败，请稍后重试。')
  }
}

const openManualCompensationDialog = () => {
  manualCompensationDialogVisible.value = true
}

const closeManualCompensationDialog = () => {
  manualCompensationDialogVisible.value = false
}

const loadPointLogs = async () => {
  compensationLoading.value = true
  try {
    const result = await listAdminPointLogs({
      ...pointLogQuery,
      page: pointLogPagination.page,
      pageSize: pointLogPagination.pageSize,
    })
    pointLogs.value = Array.isArray(result.items) ? result.items : []
    pointLogSummary.totalCount = Number(result.summary?.totalCount || 0)
    pointLogSummary.compensableCount = Number(result.summary?.compensableCount || 0)
    pointLogSummary.refundCount = Number(result.summary?.refundCount || 0)
    pointLogSummary.windowDays = Number(result.summary?.windowDays || pointLogQuery.days)
    pointLogSummary.page = Number(result.summary?.page || pointLogPagination.page)
    pointLogSummary.pageSize = Number(result.summary?.pageSize || pointLogPagination.pageSize)
    pointLogSummary.totalPages = Number(result.summary?.totalPages || 1)
    selectedCompensationAssociationNos.value = selectedCompensationAssociationNos.value
      .filter((item) => pointLogs.value.some((log) => log.associationNo === item && log.canCompensate))
    pointLogPagination.page = pointLogSummary.page
    pointLogPagination.pageSize = pointLogSummary.pageSize
  } finally {
    compensationLoading.value = false
  }
}

const handleApplyPointLogFilters = async () => {
  pointLogPagination.page = 1
  await loadPointLogs()
}

const handleResetPointLogFilters = async () => {
  pointLogQuery.keyword = ''
  pointLogQuery.action = ''
  pointLogQuery.sourceType = ''
  pointLogQuery.endpointType = ''
  pointLogQuery.refundStatus = ''
  pointLogQuery.days = 30
  pointLogPagination.page = 1
  await loadPointLogs()
}

const handlePointLogPaginationChange = async (payload: { page: number; pageSize: number }) => {
  pointLogPagination.page = payload.page
  pointLogPagination.pageSize = payload.pageSize
  await loadPointLogs()
}

const fillLegacyCompensationExample = () => {
  compensationForm.manualAssociationNos = [
    'GTK1777512523146OM0MFW',
    'GTK1777512456545MH6GTH',
  ].join('\n')
  if (!compensationForm.note) {
    compensationForm.note = '补偿修复前产生的对话失败未退款历史流水'
  }
  compensationForm.forceManual = true
}

const handleExecuteSelectedPointLogCompensation = async () => {
  if (!selectedCompensationAssociationNos.value.length) {
    window.alert('请先选择需要补偿的流水记录。')
    return
  }
  if (!window.confirm(`确认补偿已选中的 ${selectedCompensationAssociationNos.value.length} 条积分流水吗？`)) {
    return
  }

  compensationSubmitting.value = true
  try {
    const result = await executePointCompensation({
      associationNos: selectedCompensationAssociationNos.value,
      note: compensationForm.note || '后台手动补偿失败未退款任务',
      forceManual: false,
    })
    selectedCompensationAssociationNos.value = []
    await loadPointLogs()
    window.alert(`补偿完成：成功 ${result.refundedCount} 条，跳过 ${result.skippedCount} 条。`)
  } finally {
    compensationSubmitting.value = false
  }
}

const handleExecuteSinglePointLogCompensation = async (associationNo: string) => {
  if (!associationNo) {
    return
  }
  if (!window.confirm(`确认补偿流水 ${associationNo} 吗？`)) {
    return
  }
  compensationSubmitting.value = true
  try {
    const result = await executePointCompensation({
      associationNos: [associationNo],
      note: compensationForm.note || '后台单条失败补偿',
      forceManual: false,
    })
    await loadPointLogs()
    window.alert(`补偿完成：成功 ${result.refundedCount} 条，跳过 ${result.skippedCount} 条。`)
  } finally {
    compensationSubmitting.value = false
  }
}

const handleExecuteManualCompensation = async () => {
  const associationNos = parseAssociationNoList(compensationForm.manualAssociationNos)
  if (!associationNos.length) {
    window.alert('请先输入至少一个关联号。')
    return
  }
  if (!window.confirm(`确认手动补偿 ${associationNos.length} 条流水吗？该操作会直接补回积分。`)) {
    return
  }

  compensationSubmitting.value = true
  try {
    const result = await executePointCompensation({
      associationNos,
      note: compensationForm.note || '后台手动补偿历史漏账',
      forceManual: compensationForm.forceManual,
    })
    compensationForm.manualAssociationNos = ''
    compensationForm.note = ''
    compensationForm.forceManual = false
    closeManualCompensationDialog()
    await loadPointLogs()
    window.alert(`手动补偿完成：成功 ${result.refundedCount} 条，跳过 ${result.skippedCount} 条。`)
  } finally {
    compensationSubmitting.value = false
  }
}

const getPointLogTitle = (item: AdminPointLogItem) => {
  if (item.remark) {
    return item.remark
  }
  if (item.sourceType === 'RECHARGE_ORDER') return '充值到账'
  if (item.sourceType === 'MEMBERSHIP_ORDER') return '订阅积分到账'
  if (item.sourceType === 'CHECKIN') return '签到奖励'
  if (item.sourceType === 'CARD_REDEEM') return '卡密兑换'
  if (item.sourceType === 'REWARD_RULE') return '奖励规则发放'
  return '积分流水'
}

const resolvePointLogUserText = (item: AdminPointLogItem) => {
  if (item.userName) {
    if (item.userPhone) {
      return `${item.userName}（${item.userPhone}）`
    }
    if (item.userEmail) {
      return `${item.userName}（${item.userEmail}）`
    }
    return item.userName
  }
  return item.userPhone || item.userEmail || '未知用户'
}

const resolvePointLogStatusText = (item: AdminPointLogItem) => {
  if (item.canCompensate) return '待补偿'
  if (item.refunded) return '已退款'
  if (item.generationStatus === 'FAILED') return '失败未退'
  if (item.generationStatus === 'STOPPED') return '停止未退'
  return item.action === 'DECREASE' ? '已支出' : '已入账'
}

const resolvePointLogStatusClass = (item: AdminPointLogItem) => {
  if (item.canCompensate) return 'admin-status--warning'
  if (item.refunded) return 'admin-status--success'
  return item.action === 'DECREASE' ? 'admin-status--muted' : 'admin-status--success'
}

const loadAllData = async () => {
  loading.value = true
  try {
    const [overviewData, levelData, planData, packageData, rewardData, batchData, pointLogData] = await Promise.all([
      getAdminMarketingOverview(),
      listMembershipLevels(),
      listMembershipPlans(),
      listRechargePackages(),
      listRewardRules(),
      listCardBatches(),
      listAdminPointLogs({
        ...pointLogQuery,
        page: pointLogPagination.page,
        pageSize: pointLogPagination.pageSize,
      }),
    ])
    overview.value = overviewData
    levels.value = levelData
    plans.value = planData
    packages.value = packageData
    rewardRules.value = rewardData
    cardBatches.value = batchData
    pointLogs.value = Array.isArray(pointLogData.items) ? pointLogData.items : []
    pointLogSummary.totalCount = Number(pointLogData.summary?.totalCount || 0)
    pointLogSummary.compensableCount = Number(pointLogData.summary?.compensableCount || 0)
    pointLogSummary.refundCount = Number(pointLogData.summary?.refundCount || 0)
    pointLogSummary.windowDays = Number(pointLogData.summary?.windowDays || pointLogQuery.days)
    pointLogSummary.page = Number(pointLogData.summary?.page || pointLogPagination.page)
    pointLogSummary.pageSize = Number(pointLogData.summary?.pageSize || pointLogPagination.pageSize)
    pointLogSummary.totalPages = Number(pointLogData.summary?.totalPages || 1)
    selectedCompensationAssociationNos.value = selectedCompensationAssociationNos.value
      .filter((item) => pointLogs.value.some((log) => log.associationNo === item && log.canCompensate))
    pointLogPagination.page = pointLogSummary.page
    pointLogPagination.pageSize = pointLogSummary.pageSize
  } finally {
    loading.value = false
  }
}

const openLevelDialog = (item?: MembershipLevelItem) => {
  levelEditingId.value = item?.id || ''
  assignForm(levelForm, item ? {
    name: item.name,
    level: item.level,
    description: item.description || '',
    iconUrl: item.iconUrl || '',
    monthlyBonusPoints: item.monthlyBonusPoints,
    storageCapacity: Number(item.storageCapacity || 0),
    benefitsJsonText: formatJsonText(item.benefitsJson, '[]'),
    isEnabled: item.isEnabled,
    sortOrder: item.sortOrder,
  } : createLevelForm())
  levelDialogVisible.value = true
}

const closeLevelDialog = () => {
  levelDialogVisible.value = false
  levelEditingId.value = ''
  assignForm(levelForm, createLevelForm())
}

const handleSubmitLevel = async () => {
  submitting.value = true
  try {
    const payload = {
      name: levelForm.name,
      level: Number(levelForm.level || 1),
      description: levelForm.description || '',
      iconUrl: levelForm.iconUrl || '',
      monthlyBonusPoints: Number(levelForm.monthlyBonusPoints || 0),
      storageCapacity: Number(levelForm.storageCapacity || 0),
      benefitsJson: parseJsonText(levelForm.benefitsJsonText, []),
      isEnabled: Boolean(levelForm.isEnabled),
      sortOrder: Number(levelForm.sortOrder || 0),
    }
    if (levelEditingId.value) {
      await updateMembershipLevel(levelEditingId.value, payload)
    } else {
      await createMembershipLevel(payload)
    }
    closeLevelDialog()
    await loadAllData()
  } finally {
    submitting.value = false
  }
}

const handleDeleteLevel = async (item: MembershipLevelItem) => {
  if (!window.confirm(`确认删除会员等级“${item.name}”吗？`)) {
    return
  }
  await deleteMembershipLevel(item.id)
  await loadAllData()
}

const openPlanDialog = (item?: MembershipPlanItem) => {
  planEditingId.value = item?.id || ''
  assignForm(planForm, item ? {
    name: item.name,
    label: item.label || '',
    description: item.description || '',
    durationValue: item.durationValue,
    durationUnit: item.durationUnit || 'MONTH',
    bonusPoints: item.bonusPoints,
    billingRules: Array.isArray(item.billingRules) && item.billingRules.length
      ? item.billingRules.map((rule) => ({
          levelId: rule.levelId || '',
          salesPrice: normalizeMoneyString(rule.salesPrice),
          originalPrice: rule.originalPrice === null || rule.originalPrice === undefined ? '' : normalizeMoneyString(rule.originalPrice),
          label: rule.label || '',
          status: rule.status !== false,
        }))
      : [createPlanBillingRule()],
    benefitsJsonText: formatJsonText(item.benefitsJson, '[]'),
    isEnabled: item.isEnabled,
    sortOrder: item.sortOrder,
  } : createPlanForm())
  planDialogVisible.value = true
}

const closePlanDialog = () => {
  planDialogVisible.value = false
  planEditingId.value = ''
  assignForm(planForm, createPlanForm())
}

const handleSubmitPlan = async () => {
  submitting.value = true
  try {
    const payload = {
      name: planForm.name,
      label: planForm.label || '',
      description: planForm.description || '',
      durationType: planForm.durationUnit === 'YEAR' ? 'YEAR' : planForm.durationUnit === 'MONTH' && Number(planForm.durationValue || 1) === 12 ? 'YEAR' : planForm.durationUnit === 'MONTH' && Number(planForm.durationValue || 1) === 6 ? 'HALF_YEAR' : planForm.durationUnit === 'MONTH' && Number(planForm.durationValue || 1) === 3 ? 'QUARTER' : planForm.durationUnit === 'MONTH' && Number(planForm.durationValue || 1) === 1 ? 'MONTH' : 'CUSTOM',
      durationValue: Number(planForm.durationValue || 1),
      durationUnit: planForm.durationUnit,
      bonusPoints: Number(planForm.bonusPoints || 0),
      billingRules: planForm.billingRules.map((rule) => ({
        levelId: rule.levelId,
        salesPrice: parseDecimalInput(rule.salesPrice),
        originalPrice: parseOptionalDecimalInput(rule.originalPrice),
        label: rule.label || '',
        status: Boolean(rule.status),
      })).filter((rule) => rule.levelId),
      benefitsJson: parseJsonText(planForm.benefitsJsonText, []),
      isEnabled: Boolean(planForm.isEnabled),
      sortOrder: Number(planForm.sortOrder || 0),
    }
    if (planEditingId.value) {
      await updateMembershipPlan(planEditingId.value, payload)
    } else {
      await createMembershipPlan(payload)
    }
    closePlanDialog()
    await loadAllData()
  } finally {
    submitting.value = false
  }
}

const handleDeletePlan = async (item: MembershipPlanItem) => {
  if (!window.confirm(`确认删除会员计划“${item.name}”吗？`)) {
    return
  }
  await deleteMembershipPlan(item.id)
  await loadAllData()
}

const openPackageDialog = (item?: RechargePackageItem) => {
  packageEditingId.value = item?.id || ''
  assignForm(packageForm, item ? {
    name: item.name,
    label: item.label || '',
    description: item.description || '',
    points: item.points,
    bonusPoints: item.bonusPoints,
    price: normalizeMoneyString(item.price),
    originalPrice: item.originalPrice === null || item.originalPrice === undefined ? '' : normalizeMoneyString(item.originalPrice),
    badgeText: item.badgeText || '',
    benefitsText: parsePackageBenefitsText(item.metaJson),
    isEnabled: item.isEnabled,
    sortOrder: item.sortOrder,
    metaJsonText: formatJsonText(item.metaJson, '{}'),
  } : createPackageForm())
  packageDialogVisible.value = true
}

const closePackageDialog = () => {
  packageDialogVisible.value = false
  packageEditingId.value = ''
  assignForm(packageForm, createPackageForm())
}

const handleSubmitPackage = async () => {
  submitting.value = true
  try {
    const payload = {
      name: packageForm.name,
      label: packageForm.label || '',
      description: packageForm.description || '',
      points: Number(packageForm.points || 0),
      bonusPoints: Number(packageForm.bonusPoints || 0),
      price: parseDecimalInput(packageForm.price),
      originalPrice: parseOptionalDecimalInput(packageForm.originalPrice),
      badgeText: packageForm.badgeText || '',
      isEnabled: Boolean(packageForm.isEnabled),
      sortOrder: Number(packageForm.sortOrder || 0),
      metaJson: mergePackageMetaJson(packageForm.metaJsonText, packageForm.benefitsText),
    }
    if (packageEditingId.value) {
      await updateRechargePackage(packageEditingId.value, payload)
    } else {
      await createRechargePackage(payload)
    }
    closePackageDialog()
    await loadAllData()
  } finally {
    submitting.value = false
  }
}

const handleDeletePackage = async (item: RechargePackageItem) => {
  if (!window.confirm(`确认删除充值套餐“${item.name}”吗？`)) {
    return
  }
  await deleteRechargePackage(item.id)
  await loadAllData()
}

const openRewardDialog = (item?: RewardRuleItem) => {
  rewardEditingId.value = item?.id || ''
  assignForm(rewardForm, item ? {
    code: item.code,
    triggerType: item.triggerType,
    name: item.name,
    description: item.description || '',
    rewardPoints: item.rewardPoints,
    cycleType: item.cycleType,
    limitPerCycle: item.limitPerCycle,
    isEnabled: item.isEnabled,
    conditionJsonText: formatJsonText(item.conditionJson, '{}'),
    sortOrder: item.sortOrder,
  } : createRewardForm())
  rewardDialogVisible.value = true
}

const closeRewardDialog = () => {
  rewardDialogVisible.value = false
  rewardEditingId.value = ''
  assignForm(rewardForm, createRewardForm())
}

const handleSubmitReward = async () => {
  submitting.value = true
  try {
    const payload = {
      code: rewardForm.code,
      triggerType: rewardForm.triggerType,
      name: rewardForm.name,
      description: rewardForm.description || '',
      rewardPoints: Number(rewardForm.rewardPoints || 0),
      cycleType: rewardForm.cycleType,
      limitPerCycle: Number(rewardForm.limitPerCycle || 1),
      isEnabled: Boolean(rewardForm.isEnabled),
      conditionJson: parseJsonText(rewardForm.conditionJsonText, {}),
      sortOrder: Number(rewardForm.sortOrder || 0),
    }
    if (rewardEditingId.value) {
      await updateRewardRule(rewardEditingId.value, payload)
    } else {
      await createRewardRule(payload)
    }
    closeRewardDialog()
    await loadAllData()
  } finally {
    submitting.value = false
  }
}

const handleDeleteReward = async (item: RewardRuleItem) => {
  if (!window.confirm(`确认删除奖励规则“${item.name}”吗？`)) {
    return
  }
  await deleteRewardRule(item.id)
  await loadAllData()
}

const openBatchDialog = (item?: CardBatchItem) => {
  batchEditingId.value = item?.id || ''
  assignForm(batchForm, item ? {
    name: item.name,
    batchNo: item.batchNo,
    description: item.description || '',
    rewardType: item.rewardType,
    rewardPoints: item.rewardPoints,
    rewardLevelId: item.rewardLevelId || '',
    rewardDays: item.rewardDays || 30,
    totalCount: item.totalCount,
    expiresAt: toDatetimeLocalValue(item.expiresAt),
    isEnabled: item.isEnabled,
    metaJsonText: formatJsonText(item.metaJson, '{}'),
  } : createBatchForm())
  batchDialogVisible.value = true
}

const closeBatchDialog = () => {
  batchDialogVisible.value = false
  batchEditingId.value = ''
  assignForm(batchForm, createBatchForm())
}

const handleSubmitBatch = async () => {
  submitting.value = true
  try {
    const payload = {
      name: batchForm.name,
      batchNo: batchForm.batchNo,
      description: batchForm.description || '',
      rewardType: batchForm.rewardType,
      rewardPoints: batchForm.rewardType === 'POINTS' ? Number(batchForm.rewardPoints || 0) : 0,
      rewardLevelId: batchForm.rewardType === 'MEMBERSHIP' ? batchForm.rewardLevelId : '',
      rewardDays: batchForm.rewardType === 'MEMBERSHIP' ? Number(batchForm.rewardDays || 30) : null,
      totalCount: Number(batchForm.totalCount || 1),
      expiresAt: batchForm.expiresAt ? new Date(batchForm.expiresAt).toISOString() : '',
      isEnabled: Boolean(batchForm.isEnabled),
      metaJson: parseJsonText(batchForm.metaJsonText, {}),
    }
    if (batchEditingId.value) {
      await updateCardBatch(batchEditingId.value, payload)
    } else {
      await createCardBatch(payload)
    }
    closeBatchDialog()
    await loadAllData()
  } finally {
    submitting.value = false
  }
}

const handleDeleteBatch = async (item: CardBatchItem) => {
  if (!window.confirm(`确认删除卡密批次“${item.name}”吗？此操作会删除批次下所有卡密。`)) {
    return
  }
  await deleteCardBatch(item.id)
  await loadAllData()
}

const openCodesDialog = async (item: CardBatchItem) => {
  currentBatch.value = item
  codesDialogVisible.value = true
  codesLoading.value = true
  try {
    cardCodes.value = await listCardCodesByBatch(item.id)
  } finally {
    codesLoading.value = false
  }
}

const closeCodesDialog = () => {
  codesDialogVisible.value = false
  currentBatch.value = null
  cardCodes.value = []
}

onMounted(() => {
  void loadAllData()
})
</script>


<style scoped>
.admin-marketing-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: 18px;
  margin-bottom: 20px;
}

.admin-marketing-hero__main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid var(--line-divider, #00000014);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--brand-main-default) 12%, transparent), transparent 32%),
    linear-gradient(180deg, color-mix(in srgb, var(--brand-main-block-default) 28%, var(--bg-surface)), var(--bg-surface));
}

.admin-marketing-hero__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--brand-main-default);
}

.admin-marketing-hero__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.3;
  color: var(--text-primary);
}

.admin-marketing-hero__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.admin-marketing-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.admin-marketing-hero__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.admin-marketing-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.admin-marketing-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-marketing-sidebar-card {
  position: sticky;
  top: 20px;
}

.admin-marketing-main {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.admin-marketing-main__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid var(--line-divider, #00000014);
  background: var(--bg-surface);
}

.admin-marketing-main__title {
  margin: 0 0 6px;
  font-size: 22px;
  line-height: 1.35;
  color: var(--text-primary);
}

.admin-marketing-main__desc,
.admin-marketing-main__meta {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.admin-marketing-main__meta {
  white-space: nowrap;
}

.admin-marketing-section-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.admin-marketing-module-card {
  border-radius: 22px;
}

.admin-marketing-package-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 2px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
}

.admin-marketing-package-card__footer-text {
  white-space: nowrap;
}

.admin-marketing-log-toolbar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 16px;
  background: var(--bg-block-primary-default, rgba(255, 255, 255, 0.03));
}

.admin-marketing-log-toolbar__search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.admin-marketing-log-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-marketing-log-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.admin-marketing-log-filter-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.admin-marketing-log-filter-field--search {
  min-width: 0;
}

.admin-marketing-log-filter-field__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.admin-marketing-log-filter-field__control {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 12px;
  background: var(--bg-surface);
  color: var(--text-primary);
  box-sizing: border-box;
  transition: border-color .2s ease, box-shadow .2s ease, background-color .2s ease;
}

.admin-marketing-log-filter-field__control:focus {
  border-color: color-mix(in srgb, var(--brand-main-default) 48%, var(--line-divider, #00000014));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-main-default) 14%, transparent);
  outline: none;
}

.admin-marketing-log-filter-field__control.admin-input {
  padding: 0 14px;
}

.admin-marketing-log-filter-field__control.admin-select {
  padding: 0 42px 0 14px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  cursor: pointer;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--text-tertiary) 50%),
    linear-gradient(135deg, var(--text-tertiary) 50%, transparent 50%),
    linear-gradient(to right, color-mix(in srgb, var(--line-divider, #00000014) 100%, transparent), color-mix(in srgb, var(--line-divider, #00000014) 100%, transparent));
  background-position:
    calc(100% - 18px) calc(50% - 3px),
    calc(100% - 12px) calc(50% - 3px),
    calc(100% - 38px) 50%;
  background-size:
    6px 6px,
    6px 6px,
    1px 18px;
  background-repeat: no-repeat;
}

.admin-marketing-log-filter-field__control.admin-select:hover {
  border-color: color-mix(in srgb, var(--brand-main-default) 26%, var(--line-divider, #00000014));
  background-color: color-mix(in srgb, var(--bg-surface) 92%, var(--brand-main-default) 8%);
}

.admin-marketing-log-filter-field__control.admin-select option {
  color: var(--text-primary);
  background: var(--bg-surface);
}

.admin-marketing-log-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.admin-marketing-log-summary__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 84px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--line-divider, #00000014);
  background: var(--bg-block-primary-default, rgba(255, 255, 255, 0.03));
}

.admin-marketing-log-summary__label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.admin-marketing-log-summary__value {
  font-size: 24px;
  line-height: 1.1;
  color: var(--text-primary);
}

.admin-point-log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-point-log-item {
  grid-template-columns: auto minmax(0, 1.8fr) minmax(180px, 0.7fr) auto;
  gap: 14px;
  align-items: flex-start;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid var(--line-divider, #00000014);
  background: var(--bg-block-primary-default, rgba(255, 255, 255, 0.025));
}

.admin-point-log-item__check {
  padding-top: 4px;
}

.admin-point-log-item__main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.admin-point-log-item__headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-point-log-item__amount {
  white-space: nowrap;
}

.admin-point-log-item__amount.is-increase {
  color: var(--brand-main-default);
}

.admin-point-log-item__amount.is-decrease {
  color: #ff8a65;
}

.admin-point-log-item__meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.admin-point-log-item__copy-button {
  margin-left: 8px;
  padding: 0;
  min-height: auto;
  border: none;
  background: transparent;
  color: var(--brand-main-default);
  font-size: 12px;
  font-weight: 500;
}

.admin-point-log-item__aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.admin-point-log-item__status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.admin-point-log-item__compensation-reason {
  font-size: 12px;
  line-height: 1.6;
  text-align: right;
  color: var(--text-tertiary);
}

.admin-membership-billing-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-membership-billing-item {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-block-primary-default, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--stroke-secondary, rgba(255, 255, 255, 0.08));
}

.admin-form__label--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-membership-billing-switch {
  white-space: nowrap;
}

.admin-compensation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-compensation-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: flex-start;
  cursor: pointer;
}

.admin-compensation-item__check {
  padding-top: 4px;
}

.admin-compensation-item__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-compensation-item__error {
  color: var(--text-danger, #d14343);
}

.admin-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--text-secondary, rgba(15, 23, 42, 0.68));
}

@media (max-width: 1100px) {
  .admin-marketing-hero,
  .admin-marketing-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-marketing-hero__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-marketing-sidebar-card {
    position: static;
  }

  .admin-membership-billing-item {
    grid-template-columns: 1fr 1fr;
  }

  .admin-marketing-log-toolbar__search {
    grid-template-columns: 1fr;
  }

  .admin-marketing-log-toolbar__actions {
    justify-content: flex-end;
  }

  .admin-marketing-log-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-marketing-log-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-point-log-item,
  .admin-compensation-item {
    grid-template-columns: 1fr;
  }

  .admin-point-log-item__aside {
    align-items: flex-start;
  }

  .admin-point-log-item__compensation-reason {
    text-align: left;
  }

  .admin-point-log-item__meta-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .admin-marketing-hero__stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-marketing-main__header {
    flex-direction: column;
  }

  .admin-marketing-main__meta {
    white-space: normal;
  }

  .admin-marketing-log-filters {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-marketing-log-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-marketing-log-toolbar__actions {
    justify-content: stretch;
    flex-direction: column;
  }

  .admin-marketing-log-toolbar__actions .admin-button {
    width: 100%;
  }

  .admin-point-log-item__headline {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
