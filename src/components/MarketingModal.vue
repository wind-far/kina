<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="lv-modal-wrapper lv-modal-wrapper-align-center domesticModalWrapper-G4rAI_"
      @click.self="closeModal"
    >
      <div class="lv-modal-mask" @click="closeModal"></div>
      <div role="dialog" aria-modal="true" class="lv-modal lv-modal-simple domesticModal-CcAfki">
        <div class="lv-modal-content">
          <div class="outerWrapper-YDl043">
            <div class="wrapper-dTloRs">
              <div class="defaultContentContainer-ZsT7nd">
                <div class="defaultContent-bObVfZ">
                  <div class="title-AZ0SpV">
                    <span class="titleHighlight-1Hxg1W">{{ heroPrimaryText }}</span>
                    <span class="titleWhite-pL9WDI">{{ heroSecondaryText }}</span>
                  </div>
                  <div class="desc-KaZqms">
                    <span>{{ heroDescription }}</span>
                    <button class="getCredits-Y_OSUW" type="button" @click="switchTab('recharge')">购买积分</button>
                    <span class="divider-pIgPeB"></span>
                    <button class="redeem-WAo38f" type="button" @click="switchTab('redeem')">卡密兑换</button>
                  </div>
                </div>
                <div class="rightButtonContainer-CRWw92">
                  <button class="creditBtn-Todove" type="button" @click="openPointsDetailModal">积分详情</button>
                </div>
              </div>

              <div
                class="container-F98one"
                :style="membershipPlans.length ? { '--max-price-tips-char-count': String(getMaxPriceCharCount()) } : undefined"
              >
                <div class="tabs-RmpIGt">
                  <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    class="tabItem-SiOW3q"
                    :class="{ 'selectedTabItem-aDidmJ': activeTab === tab.key }"
                    type="button"
                    @click="switchTab(tab.key)"
                  >
                    <div class="tabText-LeDNDN">{{ tab.label }}</div>
                    <div
                      v-if="tab.badge"
                      class="tabTag-PSs89e"
                      :class="{ 'tabTagHighlight-QqpiuB': activeTab === tab.key, 'tabTagnoActivated-goes2o': activeTab !== tab.key }"
                    >
                      {{ tab.badge }}
                    </div>
                  </button>
                </div>

                <div v-if="isLoadingPanel" class="creditsDesc-irHa5p">正在加载营销权益...</div>

                <template v-else>
                  <div v-if="activeTab === 'membership'" class="priceListContainer-yZzGFk">
                    <div
                      v-for="(plan, planIndex) in membershipDisplayPlans"
                      :key="String(plan.id)"
                      class="priceListItem-jmLrWu"
                    >
                      <div class="price-list-item-wrapper-QTu1QM">
                        <div v-if="isActiveMembershipPlan(plan)" class="selectedMask-kgipMi"></div>
                        <div class="priceListItemContent-f8yA2T">
                          <div class="priceTopWrapper-PO1sPk">
                            <div class="priceTop-FYHAcm">
                              <div class="priceTitle-xo_cbl membershipTitleRow-canana">
                                <div class="membershipTitleMain-canana">
                                  <span v-if="!isZeroPricePlan(plan)" class="membershipSpark-canana">✦</span>
                                  <div class="levelName-kcprWP">{{ getPlanLevelName(plan) }}</div>
                                </div>
                                <div v-if="isFeaturedPlan(plan, planIndex)" class="bestPlan-fJd80q">最划算</div>
                              </div>
                              <div class="priceContainer-EtMXeH membershipPriceRow-canana">
                                <div
                                  class="priceTips-dLW7oc priceTipsWithFixedCurrencySymbolSize-XQdawj membershipPriceMain-canana"
                                  :class="{ 'priceTipsFree-T3GkW0': isZeroPricePlan(plan) }"
                                >
                                  <span>¥</span>
                                  <span>{{ formatMoneyDisplay(plan.salesPrice) }}</span>
                                </div>
                                <div class="cycleTips-r_gMtv membershipCycleTips-canana">{{ getPlanPriceUnitText(plan) }}</div>
                              </div>
                              <div class="priceDesc-yOCFse membershipSubDesc-canana">{{ getMembershipDesc(plan) }}</div>
                            </div>
                          </div>

                          <div class="btnContainer-lv1ARI btnContainerWithoutAutoRenewDesc-f6J_Ai">
                            <div class="btnContainer-lv1ARI">
                              <button
                                class="priceButton-MfMZpC priceButtonWithResourcePositionMaterial-nKxJNx mweb-button-default"
                                :class="getPlanButtonClass(plan, planIndex)"
                                type="button"
                                :disabled="submitting || isZeroPricePlan(plan)"
                                @click="handlePurchaseMembership(plan)"
                              >
                                {{ getPlanButtonText(plan, planIndex) }}
                              </button>
                            </div>
                          </div>

                          <div class="creditsContainer-kZN4Fp">
                            <div class="creditsContent-piPVgX">
                              <div class="creditsInnerContent-ybfrhd">
                                <span>赠送</span>
                                <span class="creditsNumber-em42d3">{{ Number(plan.bonusPoints || 0) }}</span>
                                <span>积分</span>
                              </div>
                            </div>
                            <div class="creditsDesc-irHa5p">{{ getMembershipCreditDesc(plan) }}</div>
                          </div>

                          <div class="benefitsDesc-qy_Zwm">
                            <div v-for="benefit in getPlanBenefits(plan)" :key="benefit">
                              <svg viewBox="0 0 12 20" aria-hidden="true"><path fill="currentColor" d="M4.704 15.122L1.27 11.69l-1.06 1.06 4.494 4.493L11.79 10.157l-1.06-1.06z" /></svg>
                              <span>{{ benefit }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-else-if="activeTab === 'recharge'" class="priceListContainer-yZzGFk">
                    <div
                      v-for="(item, itemIndex) in rechargeDisplayPackages"
                      :key="String(item.id)"
                      class="priceListItem-jmLrWu"
                    >
                      <div class="price-list-item-wrapper-QTu1QM">
                        <div class="priceListItemContent-f8yA2T">
                          <div class="priceTopWrapper-PO1sPk">
                            <div class="priceTop-FYHAcm">
                              <div class="priceTitle-xo_cbl">
                                <div class="levelName-kcprWP">{{ String(item.name || item.label || '积分包') }}</div>
                                <div v-if="isFeaturedRecharge(item, itemIndex)" class="bestPlan-fJd80q">多送</div>
                              </div>
                              <div class="priceContainer-EtMXeH">
                                <div class="priceTips-dLW7oc priceTipsWithFixedCurrencySymbolSize-XQdawj">
                                  <span>{{ Number(item.points || 0) }}</span>
                                </div>
                                <div class="cycleTips-r_gMtv">售价 {{ formatMoney(item.price) }}</div>
                              </div>
                              <div class="priceDesc-yOCFse">{{ getRechargeDesc(item) }}</div>
                            </div>
                          </div>

                          <div class="btnContainer-lv1ARI btnContainerWithoutAutoRenewDesc-f6J_Ai">
                            <div class="btnContainer-lv1ARI">
                              <button
                                class="priceButton-MfMZpC priceButtonWithResourcePositionMaterial-nKxJNx mweb-button-default"
                                :class="getRechargeButtonClass(item, itemIndex)"
                                type="button"
                                :disabled="submitting"
                                @click="handlePurchaseRecharge(item)"
                              >
                                立即充值
                              </button>
                            </div>
                          </div>

                          <div class="creditsContainer-kZN4Fp">
                            <div class="creditsContent-piPVgX">
                              <div class="creditsInnerContent-ybfrhd">
                                <span>赠送</span>
                                <span class="creditsNumber-em42d3">{{ Number(item.bonusPoints || 0) }}</span>
                                <span>积分</span>
                              </div>
                            </div>
                            <div class="creditsDesc-irHa5p">{{ getRechargeCreditDesc(item) }}</div>
                          </div>

                          <div class="benefitsDesc-qy_Zwm">
                            <div v-for="benefit in getRechargeBenefits(item)" :key="benefit">
                              <svg viewBox="0 0 12 20" aria-hidden="true"><path fill="currentColor" d="M4.704 15.122L1.27 11.69l-1.06 1.06 4.494 4.493L11.79 10.157l-1.06-1.06z" /></svg>
                              <span>{{ benefit }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-else-if="activeTab === 'checkin'" class="priceListContainer-yZzGFk checkinLayout-canana">
                    <div class="priceListItem-jmLrWu checkinDashboardCard-canana">
                      <div class="price-list-item-wrapper-QTu1QM">
                        <div class="priceListItemContent-f8yA2T checkinDashboardContent-canana">
                          <div class="priceTopWrapper-PO1sPk">
                            <div class="priceTop-FYHAcm checkinDashboardHead-canana">
                              <div class="priceTitle-xo_cbl">
                                <div class="levelName-kcprWP">{{ getRewardRuleName(primaryRewardRule) }}</div>
                                <div class="bestPlan-fJd80q">限时可领</div>
                              </div>
                              <div class="priceDesc-yOCFse checkinDashboardDesc-canana">{{ hasCheckedInToday ? '今日福利已到账，明日 0 点后可继续领取签到积分。' : '每日签到可领专属积分，连续参与更有日常活跃氛围。' }}</div>
                            </div>
                          </div>

                          <div class="creditsContainer-kZN4Fp checkinDashboardHero-canana">
                            <div class="checkinDashboardAmount-canana">
                              <div class="priceTips-dLW7oc priceTipsWithFixedCurrencySymbolSize-XQdawj">
                                <span>{{ Number(primaryRewardRule.rewardPoints || 0) }}</span>
                              </div>
                              <div class="cycleTips-r_gMtv">今日签到礼包</div>
                            </div>
                            <div class="checkinDashboardMeta-canana">
                              <div class="creditsContent-piPVgX">
                                <div class="creditsInnerContent-ybfrhd">
                                  <span>当前积分</span>
                                  <span class="creditsNumber-em42d3">{{ Number(pointsBalance || 0) }}</span>
                                </div>
                              </div>
                              <div class="creditsDesc-irHa5p">{{ currentCheckinRecord ? `最近领取：${formatDate(currentCheckinRecord.createdAt || currentCheckinRecord.checkinAt)}` : '今日福利待领取，点击右侧按钮立即到账。' }}</div>
                            </div>
                            <div class="checkinDashboardAction-canana">
                              <button
                                class="priceButton-MfMZpC priceButtonWithResourcePositionMaterial-nKxJNx mweb-button-default checkinActionButton-canana"
                                :class="hasCheckedInToday ? 'freeButton-jEPOwF disabled' : 'recommendButton-DTYbz5'"
                                type="button"
                                :disabled="submitting || hasCheckedInToday"
                                @click="handleCheckin"
                              >
                                {{ hasCheckedInToday ? '今日已领取' : '立即领取' }}
                              </button>
                              <div class="creditsDesc-irHa5p">{{ hasCheckedInToday ? '今日奖励已发放，明天记得再来打卡。' : '领取成功后积分将实时发放到账户。' }}</div>
                            </div>
                          </div>

                          <div class="benefitsDesc-qy_Zwm checkinDashboardBenefits-canana">
                            <div v-for="benefit in getRewardBenefits(primaryRewardRule)" :key="benefit">
                              <svg viewBox="0 0 12 20" aria-hidden="true"><path fill="currentColor" d="M4.704 15.122L1.27 11.69l-1.06 1.06 4.494 4.493L11.79 10.157l-1.06-1.06z" /></svg>
                              <span>{{ benefit }}</span>
                            </div>
                          </div>

                          <div v-if="secondaryRewardRules.length" class="checkinRuleGrid-canana">
                            <div
                              v-for="rule in secondaryRewardRules"
                              :key="String(rule.id)"
                              class="creditsContainer-kZN4Fp checkinRulePanel-canana"
                            >
                              <div class="priceTitle-xo_cbl">
                                <div class="levelName-kcprWP">{{ getRewardRuleName(rule) }}</div>
                              </div>
                              <div class="priceDesc-yOCFse">{{ getRewardRuleMeta(rule) }}</div>
                              <div class="benefitsDesc-qy_Zwm checkinRuleBenefits-canana">
                                <div v-for="benefit in getRewardBenefits(rule)" :key="benefit">
                                  <svg viewBox="0 0 12 20" aria-hidden="true"><path fill="currentColor" d="M4.704 15.122L1.27 11.69l-1.06 1.06 4.494 4.493L11.79 10.157l-1.06-1.06z" /></svg>
                                  <span>{{ benefit }}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-else class="priceListContainer-yZzGFk redeemLayout-canana" :style="getGridStyle(Math.max(redeemDisplayRecords.length + 1, 2))">
                    <div class="priceListItem-jmLrWu redeemEntryCard-canana">
                      <div class="price-list-item-wrapper-QTu1QM">
                        <div class="priceListItemContent-f8yA2T redeemEntryContent-canana">
                          <div class="priceTopWrapper-PO1sPk">
                            <div class="priceTop-FYHAcm redeemEntryHead-canana">
                              <div class="priceTitle-xo_cbl">
                                <div class="levelName-kcprWP">卡密兑换</div>
                                <div class="bestPlan-fJd80q">立即生效</div>
                              </div>
                              <div class="priceDesc-yOCFse redeemEntryDesc-canana">输入卡密后可兑换会员天数或积分奖励，权益会实时发放到账户。</div>
                            </div>
                          </div>

                          <div class="creditsContainer-kZN4Fp redeemHero-canana">
                            <div class="redeemHeroStat-canana">
                              <div class="priceTips-dLW7oc priceTipsWithFixedCurrencySymbolSize-XQdawj">
                                <span>{{ Number(pointsBalance || 0) }}</span>
                              </div>
                              <div class="cycleTips-r_gMtv">当前积分</div>
                            </div>
                            <div class="creditsDesc-irHa5p">支持兑换会员时长、积分奖励等后台配置权益。</div>
                          </div>

                          <div class="creditsContainer-kZN4Fp redeemForm-canana">
                            <div class="redeemInputRow-canana">
                              <input v-model="redeemCodeValue" type="text" placeholder="请输入卡密" />
                              <button
                                class="priceButton-MfMZpC priceButtonWithResourcePositionMaterial-nKxJNx recommendButton-DTYbz5 mweb-button-default redeemActionButton-canana"
                                type="button"
                                :disabled="submitting"
                                @click="handleRedeemCode"
                              >
                                立即兑换
                              </button>
                            </div>
                            <div class="creditsDesc-irHa5p">卡密区分大小写，兑换成功后将自动刷新当前权益。</div>
                          </div>

                          <div class="benefitsDesc-qy_Zwm redeemBenefits-canana">
                            <div v-for="benefit in redeemBenefits" :key="benefit">
                              <svg viewBox="0 0 12 20" aria-hidden="true"><path fill="currentColor" d="M4.704 15.122L1.27 11.69l-1.06 1.06 4.494 4.493L11.79 10.157l-1.06-1.06z" /></svg>
                              <span>{{ benefit }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      v-for="record in redeemDisplayRecords"
                      :key="String(record.id)"
                      class="priceListItem-jmLrWu redeemRecordCard-canana"
                    >
                      <div class="price-list-item-wrapper-QTu1QM">
                        <div class="priceListItemContent-f8yA2T">
                          <div class="priceTopWrapper-PO1sPk">
                            <div class="priceTop-FYHAcm redeemRecordHead-canana">
                              <div class="priceTitle-xo_cbl">
                                <div class="levelName-kcprWP">{{ getRedeemRecordTitle(record) }}</div>
                              </div>
                              <div class="priceDesc-yOCFse">兑换时间 {{ formatDate(record.redeemedAt || record.createdAt) }}</div>
                            </div>
                          </div>

                          <div class="creditsContainer-kZN4Fp redeemRecordMeta-canana">
                            <div class="creditsContent-piPVgX">
                              <div class="creditsInnerContent-ybfrhd">
                                <span>状态</span>
                                <span class="creditsNumber-em42d3">{{ String(record.status || '已生效') }}</span>
                              </div>
                            </div>
                            <div class="creditsDesc-irHa5p">{{ String(record.code || '后台卡密记录') }}</div>
                          </div>

                          <div class="benefitsDesc-qy_Zwm redeemRecordBenefits-canana">
                            <div v-for="benefit in getRedeemRecordBenefits(record)" :key="benefit">
                              <svg viewBox="0 0 12 20" aria-hidden="true"><path fill="currentColor" d="M4.704 15.122L1.27 11.69l-1.06 1.06 4.494 4.493L11.79 10.157l-1.06-1.06z" /></svg>
                              <span>{{ benefit }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

            </div>

            <div class="closeBtnContainer-S1G3nv">
              <button class="closeBtn-avuQWW" type="button" @click="closeModal" aria-label="关闭营销弹窗">
                <span class="closeBtnIcon-KXfT1X">×</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
  <PointsDetailModal
    v-model:visible="pointsDetailVisible"
    :balance="Number(pointsBalance || 0)"
    :available="Number(pointsBalance || 0)"
    :logs="pointLogs"
  />
  <ScanPayModal
    v-model:visible="scanPayVisible"
    :amount="scanPayAmount"
    :agreement-href="paymentAgreementHref"
    :agreement-label="paymentAgreementLabel"
    :submitting="submitting"
    @confirm="handleConfirmScanPay"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PointsDetailModal from './PointsDetailModal.vue'
import ScanPayModal from './ScanPayModal.vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useLoginModalStore } from '@/stores/login-modal'
import { useMarketingCenterStore } from '@/stores/marketing-center'
import { useMarketingModalStore, type MarketingModalTab } from '@/stores/marketing-modal'
import { useSystemSettingsStore } from '@/stores/system-settings'
import { formatMoney, formatMoneyDisplay, isHigherOriginalPrice, toMoneyNumber } from '@/utils/money'
import './MarketingModal.css'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
}>()

const authStore = useAuthStore()
const { openLoginModal } = useLoginModalStore()
const { marketingModalTab, setMarketingModalTab } = useMarketingModalStore()
const marketingCenterStore = useMarketingCenterStore()
const systemSettingsStore = useSystemSettingsStore()

const redeemCodeValue = ref('')
const activeTab = computed<MarketingModalTab>(() => marketingModalTab.value)
const pointsBalance = computed(() => marketingCenterStore.pointsBalance.value)
const membershipPlans = computed(() => marketingCenterStore.membershipPlans.value as Array<Record<string, any>>)
const rechargePackages = computed(() => marketingCenterStore.rechargePackages.value as Array<Record<string, any>>)
const rewardRules = computed(() => marketingCenterStore.rewardRules.value as Array<Record<string, any>>)
const cardRedeemRecords = computed(() => marketingCenterStore.cardRedeemRecords.value as Array<Record<string, any>>)
const activeSubscription = computed(() => marketingCenterStore.activeSubscription.value as Record<string, any> | null)
const hasCheckedInToday = computed(() => marketingCenterStore.hasCheckedInToday.value)
const isLoadingPanel = computed(() => marketingCenterStore.loading.value && !marketingCenterStore.overview.value)
const submitting = computed(() => marketingCenterStore.submitting.value)

const tabs = computed(() => [
  { key: 'membership' as MarketingModalTab, label: '会员套餐', badge: membershipPlans.value.length ? `${membershipPlans.value.length}档` : '' },
  { key: 'recharge' as MarketingModalTab, label: '积分充值', badge: rechargePackages.value.length ? '多充多送' : '' },
  { key: 'checkin' as MarketingModalTab, label: '签到奖励', badge: hasCheckedInToday.value ? '已签到' : '可领取' },
  { key: 'redeem' as MarketingModalTab, label: '卡密兑换', badge: '' },
])

// 兜底展示卡，保证弹窗在后台无配置时也能保持参考稿栅格结构。
const membershipDisplayPlans = computed(() => membershipPlans.value.length ? membershipPlans.value : [{
  id: 'placeholder-membership',
  name: '标准会员',
  level: { name: '标准会员' },
  salesPrice: 0,
  originalPrice: 0,
  durationValue: 1,
  durationUnit: 'MONTH',
  bonusPoints: 0,
  benefitsJson: ['后台暂未配置会员套餐', '可在管理后台新增会员规则', '配置后这里会自动同步'],
}])

const rechargeDisplayPackages = computed(() => rechargePackages.value.length ? rechargePackages.value : [{
  id: 'placeholder-recharge',
  name: '基础积分包',
  points: 0,
  price: 0,
  originalPrice: 0,
  bonusPoints: 0,
  benefitsJson: ['后台暂未配置充值套餐', '支持多充多送策略', '配置后自动同步展示'],
}])

// 签到页只展示签到类规则，避免把登录奖励、注册奖励误展示到当前面板。
const checkinRewardRules = computed(() => rewardRules.value.filter((rule) => {
  const triggerType = String(rule.triggerType || rule.code || '').toUpperCase()
  return triggerType.includes('CHECKIN')
}))

const rewardDisplayRules = computed(() => checkinRewardRules.value.length ? checkinRewardRules.value : [{
  id: 'placeholder-reward',
  name: '每日签到福利',
  rewardPoints: 0,
  description: '后台暂未配置签到活动规则',
  benefitsJson: ['每日打卡即可领取', '奖励实时发放到账户', '支持后台灵活配置活动规则'],
}])
const primaryRewardRule = computed(() => rewardDisplayRules.value[0] || {
  id: 'placeholder-reward',
  name: '每日签到福利',
  rewardPoints: 0,
  description: '后台暂未配置签到活动规则',
  benefitsJson: ['每日打卡即可领取', '奖励实时发放到账户', '支持后台灵活配置活动规则'],
})
const secondaryRewardRules = computed(() => rewardDisplayRules.value.slice(1))
const currentCheckinRecord = computed(() => marketingCenterStore.overview.value?.checkin.currentRecord as Record<string, any> | null)
const pointLogs = computed(() => (marketingCenterStore.overview.value?.points.logs || []) as Array<Record<string, any>>)
const pointsDetailVisible = ref(false)
const scanPayVisible = ref(false)
const scanPayAmount = ref(0)
const scanPayPayload = ref<{ type: 'membership' | 'recharge'; id: string } | null>(null)

const redeemDisplayRecords = computed(() => cardRedeemRecords.value.slice(0, 3))
const paymentAgreementHref = computed(() => systemSettingsStore.publicSystemSettings.value.policySettings.userAgreementUrl || '/policies/user-agreement')
const paymentAgreementLabel = computed(() => {
  const policyTitle = String(systemSettingsStore.publicSystemSettings.value.policySettings.userAgreementTitle || '').trim()
  return policyTitle ? `《${policyTitle}》` : '《“即梦”付费服务协议（含自动续费条款）》'
})

const redeemBenefits = [
  '支持兑换会员时长',
  '支持兑换积分奖励',
  '兑换成功后权益立即生效',
]

const heroPrimaryText = computed(() => {
  const firstPlan = membershipPlans.value[0]
  return firstPlan ? `¥${formatMoneyDisplay(firstPlan.salesPrice)} 特惠开通` : '会员权益限时开放'
})

const heroSecondaryText = computed(() => {
  const firstPlan = membershipPlans.value[0]
  if (!firstPlan) {
    return '立得专属积分与会员权益'
  }
  return `立得 ${Number(firstPlan.bonusPoints || 0)} 积分`
})

const heroDescription = computed(() => {
  if (!authStore.isLoggedIn.value) {
    return '登录后即可查看你的专属会员、积分和签到奖励。'
  }
  if (activeSubscription.value?.level?.name) {
    return `当前会员：${String(activeSubscription.value.level.name)}，可继续续费或补充积分。`
  }
  return '选择合适你的套餐，提升生成额度与会员权益。'
})

const closeModal = () => {
  pointsDetailVisible.value = false
  scanPayVisible.value = false
  scanPayPayload.value = null
  emit('update:visible', false)
}

const openPointsDetailModal = () => {
  if (!ensureLoggedInForAction()) return
  pointsDetailVisible.value = true
}

const switchTab = (tab: MarketingModalTab) => {
  setMarketingModalTab(tab)
}

const ensureLoggedInForAction = () => {
  if (authStore.isLoggedIn.value) {
    return true
  }
  openLoginModal('marketing-modal')
  ElMessage.info('请先登录后再使用会员和积分权益')
  return false
}

const formatDate = (value: unknown) => {
  if (!value) return '未设置'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '未设置'
  return date.toLocaleDateString('zh-CN')
}

// 统一把后台配置中的权益字段归一成字符串数组，避免模板里分支过多。
const getBenefits = (benefitsJson: unknown) => {
  if (Array.isArray(benefitsJson)) {
    return benefitsJson
      .map((item) => typeof item === 'string' ? item : String((item as Record<string, unknown>)?.label || (item as Record<string, unknown>)?.text || ''))
      .filter(Boolean)
  }
  if (benefitsJson && typeof benefitsJson === 'object') {
    const record = benefitsJson as Record<string, unknown>
    if (Array.isArray(record.benefits)) {
      return record.benefits
        .map((item) => typeof item === 'string' ? item : String((item as Record<string, unknown>)?.label || (item as Record<string, unknown>)?.text || ''))
        .filter(Boolean)
    }
  }
  return []
}

const getPlanLevelName = (plan: Record<string, any>) => String(plan.level?.name || plan.label || plan.name || '会员计划')
const getPlanDurationText = (plan: Record<string, any>) => {
  const unit = String(plan.durationUnit || 'MONTH').toUpperCase()
  const value = Number(plan.durationValue || 1)
  if (unit === 'YEAR') return `${value}年`
  if (unit === 'DAY') return `${value}天`
  return `${value}个月`
}

const getPlanPriceUnitText = (plan: Record<string, any>) => {
  if (isZeroPricePlan(plan)) {
    return '每月'
  }
  const durationType = String(plan.durationType || '').toUpperCase()
  const unit = String(plan.durationUnit || 'MONTH').toUpperCase()
  const value = Number(plan.durationValue || 1)
  if (durationType === 'YEAR' || unit === 'YEAR' || (unit === 'MONTH' && value >= 12)) {
    return '每年'
  }
  if (durationType === 'MONTH' || unit === 'MONTH') {
    return '每月'
  }
  if (unit === 'DAY') {
    return '每天'
  }
  return getPlanDurationText(plan)
}
const isActiveMembershipPlan = (plan: Record<string, any>) => Boolean(activeSubscription.value?.levelId) && String(activeSubscription.value?.levelId) === String(plan.levelId)
const isZeroPricePlan = (plan: Record<string, any>) => toMoneyNumber(plan.salesPrice, 0) <= 0

// 参考稿右侧高亮卡为主推位，这里使用价格最高的有效套餐对齐展示。
const isFeaturedPlan = (plan: Record<string, any>, planIndex: number) => {
  if (!membershipPlans.value.length) {
    return planIndex === 0
  }
  const maxPrice = Math.max(...membershipPlans.value.map((item) => toMoneyNumber(item.salesPrice, 0)))
  return toMoneyNumber(plan.salesPrice, 0) === maxPrice && planIndex === membershipPlans.value.findIndex((item) => toMoneyNumber(item.salesPrice, 0) === maxPrice)
}

const isFeaturedRecharge = (item: Record<string, any>, itemIndex: number) => {
  if (!rechargePackages.value.length) {
    return itemIndex === 0
  }
  const maxBonus = Math.max(...rechargePackages.value.map((current) => Number(current.bonusPoints || 0)))
  return Number(item.bonusPoints || 0) === maxBonus && itemIndex === rechargePackages.value.findIndex((current) => Number(current.bonusPoints || 0) === maxBonus)
}

const getPlanButtonText = (plan: Record<string, any>, planIndex: number) => {
  if (isZeroPricePlan(plan)) {
    return '当前计划'
  }
  const priceText = formatMoney(plan.salesPrice)
  if (isActiveMembershipPlan(plan)) {
    return `${priceText} 立即续费`
  }
  if (isFeaturedPlan(plan, planIndex)) {
    return `${priceText} ${String(plan.label || '立即开通')}`
  }
  return `${priceText} ${String(plan.label || '立即开通')}`
}

// 按参考稿的主按钮、普通按钮、禁用按钮三种状态映射。
const getPlanButtonClass = (plan: Record<string, any>, planIndex: number) => {
  if (isZeroPricePlan(plan)) {
    return 'freeButton-jEPOwF disabled'
  }
  if (isFeaturedPlan(plan, planIndex)) {
    return 'recommendButton-DTYbz5'
  }
  return 'freeButton-jEPOwF'
}

const getRechargeButtonClass = (item: Record<string, any>, itemIndex: number) => {
  if (isFeaturedRecharge(item, itemIndex)) {
    return 'recommendButton-DTYbz5'
  }
  return 'freeButton-jEPOwF'
}

const getPlanBenefits = (plan: Record<string, any>) => {
  const benefits = getBenefits(plan.benefitsJson)
  return benefits.length ? benefits : ['高速生成额度', '专属会员能力', '优先体验新模型']
}

const getRechargeBenefits = (item: Record<string, any>) => {
  // 充值套餐的底部权益文案优先读取后台配置的 metaJson.benefits，未配置时再回退默认文案。
  const metaBenefits = getBenefits(item.metaJson)
  if (metaBenefits.length) {
    return metaBenefits
  }
  const fallbackBenefits = getBenefits(item.benefitsJson)
  return fallbackBenefits.length ? fallbackBenefits : ['充值后即时到账', '支持多充多送', '可用于图片与视频生成']
}

const getRewardBenefits = (rule: Record<string, any>) => {
  const benefits = getBenefits(rule.benefitsJson)
  return benefits.length ? benefits : ['每日打卡即可领取', '奖励实时发放到账户', '支持后台灵活配置活动规则']
}

const getMembershipDesc = (plan: Record<string, any>) => {
  if (isZeroPricePlan(plan)) {
    return '永久'
  }
  return String(plan.description || plan.name || '解锁更多会员权益')
}
const getMembershipCreditDesc = (plan: Record<string, any>) => {
  if (isZeroPricePlan(plan)) {
    return '当前默认权益立即生效'
  }
  if (isHigherOriginalPrice(plan.originalPrice, plan.salesPrice)) {
    return `首购 ${formatMoney(plan.salesPrice)} · 原价 ${formatMoney(plan.originalPrice)}`
  }
  return '开通后权益立即生效'
}

const getRechargeDesc = (item: Record<string, any>) => String(item.label || item.description || '多充多送，立即到账')
const getRechargeCreditDesc = (item: Record<string, any>) => {
  if (isHigherOriginalPrice(item.originalPrice, item.price)) {
    return `原价 ${formatMoney(item.originalPrice)}`
  }
  return '充值后即时到账'
}

const getRewardRuleName = (rule: Record<string, any>) => String(rule.name || rule.code || '奖励规则')
const getRewardRuleMeta = (rule: Record<string, any>) => `${Number(rule.rewardPoints || 0)} 积分 · ${String(rule.description || '') || '活动奖励按配置自动发放'}`

const getRedeemRecordTitle = (record: Record<string, any>) => {
  if (record.rewardType === 'MEMBERSHIP') {
    return `${String(record.rewardLevel?.name || '会员')} ${Number(record.rewardDays || 0)} 天`
  }
  return `积分 +${Number(record.rewardPoints || 0)}`
}

const getRedeemRecordBenefits = (record: Record<string, any>) => {
  if (record.rewardType === 'MEMBERSHIP') {
    return ['会员权益已发放', `有效天数 ${Number(record.rewardDays || 0)} 天`, `兑换时间 ${formatDate(record.redeemedAt || record.createdAt)}`]
  }
  return ['积分奖励已到账', `奖励积分 ${Number(record.rewardPoints || 0)}`, `兑换时间 ${formatDate(record.redeemedAt || record.createdAt)}`]
}

// 价格字号跟随最长价格字符数，贴近参考稿的大数字排版比例。
const getMaxPriceCharCount = () => {
  const values = membershipDisplayPlans.value.map((item) => formatMoneyDisplay(item.salesPrice))
  return Math.max(...values.map((item) => item.length), 1)
}

// 营销卡片默认按四列栅格展示，卡片数量不足时收紧容器宽度，避免内容过散。
const getGridStyle = (count: number) => {
  const safeCount = Math.max(1, Math.min(4, Number(count || 0)))
  return {
    gridTemplateColumns: `repeat(${safeCount}, minmax(0, 1fr))`,
    maxWidth: `${safeCount * 320 + (safeCount - 1) * 12}px`,
  }
}

// 当前营销下单仍是后端直充直开，这里先复用扫码支付弹窗承接前台支付确认交互。
const openMembershipScanPay = (plan: Record<string, any>) => {
  // 直接复用当前点击卡片的数据，避免再次按 id 回查时因数据映射差异导致金额丢失。
  scanPayAmount.value = toMoneyNumber(plan?.salesPrice, 0)
  scanPayPayload.value = { type: 'membership', id: String(plan?.id || '') }
  scanPayVisible.value = true
}

const openRechargeScanPay = (rechargePackage: Record<string, any>) => {
  // 充值金额也直接取当前卡片，保证弹窗标题和实际购买项完全一致。
  scanPayAmount.value = toMoneyNumber(rechargePackage?.price, 0)
  scanPayPayload.value = { type: 'recharge', id: String(rechargePackage?.id || '') }
  scanPayVisible.value = true
}

const handlePurchaseMembership = async (plan: Record<string, any>) => {
  if (!ensureLoggedInForAction()) return
  openMembershipScanPay(plan)
}

const handlePurchaseRecharge = async (rechargePackage: Record<string, any>) => {
  if (!ensureLoggedInForAction()) return
  openRechargeScanPay(rechargePackage)
}

const handleConfirmScanPay = async () => {
  if (!scanPayPayload.value) {
    return
  }
  if (scanPayPayload.value.type === 'membership') {
    await marketingCenterStore.purchaseMembership(scanPayPayload.value.id)
  } else {
    await marketingCenterStore.purchaseRecharge(scanPayPayload.value.id)
  }
  scanPayVisible.value = false
  scanPayPayload.value = null
}

const handleCheckin = async () => {
  if (!ensureLoggedInForAction()) return
  await marketingCenterStore.checkin()
}

const handleRedeemCode = async () => {
  if (!ensureLoggedInForAction()) return
  const code = redeemCodeValue.value.trim()
  if (!code) {
    ElMessage.warning('请输入卡密')
    return
  }
  await marketingCenterStore.redeemCode(code)
  redeemCodeValue.value = ''
}

// 直接操作 body overflow，避免为了滚动锁再额外新增自定义样式。
const previousHtmlOverflow = ref('')
const previousBodyOverflow = ref('')

const setScrollLock = (locked: boolean) => {
  if (typeof document === 'undefined') {
    return
  }
  if (locked) {
    previousHtmlOverflow.value = document.documentElement.style.overflow
    previousBodyOverflow.value = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return
  }
  document.documentElement.style.overflow = previousHtmlOverflow.value
  document.body.style.overflow = previousBodyOverflow.value
}

watch(() => props.visible, (visible) => {
  setScrollLock(visible)
  if (!visible) {
    pointsDetailVisible.value = false
    scanPayVisible.value = false
    scanPayPayload.value = null
  }
  // 营销总览接口支持未登录访问，弹窗打开时始终拉一次，确保前台套餐和活动文案能正常展示。
  if (visible) {
    void marketingCenterStore.loadOverview(true)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  setScrollLock(false)
})
</script>
