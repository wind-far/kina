import { prisma } from '../db/prisma'
import { getDefaultProviderOverview } from '../provider-config/service'

const startOfDay = (date: Date) => {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

const endOfDay = (date: Date) => {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

const formatDayLabel = (date: Date) => {
  return String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}

// 构建最近若干天的趋势统计，先用逐日 count，避免一次性引入复杂聚合。
const buildDailyTrend = async (input: {
  days: number
  count: (range: { start: Date; end: Date }) => Promise<number>
}) => {
  const today = startOfDay(new Date())
  const items: Array<{ label: string; value: number }> = []

  for (let offset = input.days - 1; offset >= 0; offset -= 1) {
    const start = new Date(today)
    start.setDate(today.getDate() - offset)
    const end = endOfDay(start)

    items.push({
      label: formatDayLabel(start),
      value: await input.count({ start, end }),
    })
  }

  return items
}

// 查询当前登录用户可见的后台仪表盘概览数据。
export const getAdminDashboardOverview = async (currentUserId: string) => {
  const todayStart = startOfDay(new Date())
  const todayEnd = endOfDay(new Date())

  const [
    totalAssets,
    publishedAssets,
    draftAssets,
    totalGenerationRecords,
    completedGenerationRecords,
    failedGenerationRecords,
    todayGenerationRecords,
    enabledStorageConfig,
    totalStorageConfigs,
    providerOverview,
  ] = await Promise.all([
    prisma.assetItem.count({
      where: {
        userId: currentUserId,
        isDeleted: false,
      },
    }),
    prisma.assetItem.count({
      where: {
        userId: currentUserId,
        isDeleted: false,
        publishStatus: 'PUBLISHED',
      },
    }),
    prisma.assetItem.count({
      where: {
        userId: currentUserId,
        isDeleted: false,
        publishStatus: 'DRAFT',
      },
    }),
    prisma.generationRecord.count({
      where: {
        userId: currentUserId,
      },
    }),
    prisma.generationRecord.count({
      where: {
        userId: currentUserId,
        status: 'COMPLETED',
      },
    }),
    prisma.generationRecord.count({
      where: {
        userId: currentUserId,
        status: 'FAILED',
      },
    }),
    prisma.generationRecord.count({
      where: {
        userId: currentUserId,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    }),
    prisma.objectStorageConfig.findFirst({
      where: {
        userId: null,
        scene: 'global',
        isEnabled: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    }),
    prisma.objectStorageConfig.count({
      where: {
        userId: null,
        scene: 'global',
      },
    }),
    getDefaultProviderOverview(),
  ])

  const [generationTrend, assetTrend] = await Promise.all([
    buildDailyTrend({
      days: 7,
      count: ({ start, end }) => prisma.generationRecord.count({
        where: {
          userId: currentUserId,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
    }),
    buildDailyTrend({
      days: 7,
      count: ({ start, end }) => prisma.assetItem.count({
        where: {
          userId: currentUserId,
          isDeleted: false,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
    }),
  ])

  return {
    asset: {
      total: totalAssets,
      published: publishedAssets,
      draft: draftAssets,
      trend: assetTrend,
    },
    generation: {
      total: totalGenerationRecords,
      completed: completedGenerationRecords,
      failed: failedGenerationRecords,
      today: todayGenerationRecords,
      trend: generationTrend,
    },
    runtime: {
      enabledStorageName: enabledStorageConfig?.name || '',
      enabledStorageCode: enabledStorageConfig?.code || '',
      totalStorageConfigs,
      providerBaseUrl: providerOverview?.baseUrl || '',
      providerName: providerOverview?.name || '默认生成厂商',
    },
  }
}
