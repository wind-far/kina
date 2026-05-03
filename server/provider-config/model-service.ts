import type { ModelCategory } from '@prisma/client'
import { prisma } from '../db/prisma'
import { ensureProviderSeedData, getAdminProviderDetail } from './service'

export interface ProviderModelPayload {
  category?: 'CHAT' | 'IMAGE' | 'VIDEO'
  label?: string
  modelKey?: string
  description?: string
  sortOrder?: number
  isEnabled?: boolean
  capabilityJson?: Record<string, any> | null
  defaultParamsJson?: Record<string, any> | null
}

export interface ProviderModelBatchUpsertItemPayload {
  category?: 'CHAT' | 'IMAGE' | 'VIDEO'
  label?: string
  modelKey?: string
  description?: string
  sortOrder?: number
  isEnabled?: boolean
  capabilityJson?: Record<string, any> | null
  defaultParamsJson?: Record<string, any> | null
}

export interface ProviderModelBatchUpsertPayload {
  items?: ProviderModelBatchUpsertItemPayload[]
}

const normalizeCategory = (value: string) => {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'CHAT' || normalizedValue === 'IMAGE' || normalizedValue === 'VIDEO') {
    return normalizedValue as ModelCategory
  }

  throw new Error('模型分类不合法')
}

const normalizeJsonObject = (value: unknown) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('模型 JSON 配置必须为对象')
  }

  return value as Record<string, any>
}

const normalizeModelPayload = (payload: ProviderModelPayload) => {
  const label = String(payload.label || '').trim()
  const modelKey = String(payload.modelKey || '').trim()

  if (!label) {
    throw new Error('模型名称不能为空')
  }

  if (!modelKey) {
    throw new Error('模型标识不能为空')
  }

  return {
    category: normalizeCategory(String(payload.category || '')),
    label,
    modelKey,
    description: String(payload.description || '').trim(),
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0,
    isEnabled: payload.isEnabled !== false,
    capabilityJson: normalizeJsonObject(payload.capabilityJson),
    defaultParamsJson: normalizeJsonObject(payload.defaultParamsJson),
  }
}

const buildProviderModelItem = (item: {
  id: string
  providerId: string
  category: ModelCategory
  name: string
  modelKey: string
  description: string | null
  sortOrder: number
  isEnabled: boolean
  capabilityJson: unknown
  defaultParamsJson: unknown
  createdAt: Date
  updatedAt: Date
}) => ({
  id: item.id,
  providerId: item.providerId,
  category: item.category,
  label: item.name,
  modelKey: item.modelKey,
  description: item.description || '',
  sortOrder: item.sortOrder,
  isEnabled: item.isEnabled,
  capabilityJson: item.capabilityJson || null,
  defaultParamsJson: item.defaultParamsJson || null,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
})

const assertProviderExists = async (providerId: string) => {
  const normalizedProviderId = String(providerId || '').trim()
  if (!normalizedProviderId) {
    throw new Error('缺少厂商 ID')
  }

  await ensureProviderSeedData()
  const provider = await prisma.aiProvider.findUnique({
    where: { id: normalizedProviderId },
    select: { id: true },
  })
  if (!provider) {
    throw new Error('厂商不存在')
  }

  return normalizedProviderId
}

const getProviderRuntimeConnection = async (providerId: string) => {
  const provider = await getAdminProviderDetail(providerId)
  const baseUrl = String(provider.baseUrl || '').trim().replace(/\/+$/, '')
  const apiKey = String(provider.apiKey || '').trim()
  if (!baseUrl) {
    throw new Error('当前厂商未配置基础地址')
  }
  if (!apiKey) {
    throw new Error('当前厂商未配置 API Key')
  }

  return {
    provider,
    baseUrl,
    apiKey,
  }
}

const resolveProviderModelsUrl = (baseUrl: string) => {
  if (/\/v1$/i.test(baseUrl)) {
    return `${baseUrl}/models`
  }
  return `${baseUrl}/v1/models`
}

// 读取上游 /v1/models 结果，供后台批量选择导入。
export const discoverProviderModels = async (providerId: string) => {
  const normalizedProviderId = await assertProviderExists(providerId)
  const { baseUrl, apiKey, provider } = await getProviderRuntimeConnection(normalizedProviderId)
  const requestUrl = resolveProviderModelsUrl(baseUrl)

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `拉取模型列表失败 (${response.status})`)
  }

  const data = await response.json().catch(() => null) as Record<string, any> | null
  const rawModels = Array.isArray(data?.data) ? data!.data : []
  const items = rawModels
    .map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, any> : {}
      const modelKey = String(record.id || record.model || '').trim()
      if (!modelKey) {
        return null
      }

      return {
        modelKey,
        label: String(record.name || record.id || record.model || '').trim() || modelKey,
        description: String(record.description || record.owned_by || '').trim(),
        category: 'CHAT' as ModelCategory,
        sortOrder: index * 10,
        raw: record,
      }
    })
    .filter(Boolean)

  return {
    provider,
    requestUrl,
    models: items,
  }
}

export const listProviderModels = async (providerId: string) => {
  const normalizedProviderId = await assertProviderExists(providerId)
  const models = await prisma.aiModel.findMany({
    where: {
      providerId: normalizedProviderId,
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return {
    provider: await getAdminProviderDetail(normalizedProviderId),
    models: models.map(buildProviderModelItem),
  }
}

const assertDuplicateModel = async (input: {
  providerId: string
  category: ModelCategory
  modelKey: string
  excludeId?: string
}) => {
  const duplicated = await prisma.aiModel.findFirst({
    where: {
      providerId: input.providerId,
      category: input.category,
      modelKey: input.modelKey,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: {
      id: true,
    },
  })

  if (duplicated) {
    throw new Error('同分类下已存在相同的模型标识')
  }
}

export const createProviderModel = async (providerId: string, payload: ProviderModelPayload) => {
  const normalizedProviderId = await assertProviderExists(providerId)
  const normalizedPayload = normalizeModelPayload(payload)
  await assertDuplicateModel({
    providerId: normalizedProviderId,
    category: normalizedPayload.category,
    modelKey: normalizedPayload.modelKey,
  })

  const created = await prisma.aiModel.create({
    data: {
      providerId: normalizedProviderId,
      category: normalizedPayload.category,
      name: normalizedPayload.label,
      modelKey: normalizedPayload.modelKey,
      description: normalizedPayload.description || null,
      sortOrder: normalizedPayload.sortOrder,
      isEnabled: normalizedPayload.isEnabled,
      capabilityJson: normalizedPayload.capabilityJson,
      defaultParamsJson: normalizedPayload.defaultParamsJson,
    },
  })

  return buildProviderModelItem(created)
}

// 批量导入或更新模型，便于从上游 /v1/models 选择后一次性落库。
export const batchUpsertProviderModels = async (providerId: string, payload: ProviderModelBatchUpsertPayload) => {
  const normalizedProviderId = await assertProviderExists(providerId)
  const items = Array.isArray(payload.items) ? payload.items : []
  if (!items.length) {
    throw new Error('缺少待导入的模型列表')
  }

  const results = await prisma.$transaction(async (tx) => {
    const upsertedItems: Array<ReturnType<typeof buildProviderModelItem>> = []

    for (const item of items) {
      const normalizedPayload = normalizeModelPayload(item)
      const existing = await tx.aiModel.findFirst({
        where: {
          providerId: normalizedProviderId,
          category: normalizedPayload.category,
          modelKey: normalizedPayload.modelKey,
        },
      })

      if (existing) {
        const updated = await tx.aiModel.update({
          where: { id: existing.id },
          data: {
            name: normalizedPayload.label,
            description: normalizedPayload.description || null,
            sortOrder: normalizedPayload.sortOrder,
            isEnabled: normalizedPayload.isEnabled,
            capabilityJson: normalizedPayload.capabilityJson,
            defaultParamsJson: normalizedPayload.defaultParamsJson,
          },
        })
        upsertedItems.push(buildProviderModelItem(updated))
        continue
      }

      const created = await tx.aiModel.create({
        data: {
          providerId: normalizedProviderId,
          category: normalizedPayload.category,
          name: normalizedPayload.label,
          modelKey: normalizedPayload.modelKey,
          description: normalizedPayload.description || null,
          sortOrder: normalizedPayload.sortOrder,
          isEnabled: normalizedPayload.isEnabled,
          capabilityJson: normalizedPayload.capabilityJson,
          defaultParamsJson: normalizedPayload.defaultParamsJson,
        },
      })
      upsertedItems.push(buildProviderModelItem(created))
    }

    return upsertedItems
  })

  return {
    provider: await getAdminProviderDetail(normalizedProviderId),
    models: results,
  }
}

export const updateProviderModel = async (providerId: string, id: string, payload: ProviderModelPayload) => {
  const normalizedProviderId = await assertProviderExists(providerId)
  const normalizedId = String(id || '').trim()
  if (!normalizedId) {
    throw new Error('缺少模型 ID')
  }

  const existing = await prisma.aiModel.findUnique({
    where: { id: normalizedId },
  })
  if (!existing || existing.providerId !== normalizedProviderId) {
    throw new Error('模型配置不存在')
  }

  const normalizedPayload = normalizeModelPayload(payload)
  await assertDuplicateModel({
    providerId: normalizedProviderId,
    category: normalizedPayload.category,
    modelKey: normalizedPayload.modelKey,
    excludeId: normalizedId,
  })

  const updated = await prisma.aiModel.update({
    where: { id: normalizedId },
    data: {
      category: normalizedPayload.category,
      name: normalizedPayload.label,
      modelKey: normalizedPayload.modelKey,
      description: normalizedPayload.description || null,
      sortOrder: normalizedPayload.sortOrder,
      isEnabled: normalizedPayload.isEnabled,
      capabilityJson: normalizedPayload.capabilityJson,
      defaultParamsJson: normalizedPayload.defaultParamsJson,
    },
  })

  return buildProviderModelItem(updated)
}

export const deleteProviderModel = async (providerId: string, id: string) => {
  const normalizedProviderId = await assertProviderExists(providerId)
  const normalizedId = String(id || '').trim()
  if (!normalizedId) {
    throw new Error('缺少模型 ID')
  }

  const existing = await prisma.aiModel.findUnique({
    where: { id: normalizedId },
    select: { id: true, providerId: true },
  })
  if (!existing || existing.providerId !== normalizedProviderId) {
    throw new Error('模型配置不存在')
  }

  await prisma.aiModel.delete({
    where: { id: normalizedId },
  })

  return {
    id: normalizedId,
  }
}
