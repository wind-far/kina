/**
 * 跨画布、Agent 与服务端任务共享的 Skill 运行时协议。
 * 这里不暴露任何厂商字段；厂商差异由服务端 Provider Adapter 处理。
 */

export type SkillMediaType = 'image' | 'video' | 'audio'

export type SkillMediaRole =
  | 'reference'
  | 'first_frame'
  | 'last_frame'
  | 'subject'
  | 'style'
  | 'video_reference'
  | 'audio_reference'
  | 'base_video'

export interface SkillMediaReference {
  id?: string
  mediaType: SkillMediaType
  role: SkillMediaRole
  url: string
  sourceNodeId?: string
  label?: string
  startSeconds?: number
  endSeconds?: number
  mimeType?: string
}

export type SkillCapability =
  | 'text_planning'
  | 'image_generation'
  | 'video_generation'
  | 'audio_generation'
  | 'speech_synthesis'
  | 'media_composition'
  | 'web_research'
  | 'asset_analysis'

export interface SkillExecutionStep {
  key: string
  label: string
  capability: SkillCapability
  requiresConfirmation?: boolean
  optional?: boolean
}

export interface SkillExecutionPlan {
  skillKey: string
  workflowType: string
  steps: SkillExecutionStep[]
  mediaReferences: SkillMediaReference[]
  params: Record<string, unknown>
}

export const normalizeSkillMediaReferences = (input: unknown): SkillMediaReference[] => {
  if (!Array.isArray(input)) return []
  const allowedTypes = new Set<SkillMediaType>(['image', 'video', 'audio'])
  const allowedRoles = new Set<SkillMediaRole>([
    'reference', 'first_frame', 'last_frame', 'subject', 'style',
    'video_reference', 'audio_reference', 'base_video',
  ])
  return input.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const raw = item as Record<string, unknown>
    const mediaType = String(raw.mediaType || '').trim() as SkillMediaType
    const url = String(raw.url || '').trim()
    if (!allowedTypes.has(mediaType) || !url) return []
    const requestedRole = String(raw.role || '').trim() as SkillMediaRole
    const role = allowedRoles.has(requestedRole) ? requestedRole : 'reference'
    const toSeconds = (value: unknown) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
    }
    return [{
      id: String(raw.id || `media-${index + 1}`).trim() || `media-${index + 1}`,
      mediaType,
      role,
      url,
      sourceNodeId: String(raw.sourceNodeId || '').trim() || undefined,
      label: String(raw.label || '').trim() || undefined,
      startSeconds: toSeconds(raw.startSeconds),
      endSeconds: toSeconds(raw.endSeconds),
      mimeType: String(raw.mimeType || '').trim() || undefined,
    }]
  })
}

/** 旧调用方仍传 referenceImages 时，统一转换为通用协议。 */
export const legacyImagesToSkillMediaReferences = (images: unknown): SkillMediaReference[] => {
  if (!Array.isArray(images)) return []
  return images
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .map((url, index) => ({
      id: `legacy-image-${index + 1}`,
      mediaType: 'image' as const,
      role: 'reference' as const,
      url,
    }))
}
