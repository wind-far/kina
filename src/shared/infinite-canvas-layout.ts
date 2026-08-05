import type { InfiniteCanvasImageSnapshot } from '@/types/infinite-canvas'

export const LEGACY_CANVAS_GRID = {
  columns: 4,
  cellWidth: 1728,
  cellHeight: 2304,
  gap: 96,
  padding: 192,
} as const

export interface InfiniteCanvasBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  centerX: number
  centerY: number
}

const finiteNumber = (value: unknown, fallback: number) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export const getLegacyCanvasPosition = (index: number) => ({
  x: LEGACY_CANVAS_GRID.padding
    + (index % LEGACY_CANVAS_GRID.columns) * (LEGACY_CANVAS_GRID.cellWidth + LEGACY_CANVAS_GRID.gap),
  y: LEGACY_CANVAS_GRID.padding
    + Math.floor(index / LEGACY_CANVAS_GRID.columns) * (LEGACY_CANVAS_GRID.cellHeight + LEGACY_CANVAS_GRID.gap),
})

export const normalizeInfiniteCanvasImage = (
  input: Record<string, unknown>,
  fallbackIndex: number,
): InfiniteCanvasImageSnapshot => {
  const index = Math.max(0, Math.floor(finiteNumber(input.index, fallbackIndex)))
  const legacyPosition = getLegacyCanvasPosition(index)
  const source = input.source === 'upload' || input.source === 'generated' ? input.source : 'asset'

  return {
    id: String(input.id || `image-${fallbackIndex}`),
    src: String(input.src || input.url || ''),
    w: Math.max(1, finiteNumber(input.w ?? input.width, LEGACY_CANVAS_GRID.cellWidth)),
    h: Math.max(1, finiteNumber(input.h ?? input.height, LEGACY_CANVAS_GRID.cellHeight)),
    x: finiteNumber(input.x, legacyPosition.x),
    y: finiteNumber(input.y, legacyPosition.y),
    zIndex: Math.max(0, Math.floor(finiteNumber(input.zIndex, fallbackIndex))),
    rotation: finiteNumber(input.rotation, 0),
    index,
    assetId: input.assetId ? String(input.assetId) : undefined,
    name: input.name ? String(input.name) : undefined,
    source,
  }
}

export const normalizeInfiniteCanvasImages = (input: unknown): InfiniteCanvasImageSnapshot[] => (
  Array.isArray(input)
    ? input
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item, index) => normalizeInfiniteCanvasImage(item, index))
      .filter(item => Boolean(item.src))
    : []
)

export const getInfiniteCanvasBounds = (
  images: Array<Pick<InfiniteCanvasImageSnapshot, 'x' | 'y' | 'w' | 'h'>>,
): InfiniteCanvasBounds => {
  if (!images.length) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 }
  }

  const minX = Math.min(...images.map(image => image.x))
  const minY = Math.min(...images.map(image => image.y))
  const maxX = Math.max(...images.map(image => image.x + image.w))
  const maxY = Math.max(...images.map(image => image.y + image.h))
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}
