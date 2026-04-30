import crypto from 'node:crypto'
import prisma from '../db/prisma'
import { refundGenerationPoints } from '../marketing-center/service'
import type {
  MarketingCardBatchPayload,
  MarketingPointCompensationExecutePayload,
  MarketingPointLogQueryPayload,
  MarketingPointCompensationQueryPayload,
  MarketingMembershipBillingRulePayload,
  MarketingMembershipLevelPayload,
  MarketingMembershipPlanPayload,
  MarketingRechargePackagePayload,
  MarketingRewardRulePayload,
} from './shared'

const toInt = (value: unknown, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback
}

const toDecimal = (value: unknown, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const toStringValue = (value: unknown, fallback = '') => String(value || fallback).trim()

const toNullableString = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

const toBoolean = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') return value
  if (value === 'false') return false
  if (value === 'true') return true
  return fallback
}

const toJsonValue = (value: unknown) => {
  if (value === undefined) return null
  return value as any
}

const toDateValue = (value: unknown) => {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

// Prisma Decimal 在 JSON 序列化前需要先拍平成字符串金额，否则前端会收到对象结构。
const isDecimalLike = (value: unknown): value is { toNumber?: () => number; toString: () => string } => {
  return Boolean(
    value
    && typeof value === 'object'
    && (
      typeof (value as { toNumber?: () => number }).toNumber === 'function'
      || (value as { constructor?: { name?: string } }).constructor?.name === 'Decimal'
    ),
  )
}

// 将 Prisma 返回结果中的 BigInt / Decimal 递归转换为可序列化值，金额统一返回字符串。
const serializeMarketingRecord = <T>(value: T): T => {
  if (typeof value === 'bigint') {
    return Number(value) as T
  }

  if (isDecimalLike(value)) {
    return value.toString() as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeMarketingRecord(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializeMarketingRecord(item)]),
    ) as T
  }

  return value
}


const normalizeMembershipDurationType = (durationType: unknown, durationUnit: unknown, durationValue: unknown) => {
  const normalizedType = toStringValue(durationType).toUpperCase()
  if (['MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR', 'FOREVER', 'CUSTOM'].includes(normalizedType)) {
    return normalizedType as any
  }

  const normalizedUnit = toStringValue(durationUnit, 'MONTH').toUpperCase()
  const numericValue = Math.max(1, toInt(durationValue, 1))
  if (normalizedUnit === 'YEAR') {
    return 'YEAR' as any
  }
  if (normalizedUnit === 'MONTH' && numericValue === 12) {
    return 'YEAR' as any
  }
  if (normalizedUnit === 'MONTH' && numericValue === 6) {
    return 'HALF_YEAR' as any
  }
  if (normalizedUnit === 'MONTH' && numericValue === 3) {
    return 'QUARTER' as any
  }
  if (normalizedUnit === 'MONTH' && numericValue === 1) {
    return 'MONTH' as any
  }
  return 'CUSTOM' as any
}

const normalizeRewardTriggerType = (triggerType: unknown) => {
  const normalizedType = toStringValue(triggerType, 'LOGIN_DAILY').toUpperCase()
  if (normalizedType === 'LOGIN') return 'LOGIN_DAILY' as any
  if (normalizedType === 'REGISTER') return 'REGISTER_ONCE' as any
  if (normalizedType === 'CHECKIN') return 'CHECKIN_DAILY' as any
  return (normalizedType || 'LOGIN_DAILY') as any
}

interface NormalizedMembershipBillingRule {
  levelId: string
  salesPrice: number
  originalPrice: number | null
  label: string | null
  status: boolean
}

// 按 BuildingAI 的 billing 结构保存会员计划计费规则。
const normalizeMembershipBillingRules = (payload: MarketingMembershipPlanPayload) => {
  const rawRules = Array.isArray(payload.billingRules) ? payload.billingRules : []
  const normalizedRules = rawRules.map((item) => ({
    levelId: toStringValue((item as MarketingMembershipBillingRulePayload)?.levelId),
    salesPrice: toDecimal((item as MarketingMembershipBillingRulePayload)?.salesPrice, 0),
    originalPrice: (item as MarketingMembershipBillingRulePayload)?.originalPrice === null || (item as MarketingMembershipBillingRulePayload)?.originalPrice === undefined || String((item as MarketingMembershipBillingRulePayload)?.originalPrice || '').trim() === '' ? null : toDecimal((item as MarketingMembershipBillingRulePayload)?.originalPrice, 0),
    label: toNullableString((item as MarketingMembershipBillingRulePayload)?.label),
    status: toBoolean((item as MarketingMembershipBillingRulePayload)?.status, true),
  })).filter((item) => item.levelId)

  const uniqueRules = new Map<string, NormalizedMembershipBillingRule>()
  for (const item of normalizedRules) {
    // 同一个等级只保留最后一次编辑结果，避免重复等级导致前后台展示不一致。
    uniqueRules.set(item.levelId, item)
  }

  return Array.from(uniqueRules.values())
}

// 从计划 JSON 中提取权益和计费配置。
const parseMembershipPlanBenefits = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return {
      benefits: Array.isArray(record.benefits) ? record.benefits : [],
      billing: Array.isArray(record.billing) ? record.billing : [],
    }
  }

  return {
    benefits: Array.isArray(value) ? value : [],
    billing: [],
  }
}

const pickDefaultMembershipBillingRule = (billingRules: NormalizedMembershipBillingRule[]) => {
  return billingRules.find((item) => item.status) || billingRules[0] || null
}

// 对返回记录补齐 billingRules 和默认展示价格，便于后台与前台统一消费。
const decorateMembershipPlanRecord = (record: any, levelMap: Map<string, any>) => {
  const planConfig = parseMembershipPlanBenefits(record.benefitsJson)
  const billingRules = (Array.isArray(planConfig.billing) ? planConfig.billing : []).map((item) => ({
    levelId: toStringValue((item as Record<string, unknown>)?.levelId),
    salesPrice: toDecimal((item as Record<string, unknown>)?.salesPrice, 0),
    originalPrice: (item as Record<string, unknown>)?.originalPrice === null || (item as Record<string, unknown>)?.originalPrice === undefined || String((item as Record<string, unknown>)?.originalPrice || '').trim() === '' ? null : toDecimal((item as Record<string, unknown>)?.originalPrice, 0),
    label: toNullableString((item as Record<string, unknown>)?.label),
    status: toBoolean((item as Record<string, unknown>)?.status, true),
  })).filter((item) => item.levelId).map((item) => ({
    ...item,
    level: levelMap.get(item.levelId) || null,
  }))
  const defaultRule = pickDefaultMembershipBillingRule(billingRules)

  return {
    ...record,
    levelId: defaultRule?.levelId || '',
    salesPrice: defaultRule?.salesPrice ?? 0,
    originalPrice: defaultRule?.originalPrice ?? null,
    label: defaultRule?.label ?? record.label,
    level: defaultRule?.level || null,
    benefitsJson: planConfig.benefits,
    billingRules,
  }
}

const createCardCode = () => {
  // 生成 12 位大写字母数字混合卡密，尽量贴近 BuildingAI 的使用习惯。
  return crypto.randomBytes(8).toString('base64url').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12)
}

interface GenerationPointCompensationCandidate {
  associationNo: string
  sourceId: string
  userId: string
  pointCost: number
  endpointType: 'chat' | 'image' | 'video'
  providerId: string
  modelKey: string
  modelName: string
  taskType: string
  generationRecordId: string
  generationStatus: string
  generationPrompt: string
  generationErrorMessage: string
  consumedAt: string
  canCompensate: boolean
  compensationReason: string
}

interface AdminPointLogListItem {
  id: string
  userId: string
  accountNo: string
  changeType: string
  action: string
  changeAmount: number
  balanceAfter: number
  availableAmount: number
  sourceType: string
  sourceId: string
  associationNo: string
  remark: string
  endpointType: string
  providerId: string
  modelKey: string
  modelName: string
  generationRecordId: string
  generationStatus: string
  generationPrompt: string
  generationErrorMessage: string
  taskType: string
  createdAt: string
  refunded: boolean
  canCompensate: boolean
  compensationReason: string
}

const readPointLogMeta = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

const normalizeEndpointType = (value: unknown): 'chat' | 'image' | 'video' | '' => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'chat' || normalized === 'image' || normalized === 'video') {
    return normalized
  }
  return ''
}

const buildPointCompensationCandidate = (input: {
  consumeLog: any
  generationRecord?: any | null
}) => {
  const meta = readPointLogMeta(input.consumeLog.metaJson)
  const endpointType = normalizeEndpointType(meta.endpointType)
  const generationStatus = String(input.generationRecord?.status || '').trim()
  const hasRefund = false
  const generationRecordId = String(meta.generationRecordId || '').trim()
  const canCompensate = Boolean(
    !hasRefund
    && endpointType
    && generationRecordId
    && (generationStatus === 'FAILED' || generationStatus === 'STOPPED'),
  )

  return {
    associationNo: String(input.consumeLog.associationNo || input.consumeLog.sourceId || '').trim(),
    sourceId: String(input.consumeLog.sourceId || '').trim(),
    userId: String(input.consumeLog.userId || '').trim(),
    pointCost: Number(input.consumeLog.changeAmount || 0),
    endpointType: endpointType || 'chat',
    providerId: String(meta.providerId || '').trim(),
    modelKey: String(meta.modelKey || '').trim(),
    modelName: String(meta.modelName || '').trim(),
    taskType: String(meta.taskType || '').trim(),
    generationRecordId,
    generationStatus,
    generationPrompt: String(input.generationRecord?.prompt || '').trim(),
    generationErrorMessage: String(input.generationRecord?.errorMessage || '').trim(),
    consumedAt: input.consumeLog.createdAt instanceof Date
      ? input.consumeLog.createdAt.toISOString()
      : String(input.consumeLog.createdAt || ''),
    canCompensate,
    compensationReason: canCompensate
      ? '生成任务失败但未发现退款流水'
      : generationRecordId
        ? '当前记录未处于失败/停止状态'
        : '消费流水缺少生成记录关联，需走手动补偿',
  } satisfies GenerationPointCompensationCandidate
}

const buildAdminPointLogItem = (input: {
  pointLog: any
  refundedAssociationNos: Set<string>
  generationRecord?: any | null
}) => {
  const meta = readPointLogMeta(input.pointLog.metaJson)
  const endpointType = normalizeEndpointType(meta.endpointType)
  const associationNo = String(input.pointLog.associationNo || input.pointLog.sourceId || '').trim()
  const generationRecordId = String(meta.generationRecordId || '').trim()
  const generationStatus = String(input.generationRecord?.status || '').trim()
  const isConsumeLog = String(input.pointLog.changeType || '').toUpperCase() === 'CONSUME'
  const refunded = associationNo ? input.refundedAssociationNos.has(associationNo) : false
  const canCompensate = Boolean(
    isConsumeLog
    && !refunded
    && endpointType
    && generationRecordId
    && (generationStatus === 'FAILED' || generationStatus === 'STOPPED'),
  )

  return {
    id: String(input.pointLog.id || '').trim(),
    userId: String(input.pointLog.userId || '').trim(),
    accountNo: String(input.pointLog.accountNo || '').trim(),
    changeType: String(input.pointLog.changeType || '').trim(),
    action: String(input.pointLog.action || '').trim(),
    changeAmount: Number(input.pointLog.changeAmount || 0),
    balanceAfter: Number(input.pointLog.balanceAfter || 0),
    availableAmount: Number(input.pointLog.availableAmount || 0),
    sourceType: String(input.pointLog.sourceType || '').trim(),
    sourceId: String(input.pointLog.sourceId || '').trim(),
    associationNo,
    remark: String(input.pointLog.remark || '').trim(),
    endpointType,
    providerId: String(meta.providerId || '').trim(),
    modelKey: String(meta.modelKey || '').trim(),
    modelName: String(meta.modelName || '').trim(),
    generationRecordId,
    generationStatus,
    generationPrompt: String(input.generationRecord?.prompt || '').trim(),
    generationErrorMessage: String(input.generationRecord?.errorMessage || '').trim(),
    taskType: String(meta.taskType || '').trim(),
    createdAt: input.pointLog.createdAt instanceof Date
      ? input.pointLog.createdAt.toISOString()
      : String(input.pointLog.createdAt || ''),
    refunded,
    canCompensate,
    compensationReason: canCompensate
      ? '失败任务未退款，可直接补偿'
      : refunded
        ? '该关联号已存在退款流水'
        : generationRecordId
          ? '当前流水不可补偿'
          : '当前流水未关联生成记录',
  } satisfies AdminPointLogListItem
}

// 查询后台积分流水明细，支持按动作、来源、终端类型、退款状态和关键词筛选。
export const listAdminPointLogs = async (query: MarketingPointLogQueryPayload = {}) => {
  const days = Math.min(180, Math.max(1, toInt(query.days, 30)))
  const page = Math.max(1, toInt(query.page, 1))
  const pageSize = Math.min(100, Math.max(10, toInt(query.pageSize, 10)))
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const action = toStringValue(query.action).toUpperCase()
  const sourceType = toStringValue(query.sourceType).toUpperCase()
  const endpointType = normalizeEndpointType(query.endpointType)
  const refundStatus = toStringValue(query.refundStatus).toLowerCase()
  const keyword = toStringValue(query.keyword).toLowerCase()

  const pointLogs = await prisma.pointAccountLog.findMany({
    where: {
      createdAt: {
        gte: startTime,
      },
      ...(action ? { action: action as any } : {}),
      ...(sourceType ? { sourceType: sourceType as any } : {}),
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
  })

  const associationNos = Array.from(new Set(
    pointLogs
      .map((item) => String(item.associationNo || item.sourceId || '').trim())
      .filter(Boolean),
  ))

  const refundLogs = associationNos.length
    ? await prisma.pointAccountLog.findMany({
      where: {
        sourceType: 'GENERATION_CONSUME',
        changeType: 'REFUND',
        associationNo: {
          in: associationNos,
        },
      },
      select: {
        associationNo: true,
      },
    })
    : []

  const refundedAssociationNos = new Set(
    refundLogs.map((item) => String(item.associationNo || '').trim()).filter(Boolean),
  )

  const generationRecordIds = Array.from(new Set(
    pointLogs
      .map((item) => String(readPointLogMeta(item.metaJson).generationRecordId || '').trim())
      .filter(Boolean),
  ))

  const generationRecords = generationRecordIds.length
    ? await prisma.generationRecord.findMany({
      where: {
        id: {
          in: generationRecordIds,
        },
      },
      select: {
        id: true,
        status: true,
        prompt: true,
        errorMessage: true,
      },
    })
    : []

  const generationRecordMap = new Map(generationRecords.map((item) => [item.id, item]))

  const filteredItems = pointLogs
    .map((pointLog) => {
      const generationRecordId = String(readPointLogMeta(pointLog.metaJson).generationRecordId || '').trim()
      return buildAdminPointLogItem({
        pointLog,
        refundedAssociationNos,
        generationRecord: generationRecordId ? generationRecordMap.get(generationRecordId) || null : null,
      })
    })
    .filter((item) => {
      if (endpointType && item.endpointType !== endpointType) {
        return false
      }
      if (refundStatus === 'compensable' && !item.canCompensate) {
        return false
      }
      if (refundStatus === 'refunded' && !item.refunded) {
        return false
      }
      if (refundStatus === 'unrefunded' && item.refunded) {
        return false
      }
      if (keyword) {
        const haystack = [
          item.accountNo,
          item.associationNo,
          item.sourceId,
          item.userId,
          item.remark,
          item.modelName,
          item.modelKey,
          item.generationPrompt,
          item.generationErrorMessage,
        ].join(' ').toLowerCase()
        if (!haystack.includes(keyword)) {
          return false
        }
      }
      return true
    })

  const totalCount = filteredItems.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const items = filteredItems.slice(startIndex, startIndex + pageSize)

  return serializeMarketingRecord({
    summary: {
      totalCount,
      compensableCount: filteredItems.filter((item) => item.canCompensate).length,
      refundCount: filteredItems.filter((item) => item.refunded).length,
      windowDays: days,
      page: currentPage,
      pageSize,
      totalPages,
    },
    items,
  })
}

// 查询生成任务积分补偿候选列表，只返回失败/停止且尚未退款的可补偿任务。
export const listGenerationPointCompensationCandidates = async (query: MarketingPointCompensationQueryPayload = {}) => {
  const days = Math.min(90, Math.max(1, toInt(query.days, 7)))
  const limit = Math.min(200, Math.max(1, toInt(query.limit, 50)))
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const consumeLogs = await prisma.pointAccountLog.findMany({
    where: {
      sourceType: 'GENERATION_CONSUME',
      changeType: 'CONSUME',
      createdAt: {
        gte: startTime,
      },
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    take: limit * 4,
  })

  const associationNos = consumeLogs
    .map((item) => String(item.associationNo || item.sourceId || '').trim())
    .filter(Boolean)

  const refundLogs = associationNos.length
    ? await prisma.pointAccountLog.findMany({
      where: {
        sourceType: 'GENERATION_CONSUME',
        changeType: 'REFUND',
        associationNo: {
          in: associationNos,
        },
      },
      select: {
        associationNo: true,
      },
    })
    : []

  const refundedAssociationNos = new Set(
    refundLogs
      .map((item) => String(item.associationNo || '').trim())
      .filter(Boolean),
  )

  const generationRecordIds = consumeLogs
    .map((item) => String(readPointLogMeta(item.metaJson).generationRecordId || '').trim())
    .filter(Boolean)

  const generationRecords = generationRecordIds.length
    ? await prisma.generationRecord.findMany({
      where: {
        id: {
          in: generationRecordIds,
        },
      },
      select: {
        id: true,
        status: true,
        prompt: true,
        errorMessage: true,
      },
    })
    : []

  const generationRecordMap = new Map(generationRecords.map((item) => [item.id, item]))

  const candidates = consumeLogs
    .filter((item) => {
      const associationNo = String(item.associationNo || item.sourceId || '').trim()
      return associationNo && !refundedAssociationNos.has(associationNo)
    })
    .map((item) => {
      const generationRecordId = String(readPointLogMeta(item.metaJson).generationRecordId || '').trim()
      return buildPointCompensationCandidate({
        consumeLog: item,
        generationRecord: generationRecordId ? generationRecordMap.get(generationRecordId) || null : null,
      })
    })
    .filter((item) => item.canCompensate)
    .slice(0, limit)

  return serializeMarketingRecord({
    summary: {
      candidateCount: candidates.length,
      totalPointCost: candidates.reduce((sum, item) => sum + item.pointCost, 0),
      windowDays: days,
    },
    items: candidates,
  })
}

// 手动执行一次生成积分补偿。默认只允许补偿失败/停止且未退款的任务；对历史遗留可通过 forceManual 手工补偿。
export const executeGenerationPointCompensation = async (
  payload: MarketingPointCompensationExecutePayload,
  currentUserId: string,
) => {
  const associationNos = Array.from(new Set(
    (Array.isArray(payload.associationNos) ? payload.associationNos : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  ))

  if (!associationNos.length) {
    throw new Error('请先选择需要补偿的流水编号')
  }

  const note = toNullableString(payload.note)
  const forceManual = toBoolean(payload.forceManual, false)
  const consumeLogs = await prisma.pointAccountLog.findMany({
    where: {
      sourceType: 'GENERATION_CONSUME',
      changeType: 'CONSUME',
      associationNo: {
        in: associationNos,
      },
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
  })

  const consumeLogMap = new Map(
    consumeLogs.map((item) => [String(item.associationNo || item.sourceId || '').trim(), item]),
  )

  const refundLogs = await prisma.pointAccountLog.findMany({
    where: {
      sourceType: 'GENERATION_CONSUME',
      changeType: 'REFUND',
      associationNo: {
        in: associationNos,
      },
    },
    select: {
      associationNo: true,
    },
  })
  const refundedAssociationNos = new Set(
    refundLogs.map((item) => String(item.associationNo || '').trim()).filter(Boolean),
  )

  const generationRecordIds = consumeLogs
    .map((item) => String(readPointLogMeta(item.metaJson).generationRecordId || '').trim())
    .filter(Boolean)

  const generationRecords = generationRecordIds.length
    ? await prisma.generationRecord.findMany({
      where: {
        id: {
          in: generationRecordIds,
        },
      },
      select: {
        id: true,
        status: true,
        prompt: true,
        errorMessage: true,
      },
    })
    : []

  const generationRecordMap = new Map(generationRecords.map((item) => [item.id, item]))
  const refundedItems: Array<Record<string, unknown>> = []
  const skippedItems: Array<Record<string, unknown>> = []

  for (const associationNo of associationNos) {
    const consumeLog = consumeLogMap.get(associationNo)
    if (!consumeLog) {
      skippedItems.push({
        associationNo,
        reason: '未找到对应消费流水',
      })
      continue
    }

    if (refundedAssociationNos.has(associationNo)) {
      skippedItems.push({
        associationNo,
        reason: '当前流水已存在退款记录',
      })
      continue
    }

    const meta = readPointLogMeta(consumeLog.metaJson)
    const endpointType = normalizeEndpointType(meta.endpointType)
    const generationRecordId = String(meta.generationRecordId || '').trim()
    const generationRecord = generationRecordId ? generationRecordMap.get(generationRecordId) || null : null
    const generationStatus = String(generationRecord?.status || '').trim()

    if (!endpointType) {
      skippedItems.push({
        associationNo,
        reason: '流水缺少 endpointType，无法执行补偿',
      })
      continue
    }

    if (!forceManual && generationStatus !== 'FAILED' && generationStatus !== 'STOPPED') {
      skippedItems.push({
        associationNo,
        reason: generationRecordId
          ? '生成记录未处于失败或停止状态'
          : '流水缺少生成记录关联，请改用手动补偿模式',
      })
      continue
    }

    await refundGenerationPoints({
      userId: String(consumeLog.userId || '').trim(),
      pointCost: Number(consumeLog.changeAmount || 0),
      sourceId: String(consumeLog.sourceId || associationNo).trim(),
      associationNo,
      endpointType,
      providerId: String(meta.providerId || '').trim(),
      modelKey: String(meta.modelKey || '').trim(),
      modelName: String(meta.modelName || '').trim(),
      metaJson: {
        refundReason: forceManual ? 'admin_manual_compensation_force' : 'admin_manual_compensation',
        generationRecordId,
        originalConsumeLogId: consumeLog.id,
        compensatedByUserId: currentUserId,
        compensationNote: note || '',
      },
    })

    refundedItems.push({
      associationNo,
      pointCost: Number(consumeLog.changeAmount || 0),
      endpointType,
      generationRecordId,
      generationStatus,
    })
  }

  return serializeMarketingRecord({
    refundedCount: refundedItems.length,
    skippedCount: skippedItems.length,
    refundedItems,
    skippedItems,
  })
}

// 查询营销中心概览数据。
export const getAdminMarketingOverview = async () => {
  const [
    membershipLevelCount,
    membershipPlanCount,
    rechargePackageCount,
    rewardRuleCount,
    cardBatchCount,
    cardCodeCount,
    usedCardCodeCount,
  ] = await Promise.all([
    prisma.membershipLevel.count(),
    prisma.membershipPlan.count(),
    prisma.rechargePackage.count(),
    prisma.rewardRule.count(),
    prisma.cardBatch.count(),
    prisma.cardCode.count(),
    prisma.cardCode.count({ where: { status: 'USED' } }),
  ])

  return {
    membership: {
      levelCount: membershipLevelCount,
      planCount: membershipPlanCount,
    },
    recharge: {
      packageCount: rechargePackageCount,
    },
    rewards: {
      ruleCount: rewardRuleCount,
    },
    cdk: {
      batchCount: cardBatchCount,
      codeCount: cardCodeCount,
      usedCount: usedCardCodeCount,
    },
  }
}

// 查询会员等级列表。
export const listMembershipLevels = async () => {
  return serializeMarketingRecord(await prisma.membershipLevel.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { level: 'asc' },
      { createdAt: 'desc' },
    ],
  }))
}

// 保存会员等级。
export const saveMembershipLevel = async (payload: MarketingMembershipLevelPayload, id?: string) => {
  const data = {
    name: toStringValue(payload.name),
    level: toInt(payload.level, 1),
    description: toNullableString(payload.description),
    iconUrl: toNullableString(payload.iconUrl),
    monthlyBonusPoints: toInt(payload.monthlyBonusPoints, 0),
    storageCapacity: BigInt(toInt(payload.storageCapacity, 0)),
    benefitsJson: toJsonValue(payload.benefitsJson),
    isEnabled: toBoolean(payload.isEnabled, true),
    sortOrder: toInt(payload.sortOrder, 0),
  }

  if (!data.name) {
    throw new Error('会员等级名称不能为空')
  }

  if (id) {
    return serializeMarketingRecord(await prisma.membershipLevel.update({ where: { id }, data }))
  }

  return serializeMarketingRecord(await prisma.membershipLevel.create({ data }))
}

export const deleteMembershipLevel = async (id: string) => {
  return prisma.membershipLevel.delete({ where: { id } })
}

// 查询会员计划列表。
export const listMembershipPlans = async () => {
  const [records, levels] = await Promise.all([
    prisma.membershipPlan.findMany({
      include: { level: true },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    }),
    prisma.membershipLevel.findMany(),
  ])

  const levelMap = new Map(levels.map((item) => [item.id, item]))
  return serializeMarketingRecord(records.map((item) => decorateMembershipPlanRecord(item, levelMap)))
}

// 保存会员计划。
export const saveMembershipPlan = async (payload: MarketingMembershipPlanPayload, id?: string) => {
  const billingRules = normalizeMembershipBillingRules(payload)
  const defaultRule = pickDefaultMembershipBillingRule(billingRules)
  const existingBenefits = parseMembershipPlanBenefits(payload.benefitsJson).benefits

  const data = {
    levelId: defaultRule?.levelId || '',
    name: toStringValue(payload.name),
    label: defaultRule?.label || toNullableString(payload.label),
    description: toNullableString(payload.description),
    durationType: normalizeMembershipDurationType(payload.durationType, payload.durationUnit, payload.durationValue),
    durationValue: toInt(payload.durationValue, 1),
    durationUnit: toStringValue(payload.durationUnit, 'MONTH').toUpperCase() || 'MONTH',
    salesPrice: defaultRule?.salesPrice ?? 0,
    originalPrice: defaultRule?.originalPrice ?? null,
    bonusPoints: toInt(payload.bonusPoints, 0),
    benefitsJson: toJsonValue({
      benefits: existingBenefits,
      billing: billingRules,
    }),
    isEnabled: toBoolean(payload.isEnabled, true),
    sortOrder: toInt(payload.sortOrder, 0),
  }

  if (!data.name || !billingRules.length || !data.levelId) {
    throw new Error('会员计划缺少必要字段')
  }

  const savedRecord = id
    ? await prisma.membershipPlan.update({ where: { id }, data, include: { level: true } })
    : await prisma.membershipPlan.create({ data, include: { level: true } })

  const levels = await prisma.membershipLevel.findMany({
    where: { id: { in: Array.from(new Set(billingRules.map((item) => item.levelId))) } },
  })
  const levelMap = new Map(levels.map((item) => [item.id, item]))
  return serializeMarketingRecord(decorateMembershipPlanRecord(savedRecord, levelMap))
}

export const deleteMembershipPlan = async (id: string) => {
  return prisma.membershipPlan.delete({ where: { id } })
}

// 查询充值套餐列表。
export const listRechargePackages = async () => {
  return serializeMarketingRecord(await prisma.rechargePackage.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'desc' },
    ],
  }))
}

// 保存充值套餐。
export const saveRechargePackage = async (payload: MarketingRechargePackagePayload, id?: string) => {
  const data = {
    name: toStringValue(payload.name),
    label: toNullableString(payload.label),
    description: toNullableString(payload.description),
    points: toInt(payload.points, 0),
    bonusPoints: toInt(payload.bonusPoints, 0),
    price: toDecimal(payload.price, 0),
    originalPrice: payload.originalPrice === null ? null : toDecimal(payload.originalPrice, 0),
    badgeText: toNullableString(payload.badgeText),
    isEnabled: toBoolean(payload.isEnabled, true),
    sortOrder: toInt(payload.sortOrder, 0),
    metaJson: toJsonValue(payload.metaJson),
  }

  if (!data.name) {
    throw new Error('充值套餐名称不能为空')
  }

  if (id) {
    return serializeMarketingRecord(await prisma.rechargePackage.update({ where: { id }, data }))
  }

  return serializeMarketingRecord(await prisma.rechargePackage.create({ data }))
}

export const deleteRechargePackage = async (id: string) => {
  return prisma.rechargePackage.delete({ where: { id } })
}

// 查询奖励规则列表。
export const listRewardRules = async () => {
  return serializeMarketingRecord(await prisma.rewardRule.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  }))
}

// 保存奖励规则。
export const saveRewardRule = async (payload: MarketingRewardRulePayload, id?: string) => {
  const data = {
    code: toStringValue(payload.code),
    triggerType: normalizeRewardTriggerType(payload.triggerType),
    name: toStringValue(payload.name),
    description: toNullableString(payload.description),
    rewardPoints: toInt(payload.rewardPoints, 0),
    cycleType: (toStringValue(payload.cycleType, 'ONCE') || 'ONCE') as any,
    limitPerCycle: toInt(payload.limitPerCycle, 1),
    isEnabled: toBoolean(payload.isEnabled, true),
    conditionJson: toJsonValue(payload.conditionJson),
    sortOrder: toInt(payload.sortOrder, 0),
  }

  if (!data.code || !data.name) {
    throw new Error('奖励规则缺少必要字段')
  }

  if (id) {
    return serializeMarketingRecord(await prisma.rewardRule.update({ where: { id }, data }))
  }

  return serializeMarketingRecord(await prisma.rewardRule.create({ data }))
}

export const deleteRewardRule = async (id: string) => {
  return prisma.rewardRule.delete({ where: { id } })
}

// 查询卡密批次列表，同时带上部分卡密汇总。
export const listCardBatches = async () => {
  return serializeMarketingRecord(await prisma.cardBatch.findMany({
    include: {
      rewardLevel: true,
      _count: {
        select: {
          cardCodes: true,
          redeemRecords: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
  }))
}

// 查询单个批次下的卡密列表。
export const listCardCodesByBatch = async (batchId: string) => {
  return serializeMarketingRecord(await prisma.cardCode.findMany({
    where: { batchId },
    include: {
      usedByUser: true,
      rewardLevel: true,
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
  }))
}

// 保存卡密批次，并可选自动批量生成卡密。
export const saveCardBatch = async (payload: MarketingCardBatchPayload, id?: string) => {
  const totalCount = Math.max(0, toInt(payload.totalCount, 0))
  const data = {
    name: toStringValue(payload.name),
    batchNo: toStringValue(payload.batchNo) || `BATCH-${Date.now()}`,
    description: toNullableString(payload.description),
    rewardType: (toStringValue(payload.rewardType, 'POINTS') || 'POINTS') as any,
    rewardPoints: toInt(payload.rewardPoints, 0),
    rewardLevelId: toNullableString(payload.rewardLevelId),
    rewardDays: payload.rewardDays === null ? null : toInt(payload.rewardDays, 0),
    totalCount,
    expiresAt: toDateValue(payload.expiresAt),
    isEnabled: toBoolean(payload.isEnabled, true),
    metaJson: toJsonValue(payload.metaJson),
  }

  if (!data.name) {
    throw new Error('卡密批次名称不能为空')
  }

  if (id) {
    return prisma.cardBatch.update({ where: { id }, data })
  }

  return prisma.$transaction(async (tx) => {
    const createdBatch = await tx.cardBatch.create({ data })

    if (totalCount > 0) {
      const payloads = Array.from({ length: totalCount }, () => ({
        batchId: createdBatch.id,
        code: createCardCode(),
        rewardLevelId: data.rewardLevelId,
        rewardSnapshotJson: {
          rewardType: data.rewardType,
          rewardPoints: data.rewardPoints,
          rewardDays: data.rewardDays,
        },
        expiresAt: data.expiresAt,
      }))

      await tx.cardCode.createMany({ data: payloads as any })
    }

    return createdBatch
  })
}

export const deleteCardBatch = async (id: string) => {
  return prisma.cardBatch.delete({ where: { id } })
}
