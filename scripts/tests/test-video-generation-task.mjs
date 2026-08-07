import assert from 'node:assert/strict'
import { resolveGenerationTaskStrategy } from '../../server/generation-tasks/strategy.ts'
import { executeVideoTask } from '../../server/generation-tasks/video-task-executor.ts'
import {
  extractVideoTaskId,
  extractVideoTaskStatus,
  extractVideoUrl,
} from '../../server/generation-tasks/video-upstream.ts'

assert.equal(resolveGenerationTaskStrategy({ type: 'video', prompt: '' }).key, 'video')
assert.equal(extractVideoTaskId({ data: { task_id: 'task-1' } }), 'task-1')
assert.equal(extractVideoTaskStatus({ result: { state: 'SUCCEEDED' } }), 'succeeded')
assert.equal(extractVideoUrl({ data: [{ url: 'https://cdn.example/video.mp4' }] }), 'https://cdn.example/video.mp4')
assert.equal(extractVideoUrl({ output: { video_url: 'https://cdn.example/output.webm' } }), 'https://cdn.example/output.webm')

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
