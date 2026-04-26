/**
 * 「发现」页 masonry：5 列 + 左侧顶部大卡；列宽与坐标随轨道宽度变化，
 * 避免大屏下仍按 ~1653px 排版导致右侧空白。
 */

export type MasonryRect = {
  left: number
  top: number
  width: number
  height: number
}

export type MasonryMetrics = {
  columnGap: number
  colWidth: number
  colLefts: readonly [number, number, number, number, number]
  heroRect: MasonryRect
}

export type PlainMasonryMetrics = {
  columnGap: number
  colWidth: number
  colLefts: number[]
}

const DEFAULT_TRACK = 1653

/**
 * 根据轨道宽度算列宽、列起点与顶部大卡占位（大卡占左两列，比例接近 660×248）。
 */
export function computeMasonryMetrics(trackWidth: number, columnGap = 2): MasonryMetrics {
  const tw = Math.max(320, Math.floor(trackWidth || DEFAULT_TRACK))
  const colWidth = Math.max(1, Math.floor((tw - 4 * columnGap) / 5))
  const colLefts = [
    0,
    colWidth + columnGap,
    2 * (colWidth + columnGap),
    3 * (colWidth + columnGap),
    4 * (colWidth + columnGap),
  ] as const
  const heroW = 2 * colWidth + columnGap
  const heroH = Math.max(1, Math.round((heroW * 248) / 660))
  const heroRect: MasonryRect = { left: 0, top: 0, width: heroW, height: heroH }
  return { columnGap, colWidth, colLefts, heroRect }
}

function displayHeight(nw: number, nh: number, colWidth: number): number {
  if (!nw || !nh || nw <= 0 || nh <= 0) return colWidth
  return Math.max(1, Math.round((colWidth * nh) / nw))
}

/**
 * 纯瀑布流轨道指标计算。
 * 不包含首页 Hero 卡，只负责普通列宽、列坐标与间距。
 */
export function computePlainMasonryMetrics(options: {
  trackWidth: number
  minColumnWidth?: number
  maxColumnWidth?: number
  maxColumns?: number
  columnGap?: number
}): PlainMasonryMetrics {
  const {
    trackWidth,
    minColumnWidth = 220,
    maxColumnWidth = 252,
    maxColumns = 7,
    columnGap = 16,
  } = options

  const normalizedTrackWidth = Math.max(320, Math.floor(trackWidth || DEFAULT_TRACK))
  const estimatedColumnCount = Math.max(
    1,
    Math.floor((normalizedTrackWidth + columnGap) / (minColumnWidth + columnGap)),
  )
  const columnCount = Math.min(estimatedColumnCount, Math.max(1, maxColumns))
  const rawColumnWidth = Math.floor((normalizedTrackWidth - (columnCount - 1) * columnGap) / columnCount)
  const colWidth = Math.max(minColumnWidth, Math.min(maxColumnWidth, rawColumnWidth))
  const usedWidth = columnCount * colWidth + Math.max(0, columnCount - 1) * columnGap
  const offsetLeft = Math.max(0, Math.floor((normalizedTrackWidth - usedWidth) / 2))
  const colLefts = Array.from({ length: columnCount }, (_, index) => (
    offsetLeft + index * (colWidth + columnGap)
  ))

  return {
    columnGap,
    colWidth,
    colLefts,
  }
}

/**
 * @param sizes 每张图 natural 尺寸；null 按正方形占位
 * @param metrics 由 computeMasonryMetrics(trackWidth) 得到
 */
export function buildFeedLayoutsFromSizes(
  sizes: ReadonlyArray<{ w: number; h: number } | null | undefined>,
  metrics: MasonryMetrics,
): MasonryRect[] {
  const { colWidth, colLefts, heroRect, columnGap } = metrics
  const heroBottom = heroRect.top + heroRect.height
  const colBottom = [heroBottom, heroBottom, 0, 0, 0]
  const out: MasonryRect[] = []

  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i]
    const nw = s && s.w > 0 ? s.w : 1
    const nh = s && s.h > 0 ? s.h : 1
    const h = displayHeight(nw, nh, colWidth)

    let c = 0
    let minB = colBottom[0]
    for (let k = 1; k < 5; k++) {
      if (colBottom[k] < minB) {
        minB = colBottom[k]
        c = k
      }
    }

    const top = colBottom[c] + (colBottom[c] > 0 ? columnGap : 0)
    const left = colLefts[c]
    colBottom[c] = top + h
    out.push({ left, top, width: colWidth, height: h })
  }

  return out
}

export function masonryScrollHeight(feedLayouts: MasonryRect[], heroRect: MasonryRect): number {
  let maxY = heroRect.top + heroRect.height
  for (const r of feedLayouts) {
    maxY = Math.max(maxY, r.top + r.height)
  }
  return maxY + 24
}

/**
 * 纯瀑布流卡片布局生成。
 * 适合个人中心、资产页等不带 Hero 卡的页面复用。
 */
export function buildPlainMasonryLayoutsFromSizes(
  sizes: ReadonlyArray<{ w: number; h: number } | null | undefined>,
  metrics: PlainMasonryMetrics,
): MasonryRect[] {
  const { colWidth, colLefts, columnGap } = metrics
  const colBottom = new Array(colLefts.length).fill(0)
  const out: MasonryRect[] = []

  for (let i = 0; i < sizes.length; i += 1) {
    const currentSize = sizes[i]
    const width = currentSize && currentSize.w > 0 ? currentSize.w : 1
    const height = currentSize && currentSize.h > 0 ? currentSize.h : 1
    const displayH = Math.max(140, displayHeight(width, height, colWidth))

    let targetColumnIndex = 0
    let minBottom = colBottom[0]
    for (let k = 1; k < colBottom.length; k += 1) {
      if (colBottom[k] < minBottom) {
        minBottom = colBottom[k]
        targetColumnIndex = k
      }
    }

    const top = colBottom[targetColumnIndex]
    const left = colLefts[targetColumnIndex]
    colBottom[targetColumnIndex] = top + displayH + columnGap

    out.push({
      left,
      top,
      width: colWidth,
      height: displayH,
    })
  }

  return out
}

/**
 * 纯瀑布流内容高度。
 */
export function plainMasonryScrollHeight(layouts: ReadonlyArray<MasonryRect>): number {
  if (!layouts.length) return 0
  return Math.max(...layouts.map(layout => layout.top + layout.height))
}
