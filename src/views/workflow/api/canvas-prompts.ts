import { buildApiUrl } from '@/api/http'
import { handleUnauthorizedResponse, readApiData } from '@/api/response'

export type CanvasPromptKind = 'TEXT' | 'IMAGE_CONFIG' | 'VIDEO_CONFIG'
export interface CanvasPrompt { id: string; sourceId: string | null; title: string; content: string; summary: string; tags: string[]; kind: CanvasPromptKind; targetNodeType: 'text' | 'imageConfig' | 'videoConfig'; sourceData: Record<string, unknown> }
export interface CanvasPromptSource { id: string; name: string; sourceUrl: string; sourceKind: 'JSON' | 'SKILL_MARKDOWN'; category: string; permissionScope: 'PRIVATE' | 'SHARED'; allowedRoles: string[]; isEnabled: boolean; promptCount: number; currentVersionNo: number; lastSyncStatus: string; lastSyncError: string; lastSyncedAt: string | null; updatedAt: string }
export interface CanvasPromptSourceVersion { id: string; versionNo: number; contentHash: string; promptCount: number; changeType: string; changeNote: string; createdAt: string }
export interface CanvasPromptSyncRun { id: string; action: string; status: string; sourceVersionNo: number | null; targetVersionNo: number | null; importedCount: number; errorMessage: string; createdAt: string; finishedAt: string | null }

const request = async <T>(path: string, method = 'GET', data?: unknown) => {
  const response = await fetch(buildApiUrl(path), {
    method, credentials: 'include', headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  handleUnauthorizedResponse(response.status, 'canvas-prompts')
  return await readApiData<T>(response)
}

export const listCanvasPrompts = (filters: { keyword?: string; tag?: string; sourceId?: string; kind?: CanvasPromptKind | '' } = {}) => {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, String(value)) })
  return request<CanvasPrompt[]>(`/api/canvas/prompts?${query.toString()}`)
}
export const createCanvasPrompt = (title: string, content: string, tags: string[] = [], kind: CanvasPromptKind = 'TEXT') => request<CanvasPrompt>('/api/canvas/prompts', 'POST', { title, content, tags, kind })
export const listCanvasPromptSources = () => request<CanvasPromptSource[]>('/api/canvas/prompt-sources')
export const createCanvasPromptSource = (input: { name: string; sourceUrl?: string; sourceKind: 'JSON' | 'SKILL_MARKDOWN'; category?: string; permissionScope?: 'PRIVATE' | 'SHARED'; allowedRoles?: string[] }) => request<CanvasPromptSource>('/api/canvas/prompt-sources', 'POST', input)
export const syncCanvasPromptSource = (sourceId: string) => request<{ sourceId: string; importedCount: number; versionNo: number; changed: boolean }>(`/api/canvas/prompt-sources/${encodeURIComponent(sourceId)}/sync`, 'POST', {})
export const listCanvasPromptSourceVersions = (sourceId: string) => request<CanvasPromptSourceVersion[]>(`/api/canvas/prompt-sources/${encodeURIComponent(sourceId)}/versions`)
export const listCanvasPromptSyncRuns = (sourceId: string) => request<CanvasPromptSyncRun[]>(`/api/canvas/prompt-sources/${encodeURIComponent(sourceId)}/sync-runs`)
export const rollbackCanvasPromptSource = (sourceId: string, versionNo: number) => request<{ versionNo: number; importedCount: number }>(`/api/canvas/prompt-sources/${encodeURIComponent(sourceId)}/rollback`, 'POST', { versionNo })
