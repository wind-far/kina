import assert from 'node:assert/strict'
import { legacyImagesToSkillMediaReferences, normalizeSkillMediaReferences } from '../../src/shared/skill-runtime.ts'
import { resolveGenerationTaskStrategy } from '../../server/generation-tasks/strategy.ts'
import { buildMiniMaxH3MediaPayload } from '../../server/generation-tasks/video-upstream.ts'
import { MINIMAX_H3_SOURCE } from '../../server/skill-config/source-service.ts'
import { isSkillConfigPath } from '../../server/skill-config/constants.ts'

assert.deepEqual(legacyImagesToSkillMediaReferences(['/uploads/a.png', '', null]), [{
  id: 'legacy-image-1', mediaType: 'image', role: 'reference', url: '/uploads/a.png',
}])

assert.deepEqual(normalizeSkillMediaReferences([
  { mediaType: 'image', role: 'first_frame', url: 'https://cdn.example/first.png', startSeconds: -1 },
  { mediaType: 'audio', role: 'audio_reference', url: 'https://cdn.example/music.mp3', startSeconds: 2, endSeconds: 4 },
  { mediaType: 'unknown', role: 'reference', url: 'https://cdn.example/skip' },
]), [
  {
    id: 'media-1', mediaType: 'image', role: 'first_frame', url: 'https://cdn.example/first.png',
    sourceNodeId: undefined, label: undefined, startSeconds: undefined, endSeconds: undefined, mimeType: undefined,
  },
  {
    id: 'media-2', mediaType: 'audio', role: 'audio_reference', url: 'https://cdn.example/music.mp3',
    sourceNodeId: undefined, label: undefined, startSeconds: 2, endSeconds: 4, mimeType: undefined,
  },
])

assert.equal(resolveGenerationTaskStrategy({ type: 'video', prompt: '', requestMode: 'video-generation' }).key, 'video')
assert.equal(MINIMAX_H3_SOURCE.packageKey, 'minimax-h3')
assert.equal(MINIMAX_H3_SOURCE.complianceJson.requiresAcceptance, true)
assert.equal(isSkillConfigPath('/api/skill-config/sources'), true)
assert.equal(isSkillConfigPath('/api/skill-config/sources/minimax-h3/sync'), true)
assert.deepEqual(buildMiniMaxH3MediaPayload([
  { mediaType: 'image', role: 'first_frame', url: 'https://cdn.example/first.png' },
  { mediaType: 'image', role: 'last_frame', url: 'https://cdn.example/last.png' },
]), {
  mode: 'fl2va',
  firstFrame: 'https://cdn.example/first.png',
  lastFrame: 'https://cdn.example/last.png',
  references: { images: [], videos: [], audios: [] },
})
assert.equal(buildMiniMaxH3MediaPayload([
  { mediaType: 'audio', role: 'audio_reference', url: 'https://cdn.example/music.mp3' },
  { mediaType: 'image', role: 'subject', url: 'https://cdn.example/subject.png' },
]).mode, 'ref2va')
console.log('skill runtime media contract regression passed')
