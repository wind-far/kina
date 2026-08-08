export const MIN_CANVAS_ZOOM = 10
export const MAX_CANVAS_ZOOM = 200
export const CANVAS_STORAGE_VERSION = 1

export function clampCanvasScale(value: unknown, fallback = MIN_CANVAS_ZOOM / 100) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.max(MIN_CANVAS_ZOOM / 100, Math.min(MAX_CANVAS_ZOOM / 100, numericValue))
}

export function createCanvasStorageKey(projectId: unknown) {
  const normalizedProjectId = String(projectId || '').trim() || 'local'
  return `canvas-reference:${normalizedProjectId}`
}

export function normalizeCanvasTitle(value: unknown) {
  return String(value || '').trim() || '未命名项目'
}

export function resolveCanvasReturnTo(value: unknown, currentPath: string) {
  const returnTo = String(value || '').trim()
  if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo === currentPath) {
    return null
  }
  return returnTo
}
