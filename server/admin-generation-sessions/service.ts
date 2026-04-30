import { prisma } from '../db/prisma'
import type { AdminGenerationSessionsQuery } from './shared'

const MAX_GENERATION_SESSION_TITLE_LENGTH = 120

const buildRecordInclude = () => ({
  session: true,
  outputs: {
    orderBy: { sortOrder: 'asc' as const },
  },
  agentRun: {
    include: {
      steps: {
        orderBy: { sortOrder: 'asc' as const },
      },
      processSections: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
})

// 将数据库记录序列化为前端可直接消费的结构。
const serializeGenerationRecord = (record: any) => ({
  id: record.id,
  sessionId: record.sessionId,
  sessionTitle: record.session?.title || '',
  type: String(record.type || '').toLowerCase().replaceAll('_', '-'),
  prompt: record.prompt,
  content: record.content || '',
  error: record.errorMessage || '',
  model: record.modelLabel || '',
  modelKey: record.modelKey || '',
  ratio: record.ratio || '',
  resolution: record.resolution || '',
  duration: record.durationLabel || '',
  feature: record.feature || '',
  skill: record.skill || 'general',
  done: ['COMPLETED', 'FAILED', 'STOPPED'].includes(record.status),
  stopped: record.status === 'STOPPED',
  agentTaskId: record.agentTaskId || undefined,
  createdAt: record.createdAt,
  outputs: (record.outputs || []).map((output: any) => ({
    outputType: String(output.outputType || '').toLowerCase(),
    url: output.url || '',
    textContent: output.textContent || '',
    sortOrder: output.sortOrder || 0,
    metaJson: output.metaJson || null,
  })),
  images: (record.outputs || [])
    .filter((output: any) => output.outputType === 'IMAGE' && output.url)
    .map((output: any) => output.url),
  agentRun: record.agentRun
    ? {
        id: record.agentRun.id,
        query: record.agentRun.query,
        skill: record.agentRun.skill || 'general',
        status: String(record.agentRun.status || '').toLowerCase(),
        user: {
          name: record.agentRun.agentName || '',
          avatarSrc: record.agentRun.agentAvatarUrl || undefined,
        },
        indicator: {
          status: String(record.agentRun.indicatorStatus || '').toLowerCase(),
          title: record.agentRun.indicatorTitle || '',
          description: record.agentRun.indicatorDescription || '',
        },
        result: {
          title: record.agentRun.resultTitle || '',
          summary: record.agentRun.resultSummary || '',
          images: [],
          expectedImageCount: Number(record.agentRun.expectedImageCount || 0),
          outputVisible: Boolean(record.agentRun.outputVisible),
        },
        steps: (record.agentRun.steps || []).map((step: any) => ({
          id: step.stepKey,
          title: step.title,
          status: String(step.status || '').toLowerCase(),
          description: step.description || '',
        })),
        processSections: (record.agentRun.processSections || []).map((section: any) => ({
          key: section.sectionKey,
          kind: String(section.kind || '').toLowerCase(),
          label: section.label,
          paragraphs: Array.isArray(section.paragraphsJson) ? section.paragraphsJson : [],
          taskItems: Array.isArray(section.taskItemsJson) ? section.taskItemsJson : [],
        })),
      }
    : undefined,
})

const normalizeGenerationSessionTitle = (title?: string, fallback = '新对话') => {
  const normalizedTitle = String(title || '').trim()
  return (normalizedTitle || fallback).slice(0, MAX_GENERATION_SESSION_TITLE_LENGTH)
}

const buildSessionItem = (
  session: any,
  stats: {
    recordCount: number
    failedRecordCount: number
    runningRecordCount: number
    completedRecordCount: number
  },
) => {
  const latestRecord = Array.isArray(session.records) && session.records.length > 0
    ? session.records[0]
    : null
  const latestImageOutput = latestRecord?.outputs?.find((output: any) => output.outputType === 'IMAGE' && output.url)

  return {
    id: session.id,
    title: session.title,
    isDefault: Boolean(session.isDefault),
    sortOrder: Number(session.sortOrder || 0),
    coverImageUrl: latestImageOutput?.url || '',
    lastRecordAt: session.lastRecordAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    user: {
      id: session.user.id,
      name: String(session.user.name || '').trim(),
      email: String(session.user.email || '').trim(),
      avatarUrl: String(session.user.avatarUrl || '').trim(),
    },
    latestRecord: latestRecord
      ? {
          id: latestRecord.id,
          type: String(latestRecord.type || '').toLowerCase().replaceAll('_', '-'),
          status: latestRecord.status,
          prompt: String(latestRecord.prompt || '').trim(),
          error: String(latestRecord.errorMessage || '').trim(),
          createdAt: latestRecord.createdAt,
          skill: String(latestRecord.skill || '').trim(),
          model: String(latestRecord.modelLabel || '').trim(),
        }
      : null,
    ...stats,
  }
}

const buildSessionWhereInput = (query: AdminGenerationSessionsQuery) => {
  const keyword = String(query.keyword || '').trim()
  const userKeyword = String(query.userKeyword || '').trim()

  const andConditions: Array<Record<string, unknown>> = []

  if (keyword) {
    andConditions.push({
      OR: [
        { id: { contains: keyword } },
        { title: { contains: keyword } },
        { records: { some: { prompt: { contains: keyword } } } },
        { records: { some: { errorMessage: { contains: keyword } } } },
      ],
    })
  }

  if (userKeyword) {
    andConditions.push({
      user: {
        OR: [
          { id: { contains: userKeyword } },
          { name: { contains: userKeyword } },
          { email: { contains: userKeyword } },
        ],
      },
    })
  }

  if (query.type !== 'ALL') {
    andConditions.push({
      records: {
        some: {
          type: query.type,
        },
      },
    })
  }

  if (query.status === 'EMPTY') {
    andConditions.push({
      records: {
        none: {},
      },
    })
  }

  if (query.status === 'HAS_ERROR') {
    andConditions.push({
      records: {
        some: {
          OR: [
            { status: 'FAILED' },
            { errorMessage: { not: null } },
          ],
        },
      },
    })
  }

  if (query.status === 'RUNNING') {
    andConditions.push({
      records: {
        some: {
          status: {
            in: ['PENDING', 'RUNNING'],
          },
        },
      },
    })
  }

  if (query.status === 'COMPLETED') {
    andConditions.push({
      records: {
        some: {},
      },
    })
    andConditions.push({
      records: {
        none: {
          OR: [
            { status: 'FAILED' },
            { errorMessage: { not: null } },
            {
              status: {
                in: ['PENDING', 'RUNNING'],
              },
            },
          ],
        },
      },
    })
  }

  return andConditions.length ? { AND: andConditions } : {}
}

// 分页查询后台会话列表，支持用户维度与状态筛选。
export const listAdminGenerationSessions = async (query: AdminGenerationSessionsQuery) => {
  const where = buildSessionWhereInput(query)
  const totalCount = await prisma.generationSession.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize))
  const page = Math.min(Math.max(1, query.page), totalPages)
  const sessions = await prisma.generationSession.findMany({
    where,
    select: {
      id: true,
      title: true,
      isDefault: true,
      sortOrder: true,
      lastRecordAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      _count: {
        select: {
          records: true,
        },
      },
      records: {
        select: {
          id: true,
          type: true,
          status: true,
          prompt: true,
          errorMessage: true,
          createdAt: true,
          skill: true,
          modelLabel: true,
          outputs: {
            where: {
              outputType: 'IMAGE',
              url: { not: null },
            },
            take: 1,
            orderBy: {
              sortOrder: 'asc',
            },
            select: {
              url: true,
              outputType: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
    orderBy: [
      { lastRecordAt: 'desc' },
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  })

  const sessionIds = sessions.map(session => session.id)
  const [failedGroups, runningGroups, completedGroups] = await Promise.all([
    sessionIds.length
      ? prisma.generationRecord.groupBy({
          by: ['sessionId'],
          where: {
            sessionId: { in: sessionIds },
            OR: [
              { status: 'FAILED' },
              { errorMessage: { not: null } },
            ],
          },
          _count: {
            _all: true,
          },
        })
      : Promise.resolve([]),
    sessionIds.length
      ? prisma.generationRecord.groupBy({
          by: ['sessionId'],
          where: {
            sessionId: { in: sessionIds },
            status: {
              in: ['PENDING', 'RUNNING'],
            },
          },
          _count: {
            _all: true,
          },
        })
      : Promise.resolve([]),
    sessionIds.length
      ? prisma.generationRecord.groupBy({
          by: ['sessionId'],
          where: {
            sessionId: { in: sessionIds },
            status: 'COMPLETED',
          },
          _count: {
            _all: true,
          },
        })
      : Promise.resolve([]),
  ])

  const failedMap = new Map(failedGroups.map(item => [item.sessionId, item._count._all]))
  const runningMap = new Map(runningGroups.map(item => [item.sessionId, item._count._all]))
  const completedMap = new Map(completedGroups.map(item => [item.sessionId, item._count._all]))
  const items = sessions.map(session => buildSessionItem(session, {
    recordCount: Number(session._count?.records || 0),
    failedRecordCount: Number(failedMap.get(session.id) || 0),
    runningRecordCount: Number(runningMap.get(session.id) || 0),
    completedRecordCount: Number(completedMap.get(session.id) || 0),
  }))

  return {
    items,
    summary: {
      totalCount,
      totalPages,
      page,
      pageSize: query.pageSize,
    },
  }
}

// 查询后台会话详情，包含用户信息与会话统计。
export const getAdminGenerationSessionDetail = async (id: string) => {
  const sessionId = String(id || '').trim()
  if (!sessionId) {
    throw new Error('缺少会话 ID')
  }

  const session = await prisma.generationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      title: true,
      isDefault: true,
      sortOrder: true,
      lastRecordAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      records: {
        select: {
          id: true,
          status: true,
          errorMessage: true,
          type: true,
          createdAt: true,
          outputs: {
            where: {
              outputType: 'IMAGE',
              url: { not: null },
            },
            take: 1,
            orderBy: {
              sortOrder: 'asc',
            },
            select: {
              url: true,
              outputType: true,
            },
          },
        },
      },
      _count: {
        select: {
          records: true,
        },
      },
    },
  })

  if (!session) {
    throw new Error('目标会话不存在')
  }

  const failedRecordCount = await prisma.generationRecord.count({
    where: {
      sessionId,
      OR: [
        { status: 'FAILED' },
        { errorMessage: { not: null } },
      ],
    },
  })
  const runningRecordCount = await prisma.generationRecord.count({
    where: {
      sessionId,
      status: {
        in: ['PENDING', 'RUNNING'],
      },
    },
  })
  const completedRecordCount = await prisma.generationRecord.count({
    where: {
      sessionId,
      status: 'COMPLETED',
    },
  })

  return buildSessionItem(session, {
    recordCount: Number(session._count?.records || 0),
    failedRecordCount,
    runningRecordCount,
    completedRecordCount,
  })
}

// 查询指定会话下的生成记录，供后台详情抽屉分页查看。
export const listAdminGenerationSessionRecords = async (id: string, page: number, pageSize: number) => {
  const sessionId = String(id || '').trim()
  if (!sessionId) {
    throw new Error('缺少会话 ID')
  }

  const existingSession = await prisma.generationSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  })

  if (!existingSession) {
    throw new Error('目标会话不存在')
  }

  const totalCount = await prisma.generationRecord.count({
    where: { sessionId },
  })
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  const records = await prisma.generationRecord.findMany({
    where: { sessionId },
    include: buildRecordInclude(),
    orderBy: {
      createdAt: 'desc',
    },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  })

  return {
    items: records.map(serializeGenerationRecord),
    summary: {
      totalCount,
      totalPages,
      page: safePage,
      pageSize,
    },
  }
}

// 后台重命名会话。
export const updateAdminGenerationSession = async (id: string, payload: { title?: string }) => {
  const sessionId = String(id || '').trim()
  if (!sessionId) {
    throw new Error('缺少会话 ID')
  }

  const existingSession = await prisma.generationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      isDefault: true,
    },
  })

  if (!existingSession) {
    throw new Error('目标会话不存在')
  }

  await prisma.generationSession.update({
    where: { id: sessionId },
    data: {
      title: normalizeGenerationSessionTitle(payload.title, existingSession.isDefault ? '默认创作' : '新对话'),
    },
  })

  return getAdminGenerationSessionDetail(sessionId)
}

// 后台删除会话；默认会话为了安全仍不允许直接删。
export const deleteAdminGenerationSession = async (id: string) => {
  const sessionId = String(id || '').trim()
  if (!sessionId) {
    throw new Error('缺少会话 ID')
  }

  const existingSession = await prisma.generationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      isDefault: true,
    },
  })

  if (!existingSession) {
    throw new Error('目标会话不存在')
  }

  if (existingSession.isDefault) {
    throw new Error('默认会话不允许删除')
  }

  await prisma.generationSession.delete({
    where: { id: sessionId },
  })

  return { id: sessionId }
}
