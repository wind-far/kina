import { requireCurrentSessionUser } from '../auth/session'
import { sendJson } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { GENERATION_TASKS_BASE_PATH } from './constants'
import { getGenerationTaskRecord, startGenerationTask, stopGenerationTask, subscribeGenerationTaskStream } from './service'
import { readGenerationTaskBody, sendGenerationTaskError } from './shared'

// 统一输出生成任务请求异常，便于排查启动、轮询和停止链路。
const logGenerationTaskRequestError = (detail: Record<string, unknown>) => {
  console.error('[generation-tasks][request-error]', JSON.stringify(detail))
}

// 处理生成任务的创建、查询与停止请求。
export const handleGenerationTasksRequest = async (req: any, res: any) => {
  const requestUrl = String(req.url || '').split('?')[0]
  const taskPath = requestUrl.startsWith(`${GENERATION_TASKS_BASE_PATH}/`)
    ? decodeURIComponent(requestUrl.slice(GENERATION_TASKS_BASE_PATH.length + 1))
    : ''
  const taskId = taskPath.endsWith('/stop')
    ? taskPath.slice(0, -('/stop'.length))
    : taskPath.endsWith('/events')
      ? taskPath.slice(0, -('/events'.length))
      : taskPath

  let currentUser: { id?: string | null } | null = null
  let payloadSummary: Record<string, unknown> | null = null

  try {
    if (!isPrismaConfigured()) {
      sendGenerationTaskError(res, 500, '缺少 DATABASE_URL，暂时无法使用生成任务。')
      return
    }

    currentUser = await requireCurrentSessionUser(req, res)
    if (!currentUser?.id) {
      return
    }

    if (req.method === 'POST' && requestUrl === GENERATION_TASKS_BASE_PATH) {
      const payload = await readGenerationTaskBody(req)
      payloadSummary = {
        sessionId: payload?.sessionId || null,
        type: payload?.type || null,
        referenceImageCount: Array.isArray(payload?.referenceImages) ? payload.referenceImages.length : 0,
        hasRequestBody: Boolean(payload?.requestBody),
      }
      const data = await startGenerationTask(payload, currentUser.id)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && taskId) {
      if (requestUrl === `${GENERATION_TASKS_BASE_PATH}/${encodeURIComponent(taskId)}/events`) {
        await subscribeGenerationTaskStream(taskId, currentUser.id, res)
        return
      }
      const data = await getGenerationTaskRecord(taskId, currentUser.id)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && requestUrl === `${GENERATION_TASKS_BASE_PATH}/${encodeURIComponent(taskId)}/stop`) {
      const data = await stopGenerationTask(taskId, currentUser.id)
      sendJson(res, 200, { data })
      return
    }

    sendGenerationTaskError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    logGenerationTaskRequestError({
      method: req.method,
      requestUrl,
      taskId: taskId || null,
      currentUserId: currentUser?.id || null,
      payloadSummary,
      errorMessage: error?.message || '处理生成任务失败',
      errorStack: error?.stack || null,
    })
    sendGenerationTaskError(res, 500, error?.message || '处理生成任务失败')
  }
}
