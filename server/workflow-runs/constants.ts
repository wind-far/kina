export const isWorkflowRunsPath = (requestPath: string) => (
  /^\/api\/workflows\/[^/]+\/runs(?:\/[^/]+(?:\/(?:stop|retry))?)?$/.test(requestPath)
)
