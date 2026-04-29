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
  generationProgressSettings: {
    enabled: true,
    stages: [
      { key: 'queued', label: '排队中', percent: 5, showPercent: true, description: '任务已创建，等待服务端执行' },
      { key: 'resolved_provider', label: '准备中', percent: 12, showPercent: true, description: '已解析厂商与模型配置' },
      { key: 'requesting_upstream', label: '生成中', percent: 35, showPercent: true, description: '已开始请求上游图片模型' },
      { key: 'receiving_upstream_result', label: '解析中', percent: 72, showPercent: true, description: '上游已返回结果，正在解析图片内容' },
      { key: 'syncing_record', label: '同步中', percent: 92, showPercent: true, description: '图片结果已解析，正在同步记录与资源信息' },
      { key: 'completed', label: '已完成', percent: 100, showPercent: false, description: '任务执行完成' },
      { key: 'failing', label: '收尾中', percent: 96, showPercent: true, description: '任务执行异常，正在写入失败状态' },
      { key: 'failed', label: '生成失败', percent: 100, showPercent: false, description: '任务执行失败' },
      { key: 'stopping', label: '停止中', percent: 98, showPercent: true, description: '任务已收到停止指令，正在收口状态' },
      { key: 'stopped', label: '已停止', percent: 100, showPercent: false, description: '任务已停止' },
    ],
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
  const generationProgressSettings = readPlainObject(input?.generationProgressSettings || loginSettings.generationProgressSettings)
  const defaultStageMap = new Map(
    defaults.generationProgressSettings.stages.map(item => [item.key, item]),
  )
  const normalizedStages = defaults.generationProgressSettings.stages.map((defaultStage) => {
    const matchedStage = Array.isArray(generationProgressSettings.stages)
      ? generationProgressSettings.stages.find((item: any) => String(item?.key || '').trim() === defaultStage.key)
      : null

    return {
      key: defaultStage.key,
      label: String(matchedStage?.label || defaultStage.label).trim(),
      percent: Number.isFinite(Number(matchedStage?.percent))
        ? Math.max(0, Math.min(100, Number(matchedStage?.percent)))
        : defaultStage.percent,
      showPercent: matchedStage?.showPercent !== false ? defaultStage.showPercent !== false || matchedStage?.showPercent === true : false,
      description: String(matchedStage?.description || defaultStage.description).trim(),
    }
  })

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
    generationProgressSettings: {
      enabled: generationProgressSettings.enabled !== false,
      stages: normalizedStages.filter(item => defaultStageMap.has(item.key)),
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
    generationProgressSettings: readPlainObject(readPlainObject(row.login_settings_json).generationProgressSettings),
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
    JSON.stringify({
      ...normalized.loginSettings,
      generationProgressSettings: normalized.generationProgressSettings,
    }),
  )

  return normalized
}
