import { sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import {
  ADMIN_MARKETING_CARD_BATCHES_PATH,
  ADMIN_MARKETING_MEMBERSHIP_LEVELS_PATH,
  ADMIN_MARKETING_MEMBERSHIP_PLANS_PATH,
  ADMIN_MARKETING_OVERVIEW_PATH,
  ADMIN_MARKETING_POINT_COMPENSATION_CANDIDATES_PATH,
  ADMIN_MARKETING_POINT_COMPENSATION_EXECUTE_PATH,
  ADMIN_MARKETING_RECHARGE_PACKAGES_PATH,
  ADMIN_MARKETING_REWARD_RULES_PATH,
} from './constants'
import {
  deleteCardBatch,
  deleteMembershipLevel,
  deleteMembershipPlan,
  deleteRechargePackage,
  deleteRewardRule,
  executeGenerationPointCompensation,
  getAdminMarketingOverview,
  listCardBatches,
  listGenerationPointCompensationCandidates,
  listCardCodesByBatch,
  listMembershipLevels,
  listMembershipPlans,
  listRechargePackages,
  listRewardRules,
  saveCardBatch,
  saveMembershipLevel,
  saveMembershipPlan,
  saveRechargePackage,
  saveRewardRule,
} from './service'
import {
  type MarketingCardBatchPayload,
  type MarketingPointCompensationExecutePayload,
  type MarketingMembershipLevelPayload,
  type MarketingMembershipPlanPayload,
  type MarketingRechargePackagePayload,
  type MarketingRewardRulePayload,
  readMarketingBody,
  sendMarketingError,
} from './shared'

const readRequestPath = (req: any) => String(req.url || '').split('?')[0]

const readEntityId = (requestPath: string, basePath: string) => {
  const suffix = requestPath.slice(basePath.length)
  const parts = suffix.split('/').filter(Boolean)
  return parts[0] || ''
}

// 处理营销中心后台接口。
export const handleAdminMarketingRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendMarketingError(res, 500, '缺少 DATABASE_URL，暂时无法使用营销中心。')
      return
    }

    const currentUser = await requireAdminSessionUser(req, res)
    if (!currentUser) {
      return
    }

    const requestPath = readRequestPath(req)

    if (req.method === 'GET' && requestPath === ADMIN_MARKETING_OVERVIEW_PATH) {
      const data = await getAdminMarketingOverview()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && requestPath === ADMIN_MARKETING_POINT_COMPENSATION_CANDIDATES_PATH) {
      const requestUrl = new URL(String(req.url || ''), 'http://127.0.0.1')
      const data = await listGenerationPointCompensationCandidates({
        days: Number(requestUrl.searchParams.get('days') || 7),
        limit: Number(requestUrl.searchParams.get('limit') || 50),
      })
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && requestPath === ADMIN_MARKETING_POINT_COMPENSATION_EXECUTE_PATH) {
      const payload = await readMarketingBody<MarketingPointCompensationExecutePayload>(req)
      const data = await executeGenerationPointCompensation(payload, currentUser.id)
      sendJson(res, 200, { data, message: '积分补偿已执行' })
      return
    }

    if (requestPath === ADMIN_MARKETING_MEMBERSHIP_LEVELS_PATH) {
      if (req.method === 'GET') {
        sendJson(res, 200, { data: await listMembershipLevels() })
        return
      }
      if (req.method === 'POST') {
        const payload = await readMarketingBody<MarketingMembershipLevelPayload>(req)
        sendJson(res, 200, { data: await saveMembershipLevel(payload), message: '会员等级已保存' })
        return
      }
    }

    if (requestPath.startsWith(`${ADMIN_MARKETING_MEMBERSHIP_LEVELS_PATH}/`)) {
      const id = readEntityId(requestPath, ADMIN_MARKETING_MEMBERSHIP_LEVELS_PATH)
      if (!id) {
        sendMarketingError(res, 400, '缺少会员等级ID')
        return
      }
      if (req.method === 'PUT') {
        const payload = await readMarketingBody<MarketingMembershipLevelPayload>(req)
        sendJson(res, 200, { data: await saveMembershipLevel(payload, id), message: '会员等级已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteMembershipLevel(id)
        sendJson(res, 200, { data: true, message: '会员等级已删除' })
        return
      }
    }

    if (requestPath === ADMIN_MARKETING_MEMBERSHIP_PLANS_PATH) {
      if (req.method === 'GET') {
        sendJson(res, 200, { data: await listMembershipPlans() })
        return
      }
      if (req.method === 'POST') {
        const payload = await readMarketingBody<MarketingMembershipPlanPayload>(req)
        sendJson(res, 200, { data: await saveMembershipPlan(payload), message: '会员计划已保存' })
        return
      }
    }

    if (requestPath.startsWith(`${ADMIN_MARKETING_MEMBERSHIP_PLANS_PATH}/`)) {
      const id = readEntityId(requestPath, ADMIN_MARKETING_MEMBERSHIP_PLANS_PATH)
      if (!id) {
        sendMarketingError(res, 400, '缺少会员计划ID')
        return
      }
      if (req.method === 'PUT') {
        const payload = await readMarketingBody<MarketingMembershipPlanPayload>(req)
        sendJson(res, 200, { data: await saveMembershipPlan(payload, id), message: '会员计划已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteMembershipPlan(id)
        sendJson(res, 200, { data: true, message: '会员计划已删除' })
        return
      }
    }

    if (requestPath === ADMIN_MARKETING_RECHARGE_PACKAGES_PATH) {
      if (req.method === 'GET') {
        sendJson(res, 200, { data: await listRechargePackages() })
        return
      }
      if (req.method === 'POST') {
        const payload = await readMarketingBody<MarketingRechargePackagePayload>(req)
        sendJson(res, 200, { data: await saveRechargePackage(payload), message: '充值套餐已保存' })
        return
      }
    }

    if (requestPath.startsWith(`${ADMIN_MARKETING_RECHARGE_PACKAGES_PATH}/`)) {
      const id = readEntityId(requestPath, ADMIN_MARKETING_RECHARGE_PACKAGES_PATH)
      if (!id) {
        sendMarketingError(res, 400, '缺少充值套餐ID')
        return
      }
      if (req.method === 'PUT') {
        const payload = await readMarketingBody<MarketingRechargePackagePayload>(req)
        sendJson(res, 200, { data: await saveRechargePackage(payload, id), message: '充值套餐已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteRechargePackage(id)
        sendJson(res, 200, { data: true, message: '充值套餐已删除' })
        return
      }
    }

    if (requestPath === ADMIN_MARKETING_REWARD_RULES_PATH) {
      if (req.method === 'GET') {
        sendJson(res, 200, { data: await listRewardRules() })
        return
      }
      if (req.method === 'POST') {
        const payload = await readMarketingBody<MarketingRewardRulePayload>(req)
        sendJson(res, 200, { data: await saveRewardRule(payload), message: '奖励规则已保存' })
        return
      }
    }

    if (requestPath.startsWith(`${ADMIN_MARKETING_REWARD_RULES_PATH}/`)) {
      const id = readEntityId(requestPath, ADMIN_MARKETING_REWARD_RULES_PATH)
      if (!id) {
        sendMarketingError(res, 400, '缺少奖励规则ID')
        return
      }
      if (req.method === 'PUT') {
        const payload = await readMarketingBody<MarketingRewardRulePayload>(req)
        sendJson(res, 200, { data: await saveRewardRule(payload, id), message: '奖励规则已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteRewardRule(id)
        sendJson(res, 200, { data: true, message: '奖励规则已删除' })
        return
      }
    }

    if (requestPath === ADMIN_MARKETING_CARD_BATCHES_PATH) {
      if (req.method === 'GET') {
        sendJson(res, 200, { data: await listCardBatches() })
        return
      }
      if (req.method === 'POST') {
        const payload = await readMarketingBody<MarketingCardBatchPayload>(req)
        sendJson(res, 200, { data: await saveCardBatch(payload), message: '卡密批次已保存' })
        return
      }
    }

    if (requestPath.startsWith(`${ADMIN_MARKETING_CARD_BATCHES_PATH}/`)) {
      const id = readEntityId(requestPath, ADMIN_MARKETING_CARD_BATCHES_PATH)
      if (!id) {
        sendMarketingError(res, 400, '缺少卡密批次ID')
        return
      }

      if (req.method === 'GET' && requestPath.endsWith('/codes')) {
        sendJson(res, 200, { data: await listCardCodesByBatch(id) })
        return
      }

      if (req.method === 'PUT') {
        const payload = await readMarketingBody<MarketingCardBatchPayload>(req)
        sendJson(res, 200, { data: await saveCardBatch(payload, id), message: '卡密批次已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteCardBatch(id)
        sendJson(res, 200, { data: true, message: '卡密批次已删除' })
        return
      }
    }

    sendMarketingError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendMarketingError(res, 500, error?.message || '处理营销中心请求失败')
  }
}
