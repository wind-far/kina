import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { buildPageResult, resolvePagination } from '../shared/pagination'
import type { AdminGenerationRecordsQuery } from './shared'

// 后台生成记录输出关联，按排序返回图片、视频、文本等结果。
const buildRecordInclude = () => ({
  session: {
    select: {
      id: true,
      title: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  },
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

// 数据库枚举值转换成前端展示使用的短横线格式。
const formatRecordType = (type: unknown) => {
  return String(type || '').toLowerCase().replaceAll('_', '-')
}

// 后台额外带上用户摘要，方便定位是哪位用户触发的生成任务。
const serializeAdminGenerationRecord = (record: any) => ({
  id: record.id,
  sessionId: record.sessionId,
  sessionTitle: record.session?.title || '',
  source: '',
  type: formatRecordType(record.type),
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
  done: ['COMPLETED', 'FAILED', 'STOPPED'].includes(String(record.status || '')),
  stopped: record.status === 'STOPPED',
  agentTaskId: record.agentTaskId || undefined,
  createdAt: record.createdAt,
  user: {
    id: record.user?.id || '',
    name: record.user?.name || '',
    email: record.user?.email || '',
    phone: record.user?.phone || '',
    avatarUrl: record.user?.avatarUrl || '',
  },
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
          description: step.description || undefined,
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

// 构造后台生成记录筛选条件，尽量把关键词筛选下推数据库。
const buildRecordWhereInput = (query: AdminGenerationRecordsQuery): Prisma.GenerationRecordWhereInput => {
  const andConditions: Prisma.GenerationRecordWhereInput[] = []

  if (query.keyword) {
    andConditions.push({
      OR: [
        { prompt: { contains: query.keyword } },
        { content: { contains: query.keyword } },
        { skill: { contains: query.keyword } },
        { feature: { contains: query.keyword } },
        { agentTaskId: { contains: query.keyword } },
      ],
    })
  }

  if (query.userKeyword) {
    andConditions.push({
      user: {
        OR: [
          { name: { contains: query.userKeyword } },
          { email: { contains: query.userKeyword } },
          { phone: { contains: query.userKeyword } },
        ],
      },
    })
  }

  if (query.modelKeyword) {
    andConditions.push({
      OR: [
        { modelLabel: { contains: query.modelKeyword } },
        { modelKey: { contains: query.modelKeyword } },
      ],
    })
  }

  if (query.errorKeyword) {
    andConditions.push({
      errorMessage: { contains: query.errorKeyword },
    })
  }

  if (query.status === 'COMPLETED') {
    andConditions.push({ status: 'COMPLETED', errorMessage: null })
  } else if (query.status === 'FAILED') {
    andConditions.push({
      OR: [
        { status: 'FAILED' },
        { errorMessage: { not: null } },
      ],
    })
  } else if (query.status === 'RUNNING') {
    andConditions.push({
      status: {
        in: ['PENDING', 'RUNNING'],
      },
    })
  }

  if (query.type !== 'ALL') {
    if (query.type === 'RESEARCH') {
      andConditions.push({ id: '__no_research_generation_type__' })
    } else {
      andConditions.push({ type: query.type })
    }
  }

  return andConditions.length ? { AND: andConditions } : {}
}

// 分页查询全站生成记录，供后台排查生成链路问题。
export const listAdminGenerationRecords = async (query: AdminGenerationRecordsQuery) => {
  const where = buildRecordWhereInput(query)
  const totalCount = await prisma.generationRecord.count({ where })
  const pagination = resolvePagination(query, totalCount, {
    defaultPageSize: 10,
    maxPageSize: 100,
  })
  const records = await prisma.generationRecord.findMany({
    where,
    include: buildRecordInclude(),
    orderBy: {
      createdAt: 'desc',
    },
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  return buildPageResult(records.map(serializeAdminGenerationRecord), pagination)
}
