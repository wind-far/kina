// 营销中心后台接口根路径。
export const ADMIN_MARKETING_BASE_PATH = '/api/admin/marketing'

// 营销中心概览接口。
export const ADMIN_MARKETING_OVERVIEW_PATH = `${ADMIN_MARKETING_BASE_PATH}/overview`

// 会员等级接口。
export const ADMIN_MARKETING_MEMBERSHIP_LEVELS_PATH = `${ADMIN_MARKETING_BASE_PATH}/membership-levels`

// 会员计划接口。
export const ADMIN_MARKETING_MEMBERSHIP_PLANS_PATH = `${ADMIN_MARKETING_BASE_PATH}/membership-plans`

// 积分充值套餐接口。
export const ADMIN_MARKETING_RECHARGE_PACKAGES_PATH = `${ADMIN_MARKETING_BASE_PATH}/recharge-packages`

// 奖励规则接口。
export const ADMIN_MARKETING_REWARD_RULES_PATH = `${ADMIN_MARKETING_BASE_PATH}/reward-rules`

// 卡密批次接口。
export const ADMIN_MARKETING_CARD_BATCHES_PATH = `${ADMIN_MARKETING_BASE_PATH}/card-batches`

// 生成任务积分补偿候选列表接口。
export const ADMIN_MARKETING_POINT_COMPENSATION_CANDIDATES_PATH = `${ADMIN_MARKETING_BASE_PATH}/point-compensation/candidates`

// 生成任务积分补偿执行接口。
export const ADMIN_MARKETING_POINT_COMPENSATION_EXECUTE_PATH = `${ADMIN_MARKETING_BASE_PATH}/point-compensation/execute`

// 判断是否命中营销中心接口。
export const isAdminMarketingPath = (requestPath: string) => {
  return requestPath === ADMIN_MARKETING_OVERVIEW_PATH
    || requestPath === ADMIN_MARKETING_MEMBERSHIP_LEVELS_PATH
    || requestPath.startsWith(`${ADMIN_MARKETING_MEMBERSHIP_LEVELS_PATH}/`)
    || requestPath === ADMIN_MARKETING_MEMBERSHIP_PLANS_PATH
    || requestPath.startsWith(`${ADMIN_MARKETING_MEMBERSHIP_PLANS_PATH}/`)
    || requestPath === ADMIN_MARKETING_RECHARGE_PACKAGES_PATH
    || requestPath.startsWith(`${ADMIN_MARKETING_RECHARGE_PACKAGES_PATH}/`)
    || requestPath === ADMIN_MARKETING_REWARD_RULES_PATH
    || requestPath.startsWith(`${ADMIN_MARKETING_REWARD_RULES_PATH}/`)
    || requestPath === ADMIN_MARKETING_CARD_BATCHES_PATH
    || requestPath.startsWith(`${ADMIN_MARKETING_CARD_BATCHES_PATH}/`)
    || requestPath === ADMIN_MARKETING_POINT_COMPENSATION_CANDIDATES_PATH
    || requestPath === ADMIN_MARKETING_POINT_COMPENSATION_EXECUTE_PATH
}
