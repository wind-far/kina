export const ADMIN_GENERATION_RECORDS_BASE_PATH = '/api/admin/generation-records'

// 判断请求是否命中后台生成记录接口。
export const isAdminGenerationRecordsPath = (requestPath: string) => {
  return requestPath === ADMIN_GENERATION_RECORDS_BASE_PATH
    || requestPath.startsWith(`${ADMIN_GENERATION_RECORDS_BASE_PATH}/`)
}
