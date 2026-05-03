// 生成记录接口基础路径
export const GENERATION_RECORDS_BASE_PATH = '/api/generation-records'

// 判断当前请求是否命中生成记录接口
export const isGenerationRecordsPath = (requestUrl: string) => {
  return requestUrl === GENERATION_RECORDS_BASE_PATH || requestUrl.startsWith(`${GENERATION_RECORDS_BASE_PATH}/`)
}
