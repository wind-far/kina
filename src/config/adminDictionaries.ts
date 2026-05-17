export type AdminDictionaryTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface AdminDictionaryItem {
  label: string
  tone: AdminDictionaryTone
}

export const adminUserStatusDictionary = {
  ACTIVE: {
    label: '已激活',
    tone: 'success',
  },
  DISABLED: {
    label: '已禁用',
    tone: 'danger',
  },
  ANONYMOUS: {
    label: '匿名',
    tone: 'warning',
  },
} as const satisfies Record<string, AdminDictionaryItem>

export const adminUserRoleDictionary = {
  ADMIN: {
    label: '管理员',
    tone: 'info',
  },
  USER: {
    label: '普通用户',
    tone: 'neutral',
  },
} as const satisfies Record<string, AdminDictionaryItem>

export const adminGenerationStatusDictionary = {
  completed: {
    label: '已完成',
    tone: 'success',
  },
  failed: {
    label: '失败',
    tone: 'danger',
  },
  running: {
    label: '进行中',
    tone: 'warning',
  },
} as const satisfies Record<string, AdminDictionaryItem>

export const adminAssetPublishStatusDictionary = {
  published: {
    label: '已发布',
    tone: 'success',
  },
  draft: {
    label: '草稿',
    tone: 'warning',
  },
  pending: {
    label: '待审核',
    tone: 'warning',
  },
  unpublished: {
    label: '未发布',
    tone: 'warning',
  },
} as const satisfies Record<string, AdminDictionaryItem>

export const adminDictionaries = {
  userStatus: adminUserStatusDictionary,
  userRole: adminUserRoleDictionary,
  generationStatus: adminGenerationStatusDictionary,
  assetPublishStatus: adminAssetPublishStatusDictionary,
} as const

export type AdminDictionaryCategory = keyof typeof adminDictionaries

export const resolveAdminDictionaryItem = (
  category: AdminDictionaryCategory,
  value?: string | null,
): AdminDictionaryItem => {
  const dictionary = adminDictionaries[category] as Record<string, AdminDictionaryItem>
  const rawValue = String(value || '')
  const key = rawValue.toUpperCase()
  return dictionary[rawValue] || dictionary[key] || {
    label: value || '未知',
    tone: 'neutral',
  }
}
