export type WorkflowNodeAddMenuSide = 'left' | 'right'

export const WORKFLOW_NODE_ADD_MENU_WIDTH = 213
export const WORKFLOW_NODE_ADD_MENU_HEIGHT = 312
export const WORKFLOW_NODE_ADD_MENU_GAP = 16
export const WORKFLOW_NODE_ADD_MENU_MARGIN = 8

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

export const resolveWorkflowNodeAddMenuPlacement = ({
  screen,
  side,
  viewportWidth,
  viewportHeight,
}: {
  screen: { x: number; y: number }
  side: WorkflowNodeAddMenuSide
  viewportWidth: number
  viewportHeight: number
}) => {
  const maxLeft = viewportWidth - WORKFLOW_NODE_ADD_MENU_WIDTH - WORKFLOW_NODE_ADD_MENU_MARGIN
  const candidateFor = (candidateSide: WorkflowNodeAddMenuSide) => {
    const preferredLeft = candidateSide === 'right'
      ? screen.x + WORKFLOW_NODE_ADD_MENU_GAP
      : screen.x - WORKFLOW_NODE_ADD_MENU_GAP - WORKFLOW_NODE_ADD_MENU_WIDTH
    const left = clamp(preferredLeft, WORKFLOW_NODE_ADD_MENU_MARGIN, maxLeft)
    const edgeX = candidateSide === 'right' ? left : left + WORKFLOW_NODE_ADD_MENU_WIDTH
    return { side: candidateSide, left, edgeX, distance: Math.abs(edgeX - screen.x) }
  }
  const preferred = candidateFor(side)
  const alternate = candidateFor(side === 'right' ? 'left' : 'right')
  const horizontal = alternate.distance < preferred.distance ? alternate : preferred
  const top = clamp(
    screen.y - 36,
    WORKFLOW_NODE_ADD_MENU_MARGIN,
    viewportHeight - WORKFLOW_NODE_ADD_MENU_HEIGHT - WORKFLOW_NODE_ADD_MENU_MARGIN,
  )

  return {
    left: horizontal.left,
    top,
    side: horizontal.side,
    edge: {
      x: horizontal.edgeX,
      y: clamp(screen.y, top + 20, top + WORKFLOW_NODE_ADD_MENU_HEIGHT - 20),
    },
  }
}
