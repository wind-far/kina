// 网页阅读并发批处理。
// 把 ranked targets 按 RESEARCH_READER_BATCH_SIZE 分块，每块先发 tool_call、再并发 fetch、最后发 tool_result。

import { runWebReader, waitResearchToolGap, type ResearchSearchResultItem } from '../tools'
import { RESEARCH_READER_BATCH_SIZE, chunkQueryPlans } from './batch-utils'
import type { ResearchStage } from '../../../src/shared/research/research-types'
import type { ResearchTaskExecutorContext } from './context'

export type ResearchReaderBatchTarget = {
  callId: string
  url: string
  title: string
  stage: ResearchStage
  snippet?: string
  siteName?: string
  siteIcon?: string
  query?: string
  referenceIndex?: number
  batchIndex?: number
  provider?: string
  searchSources?: ResearchSearchResultItem[]
}

export type ResearchReaderBatchResult = {
  target: ResearchReaderBatchTarget
  readResult?: Awaited<ReturnType<typeof runWebReader>>
  error?: unknown
}

export const runWebReaderBatch = async (input: {
  recordId: string
  targets: ResearchReaderBatchTarget[]
  signal: AbortSignal
  context: ResearchTaskExecutorContext
  toolCallMessage: (target: ResearchReaderBatchTarget) => string
  toolResultMessage: (
    target: ResearchReaderBatchTarget,
    readResult: Awaited<ReturnType<typeof runWebReader>>,
  ) => string
}) => {
  const targetChunks = chunkQueryPlans(input.targets, RESEARCH_READER_BATCH_SIZE)
  const settledResults: ResearchReaderBatchResult[] = []

  for (const chunk of targetChunks) {
    for (const target of chunk) {
      input.context.emitTaskStreamEvent(input.recordId, {
        type: 'tool_call',
        recordId: input.recordId,
        done: false,
        stopped: false,
        stage: target.stage,
        message: input.toolCallMessage(target),
        toolCall: {
          id: target.callId,
          toolName: 'web-reader',
          parameters: {
            url: target.url,
          },
        },
      })
    }

    const settledChunk = await Promise.all(chunk.map(async (target) => {
      try {
        const readResult = await runWebReader({
          url: target.url,
          signal: input.signal,
        })
        return {
          target,
          readResult,
        } satisfies ResearchReaderBatchResult
      } catch (error) {
        return {
          target,
          error,
        } satisfies ResearchReaderBatchResult
      }
    }))

    for (const item of settledChunk) {
      settledResults.push(item)
      if (!item.readResult) {
        input.context.logGenerationTask('research_reader:skip', {
          recordId: input.recordId,
          url: item.target.url,
          errorMessage: item.error instanceof Error ? item.error.message : String(item.error || ''),
        })
        continue
      }

      input.context.emitTaskStreamEvent(input.recordId, {
        type: 'tool_result',
        recordId: input.recordId,
        done: false,
        stopped: false,
        stage: item.target.stage,
        message: input.toolResultMessage(item.target, item.readResult),
        toolResult: {
          id: item.target.callId,
          toolName: 'web-reader',
          preview: {
            url: item.readResult.url,
            title: item.readResult.title,
            excerpt: item.readResult.excerpt,
            content: item.readResult.content.slice(0, 8000),
            siteName: item.target.siteName || (() => {
              try {
                return new URL(item.readResult.url).hostname.replace(/^www\./i, '')
              } catch {
                return ''
              }
            })(),
            siteIcon: item.target.siteIcon || '',
            query: item.target.query || '',
            referenceIndex: item.target.referenceIndex,
            contentLength: item.readResult.contentLength,
            redirected: item.readResult.redirected,
            contentType: item.readResult.contentType,
          },
        },
      })
    }

    await waitResearchToolGap(input.signal)
  }

  return settledResults
}
