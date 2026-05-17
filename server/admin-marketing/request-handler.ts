import { sendJson } from '../ai-gateway/shared'
import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { invalidateAdminCaches } from '../shared/admin-cache'
import { recordAdminAuditLog } from '../shared/admin-audit'
import {
  ADMIN_MARKETING_CARD_BATCHES_PATH,
  ADMIN_MARKETING_MEMBERSHIP_LEVELS_PATH,
  ADMIN_MARKETING_MEMBERSHIP_PLANS_PATH,
  ADMIN_MARKETING_OVERVIEW_PATH,
  ADMIN_MARKETING_POINT_LOGS_PATH,
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
  listAdminPointLogs,
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

const recordMarketingAudit = async (
  req: any,
  currentUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  beforeJson: unknown,
  afterJson: unknown,
) => {
  await recordAdminAuditLog({
    req,
    operatorUserId: currentUserId,
    action,
    targetType,
    targetId,
    beforeJson,
    afterJson,
  })
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

    if (req.method === 'GET' && requestPath === ADMIN_MARKETING_POINT_LOGS_PATH) {
      const requestUrl = new URL(String(req.url || ''), 'http://127.0.0.1')
      const data = await listAdminPointLogs({
        days: Number(requestUrl.searchParams.get('days') || 30),
        page: Number(requestUrl.searchParams.get('page') || 1),
        pageSize: Number(requestUrl.searchParams.get('pageSize') || 10),
        action: String(requestUrl.searchParams.get('action') || ''),
        sourceType: String(requestUrl.searchParams.get('sourceType') || ''),
        endpointType: String(requestUrl.searchParams.get('endpointType') || ''),
        refundStatus: String(requestUrl.searchParams.get('refundStatus') || ''),
        keyword: String(requestUrl.searchParams.get('keyword') || ''),
      })
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
      await recordAdminAuditLog({
        req,
        operatorUserId: currentUser.id,
        action: 'admin_generation_points_compensate',
        targetType: 'point_account_log',
        targetId: Array.isArray(payload.associationNos) ? payload.associationNos.join(',') : '',
        beforeJson: {
          request: payload,
        },
        afterJson: data,
      })
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
        const data = await saveMembershipLevel(payload)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_membership_level_create', 'membership_level', data.id, null, data)
        sendJson(res, 200, { data, message: '会员等级已保存' })
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
        const data = await saveMembershipLevel(payload, id)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_membership_level_update', 'membership_level', id, { request: payload }, data)
        sendJson(res, 200, { data, message: '会员等级已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteMembershipLevel(id)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_membership_level_delete', 'membership_level', id, null, { deleted: true })
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
        const data = await saveMembershipPlan(payload)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_membership_plan_create', 'membership_plan', data.id, null, data)
        sendJson(res, 200, { data, message: '会员计划已保存' })
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
        const data = await saveMembershipPlan(payload, id)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_membership_plan_update', 'membership_plan', id, { request: payload }, data)
        sendJson(res, 200, { data, message: '会员计划已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteMembershipPlan(id)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_membership_plan_delete', 'membership_plan', id, null, { deleted: true })
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
        const data = await saveRechargePackage(payload)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_recharge_package_create', 'recharge_package', data.id, null, data)
        sendJson(res, 200, { data, message: '充值套餐已保存' })
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
        const data = await saveRechargePackage(payload, id)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_recharge_package_update', 'recharge_package', id, { request: payload }, data)
        sendJson(res, 200, { data, message: '充值套餐已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteRechargePackage(id)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_recharge_package_delete', 'recharge_package', id, null, { deleted: true })
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
        const data = await saveRewardRule(payload)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_reward_rule_create', 'reward_rule', data.id, null, data)
        sendJson(res, 200, { data, message: '奖励规则已保存' })
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
        const data = await saveRewardRule(payload, id)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_reward_rule_update', 'reward_rule', id, { request: payload }, data)
        sendJson(res, 200, { data, message: '奖励规则已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteRewardRule(id)
        await invalidateAdminCaches({ marketing: true })
        await recordMarketingAudit(req, currentUser.id, 'admin_reward_rule_delete', 'reward_rule', id, null, { deleted: true })
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
        const data = await saveCardBatch(payload)
        await recordMarketingAudit(req, currentUser.id, 'admin_card_batch_create', 'card_batch', data.id, null, data)
        sendJson(res, 200, { data, message: '卡密批次已保存' })
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
        const data = await saveCardBatch(payload, id)
        await recordMarketingAudit(req, currentUser.id, 'admin_card_batch_update', 'card_batch', id, { request: payload }, data)
        sendJson(res, 200, { data, message: '卡密批次已更新' })
        return
      }
      if (req.method === 'DELETE') {
        await deleteCardBatch(id)
        await recordMarketingAudit(req, currentUser.id, 'admin_card_batch_delete', 'card_batch', id, null, { deleted: true })
        sendJson(res, 200, { data: true, message: '卡密批次已删除' })
        return
      }
    }

    sendMarketingError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendMarketingError(res, 500, error?.message || '处理营销中心请求失败')
  }
}
