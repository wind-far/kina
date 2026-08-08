import path from 'node:path'
import { inflateRawSync } from 'node:zlib'

const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const CENTRAL_DIRECTORY_FILE = 0x02014b50
const LOCAL_FILE = 0x04034b50
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
const MAX_ENTRIES = 256
const MAX_ENTRY_BYTES = 20 * 1024 * 1024
const MAX_TOTAL_UNCOMPRESSED_BYTES = 80 * 1024 * 1024

export interface TargetCanvasArchiveAsset {
  storageKey: string
  path: string
  mimeType: string
  bytes: number
  buffer: Buffer
}

export interface TargetCanvasArchivePayload {
  data: Record<string, unknown>
  assets: TargetCanvasArchiveAsset[]
  warnings: string[]
}

const asRecord = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, any>
  : {}

const isSafeArchivePath = (name: string) => Boolean(name)
  && !name.startsWith('/')
  && !name.startsWith('\\')
  && !name.includes('\\')
  && !name.split('/').some(segment => !segment || segment === '.' || segment === '..')

const archiveError = (message: string, status = 400) => {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

const findEndOfCentralDirectory = (archive: Buffer) => {
  const start = Math.max(0, archive.length - 0xffff - 22)
  for (let offset = archive.length - 22; offset >= start; offset -= 1) {
    if (archive.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset
  }
  throw archiveError('导入文件不是受支持的 ZIP 归档。')
}

/**
 * 仅解析目标项目导出所需的标准 ZIP 条目。拒绝 ZIP64、加密、目录穿越和超限解压，
 * 不在解压阶段落盘，避免归档文件直接影响服务器文件系统。
 */
export const extractTargetCanvasArchiveEntries = (archive: Buffer) => {
  if (!Buffer.isBuffer(archive) || !archive.byteLength) throw archiveError('导入归档不能为空。')
  if (archive.byteLength > MAX_ARCHIVE_BYTES) throw archiveError('导入归档超过 50MB 限制。', 413)
  const eocdOffset = findEndOfCentralDirectory(archive)
  const entryCount = archive.readUInt16LE(eocdOffset + 10)
  const centralDirectorySize = archive.readUInt32LE(eocdOffset + 12)
  const centralDirectoryOffset = archive.readUInt32LE(eocdOffset + 16)
  if (entryCount > MAX_ENTRIES) throw archiveError(`导入归档包含超过 ${MAX_ENTRIES} 个条目。`, 413)
  if (centralDirectoryOffset + centralDirectorySize > eocdOffset) throw archiveError('导入归档目录损坏。')

  const entries = new Map<string, Buffer>()
  let offset = centralDirectoryOffset
  let totalUncompressedBytes = 0
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_FILE) {
      throw archiveError('导入归档条目损坏。')
    }
    const flags = archive.readUInt16LE(offset + 8)
    const compressionMethod = archive.readUInt16LE(offset + 10)
    const compressedSize = archive.readUInt32LE(offset + 20)
    const uncompressedSize = archive.readUInt32LE(offset + 24)
    const nameLength = archive.readUInt16LE(offset + 28)
    const extraLength = archive.readUInt16LE(offset + 30)
    const commentLength = archive.readUInt16LE(offset + 32)
    const localHeaderOffset = archive.readUInt32LE(offset + 42)
    const nameStart = offset + 46
    const nameEnd = nameStart + nameLength
    if (nameEnd > archive.length) throw archiveError('导入归档文件名损坏。')
    const name = archive.subarray(nameStart, nameEnd).toString('utf8')
    offset = nameEnd + extraLength + commentLength
    if (!isSafeArchivePath(name)) throw archiveError('导入归档包含不安全的文件路径。')
    if (entries.has(name)) throw archiveError('导入归档包含重复文件路径。')
    if (flags & 0x1) throw archiveError('不支持加密的 ZIP 归档。')
    if (![0, 8].includes(compressionMethod)) throw archiveError('导入归档包含不支持的压缩方式。')
    if (uncompressedSize > MAX_ENTRY_BYTES || totalUncompressedBytes + uncompressedSize > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw archiveError('导入归档解压后超过安全大小限制。', 413)
    }
    if (localHeaderOffset + 30 > archive.length || archive.readUInt32LE(localHeaderOffset) !== LOCAL_FILE) {
      throw archiveError('导入归档本地条目损坏。')
    }
    const localNameLength = archive.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > archive.length) throw archiveError('导入归档内容损坏。')
    const compressed = archive.subarray(dataStart, dataEnd)
    const content = compressionMethod === 0 ? Buffer.from(compressed) : inflateRawSync(compressed)
    if (content.byteLength !== uncompressedSize || content.byteLength > MAX_ENTRY_BYTES) {
      throw archiveError('导入归档解压结果不符合声明大小。')
    }
    entries.set(name, content)
    totalUncompressedBytes += content.byteLength
  }
  return entries
}

export const parseTargetCanvasArchive = (archive: Buffer): TargetCanvasArchivePayload => {
  const entries = extractTargetCanvasArchiveEntries(archive)
  const projectBytes = entries.get('projects.json')
  if (!projectBytes) throw archiveError('导入归档缺少 projects.json。')
  let data: Record<string, unknown>
  try {
    data = JSON.parse(projectBytes.toString('utf8')) as Record<string, unknown>
  } catch {
    throw archiveError('projects.json 不是有效 JSON。')
  }
  if (data.app !== 'infinite-canvas' || !Array.isArray(data.projects)) {
    throw archiveError('该归档不是受支持的目标无限画布导出。')
  }
  const firstProject = asRecord(asRecord(data.projects[0]).project)
  if (!Object.keys(firstProject).length) throw archiveError('目标项目导出中未找到项目。')

  const warnings: string[] = []
  const files = Array.isArray(asRecord(data.projects[0]).files) ? asRecord(data.projects[0]).files : []
  const assets: TargetCanvasArchiveAsset[] = []
  for (const file of files) {
    const metadata = asRecord(file)
    const storageKey = String(metadata.storageKey || '').trim()
    const entryPath = String(metadata.path || '').trim()
    const mimeType = String(metadata.mimeType || 'application/octet-stream').trim()
    if (!storageKey || !isSafeArchivePath(entryPath)) {
      warnings.push('已跳过缺少资源键或包含不安全路径的资源。')
      continue
    }
    const buffer = entries.get(entryPath)
    if (!buffer) {
      warnings.push(`资源 ${storageKey} 未包含在归档中，已保留其引用。`)
      continue
    }
    assets.push({ storageKey, path: entryPath, mimeType, bytes: buffer.byteLength, buffer })
  }
  return { data, assets, warnings }
}

export const applyTargetCanvasAssetUrls = (data: Record<string, unknown>, urls: Map<string, string>) => {
  const clone = JSON.parse(JSON.stringify(data)) as Record<string, any>
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const item = asRecord(value)
    if (!Object.keys(item).length) return
    const storageKey = String(item.storageKey || '').trim()
    const assetUrl = urls.get(storageKey)
    if (assetUrl) item.assetUrl = assetUrl
    Object.values(item).forEach(visit)
  }
  visit(clone)
  return clone
}
