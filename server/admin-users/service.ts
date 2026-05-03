import type {
  AuthMethodType,
  MembershipOrderSource,
  PointActionType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client'
import prisma from '../db/prisma'
import { isValidEmail, isValidPhone, maskEmail, maskPhone } from '../auth/service'

interface AdminUserRecord {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  role: UserRole
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

interface AdminUserCountMap {
  assetCount: number
  generationRecordCount: number
}

export interface ListAdminUsersOptions {
  keyword?: string
  role?: 'ALL' | 'USER' | 'ADMIN'
  status?: 'ALL' | 'ANONYMOUS' | 'ACTIVE' | 'DISABLED'
}

export interface UpdateAdminUserProfileInput {
  targetUserId: string
  currentUserId: string
  name?: string
  email?: string
  phone?: string
  avatarUrl?: string
  status?: UserStatus
}

export interface AdjustAdminUserPointsInput {
  targetUserId: string
  currentUserId: string
  action: PointActionType
  changeAmount: number
  remark?: string
}

export interface AdjustAdminUserMembershipInput {
  targetUserId: string
  currentUserId: string
  levelId: string
  durationValue: number
  durationUnit: string
  bonusPoints?: number
  remark?: string
}

export interface CreateAdminUserInput {
  currentUserId: string
  name?: string
  email?: string
  phone?: string
  avatarUrl?: string
  role?: UserRole
  status?: UserStatus
}

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

// 将 Prisma 返回结果里的 Decimal / BigInt / Date 拍平成前端可直接消费的数据。
const serializeAdminUserRecord = <T>(value: T): T => {
  if (typeof value === 'bigint') {
    return Number(value) as T
  }

  if (isDecimalLike(value)) {
    return value.toString() as T
  }

  if (value instanceof Date) {
    return value.toISOString() as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeAdminUserRecord(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializeAdminUserRecord(item)]),
    ) as T
  }

  return value
}

const normalizeEmail = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized || null
}

const normalizePhone = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

const normalizeName = (value: unknown) => {
  return String(value || '').trim() || null
}

const normalizeAvatarUrl = (value: unknown) => {
  return String(value || '').trim() || null
}

const normalizeDurationUnit = (value: unknown) => {
  const normalized = String(value || 'MONTH').trim().toUpperCase()
  if (normalized === 'DAY' || normalized === 'MONTH' || normalized === 'YEAR') {
    return normalized
  }
  return 'MONTH'
}

const addDuration = (startTime: Date, durationUnit: string, durationValue: number) => {
  const nextDate = new Date(startTime)
  const value = Math.max(1, Math.round(Number(durationValue) || 1))

  if (durationUnit === 'DAY') {
    nextDate.setDate(nextDate.getDate() + value)
    return nextDate
  }

  if (durationUnit === 'YEAR') {
    nextDate.setFullYear(nextDate.getFullYear() + value)
    return nextDate
  }

  nextDate.setMonth(nextDate.getMonth() + value)
  return nextDate
}

const readCurrentPointBalance = async (userId: string, tx: typeof prisma | any = prisma) => {
  const latestLog = await tx.pointAccountLog.findFirst({
    where: { userId },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
  })

  return Number(latestLog?.balanceAfter || 0)
}

// 追加管理员积分流水，确保用户管理与营销中心共用同一套账本口径。
const appendAdminPointLog = async (tx: typeof prisma | any, input: {
  userId: string
  currentUserId: string
  action: PointActionType
  changeAmount: number
  remark?: string
  subscriptionId?: string | null
  sourceId?: string | null
  associationNo?: string | null
}) => {
  const currentBalance = await readCurrentPointBalance(input.userId, tx)
  const normalizedAmount = Math.max(0, Math.round(Number(input.changeAmount) || 0))

  if (normalizedAmount <= 0) {
    throw new Error('调整积分必须大于 0')
  }

  const nextBalance = input.action === 'DECREASE'
    ? currentBalance - normalizedAmount
    : currentBalance + normalizedAmount

  if (nextBalance < 0) {
    throw new Error('调整后积分不能小于 0')
  }

  return await tx.pointAccountLog.create({
    data: {
      userId: input.userId,
      subscriptionId: input.subscriptionId || null,
      rechargeOrderId: null,
      accountNo: buildSerialNo('PTS'),
      changeType: 'ADJUST',
      action: input.action,
      changeAmount: normalizedAmount,
      balanceAfter: nextBalance,
      availableAmount: nextBalance,
      sourceType: 'ADMIN_ADJUST',
      sourceId: input.sourceId || input.currentUserId,
      associationNo: input.associationNo || buildSerialNo('ADMPTS'),
      remark: String(input.remark || '').trim() || `后台管理员${input.action === 'DECREASE' ? '扣减' : '增加'}积分`,
      metaJson: {
        operatorUserId: input.currentUserId,
      } as any,
    },
  })
}

const getUserCountMaps = async (userIds: string[]) => {
  if (!userIds.length) {
    return new Map<string, AdminUserCountMap>()
  }

  const [assetGroups, generationGroups] = await Promise.all([
    prisma.assetItem.groupBy({
      by: ['userId'],
      where: {
        userId: {
          in: userIds,
        },
        isDeleted: false,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.generationRecord.groupBy({
      by: ['userId'],
      where: {
        userId: {
          in: userIds,
        },
      },
      _count: {
        _all: true,
      },
    }),
  ])

  const countMap = new Map<string, AdminUserCountMap>()

  for (const userId of userIds) {
    countMap.set(userId, {
      assetCount: 0,
      generationRecordCount: 0,
    })
  }

  for (const item of assetGroups) {
    countMap.set(item.userId, {
      assetCount: item._count._all,
      generationRecordCount: countMap.get(item.userId)?.generationRecordCount || 0,
    })
  }

  for (const item of generationGroups) {
    countMap.set(item.userId, {
      assetCount: countMap.get(item.userId)?.assetCount || 0,
      generationRecordCount: item._count._all,
    })
  }

  return countMap
}

const buildAdminUserItem = (user: AdminUserRecord, countMap?: AdminUserCountMap) => {
  const email = String(user.email || '').trim()
  const phone = String(user.phone || '').trim()

  return {
    id: user.id,
    name: String(user.name || '').trim(),
    email,
    phone,
    maskedEmail: maskEmail(email),
    maskedPhone: maskPhone(phone),
    avatarUrl: String(user.avatarUrl || '').trim(),
    role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
    status: String(user.status || '').trim() || 'ANONYMOUS',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    generationRecordCount: countMap?.generationRecordCount || 0,
    assetCount: countMap?.assetCount || 0,
  }
}

const buildUserWhereInput = (options: ListAdminUsersOptions): Prisma.AppUserWhereInput => {
  const where: Prisma.AppUserWhereInput = {}
  const keyword = String(options.keyword || '').trim()

  if (options.role === 'ADMIN' || options.role === 'USER') {
    where.role = options.role
  }

  if (options.status === 'ANONYMOUS' || options.status === 'ACTIVE' || options.status === 'DISABLED') {
    where.status = options.status
  }

  if (keyword) {
    where.OR = [
      { id: { contains: keyword } },
      { name: { contains: keyword } },
      { email: { contains: keyword } },
      { phone: { contains: keyword } },
    ]
  }

  return where
}

const findAdminUserOrThrow = async (targetUserId: string) => {
  const user = await prisma.appUser.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    throw new Error('目标用户不存在')
  }

  return user
}

const ensureIdentifierNotDuplicated = async (input: {
  email: string | null
  phone: string | null
}) => {
  if (input.email) {
    const duplicatedEmailUser = await prisma.appUser.findFirst({
      where: { email: input.email },
      select: { id: true },
    })
    if (duplicatedEmailUser) {
      throw new Error('该邮箱已被其他用户使用')
    }

    const duplicatedEmailIdentity = await prisma.appUserAuthIdentity.findFirst({
      where: {
        methodType: 'EMAIL_CODE',
        identifier: input.email,
      },
      select: { id: true },
    })
    if (duplicatedEmailIdentity) {
      throw new Error('该邮箱登录身份已存在')
    }
  }

  if (input.phone) {
    const duplicatedPhoneUser = await prisma.appUser.findFirst({
      where: { phone: input.phone },
      select: { id: true },
    })
    if (duplicatedPhoneUser) {
      throw new Error('该手机号已被其他用户使用')
    }

    const duplicatedPhoneIdentity = await prisma.appUserAuthIdentity.findFirst({
      where: {
        methodType: 'PHONE_CODE',
        identifier: input.phone,
      },
      select: { id: true },
    })
    if (duplicatedPhoneIdentity) {
      throw new Error('该手机号登录身份已存在')
    }
  }
}

const ensureAuthMethodConfigExists = async (methodType: AuthMethodType) => {
  const config = await prisma.authMethodConfig.findUnique({
    where: { methodType },
    select: {
      methodType: true,
      allowSignUp: true,
      isEnabled: true,
    },
  })

  if (!config) {
    throw new Error(`缺少 ${methodType} 登录方式配置，暂时无法创建用户`)
  }

  if (!config.isEnabled) {
    throw new Error(`${methodType} 登录方式已禁用，暂时无法创建用户`)
  }
}

const ensureNotSelfDangerousAction = (currentUserId: string, targetUserId: string, actionLabel: string) => {
  if (currentUserId === targetUserId) {
    throw new Error(`不能对当前登录管理员执行${actionLabel}`)
  }
}

const buildAdminUserDetail = async (targetUserId: string) => {
  const [user, countMap, authIdentities, activeSubscription, membershipOrders, sessionCount, currentPointBalance] = await Promise.all([
    findAdminUserOrThrow(targetUserId),
    getUserCountMaps([targetUserId]),
    prisma.appUserAuthIdentity.findMany({
      where: { userId: targetUserId },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      select: {
        id: true,
        methodType: true,
        identifier: true,
        providerUserId: true,
        providerUnionId: true,
        isVerified: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.userSubscription.findFirst({
      where: {
        userId: targetUserId,
        status: 'ACTIVE',
      },
      orderBy: [
        { endTime: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        level: true,
        order: {
          include: {
            plan: true,
          },
        },
      },
    }),
    prisma.membershipOrder.findMany({
      where: { userId: targetUserId },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 10,
      include: {
        level: true,
        plan: true,
      },
    }),
    prisma.appSession.count({
      where: {
        userId: targetUserId,
        revokedAt: null,
      },
    }),
    readCurrentPointBalance(targetUserId),
  ])

  return serializeAdminUserRecord({
    ...buildAdminUserItem(user, countMap.get(targetUserId)),
    currentPointBalance,
    sessionCount,
    authIdentities,
    activeSubscription,
    membershipOrders,
  })
}

export const listAdminUsers = async (options: ListAdminUsersOptions = {}) => {
  const users = await prisma.appUser.findMany({
    where: buildUserWhereInput(options),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
  })

  const userIds = users.map(item => item.id)
  const countMap = await getUserCountMaps(userIds)

  return users.map(user => buildAdminUserItem(user, countMap.get(user.id)))
}

export const getAdminUserDetail = async (targetUserId: string) => {
  const normalizedUserId = String(targetUserId || '').trim()
  if (!normalizedUserId) {
    throw new Error('缺少目标用户 ID')
  }

  return await buildAdminUserDetail(normalizedUserId)
}

export const createAdminUser = async (input: CreateAdminUserInput) => {
  const name = normalizeName(input.name)
  const email = normalizeEmail(input.email)
  const phone = normalizePhone(input.phone)
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl)
  const role: UserRole = input.role === 'ADMIN' ? 'ADMIN' : 'USER'
  const status: UserStatus = input.status === 'DISABLED'
    ? 'DISABLED'
    : input.status === 'ANONYMOUS'
      ? 'ANONYMOUS'
      : 'ACTIVE'

  if (!email && !phone) {
    throw new Error('请至少填写一个登录标识：邮箱或手机号')
  }

  if (email && !isValidEmail(email)) {
    throw new Error('邮箱格式不正确')
  }

  if (phone && !isValidPhone(phone)) {
    throw new Error('手机号格式不正确')
  }

  await ensureIdentifierNotDuplicated({ email, phone })

  const requiredMethodTypes: AuthMethodType[] = []
  if (email) {
    requiredMethodTypes.push('EMAIL_CODE')
  }
  if (phone) {
    requiredMethodTypes.push('PHONE_CODE')
  }
  await Promise.all(requiredMethodTypes.map(methodType => ensureAuthMethodConfigExists(methodType)))

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.appUser.create({
      data: {
        name,
        email,
        phone,
        avatarUrl,
        role,
        status,
      },
      select: {
        id: true,
      },
    })

    if (email) {
      await tx.appUserAuthIdentity.create({
        data: {
          userId: user.id,
          methodType: 'EMAIL_CODE',
          identifier: email,
          isVerified: true,
          verifiedAt: new Date(),
          metaJson: {
            source: 'admin_create_user',
            operatorUserId: input.currentUserId,
          } as any,
        },
      })
    }

    if (phone) {
      await tx.appUserAuthIdentity.create({
        data: {
          userId: user.id,
          methodType: 'PHONE_CODE',
          identifier: phone,
          isVerified: true,
          verifiedAt: new Date(),
          metaJson: {
            source: 'admin_create_user',
            operatorUserId: input.currentUserId,
          } as any,
        },
      })
    }

    return user
  })

  return await buildAdminUserDetail(createdUser.id)
}

export const updateAdminUserRole = async (input: {
  targetUserId: string
  role: UserRole
  currentUserId: string
}) => {
  const targetUserId = String(input.targetUserId || '').trim()
  if (!targetUserId) {
    throw new Error('缺少目标用户 ID')
  }

  const targetRole: UserRole = input.role === 'ADMIN' ? 'ADMIN' : 'USER'

  if (input.currentUserId === targetUserId && targetRole !== 'ADMIN') {
    throw new Error('不能将当前登录管理员降级为普通用户')
  }

  await findAdminUserOrThrow(targetUserId)

  const updatedUser = await prisma.appUser.update({
    where: { id: targetUserId },
    data: {
      role: targetRole,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const countMap = await getUserCountMaps([targetUserId])
  return buildAdminUserItem(updatedUser, countMap.get(targetUserId))
}

export const updateAdminUserProfile = async (input: UpdateAdminUserProfileInput) => {
  const targetUserId = String(input.targetUserId || '').trim()
  if (!targetUserId) {
    throw new Error('缺少目标用户 ID')
  }

  const status = input.status === 'ACTIVE' || input.status === 'DISABLED' || input.status === 'ANONYMOUS'
    ? input.status
    : undefined

  if (input.currentUserId === targetUserId && status === 'DISABLED') {
    throw new Error('不能禁用当前登录管理员')
  }

  await findAdminUserOrThrow(targetUserId)

  const email = normalizeEmail(input.email)
  const phone = normalizePhone(input.phone)

  if (email) {
    const duplicatedEmailUser = await prisma.appUser.findFirst({
      where: {
        id: { not: targetUserId },
        email,
      },
      select: { id: true },
    })
    if (duplicatedEmailUser) {
      throw new Error('该邮箱已被其他用户使用')
    }
  }

  if (phone) {
    const duplicatedPhoneUser = await prisma.appUser.findFirst({
      where: {
        id: { not: targetUserId },
        phone,
      },
      select: { id: true },
    })
    if (duplicatedPhoneUser) {
      throw new Error('该手机号已被其他用户使用')
    }
  }

  await prisma.appUser.update({
    where: { id: targetUserId },
    data: {
      name: normalizeName(input.name),
      email,
      phone,
      avatarUrl: normalizeAvatarUrl(input.avatarUrl),
      ...(status ? { status } : {}),
    },
  })

  return await buildAdminUserDetail(targetUserId)
}

export const adjustAdminUserPoints = async (input: AdjustAdminUserPointsInput) => {
  const targetUserId = String(input.targetUserId || '').trim()
  if (!targetUserId) {
    throw new Error('缺少目标用户 ID')
  }

  await findAdminUserOrThrow(targetUserId)

  const associationNo = buildSerialNo('ADMPTS')

  const pointLog = await prisma.$transaction(async (tx) => {
    return await appendAdminPointLog(tx, {
      userId: targetUserId,
      currentUserId: input.currentUserId,
      action: input.action === 'DECREASE' ? 'DECREASE' : 'INCREASE',
      changeAmount: input.changeAmount,
      remark: input.remark,
      associationNo,
      sourceId: input.currentUserId,
    })
  })

  return serializeAdminUserRecord(pointLog)
}

export const adjustAdminUserMembership = async (input: AdjustAdminUserMembershipInput) => {
  const targetUserId = String(input.targetUserId || '').trim()
  const levelId = String(input.levelId || '').trim()
  const durationValue = Math.max(1, Math.round(Number(input.durationValue) || 1))
  const durationUnit = normalizeDurationUnit(input.durationUnit)
  const bonusPoints = Math.max(0, Math.round(Number(input.bonusPoints) || 0))
  const remark = String(input.remark || '').trim()

  if (!targetUserId) {
    throw new Error('缺少目标用户 ID')
  }

  if (!levelId) {
    throw new Error('请选择会员等级')
  }

  const [user, membershipLevel] = await Promise.all([
    findAdminUserOrThrow(targetUserId),
    prisma.membershipLevel.findUnique({
      where: { id: levelId },
      select: {
        id: true,
        name: true,
        level: true,
        monthlyBonusPoints: true,
        isEnabled: true,
      },
    }),
  ])

  if (!user) {
    throw new Error('目标用户不存在')
  }

  if (!membershipLevel) {
    throw new Error('会员等级不存在')
  }

  const now = new Date()
  const orderNo = buildSerialNo('MBO')
  const defaultBonusPoints = bonusPoints > 0 ? bonusPoints : Number(membershipLevel.monthlyBonusPoints || 0)

  const result = await prisma.$transaction(async (tx) => {
    const activeSameSubscription = await tx.userSubscription.findFirst({
      where: {
        userId: targetUserId,
        levelId,
        status: 'ACTIVE',
        endTime: { gt: now },
      },
      orderBy: { endTime: 'desc' },
    })

    const subscriptionStartTime = activeSameSubscription?.endTime && activeSameSubscription.endTime > now
      ? activeSameSubscription.endTime
      : now
    const subscriptionEndTime = addDuration(subscriptionStartTime, durationUnit, durationValue)

    const order = await tx.membershipOrder.create({
      data: {
        userId: targetUserId,
        levelId,
        planId: null,
        orderNo,
        sourceType: 'ADMIN_ADJUST' as MembershipOrderSource,
        status: 'PAID',
        totalAmount: 0,
        paidAmount: 0,
        bonusPoints: defaultBonusPoints,
        startTime: subscriptionStartTime,
        endTime: subscriptionEndTime,
        paidAt: now,
        metaJson: {
          operatorUserId: input.currentUserId,
          durationUnit,
          durationValue,
          remark,
        } as any,
      },
      include: {
        level: true,
        plan: true,
      },
    })

    await tx.userSubscription.updateMany({
      where: {
        userId: targetUserId,
        status: 'ACTIVE',
        levelId: { not: levelId },
      },
      data: {
        status: 'EXPIRED',
      },
    })

    const subscription = await tx.userSubscription.upsert({
      where: {
        userId_levelId: {
          userId: targetUserId,
          levelId,
        },
      },
      update: {
        orderId: order.id,
        status: 'ACTIVE',
        startTime: subscriptionStartTime,
        endTime: subscriptionEndTime,
        updatedAt: now,
      },
      create: {
        userId: targetUserId,
        levelId,
        orderId: order.id,
        status: 'ACTIVE',
        startTime: subscriptionStartTime,
        endTime: subscriptionEndTime,
      },
      include: {
        level: true,
        order: {
          include: {
            plan: true,
          },
        },
      },
    })

    let bonusPointLog = null
    if (defaultBonusPoints > 0) {
      bonusPointLog = await appendAdminPointLog(tx, {
        userId: targetUserId,
        currentUserId: input.currentUserId,
        action: 'INCREASE',
        changeAmount: defaultBonusPoints,
        subscriptionId: subscription.id,
        sourceId: order.id,
        associationNo: order.orderNo,
        remark: remark || '后台调整会员赠送积分',
      })
    }

    return {
      order,
      subscription,
      bonusPointLog,
    }
  })

  return serializeAdminUserRecord(result)
}

export const listAdminUserMembershipOrders = async (targetUserId: string) => {
  const normalizedUserId = String(targetUserId || '').trim()
  if (!normalizedUserId) {
    throw new Error('缺少目标用户 ID')
  }

  await findAdminUserOrThrow(normalizedUserId)

  const records = await prisma.membershipOrder.findMany({
    where: { userId: normalizedUserId },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    take: 50,
    include: {
      level: true,
      plan: true,
    },
  })

  return serializeAdminUserRecord(records)
}

export const resetAdminUserLoginState = async (input: {
  targetUserId: string
  currentUserId: string
}) => {
  const targetUserId = String(input.targetUserId || '').trim()
  if (!targetUserId) {
    throw new Error('缺少目标用户 ID')
  }

  ensureNotSelfDangerousAction(input.currentUserId, targetUserId, '清空登录会话')
  await findAdminUserOrThrow(targetUserId)

  const result = await prisma.appSession.updateMany({
    where: {
      userId: targetUserId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      updatedAt: new Date(),
    },
  })

  return {
    revokedCount: result.count,
  }
}

export const deleteAdminUser = async (input: {
  targetUserId: string
  currentUserId: string
}) => {
  const targetUserId = String(input.targetUserId || '').trim()
  if (!targetUserId) {
    throw new Error('缺少目标用户 ID')
  }

  ensureNotSelfDangerousAction(input.currentUserId, targetUserId, '删除操作')
  await findAdminUserOrThrow(targetUserId)

  await prisma.appUser.delete({
    where: { id: targetUserId },
  })

  return true
}
