import {
  canvasSnapshotToWorkflowPayload,
  normalizeCanvasImport,
  workflowVersionToCanvasSnapshot,
  type CanvasSnapshotV3,
} from '../../src/shared/canvas-snapshot'
import { createWorkflowDefinition, getWorkflowDefinitionDetail } from '../workflow-definitions/service'
import { deleteUploadedStorageFile, saveUploadedBuffer, type StoredUploadReference } from '../storage/service'
import {
  applyTargetCanvasAssetUrls,
  parseTargetCanvasArchive,
  selectTargetCanvasArchiveProject,
  type TargetCanvasArchivePayload,
} from './target-archive'

export interface CanvasProjectAccessContext { currentUserId: string }

type CanvasAssistantInsertOperation = {
  type: 'insert_text_node' | 'insert_director_node'
  clientKey: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

type CanvasAssistantConnectOperation = {
  type: 'connect_nodes'
  sourceClientKey: string
  targetClientKey: string
  edgeType: 'promptOrder'
}

export type CanvasAssistantOperation = CanvasAssistantInsertOperation | CanvasAssistantConnectOperation

const readCurrentVersion = (detail: any) => detail?.definition?.currentVersion || detail?.definition?.latestVersion || detail?.versions?.[0] || null

/**
 * 选区导出只保留被选节点及二者都在选区中的连线。资源地址作为节点数据的一部分
 * 原样携带，导入端仍按现有资源可用性处理；不导出项目级助手会话。
 */
export const createCanvasSelectionSnapshot = (snapshot: CanvasSnapshotV3, selection: unknown): CanvasSnapshotV3 => {
  const selectedIds = new Set(Array.isArray(selection)
    ? selection.map(item => String(item || '').trim()).filter(Boolean)
    : [])
  if (!selectedIds.size) {
    const error = new Error('请先选择至少一个画布节点') as Error & { status?: number }
    error.status = 400
    throw error
  }
  const nodes = snapshot.nodes.filter(node => selectedIds.has(node.id))
  if (!nodes.length) {
    const error = new Error('选中的节点已不存在，请刷新画布后重试') as Error & { status?: number }
    error.status = 400
    throw error
  }
  const exportedIds = new Set(nodes.map(node => node.id))
  return {
    ...snapshot,
    nodes,
    edges: snapshot.edges.filter(edge => exportedIds.has(edge.source) && exportedIds.has(edge.target)),
    chatSessions: [],
    activeChatId: null,
  }
}

export const exportCanvasProject = async (projectId: string, context: CanvasProjectAccessContext) => {
  const detail = await getWorkflowDefinitionDetail(projectId, context)
  if (detail.definition.scene !== 'INFINITE_CANVAS') {
    const error = new Error('该项目不是无限画布项目') as Error & { status?: number }
    error.status = 400
    throw error
  }
  return {
    format: 'canvasmind.infinite-canvas' as const,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project: { name: detail.definition.name, description: detail.definition.description, tags: detail.definition.tagsJson || [] },
    canvas: workflowVersionToCanvasSnapshot(readCurrentVersion(detail)),
  }
}

export const exportCanvasProjectSelection = async (projectId: string, selection: unknown, context: CanvasProjectAccessContext) => {
  const exported = await exportCanvasProject(projectId, context)
  const canvas = createCanvasSelectionSnapshot(exported.canvas, selection)
  return {
    ...exported,
    scope: 'selection' as const,
    project: {
      ...exported.project,
      name: `${exported.project.name || '无限画布'}（选区）`,
    },
    canvas,
  }
}

export const importCanvasProject = async (payload: { name?: string; data?: unknown }, context: CanvasProjectAccessContext) => {
  const source = payload?.data && typeof payload.data === 'object' ? payload.data as any : payload
  const targetExportProject = source?.app === 'infinite-canvas' && Array.isArray(source?.projects)
    ? source.projects[0]?.project
    : null
  const project = source?.project && typeof source.project === 'object'
    ? source.project
    : targetExportProject && typeof targetExportProject === 'object' ? targetExportProject : {}
  const { snapshot, warnings } = normalizeCanvasImport(source)
  const name = String(payload?.name || project?.name || '导入的无限画布').trim().slice(0, 100) || '导入的无限画布'
  const detail = await createWorkflowDefinition({
    name,
    description: typeof project?.description === 'string' ? project.description.slice(0, 255) : null,
    scene: 'INFINITE_CANVAS',
    tagsJson: Array.isArray(project?.tags) ? project.tags : [],
    ...canvasSnapshotToWorkflowPayload(snapshot),
  }, context)
  return { detail, warnings }
}

const isSupportedCanvasArchiveAsset = (mimeType: string) => [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
].includes(mimeType.toLowerCase())

const cleanupFailedCanvasArchiveProjectUploads = async (
  uploads: StoredUploadReference[],
  warnings: string[],
  projectIndex: number,
  deleteUpload: (upload: StoredUploadReference) => Promise<unknown> = deleteUploadedStorageFile,
) => {
  for (const upload of uploads.reverse()) {
    try {
      await deleteUpload(upload)
    } catch {
      warnings.push(`第 ${projectIndex + 1} 个项目有一个已上传资源未能自动回收，请在存储中人工检查。`)
    }
  }
}

type CanvasArchiveStoredAsset = StoredUploadReference & { publicUrl: string }

export interface CanvasArchiveImportDependencies {
  saveAsset: (input: {
    buffer: Buffer
    filename: string
    mimeType: string
    category: string
  }) => Promise<CanvasArchiveStoredAsset>
  deleteAsset: (input: StoredUploadReference) => Promise<unknown>
  createProject: (payload: { name?: string; data?: unknown }, context: CanvasProjectAccessContext) => Promise<{ detail: any; warnings: string[] }>
}

const defaultCanvasArchiveImportDependencies: CanvasArchiveImportDependencies = {
  saveAsset: saveUploadedBuffer,
  deleteAsset: deleteUploadedStorageFile,
  createProject: importCanvasProject,
}

/**
 * 导入目标项目完整 ZIP：资源内容先通过 CanvasMind 的现有存储策略落到对象存储
 * 或本地 uploads，再把其公开 URL 回写到快照。未支持的 MIME 和缺失资源不会阻断
 * 项目导入，但会在迁移报告中明确列出。
 */
export const importParsedCanvasProjectArchive = async (
  parsed: TargetCanvasArchivePayload,
  name: string | undefined,
  context: CanvasProjectAccessContext,
  dependencies: CanvasArchiveImportDependencies = defaultCanvasArchiveImportDependencies,
) => {
  const warnings = [...parsed.warnings]
  const details: any[] = []
  for (const projectIndex of parsed.projectIndexes) {
    const project = selectTargetCanvasArchiveProject(parsed, projectIndex)
    const assetUrls = new Map<string, string>()
    const uploadedReferences: StoredUploadReference[] = []
    for (const asset of project.assets) {
      if (!isSupportedCanvasArchiveAsset(asset.mimeType)) {
        warnings.push(`第 ${projectIndex + 1} 个项目的资源 ${asset.storageKey} MIME 类型 ${asset.mimeType || '未知'} 不受支持，已保留引用。`)
        continue
      }
      try {
        const saved = await dependencies.saveAsset({
          buffer: asset.buffer,
          filename: asset.path.split('/').pop() || 'canvas-asset',
          mimeType: asset.mimeType,
          category: `canvas-import/${context.currentUserId}`,
        })
        assetUrls.set(asset.storageKey, saved.publicUrl)
        uploadedReferences.push({
          relativePath: saved.relativePath,
          storageType: saved.storageType,
          storageCode: saved.storageCode,
        })
      } catch {
        warnings.push(`第 ${projectIndex + 1} 个项目的资源 ${asset.storageKey} 上传失败，已保留原始引用。`)
      }
    }
    try {
      const result = await dependencies.createProject({
        name: parsed.projectIndexes.length === 1 ? name : undefined,
        data: applyTargetCanvasAssetUrls(project.data, assetUrls),
      }, context)
      details.push(result.detail)
      warnings.push(...result.warnings.map(warning => `第 ${projectIndex + 1} 个项目：${warning}`))
    } catch (error: any) {
      await cleanupFailedCanvasArchiveProjectUploads(uploadedReferences, warnings, projectIndex, dependencies.deleteAsset)
      warnings.push(`第 ${projectIndex + 1} 个项目导入失败：${error?.message || '未知错误'}`)
    }
  }
  if (!details.length) {
    const error = new Error('归档中的项目均未能导入。') as Error & { status?: number }
    error.status = 400
    throw error
  }
  return { detail: details[0], details, importedCount: details.length, warnings }
}

export const importCanvasProjectArchive = async (archive: Buffer, name: string | undefined, context: CanvasProjectAccessContext) => {
  return await importParsedCanvasProjectArchive(parseTargetCanvasArchive(archive), name, context)
}

const collectAssistantContext = (snapshot: CanvasSnapshotV3, selection: unknown) => {
  const ids = new Set(Array.isArray(selection) ? selection.map(item => String(item || '').trim()).filter(Boolean) : [])
  const selected = ids.size ? snapshot.nodes.filter(node => ids.has(node.id)) : snapshot.nodes.slice(0, 20)
  if (!ids.size) return { selected, context: selected }
  const incoming = new Map<string, string[]>()
  snapshot.edges.forEach(edge => incoming.set(edge.target, [...(incoming.get(edge.target) || []), edge.source]))
  const included = new Set(selected.map(node => node.id))
  const pending = [...included]
  while (pending.length && included.size < 20) {
    const current = pending.shift()!
    for (const upstreamId of incoming.get(current) || []) {
      if (!included.has(upstreamId)) {
        included.add(upstreamId)
        pending.push(upstreamId)
      }
    }
  }
  return { selected, context: snapshot.nodes.filter(node => included.has(node.id)) }
}

const isVideoPlanningPrompt = (prompt: string) => /视频|短片|镜头|分镜|广告片|宣传片|video|shot|storyboard/i.test(prompt)

/**
 * 助手只生产白名单化的结构化提案。它不带可执行脚本、不创建生成任务，
 * 由客户端展示后显式确认，才会映射为本地画布的可撤销操作。
 */
export const buildCanvasAssistantProposal = (input: {
  prompt: string
  selectedNodes: CanvasSnapshotV3['nodes']
  contextNodes: CanvasSnapshotV3['nodes']
}): { summary: string; operations: CanvasAssistantOperation[] } => {
  const anchorX = Math.max(120, ...input.selectedNodes.map(node => node.position.x + 420))
  const anchorY = input.selectedNodes[0]?.position.y || 120
  const selectedLabels = input.selectedNodes.map(node => String(node.data.label || node.type)).filter(Boolean)
  const contextSummary = input.contextNodes.length > input.selectedNodes.length
    ? `已纳入 ${input.contextNodes.length - input.selectedNodes.length} 个上游节点。`
    : '未额外纳入上游节点。'
  const textOperation: CanvasAssistantInsertOperation = {
    type: 'insert_text_node',
    clientKey: 'assistant-brief',
    position: { x: anchorX, y: anchorY },
    data: {
      content: input.prompt,
      label: '助手需求草稿',
      source: 'canvas-assistant-preview',
      contextSummary,
    },
  }
  if (!isVideoPlanningPrompt(input.prompt)) {
    return {
      summary: `将新增 1 个需求文本节点。${contextSummary}`,
      operations: [textOperation],
    }
  }
  const directorOperation: CanvasAssistantInsertOperation = {
    type: 'insert_director_node',
    clientKey: 'assistant-director-plan',
    position: { x: anchorX + 380, y: anchorY },
    data: {
      label: '助手镜头计划',
      brief: input.prompt,
      shotPlan: [
        '1. 开场：建立主体、场景和核心情绪。',
        '2. 推进：用动作或镜头变化表达核心卖点。',
        '3. 收束：回到明确的视觉记忆点或行动引导。',
      ].join('\n'),
      mode: 'short-video',
      source: 'canvas-assistant-preview',
      selectedContext: selectedLabels,
    },
  }
  return {
    summary: `将新增需求文本和镜头计划 2 个节点，并建立提示词连接。${contextSummary}`,
    operations: [
      textOperation,
      directorOperation,
      { type: 'connect_nodes', sourceClientKey: textOperation.clientKey, targetClientKey: directorOperation.clientKey, edgeType: 'promptOrder' },
    ],
  }
}

/** 助手先返回结构化预览；客户端确认后才写入历史栈与版本快照。 */
export const previewCanvasAssistantOperation = async (projectId: string, payload: { prompt?: string; selection?: unknown }, context: CanvasProjectAccessContext) => {
  const exported = await exportCanvasProject(projectId, context)
  const { selected: selectedNodes, context: contextNodes } = collectAssistantContext(exported.canvas, payload.selection)
  const prompt = String(payload?.prompt || '').trim()
  if (!prompt) {
    const error = new Error('请输入助手指令') as Error & { status?: number }
    error.status = 400
    throw error
  }
  return {
    projectId,
    context: {
      selectedNodeIds: selectedNodes.map(node => node.id),
      selectedNodeCount: selectedNodes.length,
      contextNodeIds: contextNodes.map(node => node.id),
      upstreamContextIncluded: contextNodes.length > selectedNodes.length,
    },
    proposal: {
      id: `canvas-proposal-${Date.now()}`,
      requiresConfirmation: true,
      ...buildCanvasAssistantProposal({ prompt, selectedNodes, contextNodes }),
    },
  }
}
