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
