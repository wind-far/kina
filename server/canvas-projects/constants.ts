export const CANVAS_PROJECTS_BASE_PATH = '/api/canvas'

export const isCanvasProjectsPath = (requestPath: string) => {
  return requestPath === CANVAS_PROJECTS_BASE_PATH
    || requestPath.startsWith(`${CANVAS_PROJECTS_BASE_PATH}/`)
}
