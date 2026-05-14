// 研究搜索供应商策略注册表 + 上游配置解析。
// 策略文件通过 import 此模块的 registerSearchStrategy 自注册；
// tools.ts:runWebSearch 通过 resolveSearchStrategy 根据 provider 名拿到对应实现。

import { prisma } from '../../db/prisma'
import { decryptProviderApiKey } from '../../provider-config/crypto'
import type { ResearchSearchProvider, ResearchSearchStrategy, ResearchSearchUpstream } from './types'

const registry = new Map<ResearchSearchProvider, ResearchSearchStrategy>()

export const registerSearchStrategy = (strategy: ResearchSearchStrategy) => {
  registry.set(strategy.provider, strategy)
}

export const resolveSearchStrategy = (provider: string): ResearchSearchStrategy => {
  const normalized = String(provider || '').trim() as ResearchSearchProvider
  const strategy = registry.get(normalized)
  if (!strategy) {
    throw new Error(`未注册的研究搜索供应商：${provider || '空'}`)
  }
  return strategy
}

export const listRegisteredSearchProviders = (): ResearchSearchProvider[] => {
  return Array.from(registry.keys())
}

// 解析搜索供应商上游配置。
// 与 provider-config/service.ts:resolveGatewayProviderUpstream 解耦：
// - 不强校验 modelKey（仅 grok2api 这类 OpenAI 兼容的需要 model）
// - 端点字段一律读 chatEndpoint（用户在 AiProvider 后台填即可）
export const resolveSearchProviderUpstream = async (input: {
  providerId: string
  modelKey?: string
  requireModel: boolean
}): Promise<ResearchSearchUpstream> => {
  const providerId = String(input.providerId || '').trim()
  if (!providerId) {
    throw new Error('深度搜索需要在后台技能配置中选择搜索供应商')
  }

  const modelKey = String(input.modelKey || '').trim()
  if (input.requireModel && !modelKey) {
    throw new Error('深度搜索需要在后台技能配置中选择搜索模型')
  }

  const provider = await prisma.aiProvider.findUnique({
    where: { id: providerId },
  })

  if (!provider || !provider.isEnabled) {
    throw new Error('搜索供应商不可用或未启用')
  }

  const baseUrl = String(provider.baseUrl || '').trim()
  const endpoint = String(provider.chatEndpoint || '').trim() || '/chat/completions'
  const apiKey = decryptProviderApiKey(provider.apiKeyEncrypted)

  if (!baseUrl || !apiKey) {
    throw new Error('搜索供应商缺少 Base URL 或 API Key')
  }

  return {
    baseUrl,
    endpoint,
    apiKey,
    model: modelKey || undefined,
  }
}
