import { prisma } from '../db/prisma'
import { encryptProviderApiKey, maskApiKey } from './crypto'
import { invalidatePublicModelCatalogCache } from './service'

type ProviderCategory = 'CHAT' | 'IMAGE' | 'VIDEO'
type ProviderModality = 'text' | 'image' | 'video'

interface EnvironmentProviderDefinition {
  modality: ProviderModality
  category: ProviderCategory
  code: string
  name: string
  baseUrl: string
  apiKey: string
  modelKey: string
  endpoint: string
  imageEditEndpoint?: string
  sortOrder: number
}

export interface EnvironmentProviderBootstrapResult {
  enabled: boolean
  created: string[]
  updated: string[]
  skipped: string[]
}

const ENV_BOOTSTRAP_FLAG = 'AI_ENV_PROVIDER_BOOTSTRAP'
const MANAGED_MARKER = 'environmentProviderBootstrap'
const MODEL_CATEGORY_BY_MODALITY: Record<ProviderModality, ProviderCategory> = {
  text: 'CHAT',
  image: 'IMAGE',
  video: 'VIDEO',
}

const readEnabled = (value: unknown) => String(value || '').trim().toLowerCase() === 'true'

const readOptional = (environment: NodeJS.ProcessEnv, key: string) => String(environment[key] || '').trim()

const assertHttpUrl = (value: string, variableName: string) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol')
  } catch {
    throw new Error(`${variableName} 必须是 http 或 https 地址`)
  }
}

const assertEndpoint = (value: string, variableName: string) => {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) {
    throw new Error(`${variableName} 必须是以 / 开头的相对路径`)
  }
}

/**
 * 读取三类独立环境配置。任一类型一旦填写，就必须一次性提供地址、密钥和默认模型，
 * 避免因部署变量遗漏而用错误厂商或空密钥启动。
 */
export const readEnvironmentProviderDefinitions = (environment: NodeJS.ProcessEnv = process.env): EnvironmentProviderDefinition[] => {
  if (!readEnabled(environment[ENV_BOOTSTRAP_FLAG])) return []

  const definitions: EnvironmentProviderDefinition[] = []
  const configurations: Array<{
    modality: ProviderModality
    code: string
    name: string
    endpointVariable: string
    defaultEndpoint: string
    imageEditEndpointVariable?: string
    defaultImageEditEndpoint?: string
    sortOrder: number
  }> = [
    {
      modality: 'text',
      code: 'env-text-provider',
      name: '环境变量文本厂商',
      endpointVariable: 'TEXT_PROVIDER_CHAT_ENDPOINT',
      defaultEndpoint: '/chat/completions',
      sortOrder: 10,
    },
    {
      modality: 'image',
      code: 'env-image-provider',
      name: '环境变量图片厂商',
      endpointVariable: 'IMAGE_PROVIDER_IMAGE_ENDPOINT',
      defaultEndpoint: '/images/generations',
      imageEditEndpointVariable: 'IMAGE_PROVIDER_IMAGE_EDIT_ENDPOINT',
      defaultImageEditEndpoint: '/images/edits',
      sortOrder: 20,
    },
    {
      modality: 'video',
      code: 'env-video-provider',
      name: '环境变量视频厂商',
      endpointVariable: 'VIDEO_PROVIDER_VIDEO_ENDPOINT',
      defaultEndpoint: '/videos',
      sortOrder: 30,
    },
  ]

  for (const configuration of configurations) {
    const prefix = configuration.modality.toUpperCase()
    const baseUrlVariable = `${prefix}_PROVIDER_BASE_URL`
    const apiKeyVariable = `${prefix}_PROVIDER_API_KEY`
    const modelVariable = `${prefix}_PROVIDER_DEFAULT_MODEL`
    const baseUrl = readOptional(environment, baseUrlVariable)
    const apiKey = readOptional(environment, apiKeyVariable)
    const modelKey = readOptional(environment, modelVariable)
    const suppliedCount = [baseUrl, apiKey, modelKey].filter(Boolean).length

    if (suppliedCount === 0) continue
    if (suppliedCount !== 3) {
      throw new Error(`${configuration.modality} 厂商环境变量必须同时配置 ${baseUrlVariable}、${apiKeyVariable}、${modelVariable}`)
    }

    assertHttpUrl(baseUrl, baseUrlVariable)
    const endpoint = readOptional(environment, configuration.endpointVariable) || configuration.defaultEndpoint
    assertEndpoint(endpoint, configuration.endpointVariable)
    const imageEditEndpoint = configuration.imageEditEndpointVariable
      ? readOptional(environment, configuration.imageEditEndpointVariable) || configuration.defaultImageEditEndpoint
      : undefined
    if (imageEditEndpoint && configuration.imageEditEndpointVariable) {
      assertEndpoint(imageEditEndpoint, configuration.imageEditEndpointVariable)
    }

    definitions.push({
      modality: configuration.modality,
      category: MODEL_CATEGORY_BY_MODALITY[configuration.modality],
      code: configuration.code,
      name: configuration.name,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      modelKey,
      endpoint,
      imageEditEndpoint,
      sortOrder: configuration.sortOrder,
    })
  }

  return definitions
}

const isEnvironmentManagedProvider = (extraJson: unknown) => Boolean(
  extraJson
  && typeof extraJson === 'object'
  && !Array.isArray(extraJson)
  && (extraJson as Record<string, unknown>)[MANAGED_MARKER] === true,
)

export const bootstrapEnvironmentProviders = async (environment: NodeJS.ProcessEnv = process.env): Promise<EnvironmentProviderBootstrapResult> => {
  const enabled = readEnabled(environment[ENV_BOOTSTRAP_FLAG])
  if (!enabled) return { enabled: false, created: [], updated: [], skipped: [] }

  const definitions = readEnvironmentProviderDefinitions(environment)
  const result: EnvironmentProviderBootstrapResult = { enabled: true, created: [], updated: [], skipped: [] }

  for (const definition of definitions) {
    const existing = await prisma.aiProvider.findUnique({
      where: { code: definition.code },
      include: { models: true },
    })

    // 同编码但不是本模块建立的记录，视为管理员配置，绝不隐式改写。
    if (existing && !isEnvironmentManagedProvider(existing.extraJson)) {
      result.skipped.push(definition.code)
      continue
    }

    const providerData = {
      name: definition.name,
      description: '由服务器环境变量受管；请通过部署配置更新。',
      baseUrl: definition.baseUrl,
      apiKeyEncrypted: encryptProviderApiKey(definition.apiKey),
      apiKeyHint: maskApiKey(definition.apiKey),
      chatEndpoint: definition.category === 'CHAT' ? definition.endpoint : '/chat/completions',
      imageEndpoint: definition.category === 'IMAGE' ? definition.endpoint : '/images/generations',
      imageEditEndpoint: definition.category === 'IMAGE' ? definition.imageEditEndpoint || '/images/edits' : '/images/edits',
      videoEndpoint: definition.category === 'VIDEO' ? definition.endpoint : '/videos',
      defaultChatModel: definition.category === 'CHAT' ? definition.modelKey : null,
      supportedTypesJson: [definition.category],
      isEnabled: true,
      isBuiltIn: true,
      sortOrder: definition.sortOrder,
      extraJson: { [MANAGED_MARKER]: true, modality: definition.modality },
    }

    const provider = existing
      ? await prisma.aiProvider.update({ where: { id: existing.id }, data: providerData })
      : await prisma.aiProvider.create({ data: { code: definition.code, ...providerData } })

    await prisma.aiModel.upsert({
      where: {
        providerId_category_modelKey: {
          providerId: provider.id,
          category: definition.category,
          modelKey: definition.modelKey,
        },
      },
      create: {
        providerId: provider.id,
        category: definition.category,
        name: definition.modelKey,
        modelKey: definition.modelKey,
        isEnabled: true,
        isBuiltIn: true,
        sortOrder: 0,
      },
      update: { name: definition.modelKey, isEnabled: true, sortOrder: 0 },
    })

    // 环境变量中的默认模型变更后，关闭同一类别下的旧受管模型，防止目录中残留旧默认项。
    await prisma.aiModel.updateMany({
      where: {
        providerId: provider.id,
        category: definition.category,
        modelKey: { not: definition.modelKey },
        isBuiltIn: true,
      },
      data: { isEnabled: false },
    })

    ;(existing ? result.updated : result.created).push(definition.code)
  }

  if (result.created.length || result.updated.length) {
    await invalidatePublicModelCatalogCache()
  }

  return result
}
