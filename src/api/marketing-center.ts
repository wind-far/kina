import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface MarketingCenterOverviewResponse {
  user: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    role: string | null
    createdAt: string
  } | null
  points: {
    balance: number
    available: number
    logs: Array<Record<string, unknown>>
  }
  subscription: Record<string, unknown> | null
  membershipPlans: Array<Record<string, unknown>>
  rechargePackages: Array<Record<string, unknown>>
  rewardRules: Array<Record<string, unknown>>
  cardRedeemRecords: Array<Record<string, unknown>>
  checkin: {
    checkedInToday: boolean
    currentRecord: Record<string, unknown> | null
  }
}

// 用户侧营销总览里的价格字段也统一收口为字符串，避免弹窗内再出现混合类型。
const normalizeMoneyString = (value: unknown) => {
  if (value === null || value === undefined) {
    return null
  }
  return String(value)
}

const normalizeMarketingOverview = (payload: MarketingCenterOverviewResponse): MarketingCenterOverviewResponse => ({
  ...payload,
  membershipPlans: Array.isArray(payload.membershipPlans)
    ? payload.membershipPlans.map((item) => {
        const record = item as Record<string, unknown>
        return {
          ...record,
          salesPrice: normalizeMoneyString(record.salesPrice) ?? '0',
          originalPrice: normalizeMoneyString(record.originalPrice),
          billingRules: Array.isArray(record.billingRules)
            ? record.billingRules.map((rule) => {
                const currentRule = rule as Record<string, unknown>
                return {
                  ...currentRule,
                  salesPrice: normalizeMoneyString(currentRule.salesPrice) ?? '0',
                  originalPrice: normalizeMoneyString(currentRule.originalPrice),
                }
              })
            : [],
        }
      })
    : [],
  rechargePackages: Array.isArray(payload.rechargePackages)
    ? payload.rechargePackages.map((item) => {
        const record = item as Record<string, unknown>
        return {
          ...record,
          price: normalizeMoneyString(record.price) ?? '0',
          originalPrice: normalizeMoneyString(record.originalPrice),
        }
      })
    : [],
})

const requestJson = async <T>(path: string, options: RequestInit = {}, successMessage = '') => {
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  return readApiData<T>(response, {
    showErrorMessage: true,
    showSuccessMessage: Boolean(successMessage),
    successMessage,
  })
}

// 查询用户营销中心总览。
export const getMarketingCenterOverview = async () => {
  const payload = await requestJson<MarketingCenterOverviewResponse>('/api/marketing/overview', { method: 'GET' })
  return normalizeMarketingOverview(payload)
}

// 执行签到。
export const performMarketingCheckin = () => requestJson('/api/marketing/checkin', { method: 'POST' }, '签到成功')

// 执行卡密兑换。
export const redeemMarketingCardCode = (code: string) => requestJson('/api/marketing/card-redeem', {
  method: 'POST',
  body: JSON.stringify({ code }),
}, '卡密兑换成功')

// 开通会员。
export const createMarketingMembershipOrder = (planId: string) => requestJson('/api/marketing/membership-orders', {
  method: 'POST',
  body: JSON.stringify({ planId }),
}, '会员已开通')

// 充值积分。
export const createMarketingRechargeOrder = (rechargePackageId: string) => requestJson('/api/marketing/recharge-orders', {
  method: 'POST',
  body: JSON.stringify({ rechargePackageId }),
}, '充值已到账')
