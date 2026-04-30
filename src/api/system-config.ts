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

export interface ConversationModeOptionConfig {
  value: string
  label: string
}

export interface ConversationBasicRulesConfig {
  defaultSessionTitle: string
  newSessionTitlePrefix: string
  sessionTitleMaxLength: number
  defaultSortMode: string
  allowDeleteDefaultSession: boolean
  allowAdminRename: boolean
  allowAdminDelete: boolean
}

export interface ConversationListDisplayConfig {
  defaultPageSize: number
  showUserInfo: boolean
  showCoverImage: boolean
  showLatestPrompt: boolean
  showStatusStats: boolean
  showSessionId: boolean
  showLastRecordTime: boolean
  enableUserMasking: boolean
}

export interface ConversationEntryDisplayConfig {
  hero: {
    enabled: boolean
    title: string
    subtitle: string
  }
  input: {
    placeholder: string
    autoResize: boolean
    minRows: number
    maxWidth: number
  }
  mode: {
    enabled: boolean
    defaultMode: string
    options: ConversationModeOptionConfig[]
  }
  modelSelector: {
    enabled: boolean
    defaultModelKey: string
    allowedModelKeys: string[]
    allowSkillOverride: boolean
  }
  assistantSelector: {
    enabled: boolean
    defaultAssistantKey: string
    allowedAssistantKeys: string[]
  }
  actions: {
    auto: {
      visible: boolean
      defaultEnabled: boolean
    }
    inspiration: {
      visible: boolean
      defaultEnabled: boolean
    }
    creativeDesign: {
      visible: boolean
      defaultEnabled: boolean
    }
  }
}

export interface ConversationManagementPolicyConfig {
  allowBatchDelete: boolean
  allowExportSessions: boolean
  autoCleanupEnabled: boolean
  emptySessionRetentionDays: number
  completedSessionRetentionDays: number
  failedSessionRetentionDays: number
  deleteCascadeRecords: boolean
}

export interface ConversationSettingsConfig {
  basicRules: ConversationBasicRulesConfig
  listDisplay: ConversationListDisplayConfig
  entryDisplay: ConversationEntryDisplayConfig
  managementPolicy: ConversationManagementPolicyConfig
}

const DEFAULT_CREATION_MODE_OPTIONS: ConversationModeOptionConfig[] = [
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

export interface SystemGenerationProgressStageConfig {
  key: string
  label: string
  percent: number
  showPercent: boolean
  description: string
}

export interface SystemGenerationProgressSettingsConfig {
  enabled: boolean
  stages: SystemGenerationProgressStageConfig[]
}

export interface SystemConfigPayload {
  siteInfo: SystemSiteInfoConfig
  policySettings: SystemPolicyConfig
  loginSettings: SystemLoginSettingsConfig
  generationProgressSettings: SystemGenerationProgressSettingsConfig
  conversationSettings: ConversationSettingsConfig
}

// 创建默认会话配置，供前后台配置页面与公共设置复用。
export const createDefaultConversationSettings = (): ConversationSettingsConfig => ({
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
})

// 创建默认生成进度配置，供会话配置和系统设置复用。
export const createDefaultGenerationProgressSettings = (): SystemGenerationProgressSettingsConfig => ({
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
})

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
