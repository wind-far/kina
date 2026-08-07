import assert from 'node:assert/strict'
import { prisma } from '../../server/db/prisma.ts'
import {
  createWorkflowDefinition,
  createWorkflowDefinitionVersion,
  deleteWorkflowDefinition,
  publishWorkflowDefinition,
  rollbackWorkflowDefinitionVersion,
} from '../../server/workflow-definitions/service.ts'
import {
  createWorkflowRun,
  retryWorkflowRun,
  stopWorkflowRun,
  updateWorkflowRun,
} from '../../server/workflow-runs/service.ts'
import { enqueueWorkflowRun } from '../../server/workflow-runs/executor.ts'
import { collectWorkflowAssistantContext } from '../../src/shared/workflow-assistant-context.ts'
import { collectWorkflowSubjectReferences } from '../../src/shared/workflow-subject-references.ts'

const waitForRunStatus = async (runId, expectedStatus, attempts = 40) => {
  for (let index = 0; index < attempts; index += 1) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { nodeRuns: true },
    })
    if (run?.status === expectedStatus) return run
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`等待运行状态 ${expectedStatus} 超时`)
}

const user = await prisma.appUser.findFirst({
  where: { username: 'admin' },
  select: { id: true },
})
assert.ok(user?.id, '缺少 admin 测试用户')

let workflowId = ''
let videoWorkflowId = ''
try {
  const initialNodes = [
    { id: 'prompt-1', type: 'text', position: { x: -320, y: 0 }, data: { label: '测试提示词', content: '保留主体外观' } },
    { id: 'subject-1', type: 'image', position: { x: -320, y: 240 }, data: { label: '测试主体', url: '/uploads/subject.png', isSubject: true } },
    {
      id: 'llm-1',
      type: 'llmConfig',
      position: { x: 0, y: 0 },
      data: { label: '测试 LLM 节点', model: '__missing_server_model__' },
    },
  ]
  const initialEdges = [
    { id: 'edge-prompt-llm', source: 'prompt-1', target: 'llm-1', data: { promptOrder: 0 } },
    { id: 'edge-subject-llm', source: 'subject-1', target: 'llm-1', data: { imageRole: 'input_reference' } },
  ]
  const workflow = await createWorkflowDefinition({
    code: `workflow-run-test-${Date.now()}`,
    name: '工作流运行持久化集成测试',
    scene: 'WORKFLOW_CANVAS',
    sourceType: 'VISUAL',
    definitionJson: { scene: 'WORKFLOW_CANVAS', nodeCount: initialNodes.length, edgeCount: initialEdges.length },
    nodesJson: initialNodes,
    edgesJson: initialEdges,
    viewportJson: { x: 0, y: 0, zoom: 1 },
    runtimeConfigJson: { assistantContextSource: 'persisted-graph' },
  }, { currentUserId: user.id })
  workflowId = workflow.definition.id
  const versionId = workflow.definition.currentVersionId
  assert.ok(versionId)

  const persistedV1 = await prisma.workflowDefinitionVersion.findUniqueOrThrow({ where: { id: versionId } })
  assert.deepEqual(collectWorkflowSubjectReferences(persistedV1.nodesJson).map(item => item.id), ['subject-1'])
  assert.deepEqual(
    collectWorkflowAssistantContext(persistedV1.nodesJson, persistedV1.edgesJson, ['llm-1']).map(item => item.id),
    ['llm-1', 'prompt-1', 'subject-1'],
  )

  const version2 = await createWorkflowDefinitionVersion(workflowId, {
    versionName: 'V2 集成测试',
    changeSummary: '验证节点、连线和上下文版本化',
    nodesJson: initialNodes.map(node => node.id === 'prompt-1'
      ? { ...node, data: { ...node.data, content: 'V2 提示词' } }
      : node),
    edgesJson: initialEdges,
    viewportJson: { x: 80, y: 40, zoom: 0.9 },
    runtimeConfigJson: { assistantContextSource: 'persisted-graph' },
  }, { currentUserId: user.id })
  assert.equal(version2.versionNo, 2)
  const publishedV2 = await publishWorkflowDefinition(workflowId, { versionId: version2.id }, { currentUserId: user.id })
  assert.equal(publishedV2.status, 'PUBLISHED')
  const rollbackV3 = await rollbackWorkflowDefinitionVersion(workflowId, versionId, {}, { currentUserId: user.id })
  assert.equal(rollbackV3.versionNo, 3)
  assert.equal(rollbackV3.status, 'DRAFT')
  assert.deepEqual(collectWorkflowSubjectReferences(rollbackV3.nodesJson).map(item => item.id), ['subject-1'])
  assert.equal(rollbackV3.runtimeConfigJson.rollbackFromVersionId, versionId)

  let run = await createWorkflowRun(workflowId, {
    versionId,
    nodes: [{ id: 'llm-1', type: 'llmConfig', label: '测试 LLM 节点' }],
  }, user.id)
  assert.equal(run.status, 'RUNNING')
  assert.equal(run.nodeRuns.length, 1)

  run = await updateWorkflowRun(workflowId, run.id, {
    action: 'NODE_STARTED',
    nodeId: 'llm-1',
  }, user.id)
  assert.equal(run.currentNodeId, 'llm-1')
  assert.equal(run.nodeRuns[0].status, 'RUNNING')

  run = await updateWorkflowRun(workflowId, run.id, {
    action: 'NODE_COMPLETED',
    nodeId: 'llm-1',
    outputJson: { outputContent: 'ok' },
  }, user.id)
  assert.equal(run.completedNodes, 1)

  run = await updateWorkflowRun(workflowId, run.id, {
    action: 'COMPLETED',
    resultJson: { executedNodeIds: ['llm-1'] },
  }, user.id)
  assert.equal(run.status, 'COMPLETED')

  const cancelledRun = await createWorkflowRun(workflowId, {
    versionId,
    nodes: [{ id: 'llm-1', type: 'llmConfig' }],
  }, user.id)
  const stopped = await stopWorkflowRun(workflowId, cancelledRun.id, user.id)
  assert.equal(stopped.status, 'CANCELLED')
  assert.equal(stopped.nodeRuns[0].status, 'CANCELLED')

  const serverRun = await createWorkflowRun(workflowId, {
    versionId,
    executor: 'SERVER',
    nodes: [{ id: 'llm-1', type: 'llmConfig' }],
  }, user.id)
  assert.equal(serverRun.status, 'PENDING')
  assert.equal(serverRun.executor, 'SERVER')
  enqueueWorkflowRun(serverRun.id)
  const failedServerRun = await waitForRunStatus(serverRun.id, 'FAILED')
  assert.equal(failedServerRun.nodeRuns[0].status, 'FAILED')
  assert.match(failedServerRun.errorMessage || '', /未配置可用的对话模型/)
  const retried = await retryWorkflowRun(workflowId, serverRun.id, user.id)
  assert.equal(retried.status, 'PENDING')
  assert.equal(retried.nodeRuns[0].status, 'PENDING')
  const replacementServerRun = await createWorkflowRun(workflowId, {
    versionId,
    executor: 'SERVER',
    nodes: [{ id: 'llm-1', type: 'llmConfig' }],
  }, user.id)
  const interruptedRetry = await prisma.workflowRun.findUniqueOrThrow({
    where: { id: retried.id },
    include: { nodeRuns: true },
  })
  assert.equal(interruptedRetry.status, 'INTERRUPTED')
  assert.equal(interruptedRetry.nodeRuns[0].status, 'CANCELLED')
  const stoppedServerRun = await stopWorkflowRun(workflowId, replacementServerRun.id, user.id)
  assert.equal(stoppedServerRun.status, 'CANCELLED')
  assert.equal(stoppedServerRun.nodeRuns[0].status, 'CANCELLED')

  const videoWorkflow = await createWorkflowDefinition({
    code: `workflow-video-run-test-${Date.now()}`,
    name: '视频工作流运行集成测试',
    scene: 'WORKFLOW_CANVAS',
    sourceType: 'VISUAL',
    definitionJson: { scene: 'WORKFLOW_CANVAS', nodeCount: 1, edgeCount: 0 },
    nodesJson: [{
      id: 'video-1',
      type: 'videoConfig',
      position: { x: 0, y: 0 },
      data: { label: '测试视频节点', model: '__missing_server_video_model__', ratio: '16x9', duration: 5 },
    }],
    edgesJson: [],
    viewportJson: { x: 0, y: 0, zoom: 1 },
  }, { currentUserId: user.id })
  videoWorkflowId = videoWorkflow.definition.id
  const videoRun = await createWorkflowRun(videoWorkflowId, {
    versionId: videoWorkflow.definition.currentVersionId,
    executor: 'SERVER',
    nodes: [{ id: 'video-1', type: 'videoConfig' }],
  }, user.id)
  assert.equal(videoRun.status, 'PENDING')
  enqueueWorkflowRun(videoRun.id)
  const failedVideoRun = await waitForRunStatus(videoRun.id, 'FAILED')
  assert.equal(failedVideoRun.nodeRuns[0].status, 'FAILED')
  assert.match(failedVideoRun.errorMessage || '', /未配置可用的视频模型/)
  const retriedVideoRun = await retryWorkflowRun(videoWorkflowId, videoRun.id, user.id)
  assert.equal(retriedVideoRun.status, 'PENDING')
  assert.equal(retriedVideoRun.nodeRuns[0].status, 'PENDING')
  const stoppedVideoRun = await stopWorkflowRun(videoWorkflowId, retriedVideoRun.id, user.id)
  assert.equal(stoppedVideoRun.status, 'CANCELLED')
  assert.equal(stoppedVideoRun.nodeRuns[0].status, 'CANCELLED')

  await deleteWorkflowDefinition(videoWorkflowId, { currentUserId: user.id })
  videoWorkflowId = ''

  await deleteWorkflowDefinition(workflowId, { currentUserId: user.id })
  workflowId = ''
  console.log('workflow run database integration passed')
} finally {
  if (videoWorkflowId) {
    await prisma.workflowNodeRun.deleteMany({ where: { workflowRun: { workflowId: videoWorkflowId } } })
    await prisma.workflowRun.deleteMany({ where: { workflowId: videoWorkflowId } })
    await prisma.workflowDefinition.deleteMany({ where: { id: videoWorkflowId } })
  }
  if (workflowId) {
    await prisma.workflowNodeRun.deleteMany({ where: { workflowRun: { workflowId } } })
    await prisma.workflowRun.deleteMany({ where: { workflowId } })
    await prisma.workflowDefinition.deleteMany({ where: { id: workflowId } })
  }
  await prisma.$disconnect()
}
