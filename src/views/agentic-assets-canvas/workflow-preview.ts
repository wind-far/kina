import type { WorkflowDefinitionSummary, WorkflowDefinitionVersionSummary } from '@/views/workflow/api/definitions'

type UnknownRecord = Record<string, unknown>

const IMAGE_URL_KEYS = [
  'previewUrl',
  'thumbnailUrl',
  'coverUrl',
  'imageUrl',
  'outputUrl',
  'url',
  'src',
] as const

const VIDEO_POSTER_KEYS = [
  'previewUrl',
  'thumbnailUrl',
  'coverUrl',
  'posterUrl',
] as const

const asRecord = (value: unknown): UnknownRecord | null => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []

const normalizeBase64Image = (value: unknown) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return ''
  }

  if (/^data:image\//i.test(normalized)) {
    return normalized
  }

  return `data:image/png;base64,${normalized}`
}

const readString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const pushUniqueUrl = (urls: string[], seen: Set<string>, value: unknown) => {
  const normalized = readString(value)
  if (!normalized || seen.has(normalized)) {
    return
  }

  seen.add(normalized)
  urls.push(normalized)
}

const readKnownUrls = (
  source: unknown,
  keys: readonly string[],
  urls: string[],
  seen: Set<string>,
) => {
  const record = asRecord(source)
  if (!record) {
    return
  }

  keys.forEach(key => pushUniqueUrl(urls, seen, record[key]))
}

const readImageCollection = (value: unknown, urls: string[], seen: Set<string>) => {
  asArray(value).forEach((item) => {
    if (typeof item === 'string') {
      pushUniqueUrl(urls, seen, item)
      return
    }

    readKnownUrls(item, IMAGE_URL_KEYS, urls, seen)
  })
}

const readImageNodeUrls = (data: UnknownRecord, urls: string[], seen: Set<string>) => {
  readKnownUrls(data, IMAGE_URL_KEYS, urls, seen)

  const base64Image = normalizeBase64Image(data.base64)
  pushUniqueUrl(urls, seen, base64Image)

  readImageCollection(data.batchChildren, urls, seen)
  readImageCollection(data.images, urls, seen)
  readImageCollection(data.outputs, urls, seen)
}

const readVersionPreviewUrls = (
  version: WorkflowDefinitionVersionSummary | null,
  urls: string[],
  seen: Set<string>,
) => {
  if (!version) {
    return
  }

  readKnownUrls(version.definitionJson, VIDEO_POSTER_KEYS, urls, seen)

  asArray(version.nodesJson).forEach((rawNode) => {
    const node = asRecord(rawNode)
    const data = asRecord(node?.data)
    if (!node || !data) {
      return
    }

    const nodeType = readString(node.type).toLowerCase()
    if (nodeType === 'image') {
      readImageNodeUrls(data, urls, seen)
      return
    }

    // 视频文件本身不能交给 img 渲染，只使用明确的封面/海报字段。
    if (nodeType === 'video') {
      readKnownUrls(data, VIDEO_POSTER_KEYS, urls, seen)
      return
    }

    // 兼容旧版或第三方节点：只有明确声明为预览/封面的字段才进入项目卡。
    readKnownUrls(data, VIDEO_POSTER_KEYS, urls, seen)
  })
}

export const extractWorkflowPreviewImages = (workflow: WorkflowDefinitionSummary) => {
  const urls: string[] = []
  const seen = new Set<string>()
  const version = workflow.currentVersion || workflow.latestVersion || null

  // 显式项目封面优先于从画布节点推导出的图片。
  readKnownUrls(workflow.tagsJson, VIDEO_POSTER_KEYS, urls, seen)
  readVersionPreviewUrls(version, urls, seen)

  return urls.slice(0, 4)
}
