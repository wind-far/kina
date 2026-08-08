/**
 * 画布助手会话必须按项目隔离。source 会同时作为服务端会话与生成记录的
 * 归属键；项目 ID 由服务端生成，不包含凭据或用户隐私信息。
 */
export const CANVAS_ASSISTANT_SOURCE = 'canvas-assistant'

export const buildCanvasAssistantSessionSource = (projectId?: string | null) => {
  const normalizedProjectId = String(projectId || '').trim()
  return normalizedProjectId
    ? `${CANVAS_ASSISTANT_SOURCE}:${normalizedProjectId}`
    : CANVAS_ASSISTANT_SOURCE
}
