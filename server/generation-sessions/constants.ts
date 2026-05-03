// 生成会话接口基础路径
export const GENERATION_SESSIONS_BASE_PATH = '/api/generation-sessions'

// 判断当前请求是否命中生成会话接口
export const isGenerationSessionsPath = (requestUrl: string) => {
  return requestUrl === GENERATION_SESSIONS_BASE_PATH || requestUrl.startsWith(`${GENERATION_SESSIONS_BASE_PATH}/`)
}
