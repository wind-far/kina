// 用户侧营销中心接口根路径。
export const MARKETING_CENTER_BASE_PATH = '/api/marketing'

// 营销中心总览接口。
export const MARKETING_CENTER_OVERVIEW_PATH = MARKETING_CENTER_BASE_PATH + '/overview'

// 用户签到接口。
export const MARKETING_CENTER_CHECKIN_PATH = MARKETING_CENTER_BASE_PATH + '/checkin'

// 卡密兑换接口。
export const MARKETING_CENTER_CARD_REDEEM_PATH = MARKETING_CENTER_BASE_PATH + '/card-redeem'

// 会员购买接口。
export const MARKETING_CENTER_MEMBERSHIP_ORDER_PATH = MARKETING_CENTER_BASE_PATH + '/membership-orders'

// 积分充值接口。
export const MARKETING_CENTER_RECHARGE_ORDER_PATH = MARKETING_CENTER_BASE_PATH + '/recharge-orders'

// 判断是否命中用户侧营销接口。
export const isMarketingCenterPath = (requestPath: string) => {
  return requestPath === MARKETING_CENTER_OVERVIEW_PATH
    || requestPath === MARKETING_CENTER_CHECKIN_PATH
    || requestPath === MARKETING_CENTER_CARD_REDEEM_PATH
    || requestPath === MARKETING_CENTER_MEMBERSHIP_ORDER_PATH
    || requestPath === MARKETING_CENTER_RECHARGE_ORDER_PATH
}
