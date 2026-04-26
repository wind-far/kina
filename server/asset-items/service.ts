import { prisma } from '../db/prisma'
import type { AssetActionPayload, AssetListQuery } from './shared'

const DEFAULT_AUTHOR = {
  name: '创作者',
  avatarSrc: '',
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
    owner: DEFAULT_AUTHOR,
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
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: query.take,
  })

  return records.map(serializeAssetItem)
}

// 查询当前用户资产。
// 当前项目尚未接入完整登录态，先按匿名用户 userId = null 收口。
export const listMineAssetItems = async (query: AssetListQuery) => {
  const records = await prisma.assetItem.findMany({
    where: {
      userId: null,
      assetType: query.assetType === 'video' ? 'VIDEO' : 'IMAGE',
      isDeleted: false,
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
    take: query.take,
  })

  return records.map(serializeAssetItem)
}

// 批量更新资源状态。
export const applyAssetAction = async (payload: AssetActionPayload) => {
  if (!payload.ids.length) {
    throw new Error('缺少资源 ID')
  }

  const where = {
    id: { in: payload.ids },
    userId: null,
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
