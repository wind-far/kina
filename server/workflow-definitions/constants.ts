export const WORKFLOW_DEFINITIONS_BASE_PATH = '/api/workflows'

export const isWorkflowDefinitionsPath = (requestPath: string) => {
  return requestPath === WORKFLOW_DEFINITIONS_BASE_PATH
    || requestPath.startsWith(`${WORKFLOW_DEFINITIONS_BASE_PATH}/`)
}
