export interface InfiniteCanvasImageSnapshot {
  id: string | number
  src: string
  w: number
  h: number
  x: number
  y: number
  zIndex: number
  rotation?: number
  /** 兼容 schemaVersion 1 的网格快照。 */
  index?: number
  assetId?: string
  name?: string
  source?: 'upload' | 'asset' | 'generated'
}

export interface InfiniteCanvasSnapshot {
  schemaVersion: 1 | 2
  images: InfiniteCanvasImageSnapshot[]
  viewport: {
    x: number
    y: number
    scale: number
  }
}
