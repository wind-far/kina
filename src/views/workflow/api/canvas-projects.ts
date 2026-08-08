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
export const importCanvasProject = (data: unknown, name?: string) => requestCanvasApi<{ detail: any; warnings: string[] }>('/api/canvas/projects/import', 'POST', { data, name })
export const previewCanvasAssistantOperation = (projectId: string, prompt: string, selection: string[]) => requestCanvasApi<any>(`/api/canvas/projects/${encodeURIComponent(projectId)}/assistant-preview`, 'POST', { prompt, selection })
