import type { WorkflowDefinitionCreatePayload } from '@/views/workflow/api/definitions'

const buildUntitledName = (label: string, now: Date) => (
  `未命名${label} ${now.toLocaleTimeString('zh-CN', { hour12: false })}`
)

/** 工作流入口创建的首个可持久化空白版本。 */
export const buildBlankWorkflowProjectPayload = (now = new Date()): WorkflowDefinitionCreatePayload => ({
  name: buildUntitledName('项目', now),
  description: null,
  category: '创作区',
  scene: 'WORKFLOW_CANVAS',
  sourceType: 'VISUAL',
  status: 'DRAFT',
  versionName: '初始版本',
  changeSummary: '新建空白工作流',
  definitionJson: {
    scene: 'WORKFLOW_CANVAS',
    nodeCount: 0,
    edgeCount: 0,
  },
  nodesJson: [],
  edgesJson: [],
  viewportJson: {
    x: 100,
    y: 50,
    zoom: 0.8,
  },
  runtimeConfigJson: {
    savedAt: now.toISOString(),
    backgroundMode: 'dots',
    showImageInfo: false,
    chatSessions: [],
    activeChatId: null,
  },
})

/** 画布入口创建的首个可持久化空白版本。 */
export const buildBlankCanvasProjectPayload = (now = new Date()): WorkflowDefinitionCreatePayload => ({
  name: buildUntitledName('项目', now),
  description: null,
  category: '创作区',
  scene: 'INFINITE_CANVAS',
  sourceType: 'VISUAL',
  status: 'DRAFT',
  versionName: '初始版本',
  changeSummary: '新建空白画布',
  definitionJson: {
    scene: 'INFINITE_CANVAS',
    schemaVersion: 2,
    nodeCount: 0,
    edgeCount: 0,
  },
  nodesJson: [],
  edgesJson: [],
  viewportJson: {
    x: 0,
    y: 0,
    zoom: 1,
  },
  runtimeConfigJson: {
    savedAt: now.toISOString(),
    layout: 'freeform',
  },
})
