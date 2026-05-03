import { readJsonBody, sendJson } from '../ai-gateway/shared'

export interface MarketingMembershipBillingRulePayload {
  levelId?: string
  salesPrice?: number
  originalPrice?: number | null
  label?: string
  status?: boolean
}

export interface MarketingMembershipLevelPayload {
  name?: string
  level?: number
  description?: string
  iconUrl?: string
  monthlyBonusPoints?: number
  storageCapacity?: number
  benefitsJson?: unknown
  isEnabled?: boolean
  sortOrder?: number
}

export interface MarketingMembershipPlanPayload {
  name?: string
  label?: string
  description?: string
  durationType?: string
  durationValue?: number
  durationUnit?: string
  bonusPoints?: number
  benefitsJson?: unknown
  // 会员计划完全按 BuildingAI 方式使用 billingRules 入参，不再接收旧的单等级单售价字段。
  billingRules?: MarketingMembershipBillingRulePayload[]
  isEnabled?: boolean
  sortOrder?: number
}

export interface MarketingRechargePackagePayload {
  name?: string
  label?: string
  description?: string
  points?: number
  bonusPoints?: number
  price?: number
  originalPrice?: number | null
  badgeText?: string
  isEnabled?: boolean
  sortOrder?: number
  metaJson?: unknown
}

export interface MarketingRewardRulePayload {
  code?: string
  triggerType?: string
  name?: string
  description?: string
  rewardPoints?: number
  cycleType?: string
  limitPerCycle?: number
  isEnabled?: boolean
  conditionJson?: unknown
  sortOrder?: number
}

export interface MarketingCardBatchPayload {
  name?: string
  batchNo?: string
  description?: string
  rewardType?: string
  rewardPoints?: number
  rewardLevelId?: string
  rewardDays?: number | null
  totalCount?: number
  expiresAt?: string
  isEnabled?: boolean
  metaJson?: unknown
}

export interface MarketingPointCompensationQueryPayload {
  days?: number
  limit?: number
}

export interface MarketingPointLogQueryPayload {
  days?: number
  page?: number
  pageSize?: number
  action?: string
  sourceType?: string
  endpointType?: string
  refundStatus?: string
  keyword?: string
}

export interface MarketingPointCompensationExecutePayload {
  associationNos?: string[]
  note?: string
  forceManual?: boolean
}

// 读取营销中心请求体。
export const readMarketingBody = async <T = Record<string, unknown>>(req: any) => {
  const payload = await readJsonBody(req)
  return payload as T
}

// 返回统一的营销中心错误。
export const sendMarketingError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'admin_marketing_error',
      message,
    },
  })
}
