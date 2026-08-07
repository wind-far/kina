export const AGENTIC_ASSETS_CANVAS_PATH = '/agentic-assets-canvas'

export interface HomeSideMenuRouteItem {
  key: string
  title?: string
  actionType: string
  actionValue: string
}

// 旧版配置曾用 workflow key 承载“画布”入口；继续识别该形态，避免升级后跳回旧工作流页。
export const isLegacyCanvasWorkflowItem = (item: Pick<HomeSideMenuRouteItem, 'key' | 'title' | 'actionValue'>) => (
  item.key === 'workflow'
  && (item.title === '画布' || item.actionValue === AGENTIC_ASSETS_CANVAS_PATH)
)

export const resolveHomeSideMenuRoutePath = (item: HomeSideMenuRouteItem) => {
  if (item.actionType !== 'route') {
    return item.actionValue
  }

  if (item.key === 'canvas' || isLegacyCanvasWorkflowItem(item)) {
    return AGENTIC_ASSETS_CANVAS_PATH
  }

  return item.actionValue
}
