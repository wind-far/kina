/**
 * 账号级无限画布的可移植快照协议。
 *
 * 该协议刻意只使用 JSON 值：它既是版本快照的运行时配置，也是导入导出文件
 * 的稳定边界。旧工作流版本仍可读取；未知节点会被保留为占位节点，避免导入时
 * 静默丢失第三方插件数据。
 */

export const CANVAS_SNAPSHOT_SCHEMA_VERSION = 3

export type CanvasBackgroundMode = 'dots' | 'lines' | 'blank'

export interface CanvasSnapshotNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  zIndex?: number
  selected?: boolean
}

export interface CanvasSnapshotEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  data?: Record<string, unknown>
}

export interface CanvasSnapshotV3 {
  schemaVersion: typeof CANVAS_SNAPSHOT_SCHEMA_VERSION
  scene: 'INFINITE_CANVAS'
  nodes: CanvasSnapshotNode[]
  edges: CanvasSnapshotEdge[]
  viewport: { x: number; y: number; zoom: number }
  backgroundMode: CanvasBackgroundMode
  showImageInfo: boolean
  chatSessions: unknown[]
  activeChatId: string | null
  extensions: Record<string, unknown>
}

export interface CanvasImportResult {
  snapshot: CanvasSnapshotV3
  warnings: string[]
}

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const uniqueId = (value: unknown, prefix: string, index: number, seen: Set<string>) => {
  const base = String(value || '').trim() || `${prefix}_${index + 1}`
  let candidate = base
  let suffix = 2
  while (seen.has(candidate)) {
    candidate = `${base}_${suffix++}`
  }
  seen.add(candidate)
  return candidate
}

const normalizeNode = (value: unknown, index: number, nodeIds: Set<string>, warnings: string[]): CanvasSnapshotNode | null => {
  const input = asRecord(value)
  const type = String(input.type || input.kind || 'unknown').trim() || 'unknown'
  const positionInput = asRecord(input.position)
  const data = asRecord(input.data)
  const id = uniqueId(input.id, 'node', index, nodeIds)

  if (!['text', 'image', 'video', 'audio', 'imageConfig', 'videoConfig', 'llmConfig', 'director'].includes(type)) {
    warnings.push(`节点 ${id} 的类型“${type}”当前不可执行，已作为兼容占位节点保留。`)
    return {
      id,
      type: 'unknown',
      position: { x: numberValue(positionInput.x), y: numberValue(positionInput.y) },
      data: { label: String(data.label || input.label || type), originalType: type, originalNode: input },
      zIndex: numberValue(input.zIndex, index),
    }
  }

  return {
    id,
    type,
    position: { x: numberValue(positionInput.x), y: numberValue(positionInput.y) },
    data,
    zIndex: Number.isFinite(Number(input.zIndex)) ? numberValue(input.zIndex) : undefined,
    selected: Boolean(input.selected),
  }
}

/**
 * 将 basketikun/infinite-canvas v3 的项目节点收敛为 CanvasMind 节点。
 * 目标项目把业务字段放在 metadata 中，并以 config 统一表示各类生成配置；
 * 这里保留原始元数据和资源键，避免导入时静默丢失未实现的插件或 ZIP 资源引用。
 */
const adaptTargetInfiniteCanvasNode = (value: unknown): Record<string, unknown> => {
  const input = asRecord(value)
  const metadata = asRecord(input.metadata)
  const images = Array.isArray(metadata.images) ? metadata.images.map(asRecord) : []
  const primaryImageId = String(metadata.primaryImageId || '')
  const primaryImage = images.find(image => String(image.id || '') === primaryImageId) || images[0] || {}
  const sourceType = String(input.type || 'unknown').trim() || 'unknown'
  const generationMode = String(metadata.generationMode || '').trim()
  const type = sourceType === 'config'
    ? generationMode === 'video' ? 'videoConfig' : generationMode === 'text' ? 'llmConfig' : 'imageConfig'
    : sourceType
  const content = String(metadata.content || metadata.composerContent || metadata.prompt || '')
  const resourceKey = String(metadata.storageKey || primaryImage.storageKey || '')
  const resourceContent = String(primaryImage.content || metadata.content || '')
  const data: Record<string, unknown> = {
    label: String(input.title || sourceType || '导入节点'),
    content,
    prompt: String(metadata.prompt || ''),
    model: String(metadata.model || ''),
    fontSize: Number.isFinite(Number(metadata.fontSize)) ? Number(metadata.fontSize) : undefined,
    loading: metadata.status === 'loading',
    error: metadata.status === 'error' ? String(metadata.errorDetails || '导入任务失败') : '',
    sourceResource: resourceKey ? {
      storageKey: resourceKey,
      mimeType: String(metadata.mimeType || primaryImage.mimeType || ''),
      bytes: numberValue(metadata.bytes ?? primaryImage.bytes),
    } : undefined,
    originalMetadata: metadata,
  }
  if (['image', 'video', 'audio'].includes(type) && resourceContent) data.url = resourceContent
  if (type === 'imageConfig') {
    data.size = String(metadata.size || '')
    data.quality = String(metadata.quality || '')
    data.count = numberValue(metadata.count, 1)
  }
  if (type === 'videoConfig') {
    data.seconds = String(metadata.seconds || '')
    data.quality = String(metadata.vquality || metadata.quality || '')
  }
  return {
    id: input.id,
    type,
    position: input.position,
    width: input.width,
    height: input.height,
    data,
  }
}

const isTargetInfiniteCanvasExport = (input: Record<string, unknown>) => input.app === 'infinite-canvas' && Array.isArray(input.projects)

const resolveImportSource = (input: Record<string, unknown>, warnings: string[]) => {
  const nestedCanvas = asRecord(input.canvas)
  if (Object.keys(nestedCanvas).length) return { source: nestedCanvas, targetExport: false, targetAssets: [] as unknown[] }
  if (!isTargetInfiniteCanvasExport(input)) return { source: input, targetExport: false, targetAssets: [] as unknown[] }

  const projects = input.projects as unknown[]
  const firstItem = asRecord(projects[0])
  const project = asRecord(firstItem.project)
  if (!projects.length || !Object.keys(project).length) {
    warnings.push('目标项目导出中未找到可导入的项目。')
    return { source: {}, targetExport: true, targetAssets: [] as unknown[] }
  }
  if (projects.length > 1) warnings.push(`目标项目导出包含 ${projects.length} 个项目；当前一次仅导入第一个项目。`)
  const files = Array.isArray(firstItem.files) ? firstItem.files : []
  if (files.length) warnings.push(`已保留 ${files.length} 个目标项目资源引用；请使用 ZIP 资源迁移后再访问其二进制内容。`)
  return { source: project, targetExport: true, targetAssets: files }
}

/** 将 CanvasMind 当前或目标项目的常见导出结构收敛为 v3。 */
export const normalizeCanvasImport = (value: unknown): CanvasImportResult => {
  const input = asRecord(value)
  const warnings: string[] = []
  const { source, targetExport, targetAssets } = resolveImportSource(input, warnings)
  const nodeIds = new Set<string>()
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : []
  const nodes = rawNodes
    .map(node => targetExport ? adaptTargetInfiniteCanvasNode(node) : node)
    .map((node, index) => normalizeNode(node, index, nodeIds, warnings))
    .filter((node): node is CanvasSnapshotNode => Boolean(node))
  const rawEdges = Array.isArray(source.edges)
    ? source.edges
    : Array.isArray(source.connections)
      ? source.connections.map((connection) => {
          const inputConnection = asRecord(connection)
          return {
            id: inputConnection.id,
            source: inputConnection.fromNodeId,
            target: inputConnection.toNodeId,
            type: 'promptOrder',
          }
        })
      : []
  const edgeIds = new Set<string>()
  const edges = rawEdges.flatMap((edge, index): CanvasSnapshotEdge[] => {
    const inputEdge = asRecord(edge)
    const sourceId = String(inputEdge.source || '').trim()
    const targetId = String(inputEdge.target || '').trim()
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId) || sourceId === targetId) {
      warnings.push(`第 ${index + 1} 条连线引用了缺失或相同的节点，已忽略。`)
      return []
    }
    return [{
      id: uniqueId(inputEdge.id, 'edge', index, edgeIds),
      source: sourceId,
      target: targetId,
      sourceHandle: typeof inputEdge.sourceHandle === 'string' ? inputEdge.sourceHandle : null,
      targetHandle: typeof inputEdge.targetHandle === 'string' ? inputEdge.targetHandle : null,
      type: typeof inputEdge.type === 'string' ? inputEdge.type : undefined,
      data: asRecord(inputEdge.data),
    }]
  })
  const viewport = asRecord(source.viewport)
  const runtime = asRecord(source.runtimeConfigJson)
  const backgroundMode = source.backgroundMode === 'lines' || source.backgroundMode === 'blank'
    ? source.backgroundMode
    : runtime.backgroundMode === 'lines' || runtime.backgroundMode === 'blank'
      ? runtime.backgroundMode
      : 'dots'

  return {
    snapshot: {
      schemaVersion: CANVAS_SNAPSHOT_SCHEMA_VERSION,
      scene: 'INFINITE_CANVAS',
      nodes,
      edges,
      viewport: {
        x: numberValue(viewport.x),
        y: numberValue(viewport.y),
        zoom: Math.max(0.1, Math.min(4, numberValue(viewport.zoom ?? viewport.k, 1))),
      },
      backgroundMode,
      showImageInfo: Boolean(source.showImageInfo ?? runtime.showImageInfo),
      chatSessions: Array.isArray(source.chatSessions) ? source.chatSessions : Array.isArray(runtime.chatSessions) ? runtime.chatSessions : [],
      activeChatId: typeof source.activeChatId === 'string'
        ? source.activeChatId
        : typeof runtime.activeChatId === 'string' ? runtime.activeChatId : null,
      extensions: {
        ...asRecord(source.extensions),
        ...(targetExport ? {
          importSource: 'basketikun/infinite-canvas',
          importSourceVersion: input.version,
          sourceAssetManifest: targetAssets,
        } : {}),
      },
    },
    warnings,
  }
}

export const canvasSnapshotToWorkflowPayload = (snapshot: CanvasSnapshotV3) => ({
  definitionJson: {
    schemaVersion: CANVAS_SNAPSHOT_SCHEMA_VERSION,
    scene: 'INFINITE_CANVAS',
    nodeCount: snapshot.nodes.length,
    edgeCount: snapshot.edges.length,
  },
  nodesJson: snapshot.nodes,
  edgesJson: snapshot.edges,
  viewportJson: snapshot.viewport,
  runtimeConfigJson: {
    savedAt: new Date().toISOString(),
    backgroundMode: snapshot.backgroundMode,
    showImageInfo: snapshot.showImageInfo,
    chatSessions: snapshot.chatSessions,
    activeChatId: snapshot.activeChatId,
    canvasSnapshotSchemaVersion: CANVAS_SNAPSHOT_SCHEMA_VERSION,
    extensions: snapshot.extensions,
  },
})

export const workflowVersionToCanvasSnapshot = (version: unknown): CanvasSnapshotV3 => {
  const input = asRecord(version)
  const runtime = asRecord(input.runtimeConfigJson)
  return normalizeCanvasImport({
    nodes: input.nodesJson,
    edges: input.edgesJson,
    viewport: input.viewportJson,
    runtimeConfigJson: runtime,
    backgroundMode: runtime.backgroundMode,
    showImageInfo: runtime.showImageInfo,
    chatSessions: runtime.chatSessions,
    activeChatId: runtime.activeChatId,
    extensions: runtime.extensions,
  }).snapshot
}
