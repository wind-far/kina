import { prisma } from '../db/prisma'
import { decryptProviderApiKey, encryptProviderApiKey, maskApiKey } from './crypto'

const DEFAULT_PROVIDER_CODE = 'default-generate-provider'
const DEFAULT_PROVIDER_NAME = '默认生成厂商'
const DEFAULT_SUPPORTED_TYPES = ['CHAT', 'IMAGE', 'VIDEO']
const LEGACY_DEFAULT_SCENE = 'generate'

const MODEL_CATEGORY_TO_ENDPOINT_TYPE = {
  CHAT: 'chat',
  IMAGE: 'image',
  VIDEO: 'video',
} as const

export interface PublicProviderCatalogItem {
  id: string
  code: string
  name: string
  iconUrl: string
  supportedTypes: string[]
  sortOrder: number
}

export interface PublicModelCatalogItem {
  id: string
  selectionKey: string
  providerId: string
  providerCode: string
  providerName: string
  category: 'CHAT' | 'IMAGE' | 'VIDEO'
  label: string
  modelKey: string
  description: string
  capabilityJson: Record<string, any> | null
  defaultParamsJson: Record<string, any> | null
  sortOrder: number
  isDefault: boolean
}

export interface PublicModelCatalogResult {
  providers: PublicProviderCatalogItem[]
  models: {
    chat: PublicModelCatalogItem[]
    image: PublicModelCatalogItem[]
    video: PublicModelCatalogItem[]
  }
  defaults: {
    chat: string
    image: string
    video: string
  }
}

const buildModelSelectionKey = (providerId: string, category: string, modelKey: string) => `${providerId}::${category}::${modelKey}`

export interface AdminProviderPayload {
  code?: string
  name?: string
  description?: string
  iconUrl?: string
  baseUrl?: string
  apiKey?: string
  chatEndpoint?: string
  imageEndpoint?: string
  imageEditEndpoint?: string
  videoEndpoint?: string
  defaultChatModel?: string
  supportedTypes?: string[]
  isEnabled?: boolean
  sortOrder?: number
}

const getLegacyDefaultConfigRecord = () => prisma.aiProviderConfig.findFirst({
  where: {
    userId: null,
    scene: LEGACY_DEFAULT_SCENE,
  },
  orderBy: [
    { isDefault: 'desc' },
    { updatedAt: 'desc' },
  ],
})

const getFirstProviderRecord = (onlyEnabled = false) => prisma.aiProvider.findFirst({
  where: onlyEnabled ? { isEnabled: true } : undefined,
  orderBy: [
    { sortOrder: 'asc' },
    { createdAt: 'asc' },
  ],
})

const normalizeCode = (value: string) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-_]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')

const normalizeSupportedTypes = (input?: string[]) => {
  const normalizedValues = Array.isArray(input)
    ? input
      .map(item => String(item || '').trim().toUpperCase())
      .filter(Boolean)
    : []

  return Array.from(new Set(normalizedValues.length ? normalizedValues : DEFAULT_SUPPORTED_TYPES))
}

const normalizeProviderPayload = (payload: AdminProviderPayload, options: { isCreate: boolean }) => {
  const code = normalizeCode(String(payload.code || ''))
  const name = String(payload.name || '').trim()
  const baseUrl = String(payload.baseUrl || '').trim()

  if (!code) {
    throw new Error('厂商标识不能为空')
  }

  if (!name) {
    throw new Error('厂商名称不能为空')
  }

  if (!baseUrl) {
    throw new Error('基础地址不能为空')
  }

  return {
    code,
    name,
    description: String(payload.description || '').trim(),
    iconUrl: String(payload.iconUrl || '').trim(),
    baseUrl,
    apiKey: String(payload.apiKey || '').trim(),
    chatEndpoint: String(payload.chatEndpoint || '/chat/completions').trim() || '/chat/completions',
    imageEndpoint: String(payload.imageEndpoint || '/images/generations').trim() || '/images/generations',
    imageEditEndpoint: String(payload.imageEditEndpoint || '/images/edits').trim() || '/images/edits',
    videoEndpoint: String(payload.videoEndpoint || '/videos').trim() || '/videos',
    defaultChatModel: String(payload.defaultChatModel || '').trim(),
    supportedTypes: normalizeSupportedTypes(payload.supportedTypes),
    isEnabled: payload.isEnabled !== false,
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0,
    isCreate: options.isCreate,
  }
}

const buildProviderListItem = (provider: {
  id: string
  code: string
  name: string
  description: string | null
  iconUrl: string | null
  baseUrl: string
  apiKeyHint: string | null
  chatEndpoint: string
  imageEndpoint: string
  imageEditEndpoint: string
  videoEndpoint: string
  defaultChatModel: string | null
  supportedTypesJson: unknown
  isEnabled: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  models: Array<{
    id: string
    category: string
    isEnabled: boolean
  }>
}) => {
  const supportedTypes = Array.isArray(provider.supportedTypesJson)
    ? provider.supportedTypesJson.map(item => String(item || '').trim()).filter(Boolean)
    : []

  const modelCount = provider.models.length
  const enabledModelCount = provider.models.filter(item => item.isEnabled).length
  const modelTypes = Array.from(new Set(provider.models.map(item => String(item.category || '').trim()).filter(Boolean)))

  return {
    id: provider.id,
    code: provider.code,
    name: provider.name,
    description: provider.description || '',
    iconUrl: provider.iconUrl || '',
    baseUrl: provider.baseUrl,
    apiKeyHint: provider.apiKeyHint || '',
    chatEndpoint: provider.chatEndpoint,
    imageEndpoint: provider.imageEndpoint,
    imageEditEndpoint: provider.imageEditEndpoint,
    videoEndpoint: provider.videoEndpoint,
    defaultChatModel: provider.defaultChatModel || '',
    supportedTypes,
    isEnabled: provider.isEnabled,
    sortOrder: provider.sortOrder,
    modelCount,
    enabledModelCount,
    modelTypes,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
  }
}

// 首次读取时若新表为空，则把旧的默认配置物化到新厂商表，避免线上旧数据丢失。
const materializeLegacyProvider = async () => {
  const legacyConfig = await getLegacyDefaultConfigRecord()
  if (!legacyConfig) {
    return null
  }

  const duplicated = await prisma.aiProvider.findFirst({
    where: {
      code: DEFAULT_PROVIDER_CODE,
    },
    select: { id: true },
  })
  if (duplicated) {
    return prisma.aiProvider.findUnique({ where: { id: duplicated.id } })
  }

  const createdProvider = await prisma.aiProvider.create({
    data: {
      code: DEFAULT_PROVIDER_CODE,
      name: legacyConfig.name || DEFAULT_PROVIDER_NAME,
      description: '由旧版运行时配置自动迁移而来',
      baseUrl: legacyConfig.baseUrl,
      apiKeyEncrypted: legacyConfig.apiKeyEncrypted,
      apiKeyHint: legacyConfig.apiKeyHint,
      chatEndpoint: legacyConfig.chatEndpoint,
      imageEndpoint: legacyConfig.imageEndpoint,
      imageEditEndpoint: '/images/edits',
      videoEndpoint: legacyConfig.videoEndpoint,
      defaultChatModel: legacyConfig.defaultChatModel,
      supportedTypesJson: DEFAULT_SUPPORTED_TYPES,
      isEnabled: legacyConfig.isEnabled,
      isBuiltIn: false,
      sortOrder: 0,
      extraJson: legacyConfig.extraJson || null,
    },
  })

  const legacyModels = await prisma.aiProviderCustomModel.findMany({
    where: {
      providerConfigId: legacyConfig.id,
    },
    orderBy: [
      { category: 'asc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  if (legacyModels.length > 0) {
    await prisma.aiModel.createMany({
      data: legacyModels.map(item => ({
        providerId: createdProvider.id,
        category: item.category,
        name: item.label,
        modelKey: item.modelKey,
        capabilityJson: item.capabilityJson,
        defaultParamsJson: item.defaultParamsJson,
        sortOrder: item.sortOrder,
        isEnabled: item.isEnabled,
        isBuiltIn: false,
      })),
    })
  }

  return createdProvider
}

// 确保新表至少已经完成一次数据落地。
export const ensureProviderSeedData = async () => {
  const providerCount = await prisma.aiProvider.count()
  if (providerCount > 0) {
    return
  }

  await materializeLegacyProvider()
}

export const getRuntimeProviderRecord = async () => {
  await ensureProviderSeedData()
  const enabledProvider = await getFirstProviderRecord(true)
  if (enabledProvider) {
    return enabledProvider
  }

  return getFirstProviderRecord(false)
}

export const listAdminProviders = async () => {
  await ensureProviderSeedData()

  const providers = await prisma.aiProvider.findMany({
    include: {
      models: {
        select: {
          id: true,
          category: true,
          isEnabled: true,
        },
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  return providers.map(buildProviderListItem)
}

export const getAdminProviderDetail = async (id: string) => {
  await ensureProviderSeedData()
  const providerId = String(id || '').trim()
  if (!providerId) {
    throw new Error('缺少厂商 ID')
  }

  const provider = await prisma.aiProvider.findUnique({
    where: { id: providerId },
    include: {
      models: {
        select: {
          id: true,
          category: true,
          isEnabled: true,
        },
      },
    },
  })

  if (!provider) {
    throw new Error('厂商不存在')
  }

  return {
    ...buildProviderListItem(provider),
    apiKey: decryptProviderApiKey(provider.apiKeyEncrypted),
  }
}

const assertProviderCodeDuplicated = async (code: string, excludeId = '') => {
  const duplicated = await prisma.aiProvider.findFirst({
    where: {
      code,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })

  if (duplicated) {
    throw new Error('厂商标识已存在')
  }
}

export const createAdminProvider = async (payload: AdminProviderPayload) => {
  const normalizedPayload = normalizeProviderPayload(payload, { isCreate: true })
  await assertProviderCodeDuplicated(normalizedPayload.code)

  const createdProvider = await prisma.aiProvider.create({
    data: {
      code: normalizedPayload.code,
      name: normalizedPayload.name,
      description: normalizedPayload.description || null,
      iconUrl: normalizedPayload.iconUrl || null,
      baseUrl: normalizedPayload.baseUrl,
      apiKeyEncrypted: encryptProviderApiKey(normalizedPayload.apiKey),
      apiKeyHint: maskApiKey(normalizedPayload.apiKey),
      chatEndpoint: normalizedPayload.chatEndpoint,
      imageEndpoint: normalizedPayload.imageEndpoint,
      imageEditEndpoint: normalizedPayload.imageEditEndpoint,
      videoEndpoint: normalizedPayload.videoEndpoint,
      defaultChatModel: normalizedPayload.defaultChatModel || null,
      supportedTypesJson: normalizedPayload.supportedTypes,
      isEnabled: normalizedPayload.isEnabled,
      sortOrder: normalizedPayload.sortOrder,
      isBuiltIn: false,
    },
    include: {
      models: {
        select: {
          id: true,
          category: true,
          isEnabled: true,
        },
      },
    },
  })

  return buildProviderListItem(createdProvider)
}

export const updateAdminProvider = async (id: string, payload: AdminProviderPayload) => {
  const providerId = String(id || '').trim()
  if (!providerId) {
    throw new Error('缺少厂商 ID')
  }

  const existingProvider = await prisma.aiProvider.findUnique({
    where: { id: providerId },
  })
  if (!existingProvider) {
    throw new Error('厂商不存在')
  }

  const normalizedPayload = normalizeProviderPayload(payload, { isCreate: false })
  await assertProviderCodeDuplicated(normalizedPayload.code, providerId)

  const updatedProvider = await prisma.aiProvider.update({
    where: { id: providerId },
    data: {
      code: normalizedPayload.code,
      name: normalizedPayload.name,
      description: normalizedPayload.description || null,
      iconUrl: normalizedPayload.iconUrl || null,
      baseUrl: normalizedPayload.baseUrl,
      apiKeyEncrypted: encryptProviderApiKey(normalizedPayload.apiKey),
      apiKeyHint: maskApiKey(normalizedPayload.apiKey),
      chatEndpoint: normalizedPayload.chatEndpoint,
      imageEndpoint: normalizedPayload.imageEndpoint,
      imageEditEndpoint: normalizedPayload.imageEditEndpoint,
      videoEndpoint: normalizedPayload.videoEndpoint,
      defaultChatModel: normalizedPayload.defaultChatModel || null,
      supportedTypesJson: normalizedPayload.supportedTypes,
      isEnabled: normalizedPayload.isEnabled,
      sortOrder: normalizedPayload.sortOrder,
    },
    include: {
      models: {
        select: {
          id: true,
          category: true,
          isEnabled: true,
        },
      },
    },
  })

  return buildProviderListItem(updatedProvider)
}

export const deleteAdminProvider = async (id: string) => {
  const providerId = String(id || '').trim()
  if (!providerId) {
    throw new Error('缺少厂商 ID')
  }

  const existingProvider = await prisma.aiProvider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      _count: {
        select: {
          models: true,
        },
      },
    },
  })
  if (!existingProvider) {
    throw new Error('厂商不存在')
  }

  await prisma.aiProvider.delete({
    where: { id: providerId },
  })

  return {
    id: providerId,
    deletedModelCount: existingProvider._count.models,
  }
}


export const getPublicModelCatalog = async (): Promise<PublicModelCatalogResult> => {
  await ensureProviderSeedData()

  const providers = await prisma.aiProvider.findMany({
    where: { isEnabled: true },
    include: {
      models: {
        where: { isEnabled: true },
        orderBy: [
          { category: 'asc' },
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })

  const providerItems: PublicProviderCatalogItem[] = []
  const chatModels: PublicModelCatalogItem[] = []
  const imageModels: PublicModelCatalogItem[] = []
  const videoModels: PublicModelCatalogItem[] = []

  for (const provider of providers) {
    const supportedTypes = Array.isArray(provider.supportedTypesJson)
      ? provider.supportedTypesJson.map(item => String(item || '').trim()).filter(Boolean)
      : []

    providerItems.push({
      id: provider.id,
      code: provider.code,
      name: provider.name,
      iconUrl: provider.iconUrl || '',
      supportedTypes,
      sortOrder: provider.sortOrder,
    })

    for (const model of provider.models) {
      const currentItem: PublicModelCatalogItem = {
        id: model.id,
        selectionKey: buildModelSelectionKey(provider.id, model.category, model.modelKey),
        providerId: provider.id,
        providerCode: provider.code,
        providerName: provider.name,
        category: model.category,
        label: model.name,
        modelKey: model.modelKey,
        description: model.description || '',
        capabilityJson: model.capabilityJson && typeof model.capabilityJson === 'object' ? model.capabilityJson as Record<string, any> : null,
        defaultParamsJson: model.defaultParamsJson && typeof model.defaultParamsJson === 'object' ? model.defaultParamsJson as Record<string, any> : null,
        sortOrder: model.sortOrder,
        isDefault: model.category === 'CHAT' && provider.defaultChatModel === model.modelKey,
      }

      if (model.category === 'CHAT') {
        chatModels.push(currentItem)
      } else if (model.category === 'IMAGE') {
        imageModels.push(currentItem)
      } else if (model.category === 'VIDEO') {
        videoModels.push(currentItem)
      }
    }
  }

  const defaults = {
    chat: chatModels.find(item => item.isDefault)?.selectionKey || chatModels[0]?.selectionKey || '',
    image: imageModels[0]?.selectionKey || '',
    video: videoModels[0]?.selectionKey || '',
  }

  return {
    providers: providerItems,
    models: {
      chat: chatModels,
      image: imageModels,
      video: videoModels,
    },
    defaults,
  }
}

export const resolveGatewayProviderUpstream = async (input: {
  providerId?: string
  endpointType?: 'chat' | 'image' | 'image-edit' | 'video'
  modelKey?: string
}) => {
  const providerId = String(input.providerId || '').trim()
  const endpointType = String(input.endpointType || '').trim().toLowerCase()
  const modelKey = String(input.modelKey || '').trim()

  if (!providerId) {
    throw new Error('缺少厂商 ID')
  }

  if (endpointType !== 'chat' && endpointType !== 'image' && endpointType !== 'image-edit' && endpointType !== 'video') {
    throw new Error('缺少有效的上游接口类型')
  }

  const provider = await prisma.aiProvider.findUnique({
    where: { id: providerId },
  })

  if (!provider || !provider.isEnabled) {
    throw new Error('厂商不可用或未启用')
  }

  if (modelKey) {
    const category = endpointType === 'image-edit' ? 'IMAGE' : endpointType.toUpperCase()
    const model = await prisma.aiModel.findFirst({
      where: {
        providerId,
        isEnabled: true,
        modelKey,
        category: category as any,
      },
      select: { id: true },
    })

    if (!model) {
      throw new Error('模型不存在或未启用')
    }
  }

  const endpoint = endpointType === 'chat'
    ? provider.chatEndpoint
    : endpointType === 'image'
      ? provider.imageEndpoint
      : endpointType === 'image-edit'
        ? provider.imageEditEndpoint
      : provider.videoEndpoint

  return {
    baseUrl: provider.baseUrl,
    apiKey: decryptProviderApiKey(provider.apiKeyEncrypted),
    endpoint,
  }
}

export const getDefaultProviderOverview = async () => {
  const provider = await getRuntimeProviderRecord()
  if (!provider) {
    return null
  }

  return {
    id: provider.id,
    code: provider.code,
    name: provider.name,
    baseUrl: provider.baseUrl,
    defaultChatModel: provider.defaultChatModel || '',
    chatEndpoint: provider.chatEndpoint,
    imageEndpoint: provider.imageEndpoint,
    imageEditEndpoint: provider.imageEditEndpoint,
    videoEndpoint: provider.videoEndpoint,
    isEnabled: provider.isEnabled,
  }
}
