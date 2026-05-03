import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import type { AssetActionPayload, AssetListQuery, AssetListResult } from './shared'

const DEFAULT_AUTHOR = {
  id: '',
  name: '创作者',
  avatarSrc: '',
  email: '',
}

// 统一把关联用户信息映射为前端作者结构。
const serializeOwner = (user: { id?: string | null; name?: string | null; email?: string | null; avatarUrl?: string | null } | null | undefined) => {
  if (!user) {
    return DEFAULT_AUTHOR
  }

  return {
    id: String(user.id || '').trim(),
    name: String(user.name || '').trim() || DEFAULT_AUTHOR.name,
    email: String(user.email || '').trim(),
    avatarSrc: String(user.avatarUrl || '').trim(),
  }
}

// 统一构建资源 owner 查询条件，支持按用户 ID、昵称、邮箱模糊检索。
const buildOwnerWhereInput = (ownerKeyword: string) => {
  const keyword = String(ownerKeyword || '').trim()
  if (!keyword) {
    return undefined
  }

  return {
    OR: [
      {
        user: {
          id: {
            contains: keyword,
          },
        },
      },
      {
        user: {
          name: {
            contains: keyword,
          },
        },
      },
      {
        user: {
          email: {
            contains: keyword,
          },
        },
      },
    ],
  } satisfies Prisma.AssetItemWhereInput
}

// 统一构建后台资源发布状态过滤条件。
const buildPublishStateWhereInput = (publishState: AssetListQuery['publishState']) => {
  if (publishState === 'published') {
    return {
      visibility: 'PUBLIC' as const,
      publishStatus: 'PUBLISHED' as const,
      reviewStatus: 'APPROVED' as const,
    }
  }

  if (publishState === 'draft') {
    return {
      publishStatus: 'DRAFT' as const,
    }
  }

  return {}
}

// 统一把分页参数裁剪到可用范围，避免各资源查询重复处理。
const resolvePagination = (query: AssetListQuery, totalCount: number) => {
  const pageSize = Math.min(120, Math.max(1, Number(query.pageSize || query.take || 60)))
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / pageSize))
  const page = Math.min(Math.max(1, Number(query.page || 1)), totalPages)
  const skip = (page - 1) * pageSize

  return {
    page,
    pageSize,
    totalPages,
    totalCount: Math.max(0, totalCount),
    skip,
  }
}

// 统一组装资源分页结果，保持后台各列表返回结构一致。
const buildAssetListResult = (items: ReturnType<typeof serializeAssetItem>[], pagination: ReturnType<typeof resolvePagination>) => {
  return {
    items,
    summary: {
      totalCount: pagination.totalCount,
      totalPages: pagination.totalPages,
      page: pagination.page,
      pageSize: pagination.pageSize,
    },
  } satisfies AssetListResult<ReturnType<typeof serializeAssetItem>>
}

// 数据库存储值转前端资源类型。
const toAssetType = (assetType: string) => String(assetType || '').toLowerCase() === 'video'
  ? 'video'
  : 'image'

// 统一把数据库资源映射为前端可直接消费的结构。
const serializeAssetItem = (record: any) => {
  const assetType = toAssetType(record.assetType)
  const previewUrl = record.thumbnailUrl || record.coverUrl || record.fileUrl

  return {
    id: record.id,
    assetType,
    title: record.title || '',
    description: record.description || '',
    fileUrl: record.fileUrl,
    previewUrl,
    coverUrl: record.coverUrl || '',
    thumbnailUrl: record.thumbnailUrl || '',
    promptText: record.promptText || '',
    modelLabel: record.modelLabel || '',
    aspectRatio: record.aspectRatio || '',
    favoriteCount: record.favoriteCount || 0,
    viewCount: record.viewCount || 0,
    downloadCount: record.downloadCount || 0,
    width: record.width || undefined,
    height: record.height || undefined,
    durationSeconds: record.durationSeconds || undefined,
    visibility: String(record.visibility || '').toLowerCase(),
    publishStatus: String(record.publishStatus || '').toLowerCase(),
    reviewStatus: String(record.reviewStatus || '').toLowerCase(),
    createdAt: record.createdAt,
    publishedAt: record.publishedAt,
    owner: serializeOwner(record.user),
    sourceMeta: record.sourceMetaJson || {},
  }
}

// 查询首页公开瀑布流。
export const listPublicAssetItems = async (query: AssetListQuery) => {
  const where: Prisma.AssetItemWhereInput = {
    assetType: query.assetType === 'video' ? 'VIDEO' : 'IMAGE',
    isDeleted: false,
    visibility: 'PUBLIC',
    publishStatus: 'PUBLISHED',
    reviewStatus: 'APPROVED',
  }
  const totalCount = await prisma.assetItem.count({ where })
  const pagination = resolvePagination(query, totalCount)
  const records = await prisma.assetItem.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  return buildAssetListResult(records.map(serializeAssetItem), pagination)
}

// 查询当前用户资产。
export const listMineAssetItems = async (query: AssetListQuery, currentUserId: string) => {
  const publishStateWhere = buildPublishStateWhereInput(query.publishState)
  const where: Prisma.AssetItemWhereInput = {
    userId: currentUserId,
    assetType: query.assetType === 'video' ? 'VIDEO' : 'IMAGE',
    isDeleted: false,
    ...publishStateWhere,
  }
  const totalCount = await prisma.assetItem.count({ where })
  const pagination = resolvePagination(query, totalCount)

  const records = await prisma.assetItem.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      query.publishState === 'published'
        ? { publishedAt: 'desc' }
        : { createdAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  return buildAssetListResult(records.map(serializeAssetItem), pagination)
}

// 查询全站资源，供后台按用户维度统一管理。
export const listAllAssetItems = async (query: AssetListQuery) => {
  const publishStateWhere = buildPublishStateWhereInput(query.publishState)
  const ownerWhere = buildOwnerWhereInput(query.ownerKeyword)
  const where: Prisma.AssetItemWhereInput = {
    assetType: query.assetType === 'video' ? 'VIDEO' : 'IMAGE',
    isDeleted: false,
    ...publishStateWhere,
    ...ownerWhere,
  }
  const totalCount = await prisma.assetItem.count({ where })
  const pagination = resolvePagination(query, totalCount)

  const records = await prisma.assetItem.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      query.publishState === 'published'
        ? { publishedAt: 'desc' }
        : { createdAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  return buildAssetListResult(records.map(serializeAssetItem), pagination)
}

// 批量更新资源状态。
export const applyAssetAction = async (payload: AssetActionPayload, currentUserId: string, isAdminUser = false) => {
  if (!payload.ids.length) {
    throw new Error('缺少资源 ID')
  }

  if (payload.scope === 'feed') {
    throw new Error('公开资源不支持直接执行后台动作')
  }

  if (payload.scope === 'all' && !isAdminUser) {
    throw new Error('只有管理员可以操作全站资源')
  }

  if (payload.scope === 'all' && !['delete', 'publish', 'unpublish'].includes(payload.action)) {
    throw new Error('全站资源仅支持删除、发布和下架操作')
  }

  const where: Prisma.AssetItemWhereInput = {
    id: { in: payload.ids },
    isDeleted: false,
  }

  if (!(payload.scope === 'all' && isAdminUser)) {
    where.userId = currentUserId
  }

  switch (payload.action) {
    case 'delete': {
      const result = await prisma.assetItem.updateMany({
        where,
        data: {
          isDeleted: true,
          visibility: 'PRIVATE',
          publishStatus: 'HIDDEN',
        },
      })

      return {
        action: payload.action,
        affectedCount: result.count,
      }
    }

    case 'publish': {
      const result = await prisma.assetItem.updateMany({
        where,
        data: {
          visibility: 'PUBLIC',
          publishStatus: 'PUBLISHED',
          publishedAt: new Date(),
        },
      })

      return {
        action: payload.action,
        affectedCount: result.count,
      }
    }

    case 'unpublish': {
      const result = await prisma.assetItem.updateMany({
        where,
        data: {
          visibility: 'PRIVATE',
          publishStatus: 'DRAFT',
          publishedAt: null,
        },
      })

      return {
        action: payload.action,
        affectedCount: result.count,
      }
    }

    case 'favorite': {
      const result = await prisma.assetItem.updateMany({
        where,
        data: {
          favoriteCount: {
            increment: 1,
          },
        },
      })

      return {
        action: payload.action,
        affectedCount: result.count,
      }
    }

    case 'view': {
      const result = await prisma.assetItem.updateMany({
        where,
        data: {
          viewCount: {
            increment: 1,
          },
        },
      })

      return {
        action: payload.action,
        affectedCount: result.count,
      }
    }

    case 'download': {
      const result = await prisma.assetItem.updateMany({
        where,
        data: {
          downloadCount: {
            increment: 1,
          },
        },
      })

      return {
        action: payload.action,
        affectedCount: result.count,
      }
    }

    default:
      throw new Error('不支持的资源动作')
  }
}
