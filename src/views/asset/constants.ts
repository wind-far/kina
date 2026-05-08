import type {
  AudioFilterType,
  CanvasFilterType,
  EditorFilterType,
  FilterOption,
  ImageFilterType,
  StoryFilterType,
  TabType,
  VideoFilterType,
} from './types'

export const tabs: Array<{ id: TabType; label: string }> = [
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'canvas', label: '无限画布' },
  { id: 'editor', label: '图片编辑器' },
  { id: 'story', label: '故事' },
  { id: 'audio', label: '音频' },
]

export const imageFilterOptions: FilterOption<ImageFilterType>[] = [
  { value: 'all', label: '所有图片', activeClass: 'active-rpp' },
  { value: 'hd', label: '超清', activeClass: 'active-rpp' },
  { value: 'favorite', label: '我的收藏', activeClass: 'active-rpp' },
]

export const videoFilterOptions: FilterOption<VideoFilterType>[] = [
  { value: 'all', label: '所有视频', activeClass: 'active-chb' },
  { value: 'favorite', label: '我的收藏', activeClass: 'active-chb' },
]

export const canvasFilterOptions: FilterOption<CanvasFilterType>[] = [
  { value: 'all', label: '全部', activeClass: 'active-chb' },
]

export const editorFilterOptions: FilterOption<EditorFilterType>[] = [
  { value: 'all', label: '全部', activeClass: 'active-chb' },
  { value: 'favorite', label: '我的收藏', activeClass: 'active-chb' },
]

export const storyFilterOptions: FilterOption<StoryFilterType>[] = [
  { value: 'all', label: '所有故事', activeClass: 'active-chb' },
  { value: 'favorite', label: '我的收藏', activeClass: 'active-chb' },
]

export const audioFilterOptions: FilterOption<AudioFilterType>[] = [
  { value: 'all', label: '所有音频', activeClass: 'active-txq' },
  { value: 'voice', label: '人声配音', activeClass: 'active-txq' },
  { value: 'song', label: '人声歌曲', activeClass: 'active-txq' },
  { value: 'music', label: '纯音乐', activeClass: 'active-txq' },
  { value: 'favorite', label: '我的收藏', activeClass: 'active-txq' },
]
