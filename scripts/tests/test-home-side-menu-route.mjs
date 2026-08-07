import assert from 'node:assert/strict'
import {
  AGENTIC_ASSETS_CANVAS_PATH,
  isLegacyCanvasWorkflowItem,
  resolveHomeSideMenuRoutePath,
} from '../../src/shared/home-side-menu-route.ts'

const canvasItem = {
  key: 'canvas',
  title: '画布',
  actionType: 'route',
  actionValue: '/canvas',
}
assert.equal(resolveHomeSideMenuRoutePath(canvasItem), AGENTIC_ASSETS_CANVAS_PATH)

const legacyCanvasItem = {
  key: 'workflow',
  title: '画布',
  actionType: 'route',
  actionValue: '/workflow',
}
assert.equal(isLegacyCanvasWorkflowItem(legacyCanvasItem), true)
assert.equal(resolveHomeSideMenuRoutePath(legacyCanvasItem), AGENTIC_ASSETS_CANVAS_PATH)

const workflowItem = {
  key: 'workflow',
  title: '全能设计',
  actionType: 'route',
  actionValue: '/workflow',
}
assert.equal(isLegacyCanvasWorkflowItem(workflowItem), false)
assert.equal(resolveHomeSideMenuRoutePath(workflowItem), '/workflow')

const generateItem = {
  key: 'generate',
  title: '生成',
  actionType: 'route',
  actionValue: '/generate',
}
assert.equal(resolveHomeSideMenuRoutePath(generateItem), '/generate')

console.log('home side menu canvas route regression passed')
