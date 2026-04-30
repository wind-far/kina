<template>
  <AdminPageContainer title="营销中心" description="集中管理会员订阅、积分充值、卡密兑换与奖励规则。">
    <template #actions>
      <button class="admin-button admin-button--secondary" type="button" :disabled="loading" @click="loadAllData">
        {{ loading ? '刷新中...' : '刷新数据' }}
      </button>
    </template>

    <div class="admin-grid admin-grid--stats">
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
        <div class="admin-marketing-tool__title">{{ tool.title }}</div>
        <div class="admin-marketing-tool__desc">{{ tool.description }}</div>
        <div class="admin-marketing-tool__meta">{{ tool.meta() }}</div>
      </button>
    </div>

    <div v-if="activeTool === 'membership'" class="admin-grid admin-grid--two admin-marketing-panel-grid">
      <div class="admin-card">
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

      <div class="admin-card">
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

    <div v-else-if="activeTool === 'recharge'" class="admin-card">
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
            <div class="admin-provider-tile__actions">
              <button class="admin-inline-button" type="button" @click="openPackageDialog(item)">编辑</button>
              <button class="admin-inline-button admin-inline-button--danger" type="button" @click="handleDeletePackage(item)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTool === 'rewards'" class="admin-card">
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

    <div v-else-if="activeTool === 'cdk'" class="admin-card">
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

    <div v-else class="admin-grid admin-grid--two admin-marketing-panel-grid">
      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">失败未退款候选</h4>
            <div class="admin-card__desc">自动扫描近 {{ compensationQuery.days }} 天内失败或停止、且缺少退款流水的生成任务。</div>
          </div>
          <div class="admin-row-actions">
            <button class="admin-button admin-button--secondary" type="button" :disabled="compensationLoading" @click="loadCompensationCandidates">
              {{ compensationLoading ? '扫描中...' : '重新扫描' }}
            </button>
            <button
              class="admin-button admin-button--primary"
              type="button"
              :disabled="compensationSubmitting || !selectedCompensationAssociationNos.length"
              @click="handleExecuteCandidateCompensation"
            >
              {{ compensationSubmitting ? '执行中...' : `补偿已选 ${selectedCompensationAssociationNos.length} 项` }}
            </button>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-marketing-list-item__badges">
            <span class="admin-chip">候选 {{ compensationSummary.candidateCount }}</span>
            <span class="admin-chip">待补 {{ compensationSummary.totalPointCost }} 积分</span>
            <span class="admin-chip">窗口 {{ compensationSummary.windowDays }} 天</span>
          </div>

          <div v-if="!compensationCandidates.length" class="admin-empty">当前没有自动识别到待补偿记录。</div>
          <div v-else class="admin-list admin-compensation-list">
            <label v-for="item in compensationCandidates" :key="item.associationNo" class="admin-list-item admin-compensation-item">
              <div class="admin-compensation-item__check">
                <input
                  :checked="selectedCompensationAssociationNos.includes(item.associationNo)"
                  type="checkbox"
                  @change="toggleCompensationSelection(item.associationNo)"
                >
              </div>
              <div class="admin-compensation-item__body">
                <div class="admin-list-item__title">{{ item.generationPrompt || '未命名任务' }}</div>
                <div class="admin-list-item__meta">
                  {{ item.endpointType.toUpperCase() }} · {{ item.modelName || item.modelKey }} · {{ item.pointCost }} 积分 · {{ formatDateText(item.consumedAt) }}
                </div>
                <div class="admin-list-item__meta">
                  任务状态 {{ item.generationStatus || '未知' }} · 流水号 {{ item.associationNo }}
                </div>
                <div class="admin-list-item__meta admin-compensation-item__error">{{ item.generationErrorMessage || item.compensationReason }}</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card__header">
          <div>
            <h4 class="admin-card__title">手动补偿</h4>
            <div class="admin-card__desc">用于处理历史遗留漏账或缺少生成记录关联的流水，请按关联号逐条核实后执行。</div>
          </div>
        </div>
        <div class="admin-card__content">
          <div class="admin-form">
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
            <div class="admin-row-actions">
              <button class="admin-button admin-button--secondary" type="button" @click="fillLegacyCompensationExample">填入当前遗留样例</button>
              <button class="admin-button admin-button--primary" type="button" :disabled="compensationSubmitting" @click="handleExecuteManualCompensation">
                {{ compensationSubmitting ? '执行中...' : '执行手动补偿' }}
              </button>
            </div>
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
  listCardBatches,
  listCardCodesByBatch,
  listMembershipLevels,
  listMembershipPlans,
  listPointCompensationCandidates,
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
  type MembershipLevelItem,
  type MembershipPlanBillingItem,
  type MembershipPlanItem,
  type PointCompensationCandidateItem,
  type PointCompensationCandidateResult,
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
const compensationCandidates = ref<PointCompensationCandidateItem[]>([])

const loading = ref(false)
const submitting = ref(false)
const codesLoading = ref(false)
const compensationLoading = ref(false)
const compensationSubmitting = ref(false)
const activeTool = ref<MarketingToolKey>('membership')
const selectedCompensationAssociationNos = ref<string[]>([])
const compensationQuery = reactive({
  days: 30,
  limit: 100,
})
const compensationForm = reactive({
  manualAssociationNos: '',
  note: '',
  forceManual: false,
})
const compensationSummary = reactive<PointCompensationCandidateResult['summary']>({
  candidateCount: 0,
  totalPointCost: 0,
  windowDays: 30,
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
    title: '积分补偿',
    description: '补偿失败未退款任务，处理历史漏账',
    meta: () => `${compensationSummary.candidateCount} 条待处理`,
  },
])

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

const loadCompensationCandidates = async () => {
  compensationLoading.value = true
  try {
    const result = await listPointCompensationCandidates(compensationQuery)
    compensationCandidates.value = Array.isArray(result.items) ? result.items : []
    compensationSummary.candidateCount = Number(result.summary?.candidateCount || 0)
    compensationSummary.totalPointCost = Number(result.summary?.totalPointCost || 0)
    compensationSummary.windowDays = Number(result.summary?.windowDays || compensationQuery.days)
    selectedCompensationAssociationNos.value = selectedCompensationAssociationNos.value
      .filter((item) => compensationCandidates.value.some((candidate) => candidate.associationNo === item))
  } finally {
    compensationLoading.value = false
  }
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

const handleExecuteCandidateCompensation = async () => {
  if (!selectedCompensationAssociationNos.value.length) {
    window.alert('请先选择需要补偿的候选记录。')
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
    await loadCompensationCandidates()
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
    await loadCompensationCandidates()
    window.alert(`手动补偿完成：成功 ${result.refundedCount} 条，跳过 ${result.skippedCount} 条。`)
  } finally {
    compensationSubmitting.value = false
  }
}

const loadAllData = async () => {
  loading.value = true
  try {
    const [overviewData, levelData, planData, packageData, rewardData, batchData, compensationData] = await Promise.all([
      getAdminMarketingOverview(),
      listMembershipLevels(),
      listMembershipPlans(),
      listRechargePackages(),
      listRewardRules(),
      listCardBatches(),
      listPointCompensationCandidates(compensationQuery),
    ])
    overview.value = overviewData
    levels.value = levelData
    plans.value = planData
    packages.value = packageData
    rewardRules.value = rewardData
    cardBatches.value = batchData
    compensationCandidates.value = Array.isArray(compensationData.items) ? compensationData.items : []
    compensationSummary.candidateCount = Number(compensationData.summary?.candidateCount || 0)
    compensationSummary.totalPointCost = Number(compensationData.summary?.totalPointCost || 0)
    compensationSummary.windowDays = Number(compensationData.summary?.windowDays || compensationQuery.days)
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
  .admin-membership-billing-item {
    grid-template-columns: 1fr 1fr;
  }

  .admin-compensation-item {
    grid-template-columns: 1fr;
  }
}
</style>
