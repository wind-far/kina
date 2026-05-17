import prisma from '../db/prisma'

const SENSITIVE_KEY_PATTERN = /(api.?key|secret|token|password|credential|private.?key|encrypted)/i

const readHeaderValue = (req: any, key: string) => {
  const value = req?.headers?.[key] || req?.headers?.[key.toLowerCase()]
  return Array.isArray(value) ? String(value[0] || '').trim() : String(value || '').trim()
}

const readRequestIpAddress = (req: any) => {
  const forwardedFor = readHeaderValue(req, 'x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || ''
  }
  return String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || '').trim()
}

export const sanitizeAdminAuditJson = (value: unknown): unknown => {
  if (value === undefined) {
    return null
  }

  if (typeof value === 'bigint') {
    return Number(value)
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAdminAuditJson(item))
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeAdminAuditJson(item),
    ]),
  )
}

export const recordAdminAuditLog = async (input: {
  req?: any
  operatorUserId: string
  action: string
  targetType: string
  targetId?: string | null
  beforeJson?: unknown
  afterJson?: unknown
}) => {
  try {
    const operatorUserId = String(input.operatorUserId || '').trim()
    const action = String(input.action || '').trim()
    const targetType = String(input.targetType || '').trim()

    if (!operatorUserId || !action || !targetType) {
      return
    }

    await prisma.adminAuditLog.create({
      data: {
        operatorUserId,
        action,
        targetType,
        targetId: String(input.targetId || '').trim() || null,
        beforeJson: sanitizeAdminAuditJson(input.beforeJson) as any,
        afterJson: sanitizeAdminAuditJson(input.afterJson) as any,
        ipAddress: readRequestIpAddress(input.req) || null,
        userAgent: readHeaderValue(input.req, 'user-agent') || null,
      },
    })
  } catch (error) {
    console.error('[admin-audit] failed to record admin audit log', error)
  }
}
