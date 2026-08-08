import { prisma } from '../db/prisma'
import { decryptProviderApiKey, encryptProviderApiKey, maskApiKey } from '../provider-config/crypto'
import { resolveProviderEndpointField, type AiModelCategory, type AiEndpointType } from '../../src/shared/provider-endpoint-strategy'

type UserProviderCategory = 'VIDEO'

const USER_PROVIDER_SCENE_PREFIX = 'user-byok:'
const USER_PROVIDER_SOURCE_KEY = 'sourceProviderId'
const supportedCategories: UserProviderCategory[] = ['VIDEO']

const assertCategory = (value: string): UserProviderCategory => {
  const category = String(value || '').trim().toUpperCase() as UserProviderCategory
  if (!supportedCategories.includes(category)) throw new Error('个人 API 配置当前仅支持视频模型')
  return category
}

const buildScene = (category: UserProviderCategory) => `${USER_PROVIDER_SCENE_PREFIX}${category.toLowerCase()}`

const getSourceProviderId = (extraJson: unknown) => {
  if (!extraJson || typeof extraJson !== 'object' || Array.isArray(extraJson)) return ''
  return String((extraJson as Record<string, unknown>)[USER_PROVIDER_SOURCE_KEY] || '').trim()
}

const getProviderForCategory = async (providerId: string, category: UserProviderCategory) => {
  const provider = await prisma.aiProvider.findUnique({
    where: { id: providerId },
    include: { models: { where: { category, isEnabled: true }, select: { id: true } } },
  })
  if (!provider || !provider.isEnabled || provider.models.length === 0) {
    throw new Error('所选厂商没有启用对应类别的模型')
  }
  return provider
}

export interface UserProviderConfigInput {
  providerId?: string
  apiKey?: string
}

export const listUserProviderConfigs = async (userId: string) => {
  const configs = await prisma.aiProviderConfig.findMany({
    where: { userId, scene: buildScene('VIDEO') },
    orderBy: { updatedAt: 'desc' },
  })
  const providerIds = configs.map(item => getSourceProviderId(item.extraJson)).filter(Boolean)
  const providers = providerIds.length
    ? await prisma.aiProvider.findMany({ where: { id: { in: providerIds } }, select: { id: true, name: true, code: true } })
    : []
  const providerMap = new Map(providers.map(item => [item.id, item]))

  return configs.map(item => {
    const category: UserProviderCategory = 'VIDEO'
    const sourceProviderId = getSourceProviderId(item.extraJson)
    const sourceProvider = providerMap.get(sourceProviderId)
    return {
      category,
      providerId: sourceProviderId,
      providerName: sourceProvider?.name || '',
      providerCode: sourceProvider?.code || '',
      apiKeyConfigured: Boolean(item.apiKeyEncrypted),
      apiKeyHint: item.apiKeyHint || '',
      isEnabled: item.isEnabled,
      updatedAt: item.updatedAt.toISOString(),
    }
  })
}

export const saveUserProviderConfig = async (userId: string, rawCategory: string, input: UserProviderConfigInput) => {
  const category = assertCategory(rawCategory)
  const providerId = String(input.providerId || '').trim()
  const apiKey = String(input.apiKey || '').trim()
  if (!providerId) throw new Error('请选择对应类别的厂商')

  const scene = buildScene(category)
  const existing = await prisma.aiProviderConfig.findFirst({ where: { userId, scene } })
  if (!apiKey && !existing?.apiKeyEncrypted) throw new Error('请填写 API Key')
  const provider = await getProviderForCategory(providerId, category)

  const data = {
    name: '个人视频 API',
    providerType: provider.code === 'openai' ? 'OPENAI' as const : 'OPENAI_COMPATIBLE' as const,
    baseUrl: provider.baseUrl,
    chatEndpoint: provider.chatEndpoint,
    imageEndpoint: provider.imageEndpoint,
    videoEndpoint: provider.videoEndpoint,
    defaultChatModel: null,
    defaultImageModel: null,
    defaultVideoModel: null,
    isDefault: false,
    isEnabled: true,
    extraJson: { [USER_PROVIDER_SOURCE_KEY]: provider.id, category },
    ...(apiKey ? { apiKeyEncrypted: encryptProviderApiKey(apiKey), apiKeyHint: maskApiKey(apiKey) } : {}),
  }
  if (existing) await prisma.aiProviderConfig.update({ where: { id: existing.id }, data })
  else await prisma.aiProviderConfig.create({ data: { userId, scene, ...data } })
  return (await listUserProviderConfigs(userId)).find(item => item.category === category)
}

export const deleteUserProviderConfig = async (userId: string, rawCategory: string) => {
  const category = assertCategory(rawCategory)
  const deleted = await prisma.aiProviderConfig.deleteMany({ where: { userId, scene: buildScene(category) } })
  return { category, deleted: deleted.count > 0 }
}

export const resolveUserProviderConnection = async (input: {
  userId?: string
  providerId: string
  category: AiModelCategory
  endpointType: AiEndpointType
}) => {
  if (!input.userId) return null
  if (input.category !== 'VIDEO') return null
  const config = await prisma.aiProviderConfig.findFirst({
    where: { userId: input.userId, scene: buildScene(assertCategory(input.category)), isEnabled: true },
  })
  if (!config || getSourceProviderId(config.extraJson) !== input.providerId) return null
  const apiKey = decryptProviderApiKey(config.apiKeyEncrypted)
  if (!apiKey) return null
  return {
    baseUrl: config.baseUrl,
    apiKey,
    endpoint: config[resolveProviderEndpointField(input.endpointType)],
  }
}
