import prisma from '../db/prisma'

const buildSerialNo = (prefix: string) => {
  const now = new Date()
  const pad = (value: number, size = 2) => String(value).padStart(size, '0')
  const timestamp = now.getFullYear()
    + pad(now.getMonth() + 1)
    + pad(now.getDate())
    + pad(now.getHours())
    + pad(now.getMinutes())
    + pad(now.getSeconds())
    + pad(now.getMilliseconds(), 3)
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return prefix + timestamp + random
}

const startOfToday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const formatDateKey = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

const formatMonthKey = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return date.getFullYear() + '-' + pad(date.getMonth() + 1)
}

const formatWeekKey = (date: Date) => {
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = current.getUTCDay() || 7
  current.setUTCDate(current.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((current.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return String(current.getUTCFullYear()) + '-W' + String(weekNo).padStart(2, '0')
}

// Prisma Decimal 在用户侧接口里也统一转成字符串金额，保证与后台返回格式一致。
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

// 将用户侧营销接口返回中的 BigInt / Decimal 递归转换为可序列化值。
const serializeMarketingCenterRecord = <T>(value: T): T => {
  if (typeof value === 'bigint') {
    return Number(value) as T
  }

  if (isDecimalLike(value)) {
    return value.toString() as T
  }

  // Date 需要优先转成 ISO 字符串，否则继续走对象递归时会被展开成空对象。
  if (value instanceof Date) {
    return value.toISOString() as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeMarketingCenterRecord(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializeMarketingCenterRecord(item)]),
    ) as T
  }

  return value
}

const buildCyclePrefix = (cycleType: string, now = new Date()) => {
  if (cycleType === 'DAILY') return formatDateKey(now)
  if (cycleType === 'WEEKLY') return formatWeekKey(now)
  if (cycleType === 'MONTHLY') return formatMonthKey(now)
  return 'ONCE'
}

// BuildingAI 风格会员计费规则。
const parseMembershipPlanConfig = (value: unknown) => {
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

const normalizeMembershipBillingRule = (item: Record<string, unknown>) => ({
  levelId: String(item.levelId || '').trim(),
  salesPrice: Number(item.salesPrice || 0),
  originalPrice: item.originalPrice === null || item.originalPrice === undefined || String(item.originalPrice || '').trim() === '' ? null : Number(item.originalPrice),
  label: String(item.label || '').trim() || null,
  status: item.status === false ? false : true,
})

// 一个计划可以展开为多个前台套餐卡片。
const expandMembershipPlansByBilling = (plans: any[], levels: any[]) => {
  const levelMap = new Map(levels.map((item) => [item.id, item]))

  return plans.flatMap((plan) => {
    const config = parseMembershipPlanConfig(plan.benefitsJson)
    const billingRules = (Array.isArray(config.billing) ? config.billing : [])
      .map((item) => normalizeMembershipBillingRule(item as Record<string, unknown>))
      .filter((item) => item.levelId && item.status)

    return billingRules.map((rule, index) => ({
      ...plan,
      id: `${plan.id}::${rule.levelId}`,
      planId: plan.id,
      levelId: rule.levelId,
      label: rule.label || plan.label,
      salesPrice: rule.salesPrice,
      originalPrice: rule.originalPrice,
      level: levelMap.get(rule.levelId) || null,
      benefitsJson: config.benefits,
      billingIndex: index,
      billingRules,
    }))
  })
}

const parsePlanPurchaseSelection = (value: string) => {
  const [planId, levelId] = String(value || '').split('::')
  return {
    planId: String(planId || '').trim(),
    levelId: String(levelId || '').trim(),
  }
}

const readCurrentPointBalance = async (userId: string, tx: typeof prisma | any = prisma) => {
  const latestLog = await tx.pointAccountLog.findFirst({
    where: { userId },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
  })
  return latestLog?.balanceAfter || 0
}

const appendPointLog = async (tx: any, input: {
  userId: string
  changeType: any
  action: any
  changeAmount: number
  sourceType: any
  sourceId?: string | null
  rechargeOrderId?: string | null
  subscriptionId?: string | null
  associationNo?: string | null
  remark?: string | null
  metaJson?: unknown
}) => {
  const currentBalance = await readCurrentPointBalance(input.userId, tx)
  const nextBalance = input.action === 'DECREASE'
    ? currentBalance - Math.abs(input.changeAmount)
    : currentBalance + Math.abs(input.changeAmount)

  return tx.pointAccountLog.create({
    data: {
      userId: input.userId,
      subscriptionId: input.subscriptionId || null,
      rechargeOrderId: input.rechargeOrderId || null,
      accountNo: buildSerialNo('PTS'),
      changeType: input.changeType,
      action: input.action,
      changeAmount: Math.abs(input.changeAmount),
      balanceAfter: nextBalance,
      availableAmount: nextBalance,
      sourceType: input.sourceType,
      sourceId: input.sourceId || null,
      associationNo: input.associationNo || null,
      remark: input.remark || null,
      metaJson: (input.metaJson ?? null) as any,
    },
  })
}


const readModelBillingPower = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 0
  }

  const defaultParams = value as Record<string, unknown>
  const billingRule = defaultParams.billingRule
  if (!billingRule || typeof billingRule !== 'object' || Array.isArray(billingRule)) {
    return 0
  }

  return Math.max(0, Number((billingRule as Record<string, unknown>).power || 0))
}

// 读取后台模型配置中的积分消耗规则，统一给生成链路使用。
export const resolveGenerationPointCost = async (input: {
  providerId: string
  modelKey: string
  endpointType: 'image' | 'video'
}) => {
  const providerId = String(input.providerId || '').trim()
  const modelKey = String(input.modelKey || '').trim()
  const category = String(input.endpointType || '').trim().toUpperCase()

  if (!providerId || !modelKey || (category !== 'IMAGE' && category !== 'VIDEO')) {
    return {
      pointCost: 0,
      modelId: '',
      modelName: '',
    }
  }

  const model = await prisma.aiModel.findFirst({
    where: {
      providerId,
      modelKey,
      category: category as any,
      isEnabled: true,
    },
    select: {
      id: true,
      name: true,
      defaultParamsJson: true,
    },
  })

  if (!model) {
    return {
      pointCost: 0,
      modelId: '',
      modelName: '',
    }
  }

  return {
    pointCost: readModelBillingPower(model.defaultParamsJson),
    modelId: model.id,
    modelName: model.name,
  }
}

// 在真正发起图片/视频生成前扣减积分，并落一条可追踪的消费流水。
export const consumeGenerationPoints = async (input: {
  userId: string
  pointCost: number
  sourceId: string
  associationNo: string
  endpointType: 'image' | 'video'
  providerId: string
  modelKey: string
  modelName?: string
  metaJson?: unknown
}) => {
  const pointCost = Math.max(0, Number(input.pointCost || 0))
  if (pointCost <= 0) {
    return null
  }

  return prisma.$transaction(async (tx) => {
    const currentBalance = await readCurrentPointBalance(input.userId, tx)
    if (currentBalance < pointCost) {
      const error = new Error(`积分不足，当前剩余 ${currentBalance}，需要 ${pointCost}`) as Error & {
        code?: string
        currentBalance?: number
        requiredPoints?: number
      }
      error.code = 'INSUFFICIENT_POINTS'
      error.currentBalance = currentBalance
      error.requiredPoints = pointCost
      throw error
    }

    return appendPointLog(tx, {
      userId: input.userId,
      changeType: 'CONSUME',
      action: 'DECREASE',
      changeAmount: pointCost,
      sourceType: 'GENERATION_CONSUME',
      sourceId: input.sourceId,
      associationNo: input.associationNo,
      remark: input.endpointType === 'video' ? '视频生成消耗积分' : '图片生成消耗积分',
      metaJson: {
        endpointType: input.endpointType,
        providerId: input.providerId,
        modelKey: input.modelKey,
        modelName: input.modelName || '',
        ...(input.metaJson && typeof input.metaJson === 'object' && !Array.isArray(input.metaJson)
          ? input.metaJson as Record<string, unknown>
          : {}),
      },
    })
  })
}

// 上游请求失败时自动退回本次生成消耗，避免用户为失败结果付费。
export const refundGenerationPoints = async (input: {
  userId: string
  pointCost: number
  sourceId: string
  associationNo: string
  endpointType: 'image' | 'video'
  providerId: string
  modelKey: string
  modelName?: string
  metaJson?: unknown
}) => {
  const pointCost = Math.max(0, Number(input.pointCost || 0))
  if (pointCost <= 0) {
    return null
  }

  return prisma.$transaction(async (tx) => {
    return appendPointLog(tx, {
      userId: input.userId,
      changeType: 'REFUND',
      action: 'INCREASE',
      changeAmount: pointCost,
      sourceType: 'GENERATION_CONSUME',
      sourceId: input.sourceId,
      associationNo: input.associationNo,
      remark: input.endpointType === 'video' ? '视频生成失败，积分已退回' : '图片生成失败，积分已退回',
      metaJson: {
        endpointType: input.endpointType,
        providerId: input.providerId,
        modelKey: input.modelKey,
        modelName: input.modelName || '',
        ...(input.metaJson && typeof input.metaJson === 'object' && !Array.isArray(input.metaJson)
          ? input.metaJson as Record<string, unknown>
          : {}),
      },
    })
  })
}

const addDuration = (startTime: Date, durationUnit: string, durationValue: number) => {
  const nextDate = new Date(startTime)
  const normalizedUnit = String(durationUnit || 'MONTH').toUpperCase()
  const value = Math.max(1, durationValue || 1)
  if (normalizedUnit === 'DAY') {
    nextDate.setDate(nextDate.getDate() + value)
    return nextDate
  }
  if (normalizedUnit === 'YEAR') {
    nextDate.setFullYear(nextDate.getFullYear() + value)
    return nextDate
  }
  nextDate.setMonth(nextDate.getMonth() + value)
  return nextDate
}

const activateMembership = async (tx: any, input: {
  userId: string
  levelId: string
  sourceType: any
  sourceId: string
  startTime?: Date
  durationDays?: number | null
  durationUnit?: string
  durationValue?: number
  bonusPoints?: number
  metaJson?: unknown
}) => {
  const now = input.startTime || new Date()
  const activeSubscription = await tx.userSubscription.findFirst({
    where: {
      userId: input.userId,
      levelId: input.levelId,
      status: 'ACTIVE',
      endTime: { gt: now },
    },
    orderBy: { endTime: 'desc' },
  })

  const subscriptionStartTime = activeSubscription?.endTime && activeSubscription.endTime > now
    ? activeSubscription.endTime
    : now

  const subscriptionEndTime = input.durationDays && input.durationDays > 0
    ? new Date(subscriptionStartTime.getTime() + input.durationDays * 86400000)
    : addDuration(subscriptionStartTime, input.durationUnit || 'MONTH', input.durationValue || 1)

  await tx.userSubscription.updateMany({
    where: {
      userId: input.userId,
      status: 'ACTIVE',
      levelId: { not: input.levelId },
    },
    data: {
      status: 'EXPIRED',
    },
  })

  const subscription = await tx.userSubscription.upsert({
    where: {
      userId_levelId: {
        userId: input.userId,
        levelId: input.levelId,
      },
    },
    update: {
      status: 'ACTIVE',
      startTime: subscriptionStartTime,
      endTime: subscriptionEndTime,
      updatedAt: new Date(),
    },
    create: {
      userId: input.userId,
      levelId: input.levelId,
      status: 'ACTIVE',
      startTime: subscriptionStartTime,
      endTime: subscriptionEndTime,
    },
  })

  if ((input.bonusPoints || 0) > 0) {
    await appendPointLog(tx, {
      userId: input.userId,
      subscriptionId: subscription.id,
      changeType: 'MEMBERSHIP_BONUS',
      action: 'INCREASE',
      changeAmount: input.bonusPoints || 0,
      sourceType: 'MEMBERSHIP_ORDER',
      sourceId: input.sourceId,
      associationNo: input.sourceId,
      remark: '会员开通赠送积分',
      metaJson: input.metaJson,
    })
  }

  return subscription
}

const grantRewardByTrigger = async (tx: any, input: {
  userId: string
  triggerType: 'LOGIN_DAILY' | 'REGISTER_ONCE' | 'CHECKIN_DAILY'
  sourceId?: string | null
  remark?: string
  metaJson?: unknown
}) => {
  const rewardRules = await tx.rewardRule.findMany({
    where: {
      triggerType: input.triggerType,
      isEnabled: true,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  const results: Array<{ ruleId: string; rewardPoints: number; claimId: string }> = []
  for (const rule of rewardRules) {
    const cyclePrefix = buildCyclePrefix(rule.cycleType)
    const claimedCount = await tx.rewardClaimRecord.count({
      where: {
        userId: input.userId,
        ruleId: rule.id,
        cycleKey: {
          startsWith: cyclePrefix,
        },
      },
    })

    if (claimedCount >= Math.max(1, rule.limitPerCycle || 1)) {
      continue
    }

    const claimRecord = await tx.rewardClaimRecord.create({
      data: {
        userId: input.userId,
        ruleId: rule.id,
        triggerType: rule.triggerType,
        cycleKey: cyclePrefix + '#' + String(claimedCount + 1),
        rewardPoints: rule.rewardPoints,
        claimStatus: 'SUCCESS',
        sourceId: input.sourceId || null,
        metaJson: (input.metaJson ?? null) as any,
      },
    })

    if ((rule.rewardPoints || 0) > 0) {
      await appendPointLog(tx, {
        userId: input.userId,
        changeType: 'REWARD',
        action: 'INCREASE',
        changeAmount: rule.rewardPoints,
        sourceType: rule.triggerType === 'CHECKIN_DAILY' ? 'CHECKIN' : 'REWARD_RULE',
        sourceId: claimRecord.id,
        associationNo: claimRecord.id,
        remark: input.remark || rule.name,
        metaJson: {
          triggerType: rule.triggerType,
          ruleCode: rule.code,
          ruleName: rule.name,
        },
      })
    }

    results.push({
      ruleId: rule.id,
      rewardPoints: rule.rewardPoints,
      claimId: claimRecord.id,
    })
  }

  return results
}

// 用户登录成功后触发每日登录奖励。
export const grantLoginReward = async (userId: string) => {
  return prisma.$transaction(async (tx) => {
    return grantRewardByTrigger(tx, {
      userId,
      triggerType: 'LOGIN_DAILY',
      remark: '每日登录奖励',
    })
  })
}

// 新用户注册成功后发放一次性注册奖励。
export const grantRegisterReward = async (userId: string) => {
  return prisma.$transaction(async (tx) => {
    return grantRewardByTrigger(tx, {
      userId,
      triggerType: 'REGISTER_ONCE',
      remark: '新用户注册奖励',
    })
  })
}

// 获取用户侧营销中心总览。
export const getMarketingCenterOverview = async (userId?: string | null) => {
  const [rawMembershipPlans, membershipLevels, rechargePackages, rewardRules] = await Promise.all([
    prisma.membershipPlan.findMany({
      where: { isEnabled: true },
      include: { level: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.membershipLevel.findMany({ where: { isEnabled: true } }),
    prisma.rechargePackage.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.rewardRule.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  const membershipPlans = expandMembershipPlansByBilling(rawMembershipPlans, membershipLevels)

  if (!userId) {
    return serializeMarketingCenterRecord({
      user: null,
      points: {
        balance: 0,
        available: 0,
        logs: [],
      },
      subscription: null,
      membershipPlans,
      rechargePackages,
      rewardRules,
      cardRedeemRecords: [],
      checkin: {
        checkedInToday: false,
        currentRecord: null,
      },
    })
  }

  const [currentUser, currentBalance, activeSubscription, recentPointLogs, recentRedeemRecords, todayCheckinRecord] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    }),
    readCurrentPointBalance(userId),
    prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        endTime: { gt: new Date() },
      },
      include: { level: true },
      orderBy: { endTime: 'desc' },
    }),
    prisma.pointAccountLog.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    }),
    prisma.cardRedeemRecord.findMany({
      where: { userId },
      include: { batch: true, rewardLevel: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
    }),
    prisma.userCheckinRecord.findUnique({
      where: {
        userId_checkinDate: {
          userId,
          checkinDate: formatDateKey(new Date()),
        },
      },
    }),
  ])

  return serializeMarketingCenterRecord({
    user: currentUser,
    points: {
      balance: currentBalance,
      available: currentBalance,
      logs: recentPointLogs,
    },
    subscription: activeSubscription,
    membershipPlans,
    rechargePackages,
    rewardRules,
    cardRedeemRecords: recentRedeemRecords,
    checkin: {
      checkedInToday: Boolean(todayCheckinRecord),
      currentRecord: todayCheckinRecord,
    },
  })
}

// 用户签到。
export const performUserCheckin = async (userId: string) => {
  return prisma.$transaction(async (tx) => {
    const today = formatDateKey(new Date())
    const existing = await tx.userCheckinRecord.findUnique({
      where: {
        userId_checkinDate: {
          userId,
          checkinDate: today,
        },
      },
    })
    if (existing) {
      throw new Error('今天已经签到过了')
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = formatDateKey(yesterday)
    const previousRecord = await tx.userCheckinRecord.findUnique({
      where: {
        userId_checkinDate: {
          userId,
          checkinDate: yesterdayKey,
        },
      },
    })

    const rewardResults = await grantRewardByTrigger(tx, {
      userId,
      triggerType: 'CHECKIN_DAILY',
      remark: '每日签到奖励',
      metaJson: { checkinDate: today },
    })

    const rewardPoints = rewardResults.reduce((sum, item) => sum + item.rewardPoints, 0)
    const checkinRecord = await tx.userCheckinRecord.create({
      data: {
        userId,
        rewardClaimId: rewardResults[0]?.claimId || null,
        checkinDate: today,
        consecutiveDays: previousRecord ? previousRecord.consecutiveDays + 1 : 1,
        rewardPoints,
      },
    })

    return serializeMarketingCenterRecord({
      checkinRecord,
      rewardResults,
      currentBalance: await readCurrentPointBalance(userId, tx),
    })
  })
}

// 用户购买会员计划。
export const createMembershipPurchaseOrder = async (userId: string, selectedPlanId: string) => {
  return prisma.$transaction(async (tx) => {
    const selection = parsePlanPurchaseSelection(selectedPlanId)
    const plan = await tx.membershipPlan.findFirst({
      where: { id: selection.planId, isEnabled: true },
      include: { level: true },
    })
    if (!plan) {
      throw new Error('会员计划不存在或已下架')
    }

    const planConfig = parseMembershipPlanConfig(plan.benefitsJson)
    const matchedBillingRule = (Array.isArray(planConfig.billing) ? planConfig.billing : [])
      .map((item) => normalizeMembershipBillingRule(item as Record<string, unknown>))
      .find((item) => item.levelId === selection.levelId && item.status)
    if (!matchedBillingRule) {
      throw new Error('当前会员计费规则不存在或已停用')
    }

    const now = new Date()
    const order = await tx.membershipOrder.create({
      data: {
        userId,
        levelId: matchedBillingRule.levelId,
        planId: plan.id,
        orderNo: buildSerialNo('VIP'),
        sourceType: 'DIRECT_PURCHASE',
        status: 'PAID',
        totalAmount: matchedBillingRule.salesPrice,
        paidAmount: matchedBillingRule.salesPrice,
        bonusPoints: plan.bonusPoints,
        startTime: now,
        endTime: addDuration(now, plan.durationUnit, plan.durationValue),
        paidAt: now,
        metaJson: {
          planName: plan.name,
          durationType: plan.durationType,
          durationValue: plan.durationValue,
          durationUnit: plan.durationUnit,
          billingLevelId: matchedBillingRule.levelId,
          billingLabel: matchedBillingRule.label,
        },
      },
    })

    const subscription = await activateMembership(tx, {
      userId,
      levelId: matchedBillingRule.levelId,
      sourceType: 'DIRECT_PURCHASE',
      sourceId: order.id,
      startTime: now,
      durationUnit: plan.durationUnit,
      durationValue: plan.durationValue,
      bonusPoints: plan.bonusPoints,
      metaJson: { orderNo: order.orderNo, planId: plan.id, levelId: matchedBillingRule.levelId },
    })

    await tx.membershipOrder.update({
      where: { id: order.id },
      data: {
        startTime: subscription.startTime,
        endTime: subscription.endTime,
      },
    })

    return serializeMarketingCenterRecord({
      order: await tx.membershipOrder.findUnique({ where: { id: order.id } }),
      subscription,
      currentBalance: await readCurrentPointBalance(userId, tx),
    })
  })
}

// 用户创建充值订单并立即入账。
export const createRechargePurchaseOrder = async (userId: string, rechargePackageId: string) => {
  return prisma.$transaction(async (tx) => {
    const rechargePackage = await tx.rechargePackage.findFirst({
      where: { id: rechargePackageId, isEnabled: true },
    })
    if (!rechargePackage) {
      throw new Error('充值套餐不存在或已下架')
    }

    const totalPoints = (rechargePackage.points || 0) + (rechargePackage.bonusPoints || 0)
    const now = new Date()
    const order = await tx.rechargeOrder.create({
      data: {
        userId,
        rechargePackageId: rechargePackage.id,
        orderNo: buildSerialNo('RCH'),
        payChannel: 'MANUAL',
        payStatus: 'PAID',
        refundStatus: 'NONE',
        points: rechargePackage.points,
        bonusPoints: rechargePackage.bonusPoints,
        totalAmount: rechargePackage.price,
        paidAmount: rechargePackage.price,
        packageSnapshotJson: {
          name: rechargePackage.name,
          label: rechargePackage.label,
          price: rechargePackage.price,
        },
        paidAt: now,
      },
    })

    await appendPointLog(tx, {
      userId,
      rechargeOrderId: order.id,
      changeType: 'RECHARGE',
      action: 'INCREASE',
      changeAmount: totalPoints,
      sourceType: 'RECHARGE_ORDER',
      sourceId: order.id,
      associationNo: order.orderNo,
      remark: '积分充值到账',
      metaJson: {
        points: rechargePackage.points,
        bonusPoints: rechargePackage.bonusPoints,
      },
    })

    return serializeMarketingCenterRecord({
      order,
      currentBalance: await readCurrentPointBalance(userId, tx),
    })
  })
}

// 用户兑换卡密。
export const redeemCardCode = async (userId: string, code: string) => {
  return prisma.$transaction(async (tx) => {
    const normalizedCode = String(code || '').trim().toUpperCase()
    if (!normalizedCode) {
      throw new Error('请输入卡密')
    }

    const cardCode = await tx.cardCode.findFirst({
      where: { code: normalizedCode },
      include: {
        batch: true,
        rewardLevel: true,
      },
    })

    if (!cardCode) {
      throw new Error('卡密不存在')
    }
    if (cardCode.status !== 'UNUSED') {
      throw new Error('该卡密已使用或不可用')
    }
    if (!cardCode.batch.isEnabled) {
      throw new Error('当前卡密批次已停用')
    }
    if (cardCode.expiresAt && cardCode.expiresAt.getTime() < Date.now()) {
      await tx.cardCode.update({
        where: { id: cardCode.id },
        data: { status: 'EXPIRED' },
      })
      throw new Error('该卡密已过期')
    }

    const redeemRecord = await tx.cardRedeemRecord.create({
      data: {
        cardCodeId: cardCode.id,
        batchId: cardCode.batchId,
        userId,
        rewardType: cardCode.batch.rewardType,
        rewardPoints: cardCode.batch.rewardPoints,
        rewardLevelId: cardCode.batch.rewardLevelId,
        rewardDays: cardCode.batch.rewardDays,
        remark: '卡密兑换成功',
      },
    })

    await tx.cardCode.update({
      where: { id: cardCode.id },
      data: {
        status: 'USED',
        usedByUserId: userId,
        usedAt: new Date(),
      },
    })

    await tx.cardBatch.update({
      where: { id: cardCode.batchId },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    })

    let subscription = null
    if (cardCode.batch.rewardType === 'POINTS') {
      await appendPointLog(tx, {
        userId,
        changeType: 'CARD_REDEEM',
        action: 'INCREASE',
        changeAmount: cardCode.batch.rewardPoints,
        sourceType: 'CARD_REDEEM',
        sourceId: redeemRecord.id,
        associationNo: cardCode.code,
        remark: '卡密兑换积分到账',
        metaJson: {
          batchId: cardCode.batchId,
          cardCodeId: cardCode.id,
        },
      })
    } else if (cardCode.batch.rewardLevelId) {
      const order = await tx.membershipOrder.create({
        data: {
          userId,
          levelId: cardCode.batch.rewardLevelId,
          planId: null,
          orderNo: buildSerialNo('CDK'),
          sourceType: 'CARD_REDEEM',
          status: 'PAID',
          totalAmount: 0,
          paidAmount: 0,
          bonusPoints: 0,
          paidAt: new Date(),
          metaJson: {
            redeemRecordId: redeemRecord.id,
            cardCode: cardCode.code,
          },
        },
      })

      subscription = await activateMembership(tx, {
        userId,
        levelId: cardCode.batch.rewardLevelId,
        sourceType: 'CARD_REDEEM',
        sourceId: order.id,
        durationDays: cardCode.batch.rewardDays || 30,
        bonusPoints: 0,
        metaJson: { redeemRecordId: redeemRecord.id },
      })

      await tx.membershipOrder.update({
        where: { id: order.id },
        data: {
          startTime: subscription.startTime,
          endTime: subscription.endTime,
        },
      })
    }

    return {
      redeemRecord,
      subscription,
      currentBalance: await readCurrentPointBalance(userId, tx),
    }
  })
}
