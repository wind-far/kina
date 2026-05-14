// 研究阶段 token 使用量累加器。
// 所有 LLM 调用（含搜索阶段的 grok2api）回报的 usage 都汇聚到此实例，
// 末尾由 executor 一次性发出真实 token_usage 事件。

export interface ResearchModelUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export class ResearchUsageAccumulator {
  private promptTokens = 0

  private completionTokens = 0

  private totalTokens = 0

  private calls = 0

  add(usage: ResearchModelUsage | null | undefined) {
    if (!usage) {
      return
    }

    this.promptTokens += Number.isFinite(usage.promptTokens) ? usage.promptTokens : 0
    this.completionTokens += Number.isFinite(usage.completionTokens) ? usage.completionTokens : 0
    this.totalTokens += Number.isFinite(usage.totalTokens) ? usage.totalTokens : 0
    this.calls += 1
  }

  snapshot(): ResearchModelUsage & { calls: number } {
    return {
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.totalTokens,
      calls: this.calls,
    }
  }

  hasRealUsage() {
    return this.totalTokens > 0
  }
}

// 从 OpenAI 兼容 chat 响应里抽取 usage；缺字段时返回 null。
export const extractResearchUsageFromPayload = (payload: unknown): ResearchModelUsage | null => {
  const usage = (payload && typeof payload === 'object' ? (payload as Record<string, unknown>).usage : null) as
    | Record<string, unknown>
    | null

  if (!usage || typeof usage !== 'object') {
    return null
  }

  const promptTokens = Number(usage.prompt_tokens)
  const completionTokens = Number(usage.completion_tokens)
  const totalTokens = Number(usage.total_tokens)

  if (!Number.isFinite(promptTokens) && !Number.isFinite(completionTokens) && !Number.isFinite(totalTokens)) {
    return null
  }

  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens)
      ? totalTokens
      : (Number.isFinite(promptTokens) ? promptTokens : 0) + (Number.isFinite(completionTokens) ? completionTokens : 0),
  }
}
