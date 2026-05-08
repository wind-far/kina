import { computed, ref } from 'vue'
import { listAssetItems, type PersistedAssetItem } from '@/api/asset-items'
import { buildAssetUrl } from '@/api/http'
import type { ImageGroup, ImageItem } from '@/views/asset/types'

const formatGroupDate = (value: string | Date) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知日期'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const buildImageGroups = (items: Array<ImageItem & { createdAt?: string }>) => {
  const groups = new Map<string, ImageItem[]>()

  items.forEach((item) => {
    const groupKey = formatGroupDate(item.createdAt || new Date().toISOString())
    const current = groups.get(groupKey) || []
    current.push(item)
    groups.set(groupKey, current)
  })

  return Array.from(groups.entries()).map(([date, images], index) => ({
    date,
    isFirst: index === 0,
    images,
  }))
}

const getAssetResolutionLabel = (item: PersistedAssetItem) => {
  const sourceMeta = (item.sourceMeta || {}) as Record<string, unknown>
  const explicitLabel = sourceMeta.resolutionLabel
  if (typeof explicitLabel === 'string' && explicitLabel.trim() !== '') {
    return explicitLabel
  }

  const width = item.width || 0
  const height = item.height || 0
  const maxSide = Math.max(width, height)

  if (maxSide >= 3840) return '4K'
  if (maxSide >= 2048) return '2K'
  if (maxSide >= 1280) return '高清'
  return '标清'
}

const buildImageGroupsFromAssets = (items: PersistedAssetItem[]) => buildImageGroups(
  items.map(item => ({
    id: item.id,
    src: buildAssetUrl(item.previewUrl || item.fileUrl),
    promptText: item.promptText,
    modelLabel: item.modelLabel || '图片 4.0',
    aspectRatioLabel: item.aspectRatio || '1:1',
    resolutionLabel: getAssetResolutionLabel(item),
    createDate: item.createdAt,
    createdAt: item.createdAt,
  })),
)

export const useAssetImages = () => {
  const imageGroups = ref<ImageGroup[]>([])

  const allImages = computed(() => imageGroups.value.flatMap(group => group.images))

  const loadImageAssets = async () => {
    try {
      const assets = await listAssetItems({
        scope: 'mine',
        assetType: 'image',
        take: 120,
      })

      imageGroups.value = assets.length ? buildImageGroupsFromAssets(assets) : []
    } catch (error) {
      console.warn('读取资产列表失败。', error)
      imageGroups.value = []
    }
  }

  const resolvePreviewIndexByItemId = (itemId: string) => {
    return allImages.value.findIndex(img => img.id === itemId)
  }

  return {
    allImages,
    imageGroups,
    loadImageAssets,
    resolvePreviewIndexByItemId,
  }
}
