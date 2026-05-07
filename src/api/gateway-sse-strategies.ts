/**
 * AI 网关 SSE 解析策略
 * 统一把不同模型流的解析差异收敛为可复用策略。
 */

import { extractImageUrlsFromText, parseChatChunkText, parseUpstreamStreamChunk } from '@/shared/upstream-stream-parser'
import type { GatewaySseMessage } from './gateway-sse'

export interface GatewaySseStrategyContext<TState, TChunk> {
  message: GatewaySseMessage
  state: TState
  emit: (chunk: TChunk) => void
  close: () => void
}

export interface GatewaySseStrategy<TState, TChunk, TResult> {
  createState: () => TState
  handleMessage: (context: GatewaySseStrategyContext<TState, TChunk>) => void | Promise<void>
  buildResult: (state: TState) => TResult
}

// 用统一策略骨架消费 SSE，并按需向上层吐出增量结果。
export async function* streamGatewaySseWithStrategy<TState, TChunk, TResult>(
  messages: AsyncIterable<GatewaySseMessage>,
  strategy: GatewaySseStrategy<TState, TChunk, TResult>,
) {
  const state = strategy.createState()
  let closed = false

  for await (const message of messages) {
    const emittedChunks: TChunk[] = []
    await strategy.handleMessage({
      message,
      state,
      emit: (chunk) => {
        emittedChunks.push(chunk)
      },
      close: () => {
        closed = true
      },
    })

    for (const chunk of emittedChunks) {
      yield chunk
    }

    if (closed) {
      break
    }
  }

  return strategy.buildResult(state)
}

// 用同一套策略骨架收集最终结果，适合图片这类“只关心最终聚合值”的流。
export const collectGatewaySseWithStrategy = async <TState, TChunk, TResult>(
  messages: AsyncIterable<GatewaySseMessage>,
  strategy: GatewaySseStrategy<TState, TChunk, TResult>,
) => {
  const state = strategy.createState()
  let closed = false

  for await (const message of messages) {
    await strategy.handleMessage({
      message,
      state,
      emit: () => undefined,
      close: () => {
        closed = true
      },
    })

    if (closed) {
      break
    }
  }

  return strategy.buildResult(state)
}

export const createChatTextStreamStrategy = (): GatewaySseStrategy<null, string, void> => ({
  createState: () => null,
  handleMessage: ({ message, emit }) => {
    const content = parseChatChunkText(message.data)
    if (content) {
      emit(content)
    }
  },
  buildResult: () => undefined,
})

interface ImageUrlCollectState {
  fullContent: string
  imageUrls: string[]
}

export const createImageUrlCollectStrategy = (): GatewaySseStrategy<ImageUrlCollectState, never, { data: Array<{ url: string }> }> => ({
  createState: () => ({
    fullContent: '',
    imageUrls: [],
  }),
  handleMessage: ({ message, state }) => {
    const parsedChunk = parseUpstreamStreamChunk(message.data)
    if (parsedChunk.text) {
      state.fullContent += parsedChunk.text
    }
    if (parsedChunk.imageUrls.length) {
      state.imageUrls.push(...parsedChunk.imageUrls)
    }
  },
  buildResult: (state) => {
    state.imageUrls.push(...extractImageUrlsFromText(state.fullContent))

    if (!state.imageUrls.length) {
      throw new Error('未能从响应中提取到图片')
    }

    return {
      data: state.imageUrls.map((url) => ({ url })),
    }
  },
})
