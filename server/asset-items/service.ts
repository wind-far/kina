import { prisma } from '../db/prisma'
import type { AssetActionPayload, AssetListQuery } from './shared'

const DEFAULT_AUTHOR = {
  id: '',
  name: '创作者',
  avatarSrc: '',
}

// 统一把关联用户信息映射为前端作者结构。
const serializeOwner = (user: { id?: string | null; name?: string | null; avatarUrl?: string | null } | null | undefined) => {
  if (!user) {
    return DEFAULT_AUTHOR
  }

  return {
    id: String(user.id || '').trim(),
    name: String(user.name || '').trim() || DEFAULT_AUTHOR.name,
    avatarSrc: String(user.avatarUrl || '').trim(),
  }
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
  const records = await prisma.assetItem.findMany({
    where: {
      assetType: query.assetType === 'video' ? 'VIDEO' : 'IMAGE',
      isDeleted: false,
      visibility: 'PUBLIC',
      publishStatus: 'PUBLISHED',
      reviewStatus: 'APPROVED',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: query.take,
  })

  return records.map(serializeAssetItem)
}

// 查询当前用户资产。
export const listMineAssetItems = async (query: AssetListQuery, currentUserId: string) => {
  const publishStateWhere = query.publishState === 'published'
    ? {
        visibility: 'PUBLIC' as const,
        publishStatus: 'PUBLISHED' as const,
        reviewStatus: 'APPROVED' as const,
      }
    : query.publishState === 'draft'
      ? {
          publishStatus: 'DRAFT' as const,
        }
      : {}

  const records = await prisma.assetItem.findMany({
    where: {
      userId: currentUserId,
      assetType: query.assetType === 'video' ? 'VIDEO' : 'IMAGE',
      isDeleted: false,
      ...publishStateWhere,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
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
    take: query.take,
  })

  return records.map(serializeAssetItem)
}

// 批量更新资源状态。
export const applyAssetAction = async (payload: AssetActionPayload, currentUserId: string) => {
  if (!payload.ids.length) {
    throw new Error('缺少资源 ID')
  }

  const where = {
    id: { in: payload.ids },
    userId: currentUserId,
    isDeleted: false,
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
