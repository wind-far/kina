import { computed, ref } from 'vue'
import {
  createMarketingMembershipOrder,
  createMarketingRechargeOrder,
  getMarketingCenterOverview,
  performMarketingCheckin,
  redeemMarketingCardCode,
  type MarketingCenterOverviewResponse,
} from '@/api/marketing-center'
import { AUTH_LOGIN_SUCCESS_EVENT } from '@/stores/auth'

const overview = ref<MarketingCenterOverviewResponse | null>(null)
const loading = ref(false)
const submitting = ref(false)
let loadPromise: Promise<MarketingCenterOverviewResponse | null> | null = null
let authEventBound = false

// 全局营销数据单例，统一承接会员、积分、签到与卡密视图。
export const useMarketingCenterStore = () => {
  const pointsBalance = computed(() => overview.value?.points.balance || 0)
  const membershipPlans = computed(() => overview.value?.membershipPlans || [])
  const rechargePackages = computed(() => overview.value?.rechargePackages || [])
  const rewardRules = computed(() => overview.value?.rewardRules || [])
  const cardRedeemRecords = computed(() => overview.value?.cardRedeemRecords || [])
  const activeSubscription = computed(() => overview.value?.subscription || null)
  const hasCheckedInToday = computed(() => overview.value?.checkin.checkedInToday || false)

  const ensureAuthRefreshListener = () => {
    if (authEventBound || typeof window === 'undefined') {
      return
    }
    authEventBound = true
    window.addEventListener(AUTH_LOGIN_SUCCESS_EVENT, () => {
      void loadOverview(true)
    })
  }

  const clearOverview = () => {
    overview.value = null
  }

  const loadOverview = async (force = false) => {
    ensureAuthRefreshListener()

    if (loadPromise && !force) {
      return loadPromise
    }

    loading.value = true
    loadPromise = getMarketingCenterOverview()
      .then((result) => {
        overview.value = result
        return result
      })
      .finally(() => {
        loading.value = false
        loadPromise = null
      })

    return loadPromise
  }

  const runWithReload = async <T>(task: () => Promise<T>) => {
    submitting.value = true
    try {
      const result = await task()
      await loadOverview(true)
      return result
    } finally {
      submitting.value = false
    }
  }

  const checkin = async () => {
    return runWithReload(() => performMarketingCheckin())
  }

  const purchaseMembership = async (planId: string) => {
    return runWithReload(() => createMarketingMembershipOrder(planId))
  }

  const purchaseRecharge = async (rechargePackageId: string) => {
    return runWithReload(() => createMarketingRechargeOrder(rechargePackageId))
  }

  const redeemCode = async (code: string) => {
    return runWithReload(() => redeemMarketingCardCode(code))
  }

  return {
    overview,
    loading,
    submitting,
    pointsBalance,
    membershipPlans,
    rechargePackages,
    rewardRules,
    cardRedeemRecords,
    activeSubscription,
    hasCheckedInToday,
    loadOverview,
    clearOverview,
    checkin,
    purchaseMembership,
    purchaseRecharge,
    redeemCode,
  }
}
