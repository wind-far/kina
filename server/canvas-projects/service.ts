import {
  canvasSnapshotToWorkflowPayload,
  normalizeCanvasImport,
  workflowVersionToCanvasSnapshot,
  type CanvasSnapshotV3,
} from '../../src/shared/canvas-snapshot'
import { createWorkflowDefinition, getWorkflowDefinitionDetail } from '../workflow-definitions/service'

export interface CanvasProjectAccessContext { currentUserId: string }

const readCurrentVersion = (detail: any) => detail?.definition?.currentVersion || detail?.definition?.latestVersion || detail?.versions?.[0] || null

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

export const importCanvasProject = async (payload: { name?: string; data?: unknown }, context: CanvasProjectAccessContext) => {
  const source = payload?.data && typeof payload.data === 'object' ? payload.data as any : payload
  const project = source?.project && typeof source.project === 'object' ? source.project : {}
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
      operations: [{
        type: 'insert_text_node',
        position: { x: Math.max(120, ...selectedNodes.map(node => node.position.x + 420)), y: selectedNodes[0]?.position.y || 120 },
        data: { content: prompt, label: '助手草稿', source: 'canvas-assistant-preview' },
      }],
    },
  }
}
