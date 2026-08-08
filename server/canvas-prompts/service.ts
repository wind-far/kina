import { createHash } from 'node:crypto'
import { prisma } from '../db/prisma'

const MAX_SOURCE_BYTES = 1024 * 1024
const SOURCE_KINDS = new Set(['JSON', 'SKILL_MARKDOWN'])
const PROMPT_KINDS = new Set(['TEXT', 'IMAGE_CONFIG', 'VIDEO_CONFIG'])

export interface CanvasPromptAccessContext {
  currentUserId: string
  role?: string | null
}

export interface ManagedPromptEntry {
  externalKey: string
  title: string
  content: string
  summary: string
  tags: string[]
  kind: 'TEXT' | 'IMAGE_CONFIG' | 'VIDEO_CONFIG'
  targetNodeType: 'text' | 'imageConfig' | 'videoConfig'
  sourceData: Record<string, unknown>
}

const asTags = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map(item => String(item || '').trim().replace(/\s+/g, ' ')).filter(Boolean))].slice(0, 20)
  : []

const normalizeSourceKind = (value: unknown) => {
  const kind = String(value || 'JSON').trim().toUpperCase()
  if (!SOURCE_KINDS.has(kind)) throw new Error('提示词源类型不受支持')
  return kind as 'JSON' | 'SKILL_MARKDOWN'
}

const normalizePromptKind = (value: unknown) => {
  const kind = String(value || 'TEXT').trim().toUpperCase()
  return PROMPT_KINDS.has(kind) ? kind as ManagedPromptEntry['kind'] : 'TEXT'
}

const nodeTypeForPromptKind = (kind: ManagedPromptEntry['kind']) => kind === 'IMAGE_CONFIG'
  ? 'imageConfig'
  : kind === 'VIDEO_CONFIG'
    ? 'videoConfig'
    : 'text'

/** Skill 文件只作为数据解析；移除脚本、嵌入页面、事件属性和 fenced code，绝不执行。 */
export const sanitizeManagedPromptContent = (value: unknown) => String(value || '')
  .replace(/<\s*(script|iframe|object|embed|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  .replace(/<\s*\/?\s*(script|iframe|object|embed|style)[^>]*>/gi, '')
  .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
  .replace(/```[\s\S]*?```/g, '[已移除代码块]')
  .replace(/\u0000/g, '')
  .trim()
  .slice(0, 40_000)

const compactSummary = (value: string) => value.replace(/[#>*_`\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)

const safeExternalKey = (value: unknown, index: number) => String(value || `item-${index + 1}`)
  .trim().slice(0, 191) || `item-${index + 1}`

const parseJsonEntries = (value: unknown): ManagedPromptEntry[] => {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const rawEntries = Array.isArray(value)
    ? value
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.prompts)
        ? root.prompts
        : []
  const seen = new Set<string>()
  return rawEntries.slice(0, 500).flatMap((value, index): ManagedPromptEntry[] => {
    const item = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    const externalKey = safeExternalKey(item.id ?? item.key ?? item.slug, index)
    const content = sanitizeManagedPromptContent(item.content ?? item.prompt ?? item.template)
    if (!content || seen.has(externalKey)) return []
    seen.add(externalKey)
    const kind = normalizePromptKind(item.kind ?? item.mode ?? item.targetKind)
    const title = String(item.title ?? item.name ?? `提示词 ${index + 1}`).trim().slice(0, 191) || `提示词 ${index + 1}`
    const sourceData = item.meta && typeof item.meta === 'object' && !Array.isArray(item.meta) ? item.meta as Record<string, unknown> : {}
    return [{
      externalKey,
      title,
      content,
      summary: String(item.summary || '').trim().slice(0, 500) || compactSummary(content),
      tags: asTags(item.tags),
      kind,
      targetNodeType: nodeTypeForPromptKind(kind),
      sourceData,
    }]
  })
}

/** 解析 MiniMax H3 等 SKILL.md：仅保留文本说明，按视频配置节点插入画布。 */
export const parseSkillMarkdownEntries = (value: unknown, sourceName = 'Skill') => {
  const content = sanitizeManagedPromptContent(value)
  if (!content) return [] as ManagedPromptEntry[]
  const title = (content.match(/^\s*#\s+(.+)$/m)?.[1] || sourceName).trim().slice(0, 191)
  const slug = String(sourceName || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skill'
  const tags = [...new Set(['skill', ...( /minimax|h3/i.test(`${sourceName}\n${content}`) ? ['minimax-h3', 'video'] : [])])]
  return [{
    externalKey: `skill-${slug}`,
    title,
    content,
    summary: compactSummary(content),
    tags,
    kind: 'VIDEO_CONFIG' as const,
    targetNodeType: 'videoConfig' as const,
    sourceData: { parser: 'skill-markdown', executableContentRemoved: true },
  }]
}

export const parseCanvasPromptSourcePayload = (sourceKind: unknown, raw: string, sourceName = '受管提示词源') => {
  const kind = normalizeSourceKind(sourceKind)
  if (kind === 'SKILL_MARKDOWN') return parseSkillMarkdownEntries(raw, sourceName)
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('提示词 JSON 格式无效') }
  return parseJsonEntries(parsed)
}

/** 仅允许可审计的 GitHub Raw 内容，拒绝认证信息、端口与任意服务端请求。 */
export const assertAllowedSourceUrl = (value: unknown) => {
  const url = new URL(String(value || '').trim())
  if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com' || url.username || url.password || url.port) {
    throw new Error('提示词远程同步目前只允许 raw.githubusercontent.com 的 HTTPS 原始内容地址')
  }
  return url.href
}

const canReadSource = (source: any, context: CanvasPromptAccessContext) => {
  if (source.userId === context.currentUserId) return true
  if (source.userId !== null || String(source.permissionScope || 'PRIVATE') !== 'SHARED') return false
  const roles = asTags(source.allowedRolesJson)
  return !roles.length || roles.includes(String(context.role || 'USER').toUpperCase())
}

const canManageSource = (source: any, context: CanvasPromptAccessContext) => source.userId === context.currentUserId
  || (source.userId === null && String(context.role || '').toUpperCase() === 'ADMIN')

const serializePrompt = (prompt: any) => ({
  id: prompt.id,
  sourceId: prompt.sourceId || null,
  title: prompt.title,
  content: prompt.content,
  summary: prompt.summary || compactSummary(prompt.content),
  kind: normalizePromptKind(prompt.kind),
  targetNodeType: prompt.targetNodeType || nodeTypeForPromptKind(normalizePromptKind(prompt.kind)),
  tags: asTags(prompt.tagsJson),
  sourceData: prompt.sourceDataJson || {},
  createdAt: prompt.createdAt.toISOString(),
  updatedAt: prompt.updatedAt.toISOString(),
})

const serializeSource = (source: any) => ({
  id: source.id,
  name: source.name,
  sourceUrl: source.sourceUrl || '',
  sourceKind: normalizeSourceKind(source.sourceKind),
  category: source.category || '',
  permissionScope: source.permissionScope || 'PRIVATE',
  allowedRoles: asTags(source.allowedRolesJson),
  isEnabled: Boolean(source.isEnabled),
  promptCount: source._count?.prompts ?? source.promptCount ?? 0,
  currentVersionNo: Number(source.currentVersionNo || 0),
  lastSyncStatus: source.lastSyncStatus || 'NEVER',
  lastSyncError: source.lastSyncError || '',
  lastSyncedAt: source.lastSyncedAt ? source.lastSyncedAt.toISOString() : null,
  updatedAt: source.updatedAt.toISOString(),
})

export const listCanvasPrompts = async (context: CanvasPromptAccessContext, filters: { keyword?: string; tag?: string; sourceId?: string; kind?: string } = {}) => {
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  const tag = String(filters.tag || '').trim().toLowerCase()
  const kind = filters.kind ? normalizePromptKind(filters.kind) : null
  const prompts = await (prisma as any).canvasPrompt.findMany({
    where: { isEnabled: true, ...(filters.sourceId ? { sourceId: String(filters.sourceId) } : {}) },
    include: { source: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })
  return prompts
    .filter((prompt: any) => prompt.userId === context.currentUserId || (prompt.source && canReadSource(prompt.source, context)))
    .filter((prompt: any) => !kind || normalizePromptKind(prompt.kind) === kind)
    .filter((prompt: any) => !tag || asTags(prompt.tagsJson).some(item => item.toLowerCase() === tag))
    .filter((prompt: any) => !keyword || `${prompt.title}\n${prompt.content}\n${prompt.summary || ''}\n${asTags(prompt.tagsJson).join(' ')}`.toLowerCase().includes(keyword))
    .map(serializePrompt)
}

export const createCanvasPrompt = async (context: CanvasPromptAccessContext, payload: any) => {
  const title = String(payload?.title || '').trim().slice(0, 191)
  const content = sanitizeManagedPromptContent(payload?.content)
  if (!title || !content) throw new Error('提示词标题和内容不能为空')
  const kind = normalizePromptKind(payload?.kind)
  const prompt = await (prisma as any).canvasPrompt.create({
    data: {
      userId: context.currentUserId,
      title,
      content,
      summary: String(payload?.summary || '').trim().slice(0, 500) || compactSummary(content),
      kind,
      targetNodeType: nodeTypeForPromptKind(kind),
      tagsJson: asTags(payload?.tags),
      sourceDataJson: payload?.sourceData && typeof payload.sourceData === 'object' ? payload.sourceData : {},
    },
  })
  return serializePrompt(prompt)
}

export const listCanvasPromptSources = async (context: CanvasPromptAccessContext) => {
  const sources = await (prisma as any).canvasPromptSource.findMany({
    where: { OR: [{ userId: context.currentUserId }, { userId: null }] },
    include: { _count: { select: { prompts: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return sources.filter((source: any) => canReadSource(source, context)).map(serializeSource)
}

export const createCanvasPromptSource = async (context: CanvasPromptAccessContext, payload: any) => {
  const name = String(payload?.name || '').trim().slice(0, 100)
  if (!name) throw new Error('提示词源名称不能为空')
  const permissionScope = String(payload?.permissionScope || 'PRIVATE').trim().toUpperCase() === 'SHARED' ? 'SHARED' : 'PRIVATE'
  if (permissionScope === 'SHARED' && String(context.role || '').toUpperCase() !== 'ADMIN') throw new Error('只有管理员可以创建共享提示词源')
  const sourceKind = normalizeSourceKind(payload?.sourceKind)
  const sourceUrl = payload?.sourceUrl ? assertAllowedSourceUrl(payload.sourceUrl) : null
  const source = await (prisma as any).canvasPromptSource.create({
    data: {
      userId: permissionScope === 'SHARED' ? null : context.currentUserId,
      name,
      sourceUrl,
      sourceKind,
      category: String(payload?.category || '').trim().slice(0, 100) || null,
      permissionScope,
      allowedRolesJson: permissionScope === 'SHARED' ? asTags(payload?.allowedRoles).map(role => role.toUpperCase()) : [],
      configJson: { createdById: context.currentUserId, parser: sourceKind === 'SKILL_MARKDOWN' ? 'safe-skill-markdown' : 'safe-json' },
    },
    include: { _count: { select: { prompts: true } } },
  })
  return serializeSource(source)
}

const snapshotEntries = (entries: ManagedPromptEntry[]) => entries.map(entry => ({ ...entry, tags: [...entry.tags] }))
const contentHash = (entries: ManagedPromptEntry[]) => createHash('sha256').update(JSON.stringify(snapshotEntries(entries))).digest('hex')

const writePromptEntries = async (tx: any, sourceId: string, entries: ManagedPromptEntry[]) => {
  await tx.canvasPrompt.deleteMany({ where: { sourceId } })
  if (!entries.length) return
  await tx.canvasPrompt.createMany({ data: entries.map(entry => ({
    sourceId,
    externalKey: entry.externalKey,
    title: entry.title,
    content: entry.content,
    summary: entry.summary,
    kind: entry.kind,
    targetNodeType: entry.targetNodeType,
    tagsJson: entry.tags,
    sourceDataJson: entry.sourceData,
  })) })
}

const readSourceOrThrow = async (sourceId: string, context: CanvasPromptAccessContext) => {
  const source = await (prisma as any).canvasPromptSource.findUnique({ where: { id: sourceId } })
  if (!source || !canManageSource(source, context)) throw new Error('提示词源不存在或没有管理权限')
  return source
}

export const syncCanvasPromptSource = async (context: CanvasPromptAccessContext, sourceId: string) => {
  const source = await readSourceOrThrow(sourceId, context)
  if (!source.sourceUrl) throw new Error('该提示词源没有可同步的地址')
  const run = await (prisma as any).canvasPromptSyncRun.create({ data: { sourceId, triggerUserId: context.currentUserId, action: 'SYNC', status: 'RUNNING', sourceVersionNo: source.currentVersionNo || 0 } })
  try {
    const response = await fetch(assertAllowedSourceUrl(source.sourceUrl), { signal: AbortSignal.timeout(10_000), redirect: 'error' })
    if (!response.ok) throw new Error(`提示词源请求失败：${response.status}`)
    const length = Number(response.headers.get('content-length') || '0')
    if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) throw new Error('提示词源内容超过 1MB 限制')
    const raw = Buffer.from(await response.arrayBuffer())
    if (raw.byteLength > MAX_SOURCE_BYTES) throw new Error('提示词源内容超过 1MB 限制')
    const entries = parseCanvasPromptSourcePayload(source.sourceKind, raw.toString('utf8'), source.name)
    const hash = contentHash(entries)
    const previous = await (prisma as any).canvasPromptSourceVersion.findFirst({ where: { sourceId }, orderBy: { versionNo: 'desc' } })
    if (previous?.contentHash === hash) {
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.canvasPromptSource.update({ where: { id: sourceId }, data: { lastSyncStatus: 'NO_CHANGE', lastSyncError: null, lastSyncedAt: new Date() } })
        await tx.canvasPromptSyncRun.update({ where: { id: run.id }, data: { status: 'NO_CHANGE', importedCount: entries.length, targetVersionNo: previous.versionNo, finishedAt: new Date() } })
      })
      return { sourceId, importedCount: entries.length, versionNo: previous.versionNo, changed: false }
    }
    const versionNo = Number(source.currentVersionNo || 0) + 1
    await (prisma as any).$transaction(async (tx: any) => {
      await writePromptEntries(tx, sourceId, entries)
      await tx.canvasPromptSourceVersion.create({ data: { sourceId, versionNo, contentHash: hash, promptCount: entries.length, snapshotJson: { entries: snapshotEntries(entries) }, changeType: 'SYNC', createdById: context.currentUserId } })
      await tx.canvasPromptSource.update({ where: { id: sourceId }, data: { currentVersionNo: versionNo, lastSyncStatus: 'SUCCESS', lastSyncError: null, lastSyncedAt: new Date() } })
      await tx.canvasPromptSyncRun.update({ where: { id: run.id }, data: { status: 'SUCCESS', importedCount: entries.length, targetVersionNo: versionNo, finishedAt: new Date() } })
    })
    return { sourceId, importedCount: entries.length, versionNo, changed: true }
  } catch (error: any) {
    const message = String(error?.message || '提示词源同步失败').slice(0, 10_000)
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.canvasPromptSource.update({ where: { id: sourceId }, data: { lastSyncStatus: 'FAILED', lastSyncError: message } })
      await tx.canvasPromptSyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', errorMessage: message, finishedAt: new Date() } })
    }).catch(() => undefined)
    throw error
  }
}

export const listCanvasPromptSourceVersions = async (context: CanvasPromptAccessContext, sourceId: string) => {
  await readSourceOrThrow(sourceId, context)
  const versions = await (prisma as any).canvasPromptSourceVersion.findMany({ where: { sourceId }, orderBy: { versionNo: 'desc' }, take: 100 })
  return versions.map((version: any) => ({ id: version.id, versionNo: version.versionNo, contentHash: version.contentHash, promptCount: version.promptCount, changeType: version.changeType, changeNote: version.changeNote || '', createdAt: version.createdAt.toISOString() }))
}

export const listCanvasPromptSyncRuns = async (context: CanvasPromptAccessContext, sourceId: string) => {
  await readSourceOrThrow(sourceId, context)
  const runs = await (prisma as any).canvasPromptSyncRun.findMany({ where: { sourceId }, orderBy: { createdAt: 'desc' }, take: 100 })
  return runs.map((run: any) => ({ id: run.id, action: run.action, status: run.status, sourceVersionNo: run.sourceVersionNo, targetVersionNo: run.targetVersionNo, importedCount: run.importedCount, errorMessage: run.errorMessage || '', createdAt: run.createdAt.toISOString(), finishedAt: run.finishedAt?.toISOString() || null }))
}

export const rollbackCanvasPromptSource = async (context: CanvasPromptAccessContext, sourceId: string, versionNo: number) => {
  const source = await readSourceOrThrow(sourceId, context)
  const target = await (prisma as any).canvasPromptSourceVersion.findUnique({ where: { sourceId_versionNo: { sourceId, versionNo: Number(versionNo) } } })
  if (!target) throw new Error('目标提示词源版本不存在')
  const entries = Array.isArray(target.snapshotJson?.entries) ? target.snapshotJson.entries as ManagedPromptEntry[] : []
  const safeEntries = entries.map((entry, index) => ({
    externalKey: safeExternalKey(entry.externalKey, index),
    title: String(entry.title || `提示词 ${index + 1}`).trim().slice(0, 191),
    content: sanitizeManagedPromptContent(entry.content),
    summary: String(entry.summary || '').trim().slice(0, 500),
    tags: asTags(entry.tags),
    kind: normalizePromptKind(entry.kind),
    targetNodeType: nodeTypeForPromptKind(normalizePromptKind(entry.kind)),
    sourceData: entry.sourceData && typeof entry.sourceData === 'object' ? entry.sourceData : {},
  })).filter(entry => entry.content)
  const nextVersionNo = Number(source.currentVersionNo || 0) + 1
  const run = await (prisma as any).canvasPromptSyncRun.create({ data: { sourceId, triggerUserId: context.currentUserId, action: 'ROLLBACK', status: 'RUNNING', sourceVersionNo: source.currentVersionNo || 0, targetVersionNo: Number(versionNo) } })
  await (prisma as any).$transaction(async (tx: any) => {
    await writePromptEntries(tx, sourceId, safeEntries)
    await tx.canvasPromptSourceVersion.create({ data: { sourceId, versionNo: nextVersionNo, contentHash: contentHash(safeEntries), promptCount: safeEntries.length, snapshotJson: { entries: snapshotEntries(safeEntries) }, changeType: 'ROLLBACK', changeNote: `恢复自 V${versionNo}`, createdById: context.currentUserId } })
    await tx.canvasPromptSource.update({ where: { id: sourceId }, data: { currentVersionNo: nextVersionNo, lastSyncStatus: 'ROLLED_BACK', lastSyncError: null, lastSyncedAt: new Date() } })
    await tx.canvasPromptSyncRun.update({ where: { id: run.id }, data: { status: 'ROLLED_BACK', importedCount: safeEntries.length, targetVersionNo: nextVersionNo, finishedAt: new Date(), detailJson: { restoredFromVersionNo: Number(versionNo) } } })
  })
  return { sourceId, restoredFromVersionNo: Number(versionNo), versionNo: nextVersionNo, importedCount: safeEntries.length }
}
