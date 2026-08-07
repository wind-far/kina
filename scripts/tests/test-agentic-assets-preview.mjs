import assert from 'node:assert/strict'
import { extractWorkflowPreviewImages } from '../../src/views/agentic-assets-canvas/workflow-preview.ts'

const buildWorkflow = (overrides = {}) => ({
  id: 'workflow-1',
  userId: 'user-1',
  code: 'workflow-1',
  name: '未命名工作流',
  description: null,
  category: null,
  scene: 'WORKFLOW_CANVAS',
  sourceType: 'USER',
  status: 'DRAFT',
  currentVersionId: 'version-1',
  latestVersionNo: 1,
  isBuiltIn: false,
  isEnabled: true,
  sortOrder: 0,
  tagsJson: null,
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
  currentVersion: {
    id: 'version-1',
    workflowId: 'workflow-1',
    createdBy: 'user-1',
    versionNo: 1,
    versionName: null,
    changeSummary: null,
    status: 'DRAFT',
    definitionJson: null,
    nodesJson: [],
    edgesJson: [],
    viewportJson: null,
    inputSchemaJson: null,
    outputSchemaJson: null,
    runtimeConfigJson: null,
    publishedAt: null,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
  },
  latestVersion: null,
  versionCount: 1,
  ...overrides,
})

const workflow = buildWorkflow({
  tagsJson: { coverUrl: '/uploads/workflow-cover.png' },
  currentVersion: {
    ...buildWorkflow().currentVersion,
    nodesJson: [
      {
        id: 'image-1',
        type: 'image',
        data: {
          url: '/uploads/primary.png',
          batchChildren: [
            { id: 'child-1', url: '/uploads/primary.png' },
            { id: 'child-2', url: '/uploads/alternate.png' },
          ],
        },
      },
      {
        id: 'video-1',
        type: 'video',
        data: {
          url: '/uploads/movie.mp4',
          posterUrl: '/uploads/movie-poster.jpg',
        },
      },
      {
        id: 'legacy-output',
        type: 'custom-output',
        data: {
          thumbnailUrl: '/uploads/legacy-thumb.webp',
          url: '/uploads/should-not-be-picked.png',
        },
      },
    ],
  },
})

assert.deepEqual(extractWorkflowPreviewImages(workflow), [
  '/uploads/workflow-cover.png',
  '/uploads/primary.png',
  '/uploads/alternate.png',
  '/uploads/movie-poster.jpg',
])

const base64Workflow = buildWorkflow({
  currentVersion: {
    ...buildWorkflow().currentVersion,
    nodesJson: [{ id: 'image-base64', type: 'image', data: { base64: 'YWJj' } }],
  },
})

assert.deepEqual(extractWorkflowPreviewImages(base64Workflow), [
  'data:image/png;base64,YWJj',
])

console.log('agentic assets preview regression passed')
