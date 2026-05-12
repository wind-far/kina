import { resolveGatewayProviderUpstream } from '../provider-config/service'
import {
  extractChatTextFromJsonPayload,
  fetchWithBurstRateRetry,
} from '../generation-tasks/upstream-helpers'

type ResearchModelRunnerLogger = (stage: string, detail: Record<string, unknown>) => void

const extractJsonBlock = (text: string) => {
  const normalized = String(text || '').trim()
  if (!normalized) {
    return ''
  }

  const fencedMatch = normalized.match(/```json\s*([\s\S]*?)```/i) || normalized.match(/```\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const firstBraceIndex = normalized.indexOf('{')
  const lastBraceIndex = normalized.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return normalized.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  return normalized
}

export const runResearchStageModel = async <TResult>(input: {
  payloadRequestBody: Record<string, unknown> | null | undefined
  modelKey: string
  systemPrompt: string
  userPrompt: string
  signal: AbortSignal
  stage: string
  logGenerationTask: ResearchModelRunnerLogger
}): Promise<TResult> => {
  const providerId = String((input.payloadRequestBody || {}).providerId || '').trim()
  if (!providerId) {
    throw new Error('研究任务缺少 providerId，无法执行阶段 Prompt')
  }

  if (!String(input.modelKey || '').trim()) {
    throw new Error('研究任务缺少 modelKey，无法执行阶段 Prompt')
  }

  const upstream = await resolveGatewayProviderUpstream({
    providerId,
    endpointType: 'chat',
    modelKey: input.modelKey,
  })

  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (upstream.apiKey) {
    headers.set('Authorization', `Bearer ${upstream.apiKey}`)
  }

  const upstreamUrl = `${upstream.baseUrl.replace(/\/+$/, '')}/${upstream.endpoint.replace(/^\/+/, '')}`
  input.logGenerationTask('research_model:request_start', {
    stage: input.stage,
    providerId,
    modelKey: input.modelKey,
    upstreamUrl,
  })

  const requestBody = {
    ...(input.payloadRequestBody || {}),
    model: input.modelKey,
    stream: false,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: input.systemPrompt,
      },
      {
        role: 'user',
        content: input.userPrompt,
      },
    ],
  }
  delete (requestBody as Record<string, unknown>).providerId

  const response = await fetchWithBurstRateRetry({
    url: upstreamUrl,
    signal: input.signal,
    stage: `research_model_${input.stage}`,
    detail: {
      providerId,
      modelKey: input.modelKey,
      stage: input.stage,
    },
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
    logGenerationTask: input.logGenerationTask,
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `研究阶段模型调用失败 (${response.status})`)
  }

  const responseJson = await response.json().catch(() => null)
  const text = extractChatTextFromJsonPayload(responseJson)
  const jsonText = extractJsonBlock(text)
  try {
    return JSON.parse(jsonText) as TResult
  } catch (error) {
    input.logGenerationTask('research_model:parse_failed', {
      stage: input.stage,
      textPreview: jsonText.slice(0, 1200),
    })
    throw new Error(`研究阶段模型输出不是合法 JSON：${error instanceof Error ? error.message : String(error || '')}`)
  }
}
