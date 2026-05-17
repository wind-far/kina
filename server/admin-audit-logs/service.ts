import type { Prisma } from '@prisma/client'
import prisma from '../db/prisma'
import { buildPageResult, resolvePagination } from '../shared/pagination'
import type { ListAdminAuditLogsOptions } from './shared'

const normalizeDate = (value?: string) => {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return null
  }

  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

const findOperatorIdsByKeyword = async (keyword: string) => {
  const normalizedKeyword = String(keyword || '').trim()
  if (!normalizedKeyword) {
    return null
  }

  const users = await prisma.appUser.findMany({
    where: {
      OR: [
        { id: normalizedKeyword },
        { username: { contains: normalizedKeyword } },
        { name: { contains: normalizedKeyword } },
        { email: { contains: normalizedKeyword } },
        { phone: { contains: normalizedKeyword } },
      ],
    },
    select: {
      id: true,
    },
    take: 100,
  })

  return users.map(user => user.id)
}

const buildAdminAuditLogWhere = async (options: ListAdminAuditLogsOptions): Promise<Prisma.AdminAuditLogWhereInput> => {
  const where: Prisma.AdminAuditLogWhereInput = {}
  const action = String(options.action || '').trim()
  const targetType = String(options.targetType || '').trim()
  const targetId = String(options.targetId || '').trim()
  const createdFrom = normalizeDate(options.createdFrom)
  const createdTo = normalizeDate(options.createdTo)
  const operatorIds = await findOperatorIdsByKeyword(String(options.operatorKeyword || '').trim())

  if (action) {
    where.action = { contains: action }
  }

  if (targetType) {
    where.targetType = { contains: targetType }
  }

  if (targetId) {
    where.targetId = { contains: targetId }
  }

  if (createdFrom || createdTo) {
    where.createdAt = {
      ...(createdFrom ? { gte: createdFrom } : {}),
      ...(createdTo ? { lte: createdTo } : {}),
    }
  }

  if (operatorIds) {
    where.operatorUserId = operatorIds.length ? { in: operatorIds } : '__NO_MATCH__'
  }

  return where
}

const serializeAuditJsonPreview = (value: unknown) => {
  if (value === null || value === undefined) {
    return null
  }

  const text = JSON.stringify(value)
  if (!text) {
    return null
  }

  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text
}

export const listAdminAuditLogs = async (options: ListAdminAuditLogsOptions = {}) => {
  const where = await buildAdminAuditLogWhere(options)
  const totalCount = await prisma.adminAuditLog.count({ where })
  const pagination = resolvePagination({
    page: options.page || 1,
    pageSize: options.pageSize || 20,
  }, totalCount, {
    defaultPageSize: 20,
    maxPageSize: 100,
  })

  const logs = await prisma.adminAuditLog.findMany({
    where,
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const operatorIds = Array.from(new Set(logs.map(log => log.operatorUserId).filter(Boolean)))
  const operators = operatorIds.length
    ? await prisma.appUser.findMany({
        where: { id: { in: operatorIds } },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
        },
      })
    : []
  const operatorMap = new Map(operators.map(operator => [operator.id, operator]))

  return buildPageResult(logs.map(log => {
    const operator = operatorMap.get(log.operatorUserId) || null
    return {
      id: log.id,
      operatorUserId: log.operatorUserId,
      operator: operator
        ? {
            id: operator.id,
            username: operator.username || '',
            name: operator.name || '',
            email: operator.email || '',
            phone: operator.phone || '',
            avatarUrl: operator.avatarUrl || '',
            role: operator.role,
          }
        : null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId || '',
      beforeJsonPreview: serializeAuditJsonPreview(log.beforeJson),
      afterJsonPreview: serializeAuditJsonPreview(log.afterJson),
      ipAddress: log.ipAddress || '',
      userAgent: log.userAgent || '',
      createdAt: log.createdAt.toISOString(),
    }
  }), pagination)
}
