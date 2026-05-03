import { readCurrentSessionUser, requireCurrentSessionUser } from '../auth/session'
import { sendJson } from '../ai-gateway/shared'
import {
  MARKETING_CENTER_CARD_REDEEM_PATH,
  MARKETING_CENTER_CHECKIN_PATH,
  MARKETING_CENTER_MEMBERSHIP_ORDER_PATH,
  MARKETING_CENTER_OVERVIEW_PATH,
  MARKETING_CENTER_RECHARGE_ORDER_PATH,
} from './constants'
import {
  createMembershipPurchaseOrder,
  createRechargePurchaseOrder,
  getMarketingCenterOverview,
  performUserCheckin,
  redeemCardCode,
} from './service'
import {
  readMarketingCenterBody,
  sendMarketingCenterError,
  type MarketingCenterCardRedeemPayload,
  type MarketingCenterMembershipOrderPayload,
  type MarketingCenterRechargeOrderPayload,
} from './shared'

// 处理用户侧营销中心请求。
export const handleMarketingCenterRequest = async (req: any, res: any) => {
  try {
    const requestPath = String(req.url || '').split('?')[0] || ''

    if (req.method === 'GET' && requestPath === MARKETING_CENTER_OVERVIEW_PATH) {
      const currentUser = await readCurrentSessionUser(req)
      sendJson(res, 200, { data: await getMarketingCenterOverview(currentUser?.id || null) })
      return
    }

    const currentUser = await requireCurrentSessionUser(req, res)
    if (!currentUser) {
      return
    }

    if (req.method === 'POST' && requestPath === MARKETING_CENTER_CHECKIN_PATH) {
      sendJson(res, 200, {
        data: await performUserCheckin(currentUser.id),
        message: '签到成功',
      })
      return
    }

    if (req.method === 'POST' && requestPath === MARKETING_CENTER_CARD_REDEEM_PATH) {
      const payload = await readMarketingCenterBody<MarketingCenterCardRedeemPayload>(req)
      sendJson(res, 200, {
        data: await redeemCardCode(currentUser.id, String(payload.code || '').trim()),
        message: '卡密兑换成功',
      })
      return
    }

    if (req.method === 'POST' && requestPath === MARKETING_CENTER_MEMBERSHIP_ORDER_PATH) {
      const payload = await readMarketingCenterBody<MarketingCenterMembershipOrderPayload>(req)
      sendJson(res, 200, {
        data: await createMembershipPurchaseOrder(currentUser.id, String(payload.planId || '').trim()),
        message: '会员已开通',
      })
      return
    }

    if (req.method === 'POST' && requestPath === MARKETING_CENTER_RECHARGE_ORDER_PATH) {
      const payload = await readMarketingCenterBody<MarketingCenterRechargeOrderPayload>(req)
      sendJson(res, 200, {
        data: await createRechargePurchaseOrder(currentUser.id, String(payload.rechargePackageId || '').trim()),
        message: '充值已到账',
      })
      return
    }

    sendMarketingCenterError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendMarketingCenterError(res, 500, error?.message || '处理营销中心请求失败')
  }
}
