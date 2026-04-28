import type { Prisma, UserRole, UserStatus } from '@prisma/client'
import prisma from '../db/prisma'
import { maskEmail, maskPhone } from '../auth/service'

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

// 构建后台用户项，统一处理脱敏、默认值和时间序列化。
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

// 批量聚合用户的资源数与生成记录数，避免列表页逐条查询。
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

// 将筛选参数转换为 Prisma 查询条件，保持请求处理层轻量。
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
      {
        id: {
          contains: keyword,
        },
      },
      {
        name: {
          contains: keyword,
        },
      },
      {
        email: {
          contains: keyword,
        },
      },
      {
        phone: {
          contains: keyword,
        },
      },
    ]
  }

  return where
}

// 查询后台用户列表。
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

// 更新指定用户角色，并阻止当前管理员误降权自己。
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

  const existingUser = await prisma.appUser.findUnique({
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

  if (!existingUser) {
    throw new Error('目标用户不存在')
  }

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
