import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { getGenerationTaskRecord, startGenerationTask, stopGenerationTask } from '../generation-tasks/service'
import type { GenerationTaskStartPayload } from '../generation-tasks/shared'
import { getPublicModelCatalog } from '../provider-config/service'
import { writeScopedLog } from '../shared/logging'
import { normalizeWorkflowImageBatchCount } from '../../src/shared/workflow-image-batch'
import type { SkillMediaReference } from '../../src/shared/skill-runtime'
import { buildWorkflowGenerationMetadata } from '../../src/shared/workflow-generation-metadata'

type JsonObject = Record<string, any>

type RuntimeOutput = {
  content?: string
  url?: string
  images?: string[]
  generationRecordId?: string
  generationMeta?: ReturnType<typeof buildWorkflowGenerationMetadata>
}

const activeRuns = new Map<string, AbortController>()
const EXECUTABLE_NODE_TYPES = new Set(['llmConfig', 'imageConfig', 'videoConfig'])
const TERMINAL_RUN_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'INTERRUPTED'])

const asObjects = (value: unknown) => (Array.isArray(value)
  ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object')
  : [])

const delay = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) {
    reject(new DOMException('工作流执行已取消', 'AbortError'))
    return
  }
  const timer = setTimeout(resolve, milliseconds)
  signal.addEventListener('abort', () => {
    clearTimeout(timer)
    reject(new DOMException('工作流执行已取消', 'AbortError'))
  }, { once: true })
})

const readNodeData = (node: JsonObject) => (
  node.data && typeof node.data === 'object' ? node.data as JsonObject : {}
)

const topologicalOrder = (nodes: JsonObject[], edges: JsonObject[]) => {
  const ids = new Set(nodes.map(node => String(node.id || '')))
  const indegree = new Map([...ids].map(id => [id, 0]))
  const outgoing = new Map<string, string[]>()
  edges.forEach((edge) => {
    const source = String(edge.source || '')
    const target = String(edge.target || '')
    if (!ids.has(source) || !ids.has(target)) return
    indegree.set(target, (indegree.get(target) || 0) + 1)
    outgoing.set(source, [...(outgoing.get(source) || []), target])
  })
  const queue = nodes.map(node => String(node.id || '')).filter(id => (indegree.get(id) || 0) === 0)
  const ordered: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    ordered.push(id)
    for (const target of outgoing.get(id) || []) {
      const next = (indegree.get(target) || 0) - 1
      indegree.set(target, next)
      if (next === 0) queue.push(target)
    }
  }
  if (ordered.length !== nodes.length) throw new Error('工作流存在循环依赖，服务端无法执行')
  return ordered
}

const resolveModel = async (rawModel: string, category: 'CHAT' | 'IMAGE' | 'VIDEO') => {
  const catalog = await getPublicModelCatalog()
  const modelCategory = category === 'CHAT' ? 'chat' : category === 'IMAGE' ? 'image' : 'video'
  const models = catalog.models[modelCategory]
  const raw = String(rawModel || '').trim()
  const matched = models.find(item => item.selectionKey === raw || item.modelKey === raw)
    || (!raw ? models.find(item => item.selectionKey === catalog.defaults[modelCategory]) : null)
    || (!raw ? models[0] : null)
  if (!matched) {
    throw new Error(category === 'CHAT'
      ? '未配置可用的对话模型'
      : category === 'IMAGE' ? '未配置可用的图片模型' : '未配置可用的视频模型')
  }
  return matched
}

const readOutputUrl = (output: RuntimeOutput | undefined) => (
  String(output?.url || output?.images?.[0] || '').trim()
)

const collectInputs = (
  nodeId: string,
  nodesById: Map<string, JsonObject>,
  edges: JsonObject[],
  outputs: Map<string, RuntimeOutput>,
) => {
  const incoming = edges
    .filter(edge => String(edge.target || '') === nodeId)
    .sort((first, second) => Number(first.data?.promptOrder || first.data?.imageOrder || 0)
      - Number(second.data?.promptOrder || second.data?.imageOrder || 0))
  const prompts: string[] = []
  const images: string[] = []
  const imageRoles: string[] = []
  const mediaReferences: SkillMediaReference[] = []

  for (const edge of incoming) {
    const sourceId = String(edge.source || '')
    const source = nodesById.get(sourceId)
    if (!source) continue
    const data = readNodeData(source)
    if (source.type === 'text') {
      const content = String(data.content || '').trim()
      if (content) prompts.push(content)
      continue
    }
    if (source.type === 'llmConfig') {
      const content = String(outputs.get(sourceId)?.content || data.outputContent || '').trim()
      if (content) prompts.push(content)
      continue
    }
    if (source.type === 'image') {
      const producer = edges.find(candidate => String(candidate.target || '') === sourceId)
      const url = readOutputUrl(outputs.get(String(producer?.source || '')))
        || String(data.url || '').trim()
      if (url) {
        const imageRole = String(edge.data?.imageRole || 'input_reference')
        const mediaRole = String(edge.data?.mediaRole || (imageRole === 'first_frame_image'
          ? 'first_frame'
          : imageRole === 'last_frame_image' ? 'last_frame' : 'reference'))
        images.push(url)
        imageRoles.push(imageRole)
        mediaReferences.push({ mediaType: 'image', url, role: mediaRole as SkillMediaReference['role'], sourceNodeId: sourceId })
      }
      continue
    }
    if (source.type === 'video' || source.type === 'audio') {
      const producer = edges.find(candidate => String(candidate.target || '') === sourceId)
      const url = readOutputUrl(outputs.get(String(producer?.source || '')))
        || String(data.url || '').trim()
      if (!url) continue
      const mediaType = source.type === 'video' ? 'video' : 'audio'
      const defaultRole = mediaType === 'video' ? 'video_reference' : 'audio_reference'
      mediaReferences.push({
        mediaType,
        url,
        role: String(edge.data?.mediaRole || defaultRole) as SkillMediaReference['role'],
        sourceNodeId: sourceId,
        ...(mediaType === 'audio' && Number(data.duration) > 0 ? { startSeconds: 0, endSeconds: Number(data.duration) } : {}),
      })
    }
  }

  return { prompt: prompts.join('\n\n'), images, imageRoles, mediaReferences }
}

const waitForGenerationTask = async (
  recordId: string,
  userId: string,
  runId: string,
  signal: AbortSignal,
) => {
  while (true) {
    if (signal.aborted) throw new DOMException('工作流执行已取消', 'AbortError')
    const [record, run] = await Promise.all([
      getGenerationTaskRecord(recordId, userId),
      prisma.workflowRun.findUnique({ where: { id: runId }, select: { status: true } }),
    ])
    if (!run || run.status !== 'RUNNING') {
      await stopGenerationTask(recordId, userId).catch(() => undefined)
      throw new DOMException('工作流执行已取消', 'AbortError')
    }
    if (record.done) {
      if (record.stopped) throw new DOMException('生成任务已停止', 'AbortError')
      if (record.error) throw new Error(String(record.error))
      return record
    }
    await delay(600, signal)
  }
}

const buildTaskPayload = async (
  node: JsonObject,
  input: { prompt: string; images: string[]; imageRoles: string[]; mediaReferences: SkillMediaReference[] },
  executionAttemptId: string,
): Promise<GenerationTaskStartPayload> => {
  const data = readNodeData(node)
  if (node.type === 'llmConfig') {
    const model = await resolveModel(String(data.model || ''), 'CHAT')
    let systemPrompt = String(data.systemPrompt || '').trim()
    if (data.outputFormat === 'json') systemPrompt += '\n\n请以合法的 JSON 格式输出结果，不要包含其他内容。'
    if (data.outputFormat === 'markdown') systemPrompt += '\n\n请以 Markdown 格式输出结果。'
    const prompt = input.prompt || '请根据系统提示词生成内容'
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
    messages.push({ role: 'user', content: prompt })
    return {
      source: 'workflow-server',
      type: 'agent',
      prompt,
      model: model.label,
      modelKey: model.modelKey,
      skill: 'general',
      requestBody: {
        providerId: model.providerId,
        model: model.modelKey,
        messages,
        stream: true,
        __workflowExecutionId: executionAttemptId,
      },
    }
  }

  if (node.type === 'videoConfig') {
    const model = await resolveModel(String(data.model || ''), 'VIDEO')
    const prompt = input.prompt || String(data.prompt || '').trim()
    if (!prompt && !input.images.length) throw new Error(`节点“${data.label || node.id}”缺少视频生成输入`)
    return {
      source: 'workflow-server',
      type: 'video',
      prompt,
      model: model.label,
      modelKey: model.modelKey,
      ratio: String(data.ratio || ''),
      resolution: String(data.resolution || ''),
      duration: String(data.duration || ''),
      referenceImages: input.images,
      mediaReferences: input.mediaReferences,
      requestBody: {
        providerId: model.providerId,
        model: model.modelKey,
        prompt,
        ratio: String(data.ratio || ''),
        quality: String(data.resolution || ''),
        duration: String(data.duration || ''),
        referenceImageRoles: input.imageRoles,
        __workflowExecutionId: executionAttemptId,
      },
    }
  }

  const model = await resolveModel(String(data.model || ''), 'IMAGE')
  const prompt = input.prompt || String(data.prompt || '').trim()
  if (!prompt && !input.images.length) throw new Error(`节点“${data.label || node.id}”缺少图片生成输入`)
  const requestBody: JsonObject = {
    providerId: model.providerId,
    model: model.modelKey,
    prompt,
    n: normalizeWorkflowImageBatchCount(data.batchCount),
    __workflowExecutionId: executionAttemptId,
  }
  if (data.size) requestBody.size = String(data.size)
  if (data.quality) requestBody.quality = String(data.quality)
  return {
    source: 'workflow-server',
    type: 'image',
    requestMode: input.images.length ? 'image-edit' : 'image-generation',
    prompt,
    model: model.label,
    modelKey: model.modelKey,
    ratio: String(data.size || ''),
    resolution: String(data.quality || ''),
    referenceImages: input.images,
    requestBody,
  }
}

const executeNode = async (
  run: { id: string; userId: string },
  node: JsonObject,
  input: { prompt: string; images: string[]; imageRoles: string[]; mediaReferences: SkillMediaReference[] },
  signal: AbortSignal,
) => {
  const payload = await buildTaskPayload(node, input, `${run.id}:${String(node.id)}:${Date.now()}`)
  const record = await startGenerationTask(payload, run.userId)
  const recordId = String(record.id || '')
  if (!recordId) throw new Error('服务端生成任务未返回记录 ID')
  await prisma.workflowNodeRun.update({
    where: { workflowRunId_nodeId: { workflowRunId: run.id, nodeId: String(node.id) } },
    data: { generationRecordId: recordId },
  })
  const completed = await waitForGenerationTask(recordId, run.userId, run.id, signal)
  const images = Array.isArray(completed.images) ? completed.images.map(String).filter(Boolean) : []
  const videoUrl = asObjects(completed.outputs)
    .find(output => String(output.outputType || '').toLowerCase() === 'video')?.url
  return {
    generationRecordId: recordId,
    content: String(completed.content || '').trim(),
    url: String(videoUrl || images[0] || ''),
    images,
    generationMeta: buildWorkflowGenerationMetadata({
      kind: node.type === 'videoConfig' ? 'video' : node.type === 'llmConfig' ? 'text' : 'image',
      prompt: payload.prompt,
      model: payload.model,
      modelKey: payload.modelKey,
      systemPrompt: node.type === 'llmConfig' ? String(readNodeData(node).systemPrompt || '') : undefined,
      outputFormat: node.type === 'llmConfig' ? String(readNodeData(node).outputFormat || '') : undefined,
      size: node.type === 'imageConfig' ? String(readNodeData(node).size || '') : undefined,
      quality: node.type === 'imageConfig' ? String(readNodeData(node).quality || '') : undefined,
      ratio: payload.ratio,
      resolution: payload.resolution,
      duration: Number(payload.duration || 0),
      count: node.type === 'imageConfig' ? normalizeWorkflowImageBatchCount(readNodeData(node).batchCount) : undefined,
      references: payload.mediaReferences || input.mediaReferences,
      sourceConfigNodeId: String(node.id || ''),
    }),
  } satisfies RuntimeOutput
}

const markRunFailed = async (runId: string, nodeId: string, error: unknown) => {
  const message = error instanceof Error ? error.message : '工作流执行失败'
  const now = new Date()
  await prisma.$transaction([
    prisma.workflowNodeRun.updateMany({
      where: { workflowRunId: runId, nodeId, status: { in: ['PENDING', 'RUNNING'] } },
      data: { status: 'FAILED', errorMessage: message, finishedAt: now },
    }),
    prisma.workflowNodeRun.updateMany({
      where: { workflowRunId: runId, status: 'PENDING' },
      data: { status: 'CANCELLED', errorMessage: '前置节点执行失败', finishedAt: now },
    }),
    prisma.workflowRun.updateMany({
      where: { id: runId, status: 'RUNNING' },
      data: { status: 'FAILED', currentNodeId: nodeId, errorMessage: message, finishedAt: now, heartbeatAt: now },
    }),
  ])
}

const executeWorkflowRun = async (runId: string, controller: AbortController) => {
  let currentNodeId = ''
  try {
    const claimed = await prisma.workflowRun.updateMany({
      where: { id: runId, status: 'PENDING', executor: 'SERVER' },
      data: { status: 'RUNNING', startedAt: new Date(), heartbeatAt: new Date(), errorMessage: null, finishedAt: null },
    })
    if (claimed.count !== 1) return

    const run = await prisma.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: { workflowVersion: true, nodeRuns: { orderBy: { sortOrder: 'asc' } } },
    })
    const nodes = asObjects(run.workflowVersion.nodesJson)
    const edges = asObjects(run.workflowVersion.edgesJson)
    const nodesById = new Map(nodes.map(node => [String(node.id || ''), node]))
    const orderedIds = topologicalOrder(nodes, edges)
    const outputs = new Map<string, RuntimeOutput>()
    run.nodeRuns.filter(item => item.status === 'COMPLETED').forEach((item) => {
      const value = item.outputJson && typeof item.outputJson === 'object' ? item.outputJson as JsonObject : {}
      outputs.set(item.nodeId, {
        generationRecordId: String(value.generationRecordId || value.taskRecordId || item.generationRecordId || ''),
        content: String(value.content || value.outputContent || ''),
        url: String(value.url || value.outputUrl || ''),
        images: Array.isArray(value.images) ? value.images.map(String).filter(Boolean) : [],
      })
    })

    for (const nodeId of orderedIds) {
      const node = nodesById.get(nodeId)
      if (!node || !EXECUTABLE_NODE_TYPES.has(String(node.type || ''))) continue
      const nodeRun = run.nodeRuns.find(item => item.nodeId === nodeId)
      if (!nodeRun || nodeRun.status === 'COMPLETED') continue
      currentNodeId = nodeId
      const started = await prisma.workflowNodeRun.updateMany({
        where: { workflowRunId: runId, nodeId, status: 'PENDING' },
        data: { status: 'RUNNING', startedAt: new Date(), finishedAt: null, errorMessage: null },
      })
      if (started.count !== 1) throw new Error(`节点 ${nodeId} 当前不可执行`)
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { currentNodeId: nodeId, heartbeatAt: new Date() },
      })

      const output = await executeNode(run, node, collectInputs(nodeId, nodesById, edges, outputs), controller.signal)
      outputs.set(nodeId, output)
      const now = new Date()
      await prisma.$transaction(async tx => {
        await tx.workflowNodeRun.update({
          where: { workflowRunId_nodeId: { workflowRunId: runId, nodeId } },
          data: {
            status: 'COMPLETED',
            generationRecordId: output.generationRecordId,
            outputJson: {
              taskRecordId: output.generationRecordId,
              outputContent: output.content || null,
              outputUrl: output.url || null,
              images: output.images || [],
              generationMeta: output.generationMeta || null,
            } as Prisma.InputJsonValue,
            errorMessage: null,
            finishedAt: now,
          },
        })
        const completedNodes = await tx.workflowNodeRun.count({ where: { workflowRunId: runId, status: 'COMPLETED' } })
        await tx.workflowRun.update({
          where: { id: runId },
          data: { completedNodes, currentNodeId: null, heartbeatAt: now },
        })
      })
    }

    const completedNodeRuns = await prisma.workflowNodeRun.findMany({
      where: { workflowRunId: runId, status: 'COMPLETED' },
      select: { nodeId: true },
    })
    const now = new Date()
    await prisma.workflowRun.updateMany({
      where: { id: runId, status: 'RUNNING' },
      data: {
        status: 'COMPLETED',
        completedNodes: completedNodeRuns.length,
        currentNodeId: null,
        errorMessage: null,
        resultJson: { executedNodeIds: completedNodeRuns.map(item => item.nodeId) },
        heartbeatAt: now,
        finishedAt: now,
      },
    })
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      await markRunFailed(runId, currentNodeId, error)
      writeScopedLog('error', '工作流执行器', '运行失败', { runId, currentNodeId, error })
    }
  } finally {
    if (activeRuns.get(runId) === controller) activeRuns.delete(runId)
  }
}

export const enqueueWorkflowRun = (runId: string) => {
  if (activeRuns.has(runId)) return
  const controller = new AbortController()
  activeRuns.set(runId, controller)
  queueMicrotask(() => void executeWorkflowRun(runId, controller))
}

export const requestWorkflowRunStop = (runId: string) => {
  activeRuns.get(runId)?.abort()
}

export const recoverServerWorkflowRuns = async () => {
  const staleRuns = await prisma.workflowRun.findMany({
    where: { executor: 'SERVER', status: 'RUNNING' },
    select: { id: true },
  })
  if (staleRuns.length) {
    const ids = staleRuns.map(item => item.id)
    const now = new Date()
    await prisma.$transaction([
      prisma.workflowRun.updateMany({
        where: { id: { in: ids }, status: 'RUNNING' },
        data: { status: 'INTERRUPTED', errorMessage: '服务重启导致运行中断，可从失败处重试', finishedAt: now },
      }),
      prisma.workflowNodeRun.updateMany({
        where: { workflowRunId: { in: ids }, status: 'RUNNING' },
        data: { status: 'FAILED', errorMessage: '服务重启导致节点中断', finishedAt: now },
      }),
      prisma.workflowNodeRun.updateMany({
        where: { workflowRunId: { in: ids }, status: 'PENDING' },
        data: { status: 'CANCELLED', errorMessage: '服务重启导致运行中断', finishedAt: now },
      }),
    ])
  }
  const pendingRuns = await prisma.workflowRun.findMany({
    where: { executor: 'SERVER', status: 'PENDING' },
    select: { id: true },
  })
  pendingRuns.forEach(run => enqueueWorkflowRun(run.id))
  return { interrupted: staleRuns.length, resumed: pendingRuns.length }
}

export const isTerminalWorkflowRunStatus = (status: string) => TERMINAL_RUN_STATUSES.has(status)
