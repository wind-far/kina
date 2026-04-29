// 生成任务接口基础路径。
export const GENERATION_TASKS_BASE_PATH = '/api/generation-tasks'

// 判断当前请求是否命中生成任务接口。
export const isGenerationTasksPath = (requestUrl: string) => {
  return requestUrl === GENERATION_TASKS_BASE_PATH || requestUrl.startsWith(`${GENERATION_TASKS_BASE_PATH}/`)
}
