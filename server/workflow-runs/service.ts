import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import {
  assertWorkflowRunTransition,
  WorkflowRunRequestError,
  type WorkflowRunCreatePayload,
  type WorkflowRunNodeInput,
  type WorkflowRunUpdatePayload,
} from './shared'

const EXECUTABLE_NODE_TYPES = new Set(['llmConfig', 'imageConfig', 'videoConfig'])

const workflowRunInclude = {
  nodeRuns: {
    orderBy: { sortOrder: 'asc' as const },
  },
  workflowVersion: {
    select: {
      id: true,
      versionNo: true,
      versionName: true,
    },
  },
} satisfies Prisma.WorkflowRunInclude

export const normalizeWorkflowRunNodes = (
  payloadNodes: WorkflowRunNodeInput[] | undefined,
  versionNodes: unknown,
) => {
  const savedNodes = Array.isArray(versionNodes) ? versionNodes : []
  const savedNodeById = new Map(savedNodes
    .filter((item): item is Record<string, any> => Boolean(item) && typeof item === 'object')
    .map(item => [String(item.id || ''), item]))
  const uniqueIds = new Set<string>()

  const nodes = (Array.isArray(payloadNodes) ? payloadNodes : []).map((item, index) => {
    const id = String(item?.id || '').trim()
    const type = String(item?.type || '').trim()
    const savedNode = savedNodeById.get(id)
    if (!id || uniqueIds.has(id)) {
      throw new WorkflowRunRequestError(400, '运行节点 ID 不能为空或重复')
    }
    if (!savedNode || String(savedNode.type || '') !== type || !EXECUTABLE_NODE_TYPES.has(type)) {
      throw new WorkflowRunRequestError(400, `节点 ${id} 不属于当前版本或不可执行`)
    }
    uniqueIds.add(id)
    return {
      nodeId: id,
      nodeType: type,
      label: String(item.label || savedNode.data?.label || id).slice(0, 191),
      sortOrder: index,
    }
  })

  if (!nodes.length) {
    throw new WorkflowRunRequestError(400, '当前工作流没有可执行节点')
  }
  if (nodes.length > 200) {
    throw new WorkflowRunRequestError(400, '单次运行节点不能超过 200 个')
  }
  return nodes
}

const getOwnedWorkflow = async (workflowId: string, userId: string) => {
  const workflow = await prisma.workflowDefinition.findFirst({
    where: { id: workflowId, userId },
    select: { id: true, currentVersionId: true },
  })
  if (!workflow) throw new WorkflowRunRequestError(404, '工作流不存在')
  return workflow
}

const getOwnedRun = async (workflowId: string, runId: string, userId: string) => {
  const run = await prisma.workflowRun.findFirst({
    where: { id: runId, workflowId, userId },
    include: workflowRunInclude,
  })
  if (!run) throw new WorkflowRunRequestError(404, '工作流运行记录不存在')
  return run
}

export const createWorkflowRun = async (
  workflowId: string,
  payload: WorkflowRunCreatePayload,
  userId: string,
) => {
  const workflow = await getOwnedWorkflow(workflowId, userId)
  const versionId = String(payload.versionId || workflow.currentVersionId || '').trim()
  if (!versionId) throw new WorkflowRunRequestError(400, '工作流尚未保存可运行版本')

  const version = await prisma.workflowDefinitionVersion.findFirst({
    where: { id: versionId, workflowId },
    select: { id: true, nodesJson: true },
  })
  if (!version) throw new WorkflowRunRequestError(404, '工作流版本不存在')
  const runNodes = normalizeWorkflowRunNodes(payload.nodes, version.nodesJson)
  const executor = payload.executor === 'SERVER' ? 'SERVER' : 'BROWSER'
  const now = new Date()

  return await prisma.$transaction(async (tx) => {
    const activeRuns = await tx.workflowRun.findMany({
      where: { workflowId, userId, status: { in: ['PENDING', 'RUNNING'] } },
      select: { id: true },
    })
    const activeRunIds = activeRuns.map(item => item.id)
    if (activeRunIds.length) {
      await tx.workflowRun.updateMany({
        where: { id: { in: activeRunIds }, status: { in: ['PENDING', 'RUNNING'] } },
        data: {
          status: 'INTERRUPTED',
          errorMessage: '已由新的运行实例替代',
          finishedAt: now,
          heartbeatAt: now,
        },
      })
      await tx.workflowNodeRun.updateMany({
        where: { workflowRunId: { in: activeRunIds }, status: { in: ['PENDING', 'RUNNING'] } },
        data: { status: 'CANCELLED', errorMessage: '运行已中断', finishedAt: now },
      })
    }

    return await tx.workflowRun.create({
      data: {
        workflowId,
        workflowVersionId: version.id,
        userId,
        status: executor === 'SERVER' ? 'PENDING' : 'RUNNING',
        executor,
        totalNodes: runNodes.length,
        completedNodes: 0,
        heartbeatAt: now,
        startedAt: executor === 'SERVER' ? null : now,
        nodeRuns: { create: runNodes },
      },
      include: workflowRunInclude,
    })
  })
}

export const retryWorkflowRun = async (workflowId: string, runId: string, userId: string) => {
  const current = await getOwnedRun(workflowId, runId, userId)
  if (current.executor !== 'SERVER') {
    throw new WorkflowRunRequestError(409, '只有服务端运行记录支持失败重试')
  }
  if (!['FAILED', 'INTERRUPTED'].includes(current.status)) {
    throw new WorkflowRunRequestError(409, '只有失败或中断的运行可以重试')
  }
  const now = new Date()
  return await prisma.$transaction(async tx => {
    await tx.workflowNodeRun.updateMany({
      where: { workflowRunId: runId, status: { in: ['FAILED', 'CANCELLED'] } },
      data: {
        status: 'PENDING',
        generationRecordId: null,
        outputJson: Prisma.DbNull,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      },
    })
    const completedNodes = await tx.workflowNodeRun.count({
      where: { workflowRunId: runId, status: 'COMPLETED' },
    })
    await tx.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'PENDING',
        completedNodes,
        currentNodeId: null,
        errorMessage: null,
        resultJson: Prisma.DbNull,
        heartbeatAt: now,
        stopRequestedAt: null,
        startedAt: null,
        finishedAt: null,
      },
    })
    return await tx.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: workflowRunInclude,
    })
  })
}

export const getLatestWorkflowRun = async (workflowId: string, userId: string) => {
  await getOwnedWorkflow(workflowId, userId)
  return await prisma.workflowRun.findFirst({
    where: { workflowId, userId },
    orderBy: { createdAt: 'desc' },
    include: workflowRunInclude,
  })
}

export const getWorkflowRun = async (workflowId: string, runId: string, userId: string) => (
  await getOwnedRun(workflowId, runId, userId)
)

export const updateWorkflowRun = async (
  workflowId: string,
  runId: string,
  payload: WorkflowRunUpdatePayload,
  userId: string,
) => {
  const current = await getOwnedRun(workflowId, runId, userId)
  assertWorkflowRunTransition(current.status, payload.action)
  const now = new Date()

  return await prisma.$transaction(async (tx) => {
    const active = await tx.workflowRun.updateMany({
      where: { id: runId, workflowId, userId, status: 'RUNNING' },
      data: { heartbeatAt: now },
    })
    if (active.count !== 1) throw new WorkflowRunRequestError(409, '运行状态已发生变化')

    if (payload.action === 'NODE_STARTED') {
      const node = await tx.workflowNodeRun.updateMany({
        where: { workflowRunId: runId, nodeId: payload.nodeId, status: 'PENDING' },
        data: { status: 'RUNNING', startedAt: now, errorMessage: null },
      })
      if (node.count !== 1) throw new WorkflowRunRequestError(409, '节点不能重复开始执行')
      await tx.workflowRun.update({ where: { id: runId }, data: { currentNodeId: payload.nodeId } })
    }

    if (payload.action === 'NODE_COMPLETED') {
      const node = await tx.workflowNodeRun.updateMany({
        where: { workflowRunId: runId, nodeId: payload.nodeId, status: 'RUNNING' },
        data: {
          status: 'COMPLETED',
          generationRecordId: payload.generationRecordId || null,
          outputJson: payload.outputJson === undefined
            ? undefined
            : payload.outputJson as Prisma.InputJsonValue,
          errorMessage: null,
          finishedAt: now,
        },
      })
      if (node.count !== 1) throw new WorkflowRunRequestError(409, '节点尚未开始或已经结束')
      const completedNodes = await tx.workflowNodeRun.count({
        where: { workflowRunId: runId, status: 'COMPLETED' },
      })
      await tx.workflowRun.update({
        where: { id: runId },
        data: { completedNodes, currentNodeId: null },
      })
    }

    if (payload.action === 'FAILED') {
      const errorMessage = String(payload.errorMessage || '工作流执行失败').trim() || '工作流执行失败'
      if (payload.nodeId) {
        await tx.workflowNodeRun.updateMany({
          where: { workflowRunId: runId, nodeId: payload.nodeId, status: { in: ['PENDING', 'RUNNING'] } },
          data: { status: 'FAILED', errorMessage, finishedAt: now },
        })
      }
      await tx.workflowNodeRun.updateMany({
        where: { workflowRunId: runId, status: 'PENDING' },
        data: { status: 'CANCELLED', errorMessage: '前置节点执行失败', finishedAt: now },
      })
      await tx.workflowRun.update({
        where: { id: runId },
        data: { status: 'FAILED', errorMessage, currentNodeId: payload.nodeId || null, finishedAt: now },
      })
    }

    if (payload.action === 'COMPLETED') {
      const completedNodes = await tx.workflowNodeRun.count({
        where: { workflowRunId: runId, status: 'COMPLETED' },
      })
      if (completedNodes !== current.totalNodes) {
        throw new WorkflowRunRequestError(409, '仍有节点未完成，不能结束运行')
      }
      await tx.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          completedNodes,
          currentNodeId: null,
          errorMessage: null,
          resultJson: payload.resultJson === undefined
            ? undefined
            : payload.resultJson as Prisma.InputJsonValue,
          finishedAt: now,
        },
      })
    }

    if (payload.action === 'HEARTBEAT') {
      await tx.workflowRun.update({
        where: { id: runId },
        data: { currentNodeId: payload.nodeId || current.currentNodeId },
      })
    }

    return await tx.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: workflowRunInclude,
    })
  })
}

export const stopWorkflowRun = async (workflowId: string, runId: string, userId: string) => {
  const current = await getOwnedRun(workflowId, runId, userId)
  if (['COMPLETED', 'FAILED', 'CANCELLED', 'INTERRUPTED'].includes(current.status)) return current
  const now = new Date()

  return await prisma.$transaction(async (tx) => {
    await tx.workflowRun.updateMany({
      where: { id: runId, workflowId, userId, status: { in: ['PENDING', 'RUNNING'] } },
      data: {
        status: 'CANCELLED',
        errorMessage: '用户停止了工作流运行',
        stopRequestedAt: now,
        heartbeatAt: now,
        finishedAt: now,
      },
    })
    await tx.workflowNodeRun.updateMany({
      where: { workflowRunId: runId, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: 'CANCELLED', errorMessage: '用户停止了工作流运行', finishedAt: now },
    })
    return await tx.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: workflowRunInclude,
    })
  })
}
