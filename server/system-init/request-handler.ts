import { sendJson } from '../ai-gateway/shared'
import { isPrismaConfigured } from '../db/prisma'
import { SYSTEM_INIT_INITIALIZE_PATH, SYSTEM_INIT_STATUS_PATH } from './constants'
import { buildSystemInitSessionCookie, getSystemInitStatus, initializeSystem } from './service'
import { readSystemInitBody, sendSystemInitError, type SystemInitPayload } from './shared'

// 推导请求来源 IP。
const readRequesterIp = (req: any) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').trim()
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return String(req.socket?.remoteAddress || '').trim()
}

// 处理首次安装初始化请求。
export const handleSystemInitRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendSystemInitError(res, 500, '缺少 DATABASE_URL，暂时无法使用安装初始化功能')
      return
    }

    const requestPath = String(req.url || '').split('?')[0]

    if (req.method === 'GET' && requestPath === SYSTEM_INIT_STATUS_PATH) {
      const data = await getSystemInitStatus()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && requestPath === SYSTEM_INIT_INITIALIZE_PATH) {
      const payload = await readSystemInitBody<SystemInitPayload>(req)
      const data = await initializeSystem({
        ...payload,
        requesterIp: readRequesterIp(req),
        userAgent: String(req.headers['user-agent'] || '').trim(),
      })

      res.setHeader('Set-Cookie', buildSystemInitSessionCookie(data.token))
      sendJson(res, 200, {
        data,
        message: '系统初始化完成',
      })
      return
    }

    sendSystemInitError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendSystemInitError(res, 500, error?.message || '处理安装初始化失败')
  }
}
