import assert from 'node:assert/strict'
import { prisma } from '../../server/db/prisma.ts'
import {
  createWorkflowDefinition,
  deleteWorkflowDefinition,
} from '../../server/workflow-definitions/service.ts'
import {
  createWorkflowRun,
  retryWorkflowRun,
  stopWorkflowRun,
  updateWorkflowRun,
} from '../../server/workflow-runs/service.ts'
import { enqueueWorkflowRun } from '../../server/workflow-runs/executor.ts'

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
try {
  const workflow = await createWorkflowDefinition({
    code: `workflow-run-test-${Date.now()}`,
    name: '工作流运行持久化集成测试',
    scene: 'WORKFLOW_CANVAS',
    sourceType: 'VISUAL',
    definitionJson: { scene: 'WORKFLOW_CANVAS', nodeCount: 1, edgeCount: 0 },
    nodesJson: [{
      id: 'llm-1',
      type: 'llmConfig',
      position: { x: 0, y: 0 },
      data: { label: '测试 LLM 节点', model: '__missing_server_model__' },
    }],
    edgesJson: [],
    viewportJson: { x: 0, y: 0, zoom: 1 },
  }, { currentUserId: user.id })
  workflowId = workflow.definition.id
  const versionId = workflow.definition.currentVersionId
  assert.ok(versionId)

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

  await deleteWorkflowDefinition(workflowId, { currentUserId: user.id })
  workflowId = ''
  console.log('workflow run database integration passed')
} finally {
  if (workflowId) {
    await prisma.workflowNodeRun.deleteMany({ where: { workflowRun: { workflowId } } })
    await prisma.workflowRun.deleteMany({ where: { workflowId } })
    await prisma.workflowDefinition.deleteMany({ where: { id: workflowId } })
  }
  await prisma.$disconnect()
}
