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
export const getMarketingCenterOverview = () => requestJson<MarketingCenterOverviewResponse>('/api/marketing/overview', { method: 'GET' })

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
