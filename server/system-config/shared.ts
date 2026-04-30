import { readJsonBody, sendJson } from '../ai-gateway/shared'

export interface SystemSiteInfoPayload {
  siteName?: string
  siteDescription?: string
  siteLogoUrl?: string
  siteIconUrl?: string
  icpText?: string
  icpLink?: string
  copyrightText?: string
}

export interface SystemPolicyPayload {
  agreementRequired?: boolean
  agreementTextPrefix?: string
  userAgreementTitle?: string
  userAgreementUrl?: string
  userAgreementContent?: string
  privacyPolicyTitle?: string
  privacyPolicyUrl?: string
  privacyPolicyContent?: string
  aiNoticeTitle?: string
  aiNoticeUrl?: string
  aiNoticeContent?: string
}

export interface SystemLoginSettingsPayload {
  welcomeTitle?: string
  welcomeSubtitle?: string
  generationProgressSettings?: SystemGenerationProgressSettingsPayload
}

export interface SystemConversationModeOptionPayload {
  value?: string
  label?: string
}

export interface SystemConversationBasicRulesPayload {
  defaultSessionTitle?: string
  newSessionTitlePrefix?: string
  sessionTitleMaxLength?: number
  defaultSortMode?: string
  allowDeleteDefaultSession?: boolean
  allowAdminRename?: boolean
  allowAdminDelete?: boolean
}

export interface SystemConversationListDisplayPayload {
  defaultPageSize?: number
  showUserInfo?: boolean
  showCoverImage?: boolean
  showLatestPrompt?: boolean
  showStatusStats?: boolean
  showSessionId?: boolean
  showLastRecordTime?: boolean
  enableUserMasking?: boolean
}

export interface SystemConversationEntryHeroPayload {
  enabled?: boolean
  title?: string
  subtitle?: string
}

export interface SystemConversationEntryInputPayload {
  placeholder?: string
  autoResize?: boolean
  minRows?: number
  maxWidth?: number
}

export interface SystemConversationEntryModePayload {
  enabled?: boolean
  defaultMode?: string
  options?: SystemConversationModeOptionPayload[]
}

export interface SystemConversationEntryModelSelectorPayload {
  enabled?: boolean
  defaultModelKey?: string
  allowedModelKeys?: string[]
  allowSkillOverride?: boolean
}

export interface SystemConversationEntryAssistantSelectorPayload {
  enabled?: boolean
  defaultAssistantKey?: string
  allowedAssistantKeys?: string[]
}

export interface SystemConversationEntryActionItemPayload {
  visible?: boolean
  defaultEnabled?: boolean
}

export interface SystemConversationEntryActionsPayload {
  auto?: SystemConversationEntryActionItemPayload
  inspiration?: SystemConversationEntryActionItemPayload
  creativeDesign?: SystemConversationEntryActionItemPayload
}

export interface SystemConversationEntryDisplayPayload {
  hero?: SystemConversationEntryHeroPayload
  input?: SystemConversationEntryInputPayload
  mode?: SystemConversationEntryModePayload
  modelSelector?: SystemConversationEntryModelSelectorPayload
  assistantSelector?: SystemConversationEntryAssistantSelectorPayload
  actions?: SystemConversationEntryActionsPayload
}

export interface SystemConversationManagementPolicyPayload {
  allowBatchDelete?: boolean
  allowExportSessions?: boolean
  autoCleanupEnabled?: boolean
  emptySessionRetentionDays?: number
  completedSessionRetentionDays?: number
  failedSessionRetentionDays?: number
  deleteCascadeRecords?: boolean
}

export interface SystemConversationSettingsPayload {
  basicRules?: SystemConversationBasicRulesPayload
  listDisplay?: SystemConversationListDisplayPayload
  entryDisplay?: SystemConversationEntryDisplayPayload
  managementPolicy?: SystemConversationManagementPolicyPayload
}

export interface SystemGenerationProgressStagePayload {
  key?: string
  label?: string
  percent?: number
  showPercent?: boolean
  description?: string
}

export interface SystemGenerationProgressSettingsPayload {
  enabled?: boolean
  stages?: SystemGenerationProgressStagePayload[]
}

export interface SystemConfigPayload {
  siteInfo?: SystemSiteInfoPayload
  policySettings?: SystemPolicyPayload
  loginSettings?: SystemLoginSettingsPayload
  generationProgressSettings?: SystemGenerationProgressSettingsPayload
  conversationSettings?: SystemConversationSettingsPayload
}

// 读取系统设置请求体。
export const readSystemConfigBody = async (req: any) => {
  const payload = await readJsonBody(req)
  return payload as SystemConfigPayload
}

// 返回统一的系统设置错误。
export const sendSystemConfigError = (res: any, statusCode: number, message: string) => {
  sendJson(res, statusCode, {
    message,
    error: {
      type: 'system_config_error',
      message,
    },
  })
}
