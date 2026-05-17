export const ADMIN_AUDIT_LOGS_BASE_PATH = '/api/admin/audit-logs'

export const isAdminAuditLogsPath = (requestPath: string) => {
  return requestPath === ADMIN_AUDIT_LOGS_BASE_PATH
    || requestPath.startsWith(`${ADMIN_AUDIT_LOGS_BASE_PATH}/`)
}
