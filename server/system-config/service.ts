import crypto from 'node:crypto'
import prisma from '../db/prisma'
import type {
  SystemConfigPayload,
  SystemConversationModeOptionPayload,
  SystemConversationSettingsPayload,
} from './shared'

const SYSTEM_CONFIG_CODES = {
  siteInfo: 'SITE_INFO',
  policySettings: 'POLICY_SETTINGS',
  loginSettings: 'LOGIN_SETTINGS',
  generationProgressSettings: 'GENERATION_PROGRESS_SETTINGS',
  conversationSettings: 'CONVERSATION_SETTINGS',
  globalThemeSettings: 'GLOBAL_THEME_SETTINGS',
  homeSideMenuSettings: 'HOME_SIDE_MENU_SETTINGS',
  homeLayoutSettings: 'HOME_LAYOUT_SETTINGS',
} as const

const SYSTEM_CONFIG_NAMES = {
  [SYSTEM_CONFIG_CODES.siteInfo]: '站点信息',
  [SYSTEM_CONFIG_CODES.policySettings]: '政策协议',
  [SYSTEM_CONFIG_CODES.loginSettings]: '登录设置',
  [SYSTEM_CONFIG_CODES.generationProgressSettings]: '生成进度设置',
  [SYSTEM_CONFIG_CODES.conversationSettings]: '会话设置',
  [SYSTEM_CONFIG_CODES.globalThemeSettings]: '全局主题',
  [SYSTEM_CONFIG_CODES.homeSideMenuSettings]: '首页左侧菜单',
  [SYSTEM_CONFIG_CODES.homeLayoutSettings]: '首页布局配置',
} as const

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

const DEFAULT_HOME_SIDE_MENU_ITEMS = [
  { key: 'logo', title: 'Logo', section: 'top', iconSource: 'default', iconType: 'system', icon: 'logo', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'route', actionValue: '/', sortOrder: 10 },
  { key: 'home', title: '灵感', section: 'center', iconSource: 'default', iconType: 'system', icon: 'home', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'route', actionValue: '/', sortOrder: 10 },
  { key: 'generate', title: '生成', section: 'center', iconSource: 'default', iconType: 'system', icon: 'generate', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'primary', actionType: 'route', actionValue: '/generate', sortOrder: 20 },
  { key: 'asset', title: '资产', section: 'center', iconSource: 'default', iconType: 'system', icon: 'asset', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'route', actionValue: '/asset', sortOrder: 30 },
  { key: 'workflow', title: '工作流', section: 'center', iconSource: 'default', iconType: 'system', icon: 'workflow', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'route', actionValue: '/workflow', sortOrder: 40 },
  { key: 'account', title: '账号', section: 'center', iconSource: 'default', iconType: 'system', icon: 'account', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'route', actionValue: '/account', sortOrder: 50 },
  { key: 'publish', title: '发布', section: 'center', iconSource: 'default', iconType: 'system', icon: 'publish', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'route', actionValue: '/publish', sortOrder: 60 },
  { key: 'marketing', title: '福利', section: 'bottom', iconSource: 'default', iconType: 'system', icon: 'marketing', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'dialog', actionValue: 'marketing', sortOrder: 10 },
  { key: 'account-entry', title: '登录', section: 'bottom', iconSource: 'default', iconType: 'system', icon: 'account', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'dialog', actionValue: 'login', sortOrder: 20 },
  { key: 'notification', title: '通知', section: 'bottom', iconSource: 'default', iconType: 'system', icon: 'notification', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'none', actionValue: '', sortOrder: 30 },
  { key: 'app-download', title: 'APP下载', section: 'bottom', iconSource: 'default', iconType: 'system', icon: 'app-download', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'none', actionValue: '', sortOrder: 40 },
  { key: 'api-entry', title: 'API', section: 'bottom', iconSource: 'default', iconType: 'system', icon: 'api-entry', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'none', actionValue: '', sortOrder: 50 },
  { key: 'settings', title: '设置', section: 'bottom', iconSource: 'default', iconType: 'system', icon: 'settings', inactiveIconUrl: '', activeIconUrl: '', visible: true, badgeText: '', badgeTone: 'default', actionType: 'none', actionValue: '', sortOrder: 60 },
] as const

const DEFAULT_HOME_BANNER_ITEMS = [
  { key: 'motion', title: '动作模仿', subtitle: '响应更灵动', imageSource: 'default', presetKey: 'motion', imageUrl: '', backgroundImageUrl: '', mainImageUrl: '', overlayImageUrl: '', glowColor: '#2FE3FF', actionType: 'route', actionValue: '/generate?type=motion', visible: true, sortOrder: 10 },
  { key: 'image', title: '图片生成', subtitle: '智能美学提升', imageSource: 'default', presetKey: 'image', imageUrl: '', backgroundImageUrl: '', mainImageUrl: '', overlayImageUrl: '', glowColor: '#00B1CC', actionType: 'route', actionValue: '/generate?type=image', visible: true, sortOrder: 20 },
  { key: 'video', title: '视频生成', subtitle: '支持音画同出', imageSource: 'default', presetKey: 'video', imageUrl: '', backgroundImageUrl: '', mainImageUrl: '', overlayImageUrl: '', glowColor: '#2197FF', actionType: 'route', actionValue: '/generate?type=video', visible: true, sortOrder: 30 },
  { key: 'digital-human', title: '数字人', subtitle: '轻松生成数字分身', imageSource: 'default', presetKey: 'digital-human', imageUrl: '', backgroundImageUrl: '', mainImageUrl: '', overlayImageUrl: '', glowColor: '#9B6BFF', actionType: 'route', actionValue: '/generate?type=digital-human', visible: true, sortOrder: 40 },
  { key: 'agent', title: 'Agent 模式', subtitle: '多步骤智能创作', imageSource: 'default', presetKey: 'agent', imageUrl: '', backgroundImageUrl: '', mainImageUrl: '', overlayImageUrl: '', glowColor: '#FFD057', actionType: 'route', actionValue: '/generate?type=agent', visible: true, sortOrder: 50 },
] as const

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
  globalThemeSettings: {
    modePolicy: {
      allowUserToggle: true,
      defaultMode: 'dark',
      supportSystemMode: true,
    },
    brandColors: {
      primary: '#6f35ff',
      primaryHover: '#5b28e6',
      primaryActive: '#4c20c4',
      secondary: '#00c2d6',
      accent: '#ff7a59',
      success: '#18b566',
      warning: '#ffb020',
      danger: '#f04438',
    },
    gradients: {
      primaryGradient: 'linear-gradient(135deg, #6f35ff 0%, #ff7a59 100%)',
      bannerGlow: '#2FE3FF',
    },
    surfaces: {
      contentMaxWidth: 1440,
      cardRadius: 20,
    },
  },
  homeSideMenuSettings: {
    enabled: true,
    collapsedWidth: 76,
    drawerWidth: 440,
    drawerFloatLimitWidth: 1280,
    showTopMenu: true,
    showCenterMenu: true,
    showBottomMenu: true,
    items: DEFAULT_HOME_SIDE_MENU_ITEMS.map(item => ({ ...item })),
  },
  homeLayoutSettings: {
    header: {
      showSiteDescription: true,
      showTaskIndicator: true,
      showBanner: true,
    },
    banner: {
      enabled: true,
      items: DEFAULT_HOME_BANNER_ITEMS.map(item => ({ ...item })),
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

const normalizeHexColor = (value: unknown, fallback: string) => {
  const normalized = String(value || '').trim()
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized)) {
    return normalized
  }
  return fallback
}

const normalizeSideMenuItems = (value: unknown, fallback: Array<Record<string, any>>) => {
  if (!Array.isArray(value)) {
    return fallback.map(item => ({ ...item }))
  }

  const normalized = value
    .map((item, index) => {
      const nextItem = readPlainObject(item)
      const key = String(nextItem.key || '').trim()
      if (!key) {
        return null
      }

      const matchedFallback = fallback.find(fallbackItem => fallbackItem.key === key)
      const defaultItem = matchedFallback || fallback[Math.max(0, Math.min(index, fallback.length - 1))]

      return {
        key,
        title: String(nextItem.title || defaultItem?.title || key).trim(),
        section: String(nextItem.section || defaultItem?.section || 'center').trim(),
        iconSource: String(
          nextItem.iconSource
          || (nextItem.iconType === 'image' ? 'custom' : '')
          || defaultItem?.iconSource
          || 'default',
        ).trim(),
        iconType: String(
          nextItem.iconType
          || (nextItem.iconSource === 'custom' ? 'image' : '')
          || defaultItem?.iconType
          || 'system',
        ).trim(),
        icon: String(nextItem.icon || defaultItem?.icon || key).trim(),
        inactiveIconUrl: String(nextItem.inactiveIconUrl || defaultItem?.inactiveIconUrl || '').trim(),
        activeIconUrl: String(nextItem.activeIconUrl || defaultItem?.activeIconUrl || '').trim(),
        visible: nextItem.visible !== false,
        badgeText: String(nextItem.badgeText || '').trim(),
        badgeTone: String(nextItem.badgeTone || defaultItem?.badgeTone || 'default').trim(),
        actionType: String(nextItem.actionType || defaultItem?.actionType || 'none').trim(),
        actionValue: String(nextItem.actionValue || defaultItem?.actionValue || '').trim(),
        sortOrder: Number.isFinite(Number(nextItem.sortOrder))
          ? Math.max(0, Math.min(9999, Number(nextItem.sortOrder)))
          : Number(defaultItem?.sortOrder || (index + 1) * 10),
      }
    })
    .filter(Boolean)

  return normalized.length ? normalized : fallback.map(item => ({ ...item }))
}

const normalizeHomeBannerItems = (value: unknown, fallback: Array<Record<string, any>>) => {
  if (!Array.isArray(value)) {
    return fallback.map(item => ({ ...item }))
  }

  const normalized = value
    .map((item, index) => {
      const nextItem = readPlainObject(item)
      const key = String(nextItem.key || '').trim()
      if (!key) {
        return null
      }

      const matchedFallback = fallback.find(fallbackItem => fallbackItem.key === key)
      const defaultItem = matchedFallback || fallback[Math.max(0, Math.min(index, fallback.length - 1))]

      return {
        key,
        title: String(nextItem.title || defaultItem?.title || key).trim(),
        subtitle: String(nextItem.subtitle || defaultItem?.subtitle || '').trim(),
        imageSource: (
          nextItem.imageSource === 'custom'
            ? 'custom'
            : nextItem.imageSource === 'default'
              ? 'default'
              : String(defaultItem?.imageSource || 'default')
        ) as 'default' | 'custom',
        presetKey: String(nextItem.presetKey || defaultItem?.presetKey || key).trim(),
        imageUrl: String(nextItem.imageUrl || defaultItem?.imageUrl || '').trim(),
        backgroundImageUrl: String(nextItem.backgroundImageUrl || defaultItem?.backgroundImageUrl || '').trim(),
        mainImageUrl: String(nextItem.mainImageUrl || defaultItem?.mainImageUrl || '').trim(),
        overlayImageUrl: String(nextItem.overlayImageUrl || defaultItem?.overlayImageUrl || '').trim(),
        glowColor: normalizeHexColor(nextItem.glowColor, String(defaultItem?.glowColor || '#2FE3FF')),
        actionType: String(nextItem.actionType || defaultItem?.actionType || 'none').trim(),
        actionValue: String(nextItem.actionValue || defaultItem?.actionValue || '').trim(),
        visible: nextItem.visible !== false,
        sortOrder: Number.isFinite(Number(nextItem.sortOrder))
          ? Math.max(0, Math.min(9999, Number(nextItem.sortOrder)))
          : Number(defaultItem?.sortOrder || (index + 1) * 10),
      }
    })
    .filter(Boolean)

  return normalized.length ? normalized : fallback.map(item => ({ ...item }))
}

export const createDefaultConversationSettings = () => createDefaultSystemConfig().conversationSettings
export const getDefaultGenerationProgressSettings = () => createDefaultSystemConfig().generationProgressSettings

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
  const globalThemeSettings = readPlainObject(input?.globalThemeSettings)
  const globalThemeModePolicy = readPlainObject(globalThemeSettings.modePolicy)
  const globalThemeBrandColors = readPlainObject(globalThemeSettings.brandColors)
  const globalThemeGradients = readPlainObject(globalThemeSettings.gradients)
  const globalThemeSurfaces = readPlainObject(globalThemeSettings.surfaces)
  const homeSideMenuSettings = readPlainObject(input?.homeSideMenuSettings)
  const homeLayoutSettings = readPlainObject(input?.homeLayoutSettings)
  const homeLayoutHeaderSettings = readPlainObject(homeLayoutSettings.header)
  const homeLayoutBannerSettings = readPlainObject(homeLayoutSettings.banner)
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
    globalThemeSettings: {
      modePolicy: {
        allowUserToggle: globalThemeModePolicy.allowUserToggle !== false,
        defaultMode: globalThemeModePolicy.defaultMode === 'light' || globalThemeModePolicy.defaultMode === 'system'
          ? globalThemeModePolicy.defaultMode
          : 'dark',
        supportSystemMode: globalThemeModePolicy.supportSystemMode !== false,
      },
      brandColors: {
        primary: normalizeHexColor(globalThemeBrandColors.primary, defaults.globalThemeSettings.brandColors.primary),
        primaryHover: normalizeHexColor(globalThemeBrandColors.primaryHover, defaults.globalThemeSettings.brandColors.primaryHover),
        primaryActive: normalizeHexColor(globalThemeBrandColors.primaryActive, defaults.globalThemeSettings.brandColors.primaryActive),
        secondary: normalizeHexColor(globalThemeBrandColors.secondary, defaults.globalThemeSettings.brandColors.secondary),
        accent: normalizeHexColor(globalThemeBrandColors.accent, defaults.globalThemeSettings.brandColors.accent),
        success: normalizeHexColor(globalThemeBrandColors.success, defaults.globalThemeSettings.brandColors.success),
        warning: normalizeHexColor(globalThemeBrandColors.warning, defaults.globalThemeSettings.brandColors.warning),
        danger: normalizeHexColor(globalThemeBrandColors.danger, defaults.globalThemeSettings.brandColors.danger),
      },
      gradients: {
        primaryGradient: String(globalThemeGradients.primaryGradient || defaults.globalThemeSettings.gradients.primaryGradient).trim(),
        bannerGlow: normalizeHexColor(globalThemeGradients.bannerGlow, defaults.globalThemeSettings.gradients.bannerGlow),
      },
      surfaces: {
        contentMaxWidth: Number.isFinite(Number(globalThemeSurfaces.contentMaxWidth))
          ? Math.max(960, Math.min(1920, Number(globalThemeSurfaces.contentMaxWidth)))
          : defaults.globalThemeSettings.surfaces.contentMaxWidth,
        cardRadius: Number.isFinite(Number(globalThemeSurfaces.cardRadius))
          ? Math.max(0, Math.min(48, Number(globalThemeSurfaces.cardRadius)))
          : defaults.globalThemeSettings.surfaces.cardRadius,
      },
    },
    homeSideMenuSettings: {
      enabled: homeSideMenuSettings.enabled !== false,
      collapsedWidth: Number.isFinite(Number(homeSideMenuSettings.collapsedWidth))
        ? Math.max(48, Math.min(180, Number(homeSideMenuSettings.collapsedWidth)))
        : defaults.homeSideMenuSettings.collapsedWidth,
      drawerWidth: Number.isFinite(Number(homeSideMenuSettings.drawerWidth))
        ? Math.max(280, Math.min(960, Number(homeSideMenuSettings.drawerWidth)))
        : defaults.homeSideMenuSettings.drawerWidth,
      drawerFloatLimitWidth: Number.isFinite(Number(homeSideMenuSettings.drawerFloatLimitWidth))
        ? Math.max(960, Math.min(2560, Number(homeSideMenuSettings.drawerFloatLimitWidth)))
        : defaults.homeSideMenuSettings.drawerFloatLimitWidth,
      showTopMenu: homeSideMenuSettings.showTopMenu !== false,
      showCenterMenu: homeSideMenuSettings.showCenterMenu !== false,
      showBottomMenu: homeSideMenuSettings.showBottomMenu !== false,
      items: normalizeSideMenuItems(homeSideMenuSettings.items, defaults.homeSideMenuSettings.items),
    },
    homeLayoutSettings: {
      header: {
        showSiteDescription: homeLayoutHeaderSettings.showSiteDescription !== false,
        showTaskIndicator: homeLayoutHeaderSettings.showTaskIndicator !== false,
        showBanner: homeLayoutHeaderSettings.showBanner !== false,
      },
      banner: {
        enabled: homeLayoutBannerSettings.enabled !== false,
        items: normalizeHomeBannerItems(homeLayoutBannerSettings.items, defaults.homeLayoutSettings.banner.items),
      },
    },
  }
}

const listSystemConfigRows = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT * FROM system_settings',
  )

  return Array.isArray(rows) ? rows : []
}

const buildSystemConfigRowMap = (rows: any[]) => {
  return rows.reduce<Map<string, any>>((map, row) => {
    const code = String(row?.code || '').trim()
    if (code) {
      map.set(code, row)
    }
    return map
  }, new Map())
}

type RawExecutor = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: any[]) => Promise<T>
  $executeRawUnsafe: (query: string, ...values: any[]) => Promise<number>
}

const upsertSystemConfigItem = async (executor: RawExecutor, code: string, config: unknown) => {
  const rows = await executor.$queryRawUnsafe<any[]>(
    'SELECT id FROM system_settings WHERE code = ? LIMIT 1',
    code,
  )
  const existingRow = Array.isArray(rows) && rows[0] ? rows[0] : null
  const rowId = existingRow?.id ? String(existingRow.id) : crypto.randomUUID()
  const name = SYSTEM_CONFIG_NAMES[code as keyof typeof SYSTEM_CONFIG_NAMES] || code

  await executor.$executeRawUnsafe(
    `INSERT INTO system_settings (
      id,
      code,
      name,
      config_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      config_json = VALUES(config_json),
      updated_at = NOW()`,
    rowId,
    code,
    name,
    JSON.stringify(config ?? null),
  )
}

// 读取后台系统设置。
export const getAdminSystemConfig = async () => {
  const rows = await listSystemConfigRows()
  if (!rows.length) {
    return createDefaultSystemConfig()
  }

  const rowMap = buildSystemConfigRowMap(rows)
  return normalizeSystemConfig({
    siteInfo: readPlainObject(rowMap.get(SYSTEM_CONFIG_CODES.siteInfo)?.config_json),
    policySettings: readPlainObject(rowMap.get(SYSTEM_CONFIG_CODES.policySettings)?.config_json),
    loginSettings: readPlainObject(rowMap.get(SYSTEM_CONFIG_CODES.loginSettings)?.config_json),
    generationProgressSettings: readPlainObject(rowMap.get(SYSTEM_CONFIG_CODES.generationProgressSettings)?.config_json),
    conversationSettings: readPlainObject(rowMap.get(SYSTEM_CONFIG_CODES.conversationSettings)?.config_json),
    globalThemeSettings: readPlainObject(rowMap.get(SYSTEM_CONFIG_CODES.globalThemeSettings)?.config_json),
    homeSideMenuSettings: readPlainObject(rowMap.get(SYSTEM_CONFIG_CODES.homeSideMenuSettings)?.config_json),
    homeLayoutSettings: readPlainObject(rowMap.get(SYSTEM_CONFIG_CODES.homeLayoutSettings)?.config_json),
  })
}

// 读取前台可见系统设置。
export const getPublicSystemConfig = async () => {
  return getAdminSystemConfig()
}

// 保存后台系统设置。
export const saveAdminSystemConfig = async (payload: SystemConfigPayload) => {
  const normalized = normalizeSystemConfig(payload)

  await prisma.$transaction(async (tx) => {
    await upsertSystemConfigItem(tx, SYSTEM_CONFIG_CODES.siteInfo, normalized.siteInfo)
    await upsertSystemConfigItem(tx, SYSTEM_CONFIG_CODES.policySettings, normalized.policySettings)
    await upsertSystemConfigItem(tx, SYSTEM_CONFIG_CODES.loginSettings, normalized.loginSettings)
    await upsertSystemConfigItem(tx, SYSTEM_CONFIG_CODES.generationProgressSettings, normalized.generationProgressSettings)
    await upsertSystemConfigItem(tx, SYSTEM_CONFIG_CODES.conversationSettings, normalized.conversationSettings)
    await upsertSystemConfigItem(tx, SYSTEM_CONFIG_CODES.globalThemeSettings, normalized.globalThemeSettings)
    await upsertSystemConfigItem(tx, SYSTEM_CONFIG_CODES.homeSideMenuSettings, normalized.homeSideMenuSettings)
    await upsertSystemConfigItem(tx, SYSTEM_CONFIG_CODES.homeLayoutSettings, normalized.homeLayoutSettings)
  })

  return normalized
}
