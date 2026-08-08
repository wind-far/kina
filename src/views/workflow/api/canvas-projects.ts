import { buildApiUrl } from '@/api/http'
import { handleUnauthorizedResponse, readApiData } from '@/api/response'
import type { CanvasSnapshotV3 } from '@/shared/canvas-snapshot'

const requestCanvasApi = async <T>(url: string, method = 'GET', data?: unknown) => {
  const response = await fetch(buildApiUrl(url), {
    method,
    credentials: 'include',
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  handleUnauthorizedResponse(response.status, 'canvas-projects')
  return await readApiData<T>(response)
}

export interface CanvasProjectExport {
  format: 'canvasmind.infinite-canvas'
  formatVersion: number
  exportedAt: string
  project: { name: string; description: string | null; tags: unknown }
  canvas: CanvasSnapshotV3
}

export const exportCanvasProject = (projectId: string) => requestCanvasApi<CanvasProjectExport>(`/api/canvas/projects/${encodeURIComponent(projectId)}/export`)
export const exportCanvasProjectSelection = (projectId: string, selection: string[]) => requestCanvasApi<CanvasProjectExport & { scope: 'selection' }>(`/api/canvas/projects/${encodeURIComponent(projectId)}/export-selection`, 'POST', { selection })
export const importCanvasProject = (data: unknown, name?: string) => requestCanvasApi<{ detail: any; warnings: string[] }>('/api/canvas/projects/import', 'POST', { data, name })
export interface CanvasAssistantPreviewOperation {
  type: 'insert_text_node' | 'insert_director_node' | 'connect_nodes'
  clientKey?: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
  sourceClientKey?: string
  targetClientKey?: string
  edgeType?: 'promptOrder'
}

export interface CanvasAssistantPreview {
  proposal?: {
    id: string
    requiresConfirmation: boolean
    summary?: string
    operations: CanvasAssistantPreviewOperation[]
  }
}

export const previewCanvasAssistantOperation = (projectId: string, prompt: string, selection: string[]) => requestCanvasApi<CanvasAssistantPreview>(`/api/canvas/projects/${encodeURIComponent(projectId)}/assistant-preview`, 'POST', { prompt, selection })
