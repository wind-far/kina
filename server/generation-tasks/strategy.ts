import type { GenerationTaskStartPayload } from './shared'

export type GenerationTaskStrategyKey = 'image' | 'agent-chat' | 'agent-workspace'

export interface GenerationTaskStrategy {
  key: GenerationTaskStrategyKey
  matches: (payload: GenerationTaskStartPayload) => boolean
}

const strategies: GenerationTaskStrategy[] = [
  {
    key: 'image',
    matches: payload => String(payload.type || '').trim() === 'image',
  },
  {
    key: 'agent-workspace',
    matches: payload => String(payload.type || '').trim() === 'agent'
      && Boolean(String(payload.skill || '').trim())
      && String(payload.skill || '').trim() !== 'general',
  },
  {
    key: 'agent-chat',
    matches: payload => String(payload.type || '').trim() === 'agent',
  },
]

export const resolveGenerationTaskStrategy = (payload: GenerationTaskStartPayload): GenerationTaskStrategy => {
  const strategy = strategies.find(item => item.matches(payload))
  if (!strategy) {
    throw new Error('未找到可用的生成任务策略')
  }
  return strategy
}
