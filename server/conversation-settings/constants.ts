// 后台会话配置接口。
export const ADMIN_CONVERSATION_SETTINGS_PATH = '/api/admin/conversation-settings'

// 判断当前请求是否命中后台会话配置接口。
export const isAdminConversationSettingsPath = (requestPath: string) => {
  return requestPath === ADMIN_CONVERSATION_SETTINGS_PATH
}
