import assert from 'node:assert/strict'
import { resolveGenerationTaskStrategy } from '../../server/generation-tasks/strategy.ts'
import { executeVideoTask } from '../../server/generation-tasks/video-task-executor.ts'
import {
  extractVideoTaskId,
  extractVideoTaskStatus,
  extractVideoUrl,
  materializeVideoOutput,
} from '../../server/generation-tasks/video-upstream.ts'

assert.equal(resolveGenerationTaskStrategy({ type: 'video', prompt: '' }).key, 'video')
assert.equal(extractVideoTaskId({ data: { task_id: 'task-1' } }), 'task-1')
assert.equal(extractVideoTaskStatus({ result: { state: 'SUCCEEDED' } }), 'succeeded')
assert.equal(extractVideoUrl({ data: [{ url: 'https://cdn.example/video.mp4' }] }), 'https://cdn.example/video.mp4')
assert.equal(extractVideoUrl({ output: { video_url: 'https://cdn.example/output.webm' } }), 'https://cdn.example/output.webm')

let downloadAuthorization = ''
const materializedOutput = await materializeVideoOutput({
  videoUrl: 'https://api.example/v1/videos/task-1/content',
  upstreamBaseUrl: 'https://api.example/v1',
  apiKey: 'private-provider-key',
  signal: new AbortController().signal,
}, {
  fetchImpl: async (_url, init) => {
    downloadAuthorization = init?.headers?.Authorization || ''
    return new Response(new Uint8Array([0, 1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'video/mp4' },
    })
  },
  saveBuffer: async input => {
    assert.equal(input.mimeType, 'video/mp4')
    assert.equal(input.category, 'generation/video')
    assert.equal(input.buffer.byteLength, 4)
    return { publicUrl: '/uploads/generation/video/result.mp4' }
  },
})
assert.equal(downloadAuthorization, 'Bearer private-provider-key')
assert.equal(materializedOutput.videoUrl, '/uploads/generation/video/result.mp4')
assert.equal(materializedOutput.mimeType, 'video/mp4')

let crossOriginAuthorization = 'not-requested'
await materializeVideoOutput({
  videoUrl: 'https://cdn.example/output.webm',
  upstreamBaseUrl: 'https://api.example/v1',
  apiKey: 'private-provider-key',
  signal: new AbortController().signal,
}, {
  fetchImpl: async (_url, init) => {
    crossOriginAuthorization = init?.headers?.Authorization || ''
    return new Response(new Uint8Array([0]), {
      status: 200,
      headers: { 'Content-Type': 'video/webm' },
    })
  },
  saveBuffer: async () => ({ publicUrl: '/uploads/generation/video/result.webm' }),
})
assert.equal(crossOriginAuthorization, '')

const runtimeStatuses = []
const progressStages = []
const streamEvents = []
let persistedPayload = null
await executeVideoTask({
  recordId: 'record-1',
  userId: 'user-1',
  type: 'video',
  strategyKey: 'video',
  abortController: new AbortController(),
}, {
  type: 'video',
  prompt: '让主体转身',
  modelKey: 'video-model',
  ratio: '16x9',
  resolution: '720p',
  duration: '5',
  referenceImages: ['/uploads/subject.png'],
  mediaReferences: [{
    mediaType: 'image',
    role: 'first_frame',
    url: '/uploads/subject.png',
  }],
  requestBody: {
    providerId: 'provider-1',
    referenceImageRoles: ['first_frame_image'],
  },
}, {
  syncSharedTaskRuntime: async (_task, status) => runtimeStatuses.push(status),
  ensureTaskNotAborted: async () => undefined,
  emitTaskProgressEvent: (_recordId, event) => progressStages.push(event.stage),
  requestVideoGeneration: async input => {
    assert.equal(input.providerId, 'provider-1')
    assert.deepEqual(input.referenceImageRoles, ['first_frame_image'])
    assert.equal(input.mediaReferences?.[0]?.mediaType, 'image')
    assert.equal(input.mediaReferences?.[0]?.role, 'first_frame')
    assert.equal(input.mediaReferences?.[0]?.url, '/uploads/subject.png')
    return {
      upstreamUrl: 'https://api.example/videos',
      taskId: 'task-1',
      videoUrl: 'https://cdn.example/video.mp4',
    }
  },
  buildInitialRecordPayload: payload => ({ type: payload.type, prompt: payload.prompt }),
  updateGenerationRecord: async (_recordId, payload) => { persistedPayload = payload },
  getGenerationRecordById: async () => ({ id: 'record-1', done: true }),
  emitTaskStreamEvent: (_recordId, event) => streamEvents.push(event),
  logGenerationTask: () => undefined,
})

assert.deepEqual(runtimeStatuses, ['running', 'completed'])
assert.deepEqual(progressStages, ['resolved_provider', 'requesting_upstream', 'syncing_record'])
assert.equal(persistedPayload.done, true)
assert.equal(persistedPayload.outputs[0].outputType, 'video')
assert.equal(persistedPayload.outputs[0].durationSeconds, 5)
assert.equal(streamEvents[0].type, 'completed')

console.log('video generation task regression passed')
