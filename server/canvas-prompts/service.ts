import { prisma } from '../db/prisma'

const asTags = (value: unknown) => Array.isArray(value)
  ? value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 20)
  : []

const serializePrompt = (prompt: any) => ({
  id: prompt.id,
  sourceId: prompt.sourceId || null,
  title: prompt.title,
  content: prompt.content,
  tags: asTags(prompt.tagsJson),
  createdAt: prompt.createdAt.toISOString(),
  updatedAt: prompt.updatedAt.toISOString(),
})

const assertAllowedSourceUrl = (value: unknown) => {
  const url = new URL(String(value || '').trim())
  if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com') {
    throw new Error('提示词远程同步目前只允许 raw.githubusercontent.com 的 HTTPS JSON 地址')
  }
  return url.href
}

export const listCanvasPrompts = async (userId: string, keyword = '') => {
  const normalizedKeyword = String(keyword || '').trim()
  const prompts = await (prisma as any).canvasPrompt.findMany({
    where: {
      isEnabled: true,
      OR: [{ userId }, { source: { userId } }, { source: { userId: null } }],
      ...(normalizedKeyword ? { OR: [{ userId }, { source: { userId } }, { source: { userId: null } }] } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  const filtered = normalizedKeyword
    ? prompts.filter((prompt: any) => `${prompt.title}\n${prompt.content}\n${asTags(prompt.tagsJson).join(' ')}`.toLowerCase().includes(normalizedKeyword.toLowerCase()))
    : prompts
  return filtered.map(serializePrompt)
}

export const createCanvasPrompt = async (userId: string, payload: any) => {
  const title = String(payload?.title || '').trim().slice(0, 191)
  const content = String(payload?.content || '').trim()
  if (!title || !content) throw new Error('提示词标题和内容不能为空')
  const prompt = await (prisma as any).canvasPrompt.create({
    data: { userId, title, content, tagsJson: asTags(payload?.tags) },
  })
  return serializePrompt(prompt)
}

export const listCanvasPromptSources = async (userId: string) => {
  const sources = await (prisma as any).canvasPromptSource.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    include: { _count: { select: { prompts: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return sources.map((source: any) => ({
    id: source.id, name: source.name, sourceUrl: source.sourceUrl || '', isEnabled: source.isEnabled,
    promptCount: source._count.prompts, updatedAt: source.updatedAt.toISOString(),
  }))
}

export const createCanvasPromptSource = async (userId: string, payload: any) => {
  const name = String(payload?.name || '').trim().slice(0, 100)
  if (!name) throw new Error('提示词源名称不能为空')
  const sourceUrl = payload?.sourceUrl ? assertAllowedSourceUrl(payload.sourceUrl) : null
  return await (prisma as any).canvasPromptSource.create({ data: { userId, name, sourceUrl, configJson: {} } })
}

export const syncCanvasPromptSource = async (userId: string, sourceId: string) => {
  const source = await (prisma as any).canvasPromptSource.findFirst({ where: { id: sourceId, userId } })
  if (!source?.sourceUrl) throw new Error('该提示词源没有可同步的地址')
  const response = await fetch(assertAllowedSourceUrl(source.sourceUrl), { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`提示词源请求失败：${response.status}`)
  const payload = await response.json()
  const entries = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.prompts) ? payload.prompts : []
  const prompts = entries.map((item: any, index: number) => ({
    sourceId,
    externalKey: String(item?.id || item?.key || index),
    title: String(item?.title || item?.name || `提示词 ${index + 1}`).trim().slice(0, 191),
    content: String(item?.content || item?.prompt || '').trim(),
    tagsJson: asTags(item?.tags),
  })).filter((item: any) => item.content)
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.canvasPrompt.deleteMany({ where: { sourceId } })
    if (prompts.length) await tx.canvasPrompt.createMany({ data: prompts })
  })
  return { sourceId, importedCount: prompts.length }
}
