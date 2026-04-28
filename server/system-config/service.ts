import crypto from 'node:crypto'
import prisma from '../db/prisma'
import type { SystemConfigPayload } from './shared'

const SYSTEM_CONFIG_CODE = 'DEFAULT'

const createDefaultSystemConfig = () => ({
  siteInfo: {
    siteName: 'Canana',
    siteDescription: '',
    siteLogoUrl: '',
    siteIconUrl: '',
    icpText: '',
    icpLink: '',
    copyrightText: '',
  },
  policySettings: {
    agreementRequired: true,
    agreementTextPrefix: '已阅读并同意',
    userAgreementTitle: '用户服务协议',
    userAgreementUrl: '',
    userAgreementContent: '',
    privacyPolicyTitle: '隐私政策',
    privacyPolicyUrl: '',
    privacyPolicyContent: '',
    aiNoticeTitle: 'AI功能使用须知',
    aiNoticeUrl: '',
    aiNoticeContent: '',
  },
  loginSettings: {
    welcomeTitle: '欢迎登录',
    welcomeSubtitle: '',
  },
})

const readPlainObject = (value: unknown) => {
  if (!value) {
    return {}
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : {}
    } catch {
      return {}
    }
  }

  return value && typeof value === 'object' ? value as Record<string, any> : {}
}

const normalizeSystemConfig = (input?: SystemConfigPayload | null) => {
  const defaults = createDefaultSystemConfig()
  const siteInfo = readPlainObject(input?.siteInfo)
  const policySettings = readPlainObject(input?.policySettings)
  const loginSettings = readPlainObject(input?.loginSettings)

  return {
    siteInfo: {
      siteName: String(siteInfo.siteName || defaults.siteInfo.siteName).trim(),
      siteDescription: String(siteInfo.siteDescription || '').trim(),
      siteLogoUrl: String(siteInfo.siteLogoUrl || '').trim(),
      siteIconUrl: String(siteInfo.siteIconUrl || '').trim(),
      icpText: String(siteInfo.icpText || '').trim(),
      icpLink: String(siteInfo.icpLink || '').trim(),
      copyrightText: String(siteInfo.copyrightText || '').trim(),
    },
    policySettings: {
      agreementRequired: policySettings.agreementRequired !== false,
      agreementTextPrefix: String(policySettings.agreementTextPrefix || defaults.policySettings.agreementTextPrefix).trim(),
      userAgreementTitle: String(policySettings.userAgreementTitle || defaults.policySettings.userAgreementTitle).trim(),
      userAgreementUrl: String(policySettings.userAgreementUrl || '').trim(),
      userAgreementContent: String(policySettings.userAgreementContent || '').trim(),
      privacyPolicyTitle: String(policySettings.privacyPolicyTitle || defaults.policySettings.privacyPolicyTitle).trim(),
      privacyPolicyUrl: String(policySettings.privacyPolicyUrl || '').trim(),
      privacyPolicyContent: String(policySettings.privacyPolicyContent || '').trim(),
      aiNoticeTitle: String(policySettings.aiNoticeTitle || defaults.policySettings.aiNoticeTitle).trim(),
      aiNoticeUrl: String(policySettings.aiNoticeUrl || '').trim(),
      aiNoticeContent: String(policySettings.aiNoticeContent || '').trim(),
    },
    loginSettings: {
      welcomeTitle: String(loginSettings.welcomeTitle || defaults.loginSettings.welcomeTitle).trim(),
      welcomeSubtitle: String(loginSettings.welcomeSubtitle || '').trim(),
    },
  }
}

const findSystemConfigRow = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT * FROM system_settings WHERE code = ? LIMIT 1',
    SYSTEM_CONFIG_CODE,
  )

  return Array.isArray(rows) && rows[0] ? rows[0] : null
}

// 读取后台系统设置。
export const getAdminSystemConfig = async () => {
  const row = await findSystemConfigRow()
  if (!row) {
    return createDefaultSystemConfig()
  }

  return normalizeSystemConfig({
    siteInfo: readPlainObject(row.site_info_json),
    policySettings: readPlainObject(row.policy_json),
    loginSettings: readPlainObject(row.login_settings_json),
  })
}

// 读取前台可见系统设置。
export const getPublicSystemConfig = async () => {
  return getAdminSystemConfig()
}

// 保存后台系统设置。
export const saveAdminSystemConfig = async (payload: SystemConfigPayload) => {
  const normalized = normalizeSystemConfig(payload)
  const existing = await findSystemConfigRow()
  const rowId = existing?.id ? String(existing.id) : crypto.randomUUID()

  await prisma.$executeRawUnsafe(
    `INSERT INTO system_settings (
      id,
      code,
      site_info_json,
      policy_json,
      login_settings_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      site_info_json = VALUES(site_info_json),
      policy_json = VALUES(policy_json),
      login_settings_json = VALUES(login_settings_json),
      updated_at = NOW()`,
    rowId,
    SYSTEM_CONFIG_CODE,
    JSON.stringify(normalized.siteInfo),
    JSON.stringify(normalized.policySettings),
    JSON.stringify(normalized.loginSettings),
  )

  return normalized
}
