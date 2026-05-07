import type {
  Prisma,
  WorkflowDefinitionStatus,
  WorkflowScene,
  WorkflowSourceType,
  WorkflowVersionStatus,
} from '@prisma/client'
import { prisma } from '../db/prisma'
import type {
  WorkflowDefinitionCreatePayload,
  WorkflowDefinitionListQuery,
  WorkflowDefinitionPublishPayload,
  WorkflowDefinitionUpdatePayload,
  WorkflowDefinitionVersionPayload,
} from './shared'

interface WorkflowAccessContext {
  currentUserId: string
}

interface WorkflowDefinitionListResult {
  items: ReturnType<typeof mapWorkflowDefinitionSummary>[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

type WorkflowDefinitionWithRelations = Prisma.WorkflowDefinitionGetPayload<{
  include: {
    currentVersion: true
    versions: {
      orderBy: {
        versionNo: 'desc'
      }
    }
  }
}>

const WORKFLOW_SCENE_VALUES: WorkflowScene[] = [
  'WORKFLOW_CANVAS',
  'AGENT_WORKSPACE',
  'GENERATION_PIPELINE',
]

const WORKFLOW_SOURCE_TYPE_VALUES: WorkflowSourceType[] = [
  'VISUAL',
  'SKILL_TEMPLATE',
  'SYSTEM_BUILTIN',
]

const WORKFLOW_DEFINITION_STATUS_VALUES: WorkflowDefinitionStatus[] = [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
]

const WORKFLOW_VERSION_STATUS_VALUES: WorkflowVersionStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'DEPRECATED',
]

const normalizeString = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

const normalizeRequiredString = (value: unknown, fieldLabel: string) => {
  const normalized = normalizeString(value)
  if (!normalized) {
    throw new Error(`${fieldLabel}不能为空`)
  }
  return normalized
}

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return fallback
}

const normalizeInteger = (value: unknown, fallback: number) => {
  const nextValue = Number(value)
  if (!Number.isFinite(nextValue)) {
    return fallback
  }

  return Math.round(nextValue)
}

const normalizePositiveInteger = (value: unknown, fallback: number, minValue = 1, maxValue = Number.MAX_SAFE_INTEGER) => {
  const normalizedValue = normalizeInteger(value, fallback)
  if (!Number.isFinite(normalizedValue)) {
    return fallback
  }

  return Math.min(maxValue, Math.max(minValue, normalizedValue))
}

const normalizeJsonValue = (value: unknown) => {
  return value === undefined ? null : value
}

const toNullableJsonInput = (value: unknown) => {
  return normalizeJsonValue(value) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined
}

const normalizeEnumValue = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
  fieldLabel: string,
) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback
  }

  const normalized = String(value).trim().toUpperCase() as T
  if (!allowedValues.includes(normalized)) {
    throw new Error(`${fieldLabel}不合法`)
  }

  return normalized
}

const buildWorkflowCode = (input: { code?: unknown; name?: unknown }) => {
  const explicitCode = normalizeString(input.code)
  if (explicitCode) {
    return explicitCode
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
  }

  const name = normalizeRequiredString(input.name, '工作流名称')
  const baseCode = name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return `${baseCode || 'workflow'}-${Date.now().toString(36)}`
}

const serializeWorkflowRecord = <T>(value: T): T => {
  if (value instanceof Date) {
    return value.toISOString() as T
  }

  if (Array.isArray(value)) {
    return value.map(item => serializeWorkflowRecord(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializeWorkflowRecord(item)]),
    ) as T
  }

  return value
}

const buildWorkflowWhereInput = (
  query: WorkflowDefinitionListQuery,
  currentUserId: string,
): Prisma.WorkflowDefinitionWhereInput => {
  const scene = normalizeString(query.scene)
  const status = normalizeString(query.status)
  const keyword = normalizeString(query.keyword)

  const where: Prisma.WorkflowDefinitionWhereInput = {
    OR: [
      { userId: currentUserId },
      { userId: null },
    ],
  }

  if (scene) {
    where.scene = normalizeEnumValue(scene, WORKFLOW_SCENE_VALUES, 'WORKFLOW_CANVAS', '工作流场景')
  }

  if (status) {
    where.status = normalizeEnumValue(status, WORKFLOW_DEFINITION_STATUS_VALUES, 'DRAFT', '工作流状态')
  }

  if (keyword) {
    where.AND = [
      {
        OR: [
          { name: { contains: keyword } },
          { code: { contains: keyword } },
          { description: { contains: keyword } },
          { category: { contains: keyword } },
        ],
      },
    ]
  }

  return where
}

const mapWorkflowDefinitionSummary = (item: WorkflowDefinitionWithRelations) => {
  const latestVersion = item.versions[0] || null

  return serializeWorkflowRecord({
    id: item.id,
    userId: item.userId,
    code: item.code,
    name: item.name,
    description: item.description,
    category: item.category,
    scene: item.scene,
    sourceType: item.sourceType,
    status: item.status,
    currentVersionId: item.currentVersionId,
    latestVersionNo: item.latestVersionNo,
    isBuiltIn: item.isBuiltIn,
    isEnabled: item.isEnabled,
    sortOrder: item.sortOrder,
    tagsJson: item.tagsJson,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    currentVersion: item.currentVersion,
    latestVersion,
    versionCount: item.versions.length,
  })
}

const ensureWorkflowEditable = (
  workflow: {
    userId: string | null
    isBuiltIn: boolean
  },
  currentUserId: string,
) => {
  if (workflow.isBuiltIn || workflow.userId === null) {
    throw new Error('系统级工作流暂不允许在这里直接修改')
  }

  if (workflow.userId !== currentUserId) {
    throw new Error('你没有权限修改该工作流')
  }
}

const readAccessibleWorkflowDetail = async (workflowId: string, context: WorkflowAccessContext) => {
  const workflow = await prisma.workflowDefinition.findFirst({
    where: {
      id: workflowId,
      OR: [
        { userId: context.currentUserId },
        { userId: null },
      ],
    },
    include: {
      currentVersion: true,
      versions: {
        orderBy: {
          versionNo: 'desc',
        },
      },
    },
  })

  if (!workflow) {
    throw new Error('工作流不存在')
  }

  return workflow
}

export const listWorkflowDefinitions = async (
  query: WorkflowDefinitionListQuery,
  context: WorkflowAccessContext,
) : Promise<WorkflowDefinitionListResult> => {
  const page = normalizePositiveInteger(query.page, 1)
  const pageSize = normalizePositiveInteger(query.pageSize, 12, 1, 50)
  const where = buildWorkflowWhereInput(query, context.currentUserId)
  const skip = (page - 1) * pageSize

  const [items, total] = await prisma.$transaction([
    prisma.workflowDefinition.findMany({
      where,
      include: {
        currentVersion: true,
        versions: {
          orderBy: {
            versionNo: 'desc',
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
      skip,
      take: pageSize,
    }),
    prisma.workflowDefinition.count({ where }),
  ])

  const normalizedItems = items.map(item => mapWorkflowDefinitionSummary(item as WorkflowDefinitionWithRelations))

  return {
    items: normalizedItems,
    total,
    page,
    pageSize,
    hasMore: skip + normalizedItems.length < total,
  }
}

export const getWorkflowDefinitionDetail = async (workflowId: string, context: WorkflowAccessContext) => {
  const workflow = await readAccessibleWorkflowDetail(workflowId, context)

  return serializeWorkflowRecord({
    definition: mapWorkflowDefinitionSummary(workflow as WorkflowDefinitionWithRelations),
    versions: workflow.versions,
  })
}

export const updateWorkflowDefinition = async (
  workflowId: string,
  payload: WorkflowDefinitionUpdatePayload,
  context: WorkflowAccessContext,
) => {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      userId: true,
      isBuiltIn: true,
      scene: true,
      sourceType: true,
      status: true,
      isEnabled: true,
      sortOrder: true,
      tagsJson: true,
    },
  })

  if (!workflow) {
    throw new Error('工作流不存在')
  }

  ensureWorkflowEditable(workflow, context.currentUserId)

  const name = payload.name === undefined
    ? undefined
    : normalizeRequiredString(payload.name, '工作流名称')
  const description = payload.description === undefined
    ? undefined
    : normalizeString(payload.description)
  const category = payload.category === undefined
    ? undefined
    : normalizeString(payload.category)
  const status = payload.status === undefined
    ? undefined
    : normalizeEnumValue(payload.status, WORKFLOW_DEFINITION_STATUS_VALUES, workflow.status, '工作流状态')
  const isEnabled = payload.isEnabled === undefined
    ? undefined
    : normalizeBoolean(payload.isEnabled, workflow.isEnabled)
  const sortOrder = payload.sortOrder === undefined
    ? undefined
    : normalizeInteger(payload.sortOrder, workflow.sortOrder)
  const tagsJson = payload.tagsJson === undefined
    ? undefined
    : toNullableJsonInput(payload.tagsJson)

  const result = await prisma.workflowDefinition.update({
    where: { id: workflowId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(isEnabled !== undefined ? { isEnabled } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(tagsJson !== undefined ? { tagsJson } : {}),
    },
    include: {
      currentVersion: true,
      versions: {
        orderBy: {
          versionNo: 'desc',
        },
      },
    },
  })

  return serializeWorkflowRecord({
    definition: mapWorkflowDefinitionSummary(result as WorkflowDefinitionWithRelations),
    versions: result.versions,
  })
}

export const deleteWorkflowDefinition = async (
  workflowId: string,
  context: WorkflowAccessContext,
) => {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      userId: true,
      isBuiltIn: true,
      name: true,
    },
  })

  if (!workflow) {
    throw new Error('工作流不存在')
  }

  ensureWorkflowEditable(workflow, context.currentUserId)

  await prisma.workflowDefinition.delete({
    where: { id: workflowId },
  })

  return serializeWorkflowRecord({
    id: workflow.id,
    name: workflow.name,
    deleted: true,
  })
}

export const createWorkflowDefinition = async (
  payload: WorkflowDefinitionCreatePayload,
  context: WorkflowAccessContext,
) => {
  const name = normalizeRequiredString(payload.name, '工作流名称')
  const code = buildWorkflowCode(payload)
  const description = normalizeString(payload.description)
  const category = normalizeString(payload.category)
  const scene = normalizeEnumValue(payload.scene, WORKFLOW_SCENE_VALUES, 'WORKFLOW_CANVAS', '工作流场景')
  const sourceType = normalizeEnumValue(payload.sourceType, WORKFLOW_SOURCE_TYPE_VALUES, 'VISUAL', '工作流来源')
  const status = normalizeEnumValue(payload.status, WORKFLOW_DEFINITION_STATUS_VALUES, 'DRAFT', '工作流状态')
  const versionStatus: WorkflowVersionStatus = status === 'ACTIVE' ? 'PUBLISHED' : 'DRAFT'

  const result = await prisma.$transaction(async (tx) => {
    const workflow = await tx.workflowDefinition.create({
      data: {
        userId: context.currentUserId,
        code,
        name,
        description,
        category,
        scene,
        sourceType,
        status,
        latestVersionNo: 1,
        isBuiltIn: normalizeBoolean(payload.isBuiltIn, false),
        isEnabled: normalizeBoolean(payload.isEnabled, true),
        sortOrder: normalizeInteger(payload.sortOrder, 0),
        tagsJson: toNullableJsonInput(payload.tagsJson),
      },
    })

    const version = await tx.workflowDefinitionVersion.create({
      data: {
        workflowId: workflow.id,
        createdBy: context.currentUserId,
        versionNo: 1,
        versionName: normalizeString(payload.versionName),
        changeSummary: normalizeString(payload.changeSummary),
        status: versionStatus,
        definitionJson: toNullableJsonInput(payload.definitionJson),
        nodesJson: toNullableJsonInput(payload.nodesJson),
        edgesJson: toNullableJsonInput(payload.edgesJson),
        viewportJson: toNullableJsonInput(payload.viewportJson),
        inputSchemaJson: toNullableJsonInput(payload.inputSchemaJson),
        outputSchemaJson: toNullableJsonInput(payload.outputSchemaJson),
        runtimeConfigJson: toNullableJsonInput(payload.runtimeConfigJson),
        publishedAt: versionStatus === 'PUBLISHED' ? new Date() : null,
      },
    })

    await tx.workflowDefinition.update({
      where: { id: workflow.id },
      data: {
        currentVersionId: version.id,
      },
    })

    return await tx.workflowDefinition.findUniqueOrThrow({
      where: { id: workflow.id },
      include: {
        currentVersion: true,
        versions: {
          orderBy: {
            versionNo: 'desc',
          },
        },
      },
    })
  })

  return serializeWorkflowRecord({
    definition: mapWorkflowDefinitionSummary(result as WorkflowDefinitionWithRelations),
    versions: result.versions,
  })
}

export const createWorkflowDefinitionVersion = async (
  workflowId: string,
  payload: WorkflowDefinitionVersionPayload,
  context: WorkflowAccessContext,
) => {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      userId: true,
      isBuiltIn: true,
      latestVersionNo: true,
      status: true,
    },
  })

  if (!workflow) {
    throw new Error('工作流不存在')
  }

  ensureWorkflowEditable(workflow, context.currentUserId)

  const versionStatus = normalizeEnumValue(payload.status, WORKFLOW_VERSION_STATUS_VALUES, 'DRAFT', '工作流版本状态')

  const result = await prisma.$transaction(async (tx) => {
    const nextVersionNo = workflow.latestVersionNo + 1

    const version = await tx.workflowDefinitionVersion.create({
      data: {
        workflowId,
        createdBy: context.currentUserId,
        versionNo: nextVersionNo,
        versionName: normalizeString(payload.versionName),
        changeSummary: normalizeString(payload.changeSummary),
        status: versionStatus,
        definitionJson: toNullableJsonInput(payload.definitionJson),
        nodesJson: toNullableJsonInput(payload.nodesJson),
        edgesJson: toNullableJsonInput(payload.edgesJson),
        viewportJson: toNullableJsonInput(payload.viewportJson),
        inputSchemaJson: toNullableJsonInput(payload.inputSchemaJson),
        outputSchemaJson: toNullableJsonInput(payload.outputSchemaJson),
        runtimeConfigJson: toNullableJsonInput(payload.runtimeConfigJson),
        publishedAt: versionStatus === 'PUBLISHED' ? new Date() : null,
      },
    })

    await tx.workflowDefinition.update({
      where: { id: workflowId },
      data: {
        latestVersionNo: nextVersionNo,
        currentVersionId: version.id,
        status: versionStatus === 'PUBLISHED' ? 'ACTIVE' : workflow.status,
      },
    })

    if (versionStatus === 'PUBLISHED') {
      await tx.workflowDefinitionVersion.updateMany({
        where: {
          workflowId,
          id: { not: version.id },
          status: 'PUBLISHED',
        },
        data: {
          status: 'DEPRECATED',
        },
      })
    }

    return version
  })

  return serializeWorkflowRecord(result)
}

export const autosaveWorkflowDefinitionDraft = async (
  workflowId: string,
  payload: WorkflowDefinitionVersionPayload,
  context: WorkflowAccessContext,
) => {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      userId: true,
      isBuiltIn: true,
      latestVersionNo: true,
      status: true,
      currentVersionId: true,
      currentVersion: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  })

  if (!workflow) {
    throw new Error('工作流不存在')
  }

  ensureWorkflowEditable(workflow, context.currentUserId)

  const result = await prisma.$transaction(async (tx) => {
    if (workflow.currentVersion?.id && workflow.currentVersion.status === 'DRAFT') {
      const draftVersion = await tx.workflowDefinitionVersion.update({
        where: { id: workflow.currentVersion.id },
        data: {
          versionName: normalizeString(payload.versionName),
          changeSummary: normalizeString(payload.changeSummary),
          definitionJson: toNullableJsonInput(payload.definitionJson),
          nodesJson: toNullableJsonInput(payload.nodesJson),
          edgesJson: toNullableJsonInput(payload.edgesJson),
          viewportJson: toNullableJsonInput(payload.viewportJson),
          inputSchemaJson: toNullableJsonInput(payload.inputSchemaJson),
          outputSchemaJson: toNullableJsonInput(payload.outputSchemaJson),
          runtimeConfigJson: toNullableJsonInput(payload.runtimeConfigJson),
        },
      })

      await tx.workflowDefinition.update({
        where: { id: workflowId },
        data: {
          status: workflow.status === 'ARCHIVED' ? workflow.status : 'DRAFT',
        },
      })

      return draftVersion
    }

    const nextVersionNo = workflow.latestVersionNo + 1
    const nextDraftVersion = await tx.workflowDefinitionVersion.create({
      data: {
        workflowId,
        createdBy: context.currentUserId,
        versionNo: nextVersionNo,
        versionName: normalizeString(payload.versionName),
        changeSummary: normalizeString(payload.changeSummary),
        status: 'DRAFT',
        definitionJson: toNullableJsonInput(payload.definitionJson),
        nodesJson: toNullableJsonInput(payload.nodesJson),
        edgesJson: toNullableJsonInput(payload.edgesJson),
        viewportJson: toNullableJsonInput(payload.viewportJson),
        inputSchemaJson: toNullableJsonInput(payload.inputSchemaJson),
        outputSchemaJson: toNullableJsonInput(payload.outputSchemaJson),
        runtimeConfigJson: toNullableJsonInput(payload.runtimeConfigJson),
      },
    })

    await tx.workflowDefinition.update({
      where: { id: workflowId },
      data: {
        latestVersionNo: nextVersionNo,
        currentVersionId: nextDraftVersion.id,
        status: workflow.status === 'ARCHIVED' ? workflow.status : 'DRAFT',
      },
    })

    return nextDraftVersion
  })

  return serializeWorkflowRecord(result)
}

export const publishWorkflowDefinition = async (
  workflowId: string,
  payload: WorkflowDefinitionPublishPayload,
  context: WorkflowAccessContext,
) => {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      userId: true,
      isBuiltIn: true,
      currentVersionId: true,
    },
  })

  if (!workflow) {
    throw new Error('工作流不存在')
  }

  ensureWorkflowEditable(workflow, context.currentUserId)

  const versionId = normalizeString(payload.versionId) || workflow.currentVersionId
  if (!versionId) {
    throw new Error('当前工作流还没有可发布的版本')
  }

  const targetVersion = await prisma.workflowDefinitionVersion.findFirst({
    where: {
      id: versionId,
      workflowId,
    },
    select: {
      id: true,
    },
  })

  if (!targetVersion) {
    throw new Error('目标版本不存在')
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.workflowDefinitionVersion.updateMany({
      where: {
        workflowId,
        status: 'PUBLISHED',
        id: { not: versionId },
      },
      data: {
        status: 'DEPRECATED',
      },
    })

    const publishedVersion = await tx.workflowDefinitionVersion.update({
      where: { id: versionId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    await tx.workflowDefinition.update({
      where: { id: workflowId },
      data: {
        currentVersionId: versionId,
        status: 'ACTIVE',
      },
    })

    return publishedVersion
  })

  return serializeWorkflowRecord(result)
}
