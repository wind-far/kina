import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface AdminMarketingOverview {
  membership: {
    levelCount: number
    planCount: number
  }
  recharge: {
    packageCount: number
  }
  rewards: {
    ruleCount: number
  }
  cdk: {
    batchCount: number
    codeCount: number
    usedCount: number
  }
}

export interface MembershipLevelItem {
  id: string
  name: string
  level: number
  description: string | null
  iconUrl: string | null
  monthlyBonusPoints: number
  storageCapacity: string | number
  benefitsJson: unknown
  isEnabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}


export interface MembershipPlanBillingItem {
  levelId: string
  salesPrice: string
  originalPrice?: string | null
  label?: string | null
  status: boolean
  level?: MembershipLevelItem | null
}

export interface MembershipPlanItem {
  id: string
  planId?: string
  levelId: string
  name: string
  label: string | null
  description: string | null
  durationType: string
  durationValue: number
  durationUnit: string
  salesPrice: string
  originalPrice: string | null
  bonusPoints: number
  benefitsJson: unknown
  billingRules?: MembershipPlanBillingItem[]
  isEnabled: boolean
  sortOrder: number
  level?: MembershipLevelItem | null
}

export interface RechargePackageItem {
  id: string
  name: string
  label: string | null
  description: string | null
  points: number
  bonusPoints: number
  price: string
  originalPrice: string | null
  badgeText: string | null
  isEnabled: boolean
  sortOrder: number
  metaJson: unknown
}

export interface RewardRuleItem {
  id: string
  code: string
  triggerType: string
  name: string
  description: string | null
  rewardPoints: number
  cycleType: string
  limitPerCycle: number
  isEnabled: boolean
  conditionJson: unknown
  sortOrder: number
}

export interface CardBatchItem {
  id: string
  name: string
  batchNo: string
  description: string | null
  rewardType: string
  rewardPoints: number
  rewardLevelId: string | null
  rewardDays: number | null
  totalCount: number
  usedCount: number
  expiresAt: string | null
  isEnabled: boolean
  metaJson: unknown
  rewardLevel?: MembershipLevelItem | null
  _count?: {
    cardCodes: number
    redeemRecords: number
  }
}

export interface CardCodeItem {
  id: string
  batchId: string
  code: string
  status: string
  usedByUserId: string | null
  rewardLevelId: string | null
  rewardSnapshotJson: unknown
  expiresAt: string | null
  usedAt: string | null
  usedByUser?: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
}

const ADMIN_MARKETING_BASE_PATH = '/api/admin/marketing'
const OVERVIEW_PATH = `${ADMIN_MARKETING_BASE_PATH}/overview`
const MEMBERSHIP_LEVELS_PATH = `${ADMIN_MARKETING_BASE_PATH}/membership-levels`
const MEMBERSHIP_PLANS_PATH = `${ADMIN_MARKETING_BASE_PATH}/membership-plans`
const RECHARGE_PACKAGES_PATH = `${ADMIN_MARKETING_BASE_PATH}/recharge-packages`
const REWARD_RULES_PATH = `${ADMIN_MARKETING_BASE_PATH}/reward-rules`
const CARD_BATCHES_PATH = `${ADMIN_MARKETING_BASE_PATH}/card-batches`

// 统一把金额字段收口为字符串，避免前端再混用 number / object / string 三种形态。
const normalizeMoneyString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['$numberDecimal', 'value', 'amount']) {
      const candidate = record[key]
      if (typeof candidate === 'number') {
        return String(candidate)
      }
      if (typeof candidate === 'string') {
        return candidate
      }
    }
    if (typeof (value as { toString?: () => string }).toString === 'function') {
      const text = (value as { toString: () => string }).toString()
      if (text && text !== '[object Object]') {
        return text
      }
    }
  }
  return String(value)
}

// 会员计划中的价格字段较多，这里统一拍平，保证展示与编辑回填一致。
const normalizeMembershipPlanItem = (item: MembershipPlanItem): MembershipPlanItem => ({
  ...item,
  salesPrice: normalizeMoneyString(item.salesPrice) ?? '0',
  originalPrice: normalizeMoneyString(item.originalPrice),
  billingRules: Array.isArray(item.billingRules)
    ? item.billingRules.map((rule) => ({
        ...rule,
        salesPrice: normalizeMoneyString(rule.salesPrice) ?? '0',
        originalPrice: normalizeMoneyString(rule.originalPrice),
      }))
    : [],
})

// 积分充值套餐也统一拍平价格字段，避免售价和原价回显异常。
const normalizeRechargePackageItem = (item: RechargePackageItem): RechargePackageItem => ({
  ...item,
  price: normalizeMoneyString(item.price) ?? '0',
  originalPrice: normalizeMoneyString(item.originalPrice),
})

interface MarketingRequestMessageOptions {
  showSuccessMessage?: boolean
  successMessage?: string
}

const requestJson = async <T>(url: string, options: RequestInit = {}, messageOptions: MarketingRequestMessageOptions = {}) => {
  const response = await fetch(buildApiUrl(url), {
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
    showSuccessMessage: messageOptions.showSuccessMessage,
    successMessage: messageOptions.successMessage,
  })
}

// 查询营销中心概览。
export const getAdminMarketingOverview = () => requestJson<AdminMarketingOverview>(OVERVIEW_PATH, { method: 'GET' })

// 查询会员等级列表。
export const listMembershipLevels = () => requestJson<MembershipLevelItem[]>(MEMBERSHIP_LEVELS_PATH, { method: 'GET' })
export const createMembershipLevel = (payload: Partial<MembershipLevelItem>) => requestJson<MembershipLevelItem>(MEMBERSHIP_LEVELS_PATH, { method: 'POST', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '会员等级已创建' })
export const updateMembershipLevel = (id: string, payload: Partial<MembershipLevelItem>) => requestJson<MembershipLevelItem>(`${MEMBERSHIP_LEVELS_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '会员等级已更新' })
export const deleteMembershipLevel = (id: string) => requestJson<boolean>(`${MEMBERSHIP_LEVELS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }, { showSuccessMessage: true, successMessage: '会员等级已删除' })

// 查询会员计划列表。
export const listMembershipPlans = async () => {
  const items = await requestJson<MembershipPlanItem[]>(MEMBERSHIP_PLANS_PATH, { method: 'GET' })
  return Array.isArray(items) ? items.map(normalizeMembershipPlanItem) : []
}
export const createMembershipPlan = async (payload: Partial<MembershipPlanItem>) => {
  const item = await requestJson<MembershipPlanItem>(MEMBERSHIP_PLANS_PATH, { method: 'POST', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '会员计划已创建' })
  return normalizeMembershipPlanItem(item)
}
export const updateMembershipPlan = async (id: string, payload: Partial<MembershipPlanItem>) => {
  const item = await requestJson<MembershipPlanItem>(`${MEMBERSHIP_PLANS_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '会员计划已更新' })
  return normalizeMembershipPlanItem(item)
}
export const deleteMembershipPlan = (id: string) => requestJson<boolean>(`${MEMBERSHIP_PLANS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }, { showSuccessMessage: true, successMessage: '会员计划已删除' })

// 查询充值套餐列表。
export const listRechargePackages = async () => {
  const items = await requestJson<RechargePackageItem[]>(RECHARGE_PACKAGES_PATH, { method: 'GET' })
  return Array.isArray(items) ? items.map(normalizeRechargePackageItem) : []
}
export const createRechargePackage = async (payload: Partial<RechargePackageItem>) => {
  const item = await requestJson<RechargePackageItem>(RECHARGE_PACKAGES_PATH, { method: 'POST', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '充值套餐已创建' })
  return normalizeRechargePackageItem(item)
}
export const updateRechargePackage = async (id: string, payload: Partial<RechargePackageItem>) => {
  const item = await requestJson<RechargePackageItem>(`${RECHARGE_PACKAGES_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '充值套餐已更新' })
  return normalizeRechargePackageItem(item)
}
export const deleteRechargePackage = (id: string) => requestJson<boolean>(`${RECHARGE_PACKAGES_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }, { showSuccessMessage: true, successMessage: '充值套餐已删除' })

// 查询奖励规则列表。
export const listRewardRules = () => requestJson<RewardRuleItem[]>(REWARD_RULES_PATH, { method: 'GET' })
export const createRewardRule = (payload: Partial<RewardRuleItem>) => requestJson<RewardRuleItem>(REWARD_RULES_PATH, { method: 'POST', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '奖励规则已创建' })
export const updateRewardRule = (id: string, payload: Partial<RewardRuleItem>) => requestJson<RewardRuleItem>(`${REWARD_RULES_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '奖励规则已更新' })
export const deleteRewardRule = (id: string) => requestJson<boolean>(`${REWARD_RULES_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }, { showSuccessMessage: true, successMessage: '奖励规则已删除' })

// 查询卡密批次与卡密列表。
export const listCardBatches = () => requestJson<CardBatchItem[]>(CARD_BATCHES_PATH, { method: 'GET' })
export const createCardBatch = (payload: Partial<CardBatchItem>) => requestJson<CardBatchItem>(CARD_BATCHES_PATH, { method: 'POST', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '卡密批次已创建' })
export const updateCardBatch = (id: string, payload: Partial<CardBatchItem>) => requestJson<CardBatchItem>(`${CARD_BATCHES_PATH}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }, { showSuccessMessage: true, successMessage: '卡密批次已更新' })
export const deleteCardBatch = (id: string) => requestJson<boolean>(`${CARD_BATCHES_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }, { showSuccessMessage: true, successMessage: '卡密批次已删除' })
export const listCardCodesByBatch = (id: string) => requestJson<CardCodeItem[]>(`${CARD_BATCHES_PATH}/${encodeURIComponent(id)}/codes`, { method: 'GET' })
