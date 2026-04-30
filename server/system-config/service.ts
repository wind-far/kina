import crypto from 'node:crypto'
import prisma from '../db/prisma'
import type {
  SystemConfigPayload,
  SystemConversationModeOptionPayload,
  SystemConversationSettingsPayload,
} from './shared'

const SYSTEM_CONFIG_CODE = 'DEFAULT'

const DEFAULT_CREATION_MODE_OPTIONS = [
  { value: 'agent', label: 'Agent 模式' },
  { value: 'image', label: '图片生成' },
  { value: 'video', label: '视频生成' },
  { value: 'digital-human', label: '数字人' },
  { value: 'motion', label: '动作模仿' },
]

const DEFAULT_ASSISTANT_ALLOWLIST = [
  'general',
  'story-short',
  'marketing-video',
  'ecommerce-pack',
  'poster-design',
  'brand-design',
]

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
  conversationSettings: {
    basicRules: {
      defaultSessionTitle: '新对话',
      newSessionTitlePrefix: '新对话',
      sessionTitleMaxLength: 120,
      defaultSortMode: 'lastRecordAt_desc',
      allowDeleteDefaultSession: false,
      allowAdminRename: true,
      allowAdminDelete: true,
    },
    listDisplay: {
      defaultPageSize: 12,
      showUserInfo: true,
      showCoverImage: true,
      showLatestPrompt: true,
      showStatusStats: true,
      showSessionId: true,
      showLastRecordTime: true,
      enableUserMasking: false,
    },
    entryDisplay: {
      hero: {
        enabled: true,
        title: '你好，想创作什么？',
        subtitle: '输入一句需求，快速开始图片、视频或智能创作',
      },
      input: {
        placeholder: '说说今天想做点什么',
        autoResize: true,
        minRows: 4,
        maxWidth: 960,
      },
      mode: {
        enabled: true,
        defaultMode: 'agent',
        options: DEFAULT_CREATION_MODE_OPTIONS.map(option => ({ ...option })),
      },
      modelSelector: {
        enabled: true,
        defaultModelKey: '',
        allowedModelKeys: [],
        allowSkillOverride: true,
      },
      assistantSelector: {
        enabled: true,
        defaultAssistantKey: 'general',
        allowedAssistantKeys: [...DEFAULT_ASSISTANT_ALLOWLIST],
      },
      actions: {
        auto: {
          visible: true,
          defaultEnabled: true,
        },
        inspiration: {
          visible: true,
          defaultEnabled: false,
        },
        creativeDesign: {
          visible: true,
          defaultEnabled: false,
        },
      },
    },
    managementPolicy: {
      allowBatchDelete: true,
      allowExportSessions: false,
      autoCleanupEnabled: false,
      emptySessionRetentionDays: 30,
      completedSessionRetentionDays: 180,
      failedSessionRetentionDays: 365,
      deleteCascadeRecords: true,
    },
  },
})

const normalizeConversationModeOptions = (value: unknown, fallback: SystemConversationModeOptionPayload[]) => {
  if (!Array.isArray(value)) {
    return fallback.map(option => ({ ...option }))
  }

  const options = value
    .map((item) => ({
      value: String((item as any)?.value || '').trim(),
      label: String((item as any)?.label || '').trim(),
    }))
    .filter(item => item.value && item.label)

  return options.length ? options : fallback.map(option => ({ ...option }))
}

const normalizeStringList = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) {
    return [...fallback]
  }

  const items = value
    .map(item => String(item || '').trim())
    .filter(Boolean)

  return items.length ? Array.from(new Set(items)) : [...fallback]
}

export const createDefaultConversationSettings = () => createDefaultSystemConfig().conversationSettings

export const normalizeConversationSettings = (input?: SystemConversationSettingsPayload | null) => {
  const defaults = createDefaultConversationSettings()
  const basicRules = readPlainObject(input?.basicRules)
  const listDisplay = readPlainObject(input?.listDisplay)
  const entryDisplay = readPlainObject(input?.entryDisplay)
  const hero = readPlainObject(entryDisplay.hero)
  const inputSettings = readPlainObject(entryDisplay.input)
  const mode = readPlainObject(entryDisplay.mode)
  const modelSelector = readPlainObject(entryDisplay.modelSelector)
  const assistantSelector = readPlainObject(entryDisplay.assistantSelector)
  const actions = readPlainObject(entryDisplay.actions)
  const actionAuto = readPlainObject(actions.auto)
  const actionInspiration = readPlainObject(actions.inspiration)
  const actionCreativeDesign = readPlainObject(actions.creativeDesign)
  const managementPolicy = readPlainObject(input?.managementPolicy)

  return {
    basicRules: {
      defaultSessionTitle: String(basicRules.defaultSessionTitle || defaults.basicRules.defaultSessionTitle).trim(),
      newSessionTitlePrefix: String(basicRules.newSessionTitlePrefix || defaults.basicRules.newSessionTitlePrefix).trim(),
      sessionTitleMaxLength: Number.isFinite(Number(basicRules.sessionTitleMaxLength))
        ? Math.max(1, Math.min(200, Number(basicRules.sessionTitleMaxLength)))
        : defaults.basicRules.sessionTitleMaxLength,
      defaultSortMode: String(basicRules.defaultSortMode || defaults.basicRules.defaultSortMode).trim() || defaults.basicRules.defaultSortMode,
      allowDeleteDefaultSession: basicRules.allowDeleteDefaultSession === true,
      allowAdminRename: basicRules.allowAdminRename !== false,
      allowAdminDelete: basicRules.allowAdminDelete !== false,
    },
    listDisplay: {
      defaultPageSize: Number.isFinite(Number(listDisplay.defaultPageSize))
        ? Math.max(1, Math.min(100, Number(listDisplay.defaultPageSize)))
        : defaults.listDisplay.defaultPageSize,
      showUserInfo: listDisplay.showUserInfo !== false,
      showCoverImage: listDisplay.showCoverImage !== false,
      showLatestPrompt: listDisplay.showLatestPrompt !== false,
      showStatusStats: listDisplay.showStatusStats !== false,
      showSessionId: listDisplay.showSessionId !== false,
      showLastRecordTime: listDisplay.showLastRecordTime !== false,
      enableUserMasking: listDisplay.enableUserMasking === true,
    },
    entryDisplay: {
      hero: {
        enabled: hero.enabled !== false,
        title: String(hero.title || defaults.entryDisplay.hero.title).trim(),
        subtitle: String(hero.subtitle || '').trim(),
      },
      input: {
        placeholder: String(inputSettings.placeholder || defaults.entryDisplay.input.placeholder).trim(),
        autoResize: inputSettings.autoResize !== false,
        minRows: Number.isFinite(Number(inputSettings.minRows))
          ? Math.max(1, Math.min(12, Number(inputSettings.minRows)))
          : defaults.entryDisplay.input.minRows,
        maxWidth: Number.isFinite(Number(inputSettings.maxWidth))
          ? Math.max(320, Math.min(1600, Number(inputSettings.maxWidth)))
          : defaults.entryDisplay.input.maxWidth,
      },
      mode: {
        enabled: mode.enabled !== false,
        defaultMode: String(mode.defaultMode || defaults.entryDisplay.mode.defaultMode).trim(),
        options: normalizeConversationModeOptions(mode.options, defaults.entryDisplay.mode.options),
      },
      modelSelector: {
        enabled: modelSelector.enabled !== false,
        defaultModelKey: String(modelSelector.defaultModelKey || '').trim(),
        allowedModelKeys: normalizeStringList(modelSelector.allowedModelKeys, defaults.entryDisplay.modelSelector.allowedModelKeys),
        allowSkillOverride: modelSelector.allowSkillOverride !== false,
      },
      assistantSelector: {
        enabled: assistantSelector.enabled !== false,
        defaultAssistantKey: String(assistantSelector.defaultAssistantKey || defaults.entryDisplay.assistantSelector.defaultAssistantKey).trim(),
        allowedAssistantKeys: normalizeStringList(assistantSelector.allowedAssistantKeys, defaults.entryDisplay.assistantSelector.allowedAssistantKeys),
      },
      actions: {
        auto: {
          visible: actionAuto.visible !== false,
          defaultEnabled: actionAuto.defaultEnabled !== false,
        },
        inspiration: {
          visible: actionInspiration.visible !== false,
          defaultEnabled: actionInspiration.defaultEnabled === true,
        },
        creativeDesign: {
          visible: actionCreativeDesign.visible !== false,
          defaultEnabled: actionCreativeDesign.defaultEnabled === true,
        },
      },
    },
    managementPolicy: {
      allowBatchDelete: managementPolicy.allowBatchDelete !== false,
      allowExportSessions: managementPolicy.allowExportSessions === true,
      autoCleanupEnabled: managementPolicy.autoCleanupEnabled === true,
      emptySessionRetentionDays: Number.isFinite(Number(managementPolicy.emptySessionRetentionDays))
        ? Math.max(1, Math.min(3650, Number(managementPolicy.emptySessionRetentionDays)))
        : defaults.managementPolicy.emptySessionRetentionDays,
      completedSessionRetentionDays: Number.isFinite(Number(managementPolicy.completedSessionRetentionDays))
        ? Math.max(1, Math.min(3650, Number(managementPolicy.completedSessionRetentionDays)))
        : defaults.managementPolicy.completedSessionRetentionDays,
      failedSessionRetentionDays: Number.isFinite(Number(managementPolicy.failedSessionRetentionDays))
        ? Math.max(1, Math.min(3650, Number(managementPolicy.failedSessionRetentionDays)))
        : defaults.managementPolicy.failedSessionRetentionDays,
      deleteCascadeRecords: managementPolicy.deleteCascadeRecords !== false,
    },
  }
}

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
  const conversationSettings = normalizeConversationSettings(input?.conversationSettings || loginSettings.conversationSettings)
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
    conversationSettings,
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
    conversationSettings: readPlainObject(readPlainObject(row.login_settings_json).conversationSettings),
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
      conversationSettings: normalized.conversationSettings,
    }),
  )

  return normalized
}
