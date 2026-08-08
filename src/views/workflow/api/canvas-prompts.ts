import { buildApiUrl } from '@/api/http'
import { handleUnauthorizedResponse, readApiData } from '@/api/response'

export interface CanvasPrompt { id: string; title: string; content: string; tags: string[] }

const request = async <T>(path: string, method = 'GET', data?: unknown) => {
  const response = await fetch(buildApiUrl(path), {
    method, credentials: 'include', headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  handleUnauthorizedResponse(response.status, 'canvas-prompts')
  return await readApiData<T>(response)
}

export const listCanvasPrompts = (keyword = '') => request<CanvasPrompt[]>(`/api/canvas/prompts?keyword=${encodeURIComponent(keyword)}`)
export const createCanvasPrompt = (title: string, content: string, tags: string[] = []) => request<CanvasPrompt>('/api/canvas/prompts', 'POST', { title, content, tags })
