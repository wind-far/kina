import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface SystemSiteInfoConfig {
  siteName: string
  siteDescription: string
  siteLogoUrl: string
  siteIconUrl: string
  icpText: string
  icpLink: string
  copyrightText: string
}

export interface SystemPolicyConfig {
  agreementRequired: boolean
  agreementTextPrefix: string
  userAgreementTitle: string
  userAgreementUrl: string
  userAgreementContent: string
  privacyPolicyTitle: string
  privacyPolicyUrl: string
  privacyPolicyContent: string
  aiNoticeTitle: string
  aiNoticeUrl: string
  aiNoticeContent: string
}

export interface SystemLoginSettingsConfig {
  welcomeTitle: string
  welcomeSubtitle: string
}

export interface SystemConfigPayload {
  siteInfo: SystemSiteInfoConfig
  policySettings: SystemPolicyConfig
  loginSettings: SystemLoginSettingsConfig
}

const SYSTEM_CONFIG_PUBLIC_API_PATH = '/api/system-config/public'
const SYSTEM_CONFIG_ADMIN_API_PATH = '/api/system-config/admin'

// 获取前台可见系统设置。
export const getPublicSystemConfig = async () => {
  const response = await fetch(buildApiUrl(SYSTEM_CONFIG_PUBLIC_API_PATH), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<SystemConfigPayload>(response)
}

// 获取后台系统设置。
export const getAdminSystemConfig = async () => {
  const response = await fetch(buildApiUrl(SYSTEM_CONFIG_ADMIN_API_PATH), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<SystemConfigPayload>(response)
}

// 保存后台系统设置。
export const saveAdminSystemConfig = async (payload: SystemConfigPayload) => {
  const response = await fetch(buildApiUrl(SYSTEM_CONFIG_ADMIN_API_PATH), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<SystemConfigPayload>(response, {
    showSuccessMessage: true,
    showErrorMessage: true,
  })
}
