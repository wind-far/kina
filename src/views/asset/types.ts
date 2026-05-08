export type TabType = 'image' | 'video' | 'canvas' | 'editor' | 'story' | 'audio'

export type ImageFilterType = 'all' | 'hd' | 'favorite'
export type VideoFilterType = 'all' | 'favorite'
export type CanvasFilterType = 'all'
export type EditorFilterType = 'all' | 'favorite'
export type StoryFilterType = 'all' | 'favorite'
export type AudioFilterType = 'all' | 'voice' | 'song' | 'music' | 'favorite'

export interface FilterOption<T extends string> {
  value: T
  label: string
  activeClass: string
}

export interface ImageItem {
  id: string
  src: string
  promptText?: string
  modelLabel?: string
  aspectRatioLabel?: string
  resolutionLabel?: string
  featureLabel?: string
  createDate?: string
}

export interface ImageGroup {
  date: string
  isFirst?: boolean
  images: ImageItem[]
}
